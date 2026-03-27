// ============================================================
// worker/src/routes/payments.js — D1/SQLite version
// ============================================================
import { Hono } from 'hono';
import { query, uuid } from '../db.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { BkashService, SSLCommerzService } from '../services/payment.js';

const payments = new Hono();

payments.post('/bkash/create', authenticate, async (c) => {
  try {
    const { orderId, amount } = await c.req.json();
    const bkash = new BkashService(c.env);
    const callbackURL = `${c.env.FRONTEND_URL}/payment/bkash/callback`;
    const result = await bkash.createPayment({ amount, orderId, callbackURL });
    await query(c.env,
      "INSERT INTO payments (id,order_id,method,amount,status,gateway_ref) VALUES (?,?,'bkash',?,'pending',?)",
      [uuid(), orderId, amount, result.paymentID]
    );
    return c.json({ success: true, data: result });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

payments.post('/bkash/execute', authenticate, async (c) => {
  try {
    const { paymentID, orderId } = await c.req.json();
    const bkash  = new BkashService(c.env);
    const result = await bkash.executePayment(paymentID);
    await query(c.env,
      "UPDATE payments SET status='paid', transaction_id=?, paid_at=datetime('now'), gateway_payload=? WHERE gateway_ref=?",
      [result.transactionId, JSON.stringify(result), paymentID]
    );
    await query(c.env,
      "UPDATE orders SET payment_status='paid', payment_ref=?, status='confirmed' WHERE id=?",
      [result.transactionId, orderId]
    );
    await query(c.env,
      "INSERT INTO order_status_history (id,order_id,status,note) VALUES (?,?,'confirmed','Payment confirmed via bKash')",
      [uuid(), orderId]
    );
    return c.json({ success: true, data: result });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

payments.post('/sslcommerz/initiate', authenticate, async (c) => {
  try {
    const { orderId } = await c.req.json();
    const { rows } = await query(c.env, 'SELECT * FROM orders WHERE id=? AND user_id=?', [orderId, c.get('user').id]);
    if (!rows.length) return c.json({ success: false, message: 'Order not found' }, 404);
    const ssl    = new SSLCommerzService(c.env);
    const result = await ssl.initiatePayment({ order: rows[0], customer: c.get('user') });
    return c.json({ success: true, data: result });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

payments.post('/sslcommerz/ipn', async (c) => {
  try {
    const body = await c.req.parseBody();
    const { val_id, tran_id, status } = body;
    if (status === 'VALID') {
      const ssl        = new SSLCommerzService(c.env);
      const validation = await ssl.validatePayment(val_id);
      if (validation.status === 'VALID') {
        await query(c.env,
          "UPDATE orders SET payment_status='paid', status='confirmed', payment_ref=? WHERE order_number=?",
          [val_id, tran_id]
        );
      }
    }
    return new Response('OK', { status: 200 });
  } catch (e) { return new Response('Error', { status: 500 }); }
});

payments.post('/cod/confirm', authenticate, async (c) => {
  const { orderId } = await c.req.json();
  await query(c.env,
    "UPDATE orders SET status='confirmed' WHERE id=? AND user_id=? AND payment_method='cod'",
    [orderId, c.get('user').id]
  );
  return c.json({ success: true, message: 'COD order confirmed' });
});

payments.post('/refund', ...isAdmin, async (c) => {
  try {
    const { orderId, reason } = await c.req.json();
    const { rows } = await query(c.env, "SELECT * FROM payments WHERE order_id=? AND status='paid'", [orderId]);
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
    await query(c.env, "UPDATE payments SET status='refunded' WHERE id=?", [payment.id]);
    await query(c.env, "UPDATE orders SET payment_status='refunded', status='refunded' WHERE id=?", [orderId]);
    return c.json({ success: true, message: 'Refund processed', data: refundResult });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

export default payments;
