// ============================================================
// worker/src/routes/payments.js — bKash, Nagad, SSLCommerz, COD
// ============================================================
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { BkashService, SSLCommerzService } from '../services/payment.js';

const payments = new Hono();

// ── POST /api/payments/bkash/create ──────────────────────────
payments.post('/bkash/create', authenticate, async (c) => {
  try {
    const { orderId, amount } = await c.req.json();
    const bkash = new BkashService(c.env);
    const callbackURL = `${c.env.FRONTEND_URL}/payment/bkash/callback`;
    const result = await bkash.createPayment({ amount, orderId, callbackURL });
    await query(c.env,
      "INSERT INTO payments (order_id,method,amount,status,gateway_ref) VALUES ($1,'bkash',$2,'pending',$3)",
      [orderId, amount, result.paymentID]
    );
    return c.json({ success: true, data: result });
  } catch (e) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

// ── POST /api/payments/bkash/execute ─────────────────────────
payments.post('/bkash/execute', authenticate, async (c) => {
  try {
    const { paymentID, orderId } = await c.req.json();
    const bkash  = new BkashService(c.env);
    const result = await bkash.executePayment(paymentID);
    await query(c.env,
      "UPDATE payments SET status='paid',transaction_id=$1,paid_at=NOW(),gateway_payload=$2 WHERE gateway_ref=$3",
      [result.transactionId, JSON.stringify(result), paymentID]
    );
    await query(c.env,
      "UPDATE orders SET payment_status='paid',payment_ref=$1,status='confirmed' WHERE id=$2",
      [result.transactionId, orderId]
    );
    await query(c.env,
      "INSERT INTO order_status_history (order_id,status,note) VALUES ($1,'confirmed','Payment confirmed via bKash')",
      [orderId]
    );
    return c.json({ success: true, data: result });
  } catch (e) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

// ── POST /api/payments/sslcommerz/initiate ───────────────────
payments.post('/sslcommerz/initiate', authenticate, async (c) => {
  try {
    const { orderId } = await c.req.json();
    const { rows } = await query(c.env, 'SELECT * FROM orders WHERE id=$1 AND user_id=$2', [orderId, c.get('user').id]);
    if (!rows.length) return c.json({ success: false, message: 'Order not found' }, 404);
    const ssl    = new SSLCommerzService(c.env);
    const result = await ssl.initiatePayment({
      order: rows[0],
      customer: { name: c.get('user').name, phone: c.get('user').phone, email: c.get('user').email },
    });
    return c.json({ success: true, data: result });
  } catch (e) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

// ── POST /api/payments/sslcommerz/ipn (webhook) ──────────────
payments.post('/sslcommerz/ipn', async (c) => {
  try {
    const body     = await c.req.parseBody();
    const { val_id, tran_id, status } = body;
    if (status === 'VALID') {
      const ssl        = new SSLCommerzService(c.env);
      const validation = await ssl.validatePayment(val_id);
      if (validation.status === 'VALID') {
        await query(c.env,
          "UPDATE orders SET payment_status='paid',status='confirmed',payment_ref=$1 WHERE order_number=$2",
          [val_id, tran_id]
        );
      }
    }
    return new Response('OK', { status: 200 });
  } catch (e) {
    console.error('IPN error:', e);
    return new Response('Error', { status: 500 });
  }
});

// ── POST /api/payments/cod/confirm ───────────────────────────
payments.post('/cod/confirm', authenticate, async (c) => {
  const { orderId } = await c.req.json();
  await query(c.env,
    "UPDATE orders SET status='confirmed' WHERE id=$1 AND user_id=$2 AND payment_method='cod'",
    [orderId, c.get('user').id]
  );
  return c.json({ success: true, message: 'COD order confirmed' });
});

// ── POST /api/payments/refund (admin) ────────────────────────
payments.post('/refund', ...isAdmin, async (c) => {
  try {
    const { orderId, reason } = await c.req.json();
    const { rows } = await query(c.env, "SELECT * FROM payments WHERE order_id=$1 AND status='paid'", [orderId]);
    if (!rows.length) return c.json({ success: false, message: 'No paid payment found' }, 400);
    const payment = rows[0];
    let refundResult;
    if (payment.method === 'bkash') {
      const bkash = new BkashService(c.env);
      refundResult = await bkash.refund({
        paymentID: payment.gateway_ref, trxID: payment.transaction_id,
        amount: String(payment.amount), orderId, reason,
      });
    }
    await query(c.env, "UPDATE payments SET status='refunded' WHERE id=$1", [payment.id]);
    await query(c.env, "UPDATE orders SET payment_status='refunded',status='refunded' WHERE id=$1", [orderId]);
    return c.json({ success: true, message: 'Refund processed', data: refundResult });
  } catch (e) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

export default payments;
