// ============================================================
// worker/src/routes/orders.js
// ============================================================
import { Hono } from 'hono';
import { query, getClient } from '../db.js';
import { authenticate, optionalAuth, isAdmin } from '../middleware/auth.js';
import { sendOrderConfirmationEmail } from '../services/email.js';
import { sendOrderStatusSMS } from '../services/sms.js';

const orders = new Hono();

const genOrderNumber = () =>
  `RM-${new Date().getFullYear()}-${String(Date.now()).slice(-6).padStart(6,'0')}`;

// ── POST /api/orders ──────────────────────────────────────────
orders.post('/', optionalAuth, async (c) => {
  const client = await getClient(c.env);
  try {
    await client.query('BEGIN');
    const { items, shipping_address, delivery_method='standard',
            courier_name='steadfast', payment_method='cod',
            coupon_code, notes, guest_name, guest_phone, guest_email } = await c.req.json();

    if (!items?.length || !shipping_address)
      return c.json({ success: false, message: 'Items and shipping address required' }, 400);

    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const { rows } = await client.query(
        `SELECT p.id,p.name,p.price,p.sale_price,p.images,p.status,
                v.id AS variant_id,v.stock,v.color,v.storage,v.extra_price
         FROM products p LEFT JOIN product_variants v ON v.id=$2
         WHERE p.id=$1`,
        [item.product_id, item.variant_id||null]
      );
      if (!rows.length || rows[0].status !== 'published')
        throw new Error(`Product not available: ${item.product_id}`);

      const row = rows[0];
      if (row.stock !== null && row.stock < item.quantity)
        throw new Error(`Not enough stock for ${row.name}`);

      const unitPrice  = parseFloat(row.sale_price||row.price) + parseFloat(row.extra_price||0);
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;
      orderItems.push({ product_id:row.id, variant_id:row.variant_id||null,
        name:row.name, image_url:row.images?.[0]||null, color:row.color, storage:row.storage,
        quantity:item.quantity, unit_price:unitPrice, total_price:totalPrice });
    }

    const deliveryCharges = { same_day:0, standard:80, express:150, pickup:0 };
    let delivery_charge = deliveryCharges[delivery_method]??80;
    if (subtotal >= 5000) delivery_charge = 0;

    let discount_amount = 0;
    if (coupon_code) {
      const { rows: crows } = await client.query(
        `SELECT * FROM coupons WHERE code=$1 AND is_active=TRUE
         AND (expires_at IS NULL OR expires_at>NOW())
         AND (usage_limit IS NULL OR used_count<usage_limit)`,
        [coupon_code.toUpperCase()]
      );
      if (crows.length) {
        const coupon = crows[0];
        if (subtotal >= coupon.min_order) {
          if (coupon.type === 'percentage')
            discount_amount = Math.min(subtotal * coupon.value/100, coupon.max_discount||Infinity);
          else if (coupon.type === 'flat')
            discount_amount = coupon.value;
          else if (coupon.type === 'free_shipping')
            delivery_charge = 0;
        }
        await client.query('UPDATE coupons SET used_count=used_count+1 WHERE id=$1', [coupon.id]);
      }
    }

    const vat_amount   = parseFloat(((subtotal-discount_amount)*0.05).toFixed(2));
    const total_amount = parseFloat((subtotal-discount_amount+delivery_charge+vat_amount).toFixed(2));

    const deliveryDays = { same_day:0, standard:3, express:1, pickup:0 };
    const estimated    = new Date();
    estimated.setDate(estimated.getDate() + (deliveryDays[delivery_method]??3));

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders
         (order_number,user_id,guest_name,guest_phone,guest_email,subtotal,
          delivery_charge,discount_amount,vat_amount,total_amount,
          shipping_address,delivery_method,courier_name,coupon_code,
          payment_method,notes,estimated_delivery)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [genOrderNumber(), c.get('user')?.id||null, guest_name||null, guest_phone||null, guest_email||null,
       subtotal, delivery_charge, discount_amount, vat_amount, total_amount,
       JSON.stringify(shipping_address), delivery_method, courier_name, coupon_code||null,
       payment_method, notes||null, estimated.toISOString().split('T')[0]]
    );
    const order = orderRows[0];

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (order_id,product_id,variant_id,name,image_url,color,storage,quantity,unit_price,total_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [order.id, item.product_id, item.variant_id, item.name, item.image_url,
         item.color, item.storage, item.quantity, item.unit_price, item.total_price]
      );
      if (item.variant_id) {
        await client.query('UPDATE product_variants SET stock=stock-$1 WHERE id=$2', [item.quantity, item.variant_id]);
        await client.query("INSERT INTO inventory_logs (variant_id,change,reason,order_id) VALUES ($1,$2,'sale',$3)",
          [item.variant_id, -item.quantity, order.id]);
      }
      await client.query('UPDATE products SET total_sales=total_sales+$1 WHERE id=$2', [item.quantity, item.product_id]);
    }

    await client.query("INSERT INTO order_status_history (order_id,status,note) VALUES ($1,'pending','Order placed')", [order.id]);
    await client.query('COMMIT');

    const email = c.get('user')?.email || guest_email;
    if (email) sendOrderConfirmationEmail(c.env, email, order).catch(console.error);
    const phone = c.get('user')?.phone || guest_phone;
    if (phone) sendOrderStatusSMS(c.env, phone, order.order_number, 'pending').catch(console.error);

    return c.json({ success: true, data: { order, items: orderItems } }, 201);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    return c.json({ success: false, message: e.message||'Failed to place order' }, 400);
  } finally {
    client.release();
  }
});

// ── GET /api/orders ───────────────────────────────────────────
orders.get('/', authenticate, async (c) => {
  const { status, page='1', limit='10' } = c.req.query();
  const offset = (parseInt(page)-1)*parseInt(limit);
  const params = [c.get('user').id];
  let where = 'user_id=$1';
  if (status) { params.push(status); where += ` AND status=$${params.length}`; }

  const { rows } = await query(c.env,
    `SELECT o.*,(SELECT json_agg(json_build_object('name',i.name,'quantity',i.quantity,'unit_price',i.unit_price,'image_url',i.image_url))
      FROM order_items i WHERE i.order_id=o.id) AS items
     FROM orders o WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
    [...params, parseInt(limit), offset]
  );
  return c.json({ success: true, data: rows });
});

// ── GET /api/orders/:id ───────────────────────────────────────
orders.get('/:id', authenticate, async (c) => {
  const user = c.get('user');
  const { rows } = await query(c.env,
    `SELECT * FROM orders WHERE id=$1 AND (user_id=$2 OR $3 = ANY(ARRAY['admin','superadmin']))`,
    [c.req.param('id'), user.id, user.role]
  );
  if (!rows.length) return c.json({ success: false, message: 'Order not found' }, 404);

  const [items, history] = await Promise.all([
    query(c.env, 'SELECT * FROM order_items WHERE order_id=$1', [c.req.param('id')]),
    query(c.env, 'SELECT * FROM order_status_history WHERE order_id=$1 ORDER BY created_at ASC', [c.req.param('id')]),
  ]);
  return c.json({ success: true, data: { ...rows[0], items: items.rows, history: history.rows } });
});

// ── PUT /api/orders/:id/status (admin) ───────────────────────
orders.put('/:id/status', ...isAdmin, async (c) => {
  const { status, note, tracking_id } = await c.req.json();
  const allowed = ['confirmed','processing','packed','shipped','delivered','cancelled','refunded'];
  if (!allowed.includes(status))
    return c.json({ success: false, message: 'Invalid status' }, 400);

  const { rows } = await query(c.env,
    `UPDATE orders SET status=$1,tracking_id=COALESCE($2,tracking_id),
       delivered_at=CASE WHEN $1='delivered' THEN NOW() ELSE delivered_at END,
       updated_at=NOW() WHERE id=$3 RETURNING *`,
    [status, tracking_id||null, c.req.param('id')]
  );
  if (!rows.length) return c.json({ success: false, message: 'Order not found' }, 404);

  await query(c.env,
    'INSERT INTO order_status_history (order_id,status,note,done_by) VALUES ($1,$2,$3,$4)',
    [c.req.param('id'), status, note||null, c.get('user').id]
  );

  const order = rows[0];
  const { rows: userRows } = await query(c.env, 'SELECT phone FROM users WHERE id=$1', [order.user_id]);
  if (userRows[0]?.phone)
    sendOrderStatusSMS(c.env, userRows[0].phone, order.order_number, status).catch(console.error);

  return c.json({ success: true, data: rows[0] });
});

// ── POST /api/orders/:id/cancel ───────────────────────────────
orders.post('/:id/cancel', authenticate, async (c) => {
  const { rows } = await query(c.env,
    "SELECT * FROM orders WHERE id=$1 AND user_id=$2 AND status IN ('pending','confirmed')",
    [c.req.param('id'), c.get('user').id]
  );
  if (!rows.length) return c.json({ success: false, message: 'Order cannot be cancelled' }, 400);

  const { reason = 'Cancelled by customer' } = await c.req.json().catch(() => ({}));
  await query(c.env, "UPDATE orders SET status='cancelled',cancelled_at=NOW(),cancel_reason=$1 WHERE id=$2",
    [reason, c.req.param('id')]);
  await query(c.env, "INSERT INTO order_status_history (order_id,status,note) VALUES ($1,'cancelled',$2)",
    [c.req.param('id'), reason]);

  const { rows: items } = await query(c.env, 'SELECT * FROM order_items WHERE order_id=$1', [c.req.param('id')]);
  for (const item of items) {
    if (item.variant_id) {
      await query(c.env, 'UPDATE product_variants SET stock=stock+$1 WHERE id=$2', [item.quantity, item.variant_id]);
      await query(c.env, "INSERT INTO inventory_logs (variant_id,change,reason,order_id) VALUES ($1,$2,'return',$3)",
        [item.variant_id, item.quantity, c.req.param('id')]);
    }
    await query(c.env, 'UPDATE products SET total_sales=total_sales-$1 WHERE id=$2', [item.quantity, item.product_id]);
  }
  return c.json({ success: true, message: 'Order cancelled successfully' });
});

export default orders;
