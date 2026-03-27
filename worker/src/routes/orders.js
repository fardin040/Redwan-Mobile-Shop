// ============================================================
// worker/src/routes/orders.js — D1/SQLite version
// Uses D1 batch() instead of PostgreSQL transactions
// ============================================================
import { Hono } from 'hono';
import { query, batch, uuid } from '../db.js';
import { authenticate, optionalAuth, isAdmin } from '../middleware/auth.js';
import { sendOrderConfirmationEmail } from '../services/email.js';
import { sendOrderStatusSMS } from '../services/sms.js';

const orders = new Hono();

const genOrderNumber = () =>
  `RM-${new Date().getFullYear()}-${String(Date.now()).slice(-6).padStart(6,'0')}`;

// ── POST /api/orders ──────────────────────────────────────────
orders.post('/', optionalAuth, async (c) => {
  try {
    const { items, shipping_address, delivery_method='standard',
            courier_name='steadfast', payment_method='cod',
            coupon_code, notes, guest_name, guest_phone, guest_email } = await c.req.json();

    if (!items?.length || !shipping_address)
      return c.json({ success: false, message: 'Items and shipping address required' }, 400);

    // ── Phase 1: READ — validate products ──
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const { rows } = await query(c.env,
        `SELECT p.id, p.name, p.price, p.sale_price, p.images, p.status,
                v.id AS variant_id, v.stock, v.color, v.storage, v.extra_price
         FROM products p LEFT JOIN product_variants v ON v.id = ?
         WHERE p.id = ?`,
        [item.variant_id||null, item.product_id]
      );
      if (!rows.length || rows[0].status !== 'published')
        return c.json({ success: false, message: `Product not available: ${item.product_id}` }, 400);

      const row = rows[0];
      if (row.stock !== null && row.stock < item.quantity)
        return c.json({ success: false, message: `Not enough stock for ${row.name}` }, 400);

      const unitPrice  = parseFloat(row.sale_price || row.price) + parseFloat(row.extra_price || 0);
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;
      orderItems.push({
        product_id: row.id, variant_id: row.variant_id||null, name: row.name,
        image_url: tryParse(row.images, [])?.[0] || null, color: row.color, storage: row.storage,
        quantity: item.quantity, unit_price: unitPrice, total_price: totalPrice,
      });
    }

    // ── Delivery charge ──
    const deliveryCharges = { same_day: 0, standard: 80, express: 150, pickup: 0 };
    let delivery_charge = deliveryCharges[delivery_method] ?? 80;
    if (subtotal >= 5000) delivery_charge = 0;

    // ── Coupon ──
    let discount_amount = 0;
    if (coupon_code) {
      const { rows: crows } = await query(c.env,
        `SELECT * FROM coupons WHERE code = ? AND is_active = 1
         AND (expires_at IS NULL OR expires_at > datetime('now'))
         AND (usage_limit IS NULL OR used_count < usage_limit)`,
        [coupon_code.toUpperCase()]
      );
      if (crows.length) {
        const coupon = crows[0];
        if (subtotal >= coupon.min_order) {
          if (coupon.type === 'percentage')
            discount_amount = Math.min(subtotal * coupon.value / 100, coupon.max_discount || Infinity);
          else if (coupon.type === 'flat') discount_amount = coupon.value;
          else if (coupon.type === 'free_shipping') delivery_charge = 0;
        }
      }
    }

    const vat_amount   = parseFloat(((subtotal - discount_amount) * 0.05).toFixed(2));
    const total_amount = parseFloat((subtotal - discount_amount + delivery_charge + vat_amount).toFixed(2));
    const deliveryDays = { same_day: 0, standard: 3, express: 1, pickup: 0 };
    const estimated    = new Date();
    estimated.setDate(estimated.getDate() + (deliveryDays[delivery_method] ?? 3));

    // ── Phase 2: BUILD batch statements ──
    const orderId      = uuid();
    const orderNumber  = genOrderNumber();
    const writes = [];

    // Insert order
    writes.push({
      sql: `INSERT INTO orders (id,order_number,user_id,guest_name,guest_phone,guest_email,
            subtotal,delivery_charge,discount_amount,vat_amount,total_amount,
            shipping_address,delivery_method,courier_name,coupon_code,payment_method,notes,estimated_delivery)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      params: [orderId, orderNumber, c.get('user')?.id||null, guest_name||null, guest_phone||null, guest_email||null,
               subtotal, delivery_charge, discount_amount, vat_amount, total_amount,
               JSON.stringify(shipping_address), delivery_method, courier_name, coupon_code||null,
               payment_method, notes||null, estimated.toISOString().split('T')[0]],
    });

    // Insert order items + stock updates
    for (const item of orderItems) {
      writes.push({
        sql: `INSERT INTO order_items (id,order_id,product_id,variant_id,name,image_url,color,storage,quantity,unit_price,total_price)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        params: [uuid(), orderId, item.product_id, item.variant_id, item.name, item.image_url,
                 item.color, item.storage, item.quantity, item.unit_price, item.total_price],
      });
      if (item.variant_id) {
        writes.push({ sql: 'UPDATE product_variants SET stock = stock - ? WHERE id = ?', params: [item.quantity, item.variant_id] });
        writes.push({ sql: "INSERT INTO inventory_logs (id,variant_id,change,reason,order_id) VALUES (?,?,?,'sale',?)",
          params: [uuid(), item.variant_id, -item.quantity, orderId] });
      }
      writes.push({ sql: 'UPDATE products SET total_sales = total_sales + ? WHERE id = ?', params: [item.quantity, item.product_id] });
    }

    // Coupon usage
    if (coupon_code) {
      writes.push({ sql: 'UPDATE coupons SET used_count = used_count + 1 WHERE code = ?', params: [coupon_code.toUpperCase()] });
    }

    // Status history
    writes.push({ sql: "INSERT INTO order_status_history (id,order_id,status,note) VALUES (?,?,'pending','Order placed')",
      params: [uuid(), orderId] });

    // ── Phase 3: Execute batch (atomic) ──
    await batch(c.env, writes);

    // ── Notifications (async) ──
    const email = c.get('user')?.email || guest_email;
    if (email) sendOrderConfirmationEmail(c.env, email, { order_number: orderNumber, total_amount, payment_method }).catch(console.error);
    const phone = c.get('user')?.phone || guest_phone;
    if (phone) sendOrderStatusSMS(c.env, phone, orderNumber, 'pending').catch(console.error);

    return c.json({ success: true, data: {
      order: { id: orderId, order_number: orderNumber, total_amount, status: 'pending', payment_method },
      items: orderItems,
    }}, 201);

  } catch (e) {
    console.error(e);
    return c.json({ success: false, message: e.message || 'Failed to place order' }, 500);
  }
});

// ── GET /api/orders ───────────────────────────────────────────
orders.get('/', authenticate, async (c) => {
  const { status, page='1', limit='10' } = c.req.query();
  const offset = (parseInt(page)-1)*parseInt(limit);
  const params = [c.get('user').id];
  let where = 'user_id = ?';
  if (status) { params.push(status); where += ' AND status = ?'; }

  const { rows: orderRows } = await query(c.env,
    `SELECT * FROM orders WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  // Fetch items for each order
  const result = await Promise.all(orderRows.map(async (o) => {
    const { rows: items } = await query(c.env,
      'SELECT name, quantity, unit_price, image_url FROM order_items WHERE order_id = ?', [o.id]);
    return { ...o, shipping_address: tryParse(o.shipping_address, {}), items };
  }));

  return c.json({ success: true, data: result });
});

// ── GET /api/orders/:id ───────────────────────────────────────
orders.get('/:id', authenticate, async (c) => {
  const user = c.get('user');
  const { rows } = await query(c.env,
    `SELECT * FROM orders WHERE id = ? AND (user_id = ? OR ? IN ('admin','superadmin'))`,
    [c.req.param('id'), user.id, user.role]
  );
  if (!rows.length) return c.json({ success: false, message: 'Order not found' }, 404);
  const order = { ...rows[0], shipping_address: tryParse(rows[0].shipping_address, {}) };

  const [items, history] = await Promise.all([
    query(c.env, 'SELECT * FROM order_items WHERE order_id = ?', [c.req.param('id')]),
    query(c.env, 'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC', [c.req.param('id')]),
  ]);
  return c.json({ success: true, data: { ...order, items: items.rows, history: history.rows } });
});

// ── PUT /api/orders/:id/status (admin) ───────────────────────
orders.put('/:id/status', ...isAdmin, async (c) => {
  const { status, note, tracking_id } = await c.req.json();
  const allowed = ['confirmed','processing','packed','shipped','delivered','cancelled','refunded'];
  if (!allowed.includes(status))
    return c.json({ success: false, message: 'Invalid status' }, 400);

  const deliveredAt = status === 'delivered' ? `datetime('now')` : null;
  const { rows } = await query(c.env,
    `UPDATE orders SET status = ?, tracking_id = COALESCE(?, tracking_id),
       delivered_at = CASE WHEN ? = 'delivered' THEN datetime('now') ELSE delivered_at END,
       updated_at = datetime('now') WHERE id = ? RETURNING *`,
    [status, tracking_id||null, status, c.req.param('id')]
  );
  if (!rows.length) return c.json({ success: false, message: 'Order not found' }, 404);

  await query(c.env,
    'INSERT INTO order_status_history (id,order_id,status,note,done_by) VALUES (?,?,?,?,?)',
    [uuid(), c.req.param('id'), status, note||null, c.get('user').id]
  );

  const order = rows[0];
  if (order.user_id) {
    const { rows: urows } = await query(c.env, 'SELECT phone FROM users WHERE id = ?', [order.user_id]);
    if (urows[0]?.phone)
      sendOrderStatusSMS(c.env, urows[0].phone, order.order_number, status).catch(console.error);
  }
  return c.json({ success: true, data: rows[0] });
});

// ── POST /api/orders/:id/cancel ───────────────────────────────
orders.post('/:id/cancel', authenticate, async (c) => {
  const { rows } = await query(c.env,
    "SELECT * FROM orders WHERE id = ? AND user_id = ? AND status IN ('pending','confirmed')",
    [c.req.param('id'), c.get('user').id]
  );
  if (!rows.length) return c.json({ success: false, message: 'Order cannot be cancelled' }, 400);
  const { reason = 'Cancelled by customer' } = await c.req.json().catch(() => ({}));

  const { rows: items } = await query(c.env, 'SELECT * FROM order_items WHERE order_id = ?', [c.req.param('id')]);
  const writes = [
    { sql: "UPDATE orders SET status='cancelled', cancelled_at=datetime('now'), cancel_reason=? WHERE id=?", params: [reason, c.req.param('id')] },
    { sql: "INSERT INTO order_status_history (id,order_id,status,note) VALUES (?,?,'cancelled',?)", params: [uuid(), c.req.param('id'), reason] },
  ];
  for (const item of items) {
    if (item.variant_id) {
      writes.push({ sql: 'UPDATE product_variants SET stock = stock + ? WHERE id = ?', params: [item.quantity, item.variant_id] });
      writes.push({ sql: "INSERT INTO inventory_logs (id,variant_id,change,reason,order_id) VALUES (?,?,?,'return',?)",
        params: [uuid(), item.variant_id, item.quantity, c.req.param('id')] });
    }
    writes.push({ sql: 'UPDATE products SET total_sales = total_sales - ? WHERE id = ?', params: [item.quantity, item.product_id] });
  }
  await batch(c.env, writes);
  return c.json({ success: true, message: 'Order cancelled successfully' });
});

const tryParse = (val, fallback) => { try { return JSON.parse(val); } catch { return fallback; } };
export default orders;
