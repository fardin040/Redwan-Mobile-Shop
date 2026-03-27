// ============================================================
// worker/src/routes/admin.js — D1/SQLite version
// INTERVAL → datetime('now', '-N days'), json_group_array
// ============================================================
import { Hono } from 'hono';
import { query, uuid } from '../db.js';
import { isAdmin } from '../middleware/auth.js';

const admin = new Hono();

admin.get('/stats', ...isAdmin, async (c) => {
  const user = c.get('user');
  console.log('[AdminStats] Requesting stats for user:', user?.email, 'Role:', user?.role);

  const [revenue, orders, customers, products, lowStock, recentOrders] = await Promise.all([
    query(c.env, `SELECT
      COALESCE(SUM(total_amount),0) AS total,
      COALESCE(SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN total_amount END),0) AS this_month
      FROM orders WHERE status NOT IN ('cancelled','refunded')`),
    query(c.env, `SELECT COUNT(*) AS total,
      COUNT(CASE WHEN status='pending'   THEN 1 END) AS pending,
      COUNT(CASE WHEN status='delivered' THEN 1 END) AS delivered,
      COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) AS this_week
      FROM orders`),
    query(c.env, `SELECT COUNT(*) AS total,
      COUNT(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 END) AS new_this_month
      FROM users WHERE role='customer'`),
    query(c.env, `SELECT COUNT(*) AS total,
      COUNT(CASE WHEN status='published' THEN 1 END) AS published,
      COUNT(CASE WHEN status='draft'     THEN 1 END) AS drafts
      FROM products`),
    query(c.env, `SELECT p.name, v.color, v.storage, v.stock, v.low_stock_at
      FROM product_variants v JOIN products p ON v.product_id=p.id
      WHERE v.stock <= v.low_stock_at AND p.status='published'
      ORDER BY v.stock ASC LIMIT 10`),
    query(c.env, `SELECT o.id,o.order_number,o.total_amount,o.status,o.payment_method,o.created_at,
      COALESCE(u.name, o.guest_name) AS customer_name
      FROM orders o LEFT JOIN users u ON o.user_id=u.id
      ORDER BY o.created_at DESC LIMIT 10`),
  ]);

  return c.json({ success: true, data: {
    revenue:      revenue.rows[0],
    orders:       orders.rows[0],
    customers:    customers.rows[0],
    products:     products.rows[0],
    lowStock:     lowStock.rows,
    recentOrders: recentOrders.rows,
  }});
});

admin.get('/revenue-chart', ...isAdmin, async (c) => {
  const { period='30' } = c.req.query();
  const days = Math.min(parseInt(period), 365);
  const { rows } = await query(c.env,
    `SELECT date(created_at) AS date, COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS orders
     FROM orders WHERE status NOT IN ('cancelled','refunded')
       AND created_at >= datetime('now', ? )
     GROUP BY date(created_at) ORDER BY date ASC`,
    [`-${days} days`]
  );
  return c.json({ success: true, data: rows });
});

admin.get('/top-products', ...isAdmin, async (c) => {
  const { rows } = await query(c.env,
    `SELECT id, name, slug, images, total_sales, avg_rating,
            COALESCE(sale_price, price) AS price
     FROM products WHERE status='published'
     ORDER BY total_sales DESC LIMIT 10`
  );
  return c.json({ success: true, data: rows.map((r) => ({ ...r, images: tryParse(r.images, []) })) });
});

admin.get('/customers', ...isAdmin, async (c) => {
  const { page='1', limit='20', search } = c.req.query();
  const offset = (parseInt(page)-1)*parseInt(limit);
  const params = [];
  let where = "role='customer'";
  if (search) {
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    where += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
  }
  params.push(parseInt(limit), offset);
  const { rows } = await query(c.env,
    `SELECT id, name, email, phone, tier, is_blocked, created_at, last_login,
            (SELECT COUNT(*) FROM orders WHERE user_id=users.id) AS order_count,
            (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE user_id=users.id AND status='delivered') AS total_spent
     FROM users WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params
  );
  return c.json({ success: true, data: rows });
});

admin.put('/customers/:id/block', ...isAdmin, async (c) => {
  const { is_blocked } = await c.req.json();
  await query(c.env, 'UPDATE users SET is_blocked = ? WHERE id = ?', [is_blocked ? 1 : 0, c.req.param('id')]);
  return c.json({ success: true, message: is_blocked ? 'Customer blocked' : 'Customer unblocked' });
});

admin.get('/orders', ...isAdmin, async (c) => {
  const { page='1', limit='20', status, search } = c.req.query();
  const offset = (parseInt(page)-1)*parseInt(limit);
  const params = [];
  const filters = [];
  if (status) { params.push(status); filters.push('o.status = ?'); }
  if (search) {
    params.push(`%${search}%`, `%${search}%`);
    filters.push('(o.order_number LIKE ? OR u.name LIKE ?)');
  }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  params.push(parseInt(limit), offset);
  const { rows } = await query(c.env,
    `SELECT o.*, COALESCE(u.name, o.guest_name) AS customer_name, u.phone AS customer_phone
     FROM orders o LEFT JOIN users u ON o.user_id=u.id
     ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    params
  );
  return c.json({ success: true, data: rows.map((r) => ({ ...r, shipping_address: tryParse(r.shipping_address, {}) })) });
});

// ── Banners ───────────────────────────────────────────────────
admin.get('/banners', async (c) => {
  const { rows } = await query(c.env,
    `SELECT * FROM banners WHERE is_active=1
     AND (starts_at IS NULL OR starts_at <= datetime('now'))
     AND (ends_at IS NULL OR ends_at > datetime('now'))
     ORDER BY sort_order`
  );
  return c.json({ success: true, data: rows });
});

admin.post('/banners', ...isAdmin, async (c) => {
  const { title, image_url, link_url, position='hero', sort_order=0 } = await c.req.json();
  if (!image_url) return c.json({ success: false, message: 'image_url required' }, 422);
  const id = uuid();
  await query(c.env,
    'INSERT INTO banners (id,title,image_url,link_url,position,sort_order) VALUES (?,?,?,?,?,?)',
    [id, title||null, image_url, link_url||null, position, sort_order]
  );
  const { rows } = await query(c.env, 'SELECT * FROM banners WHERE id=?', [id]);
  return c.json({ success: true, data: rows[0] }, 201);
});

const tryParse = (val, fallback) => { try { return JSON.parse(val); } catch { return fallback; } };
export default admin;
