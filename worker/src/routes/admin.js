// ============================================================
// worker/src/routes/admin.js — Dashboard stats
// ============================================================
import { Hono } from 'hono';
import { query } from '../db.js';
import { isAdmin } from '../middleware/auth.js';

const admin = new Hono();

// ── GET /api/admin/stats ──────────────────────────────────────
admin.get('/stats', ...isAdmin, async (c) => {
  const [revenue, orders, customers, products, lowStock, recentOrders] = await Promise.all([
    query(c.env, `SELECT COALESCE(SUM(total_amount),0) AS total,
      COALESCE(SUM(CASE WHEN created_at >= NOW()-INTERVAL '30 days' THEN total_amount END),0) AS this_month
      FROM orders WHERE status NOT IN ('cancelled','refunded')`),
    query(c.env, `SELECT COUNT(*) AS total,
      COUNT(CASE WHEN status='pending'   THEN 1 END) AS pending,
      COUNT(CASE WHEN status='delivered' THEN 1 END) AS delivered,
      COUNT(CASE WHEN created_at >= NOW()-INTERVAL '7 days' THEN 1 END) AS this_week
      FROM orders`),
    query(c.env, `SELECT COUNT(*) AS total,
      COUNT(CASE WHEN created_at >= NOW()-INTERVAL '30 days' THEN 1 END) AS new_this_month
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

  return c.json({
    success: true,
    data: {
      revenue:       revenue.rows[0],
      orders:        orders.rows[0],
      customers:     customers.rows[0],
      products:      products.rows[0],
      lowStock:      lowStock.rows,
      recentOrders:  recentOrders.rows,
    },
  });
});

// ── GET /api/admin/revenue-chart ──────────────────────────────
admin.get('/revenue-chart', ...isAdmin, async (c) => {
  const { period='30' } = c.req.query();
  const { rows } = await query(c.env,
    `SELECT DATE(created_at) AS date, COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS orders
     FROM orders WHERE status NOT IN ('cancelled','refunded')
       AND created_at >= NOW()-INTERVAL '${parseInt(period)} days'
     GROUP BY DATE(created_at) ORDER BY date ASC`
  );
  return c.json({ success: true, data: rows });
});

// ── GET /api/admin/top-products ───────────────────────────────
admin.get('/top-products', ...isAdmin, async (c) => {
  const { rows } = await query(c.env,
    `SELECT p.id,p.name,p.slug,p.images,p.total_sales,p.avg_rating,
            COALESCE(p.sale_price,p.price) AS price
     FROM products p WHERE p.status='published'
     ORDER BY p.total_sales DESC LIMIT 10`
  );
  return c.json({ success: true, data: rows });
});

// ── GET /api/admin/customers ──────────────────────────────────
admin.get('/customers', ...isAdmin, async (c) => {
  const { page='1', limit='20', search } = c.req.query();
  const offset = (parseInt(page)-1)*parseInt(limit);
  const params = [];
  let where = "role='customer'";
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1)`;
  }
  params.push(parseInt(limit), offset);
  const { rows } = await query(c.env,
    `SELECT id,name,email,phone,tier,is_blocked,created_at,last_login,
            (SELECT COUNT(*) FROM orders WHERE user_id=users.id) AS order_count,
            (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE user_id=users.id AND status='delivered') AS total_spent
     FROM users WHERE ${where} ORDER BY created_at DESC
     LIMIT $${params.length-1} OFFSET $${params.length}`,
    params
  );
  return c.json({ success: true, data: rows });
});

// ── PUT /api/admin/customers/:id/block ────────────────────────
admin.put('/customers/:id/block', ...isAdmin, async (c) => {
  const { is_blocked } = await c.req.json();
  await query(c.env, 'UPDATE users SET is_blocked=$1 WHERE id=$2', [is_blocked, c.req.param('id')]);
  return c.json({ success: true, message: is_blocked ? 'Customer blocked' : 'Customer unblocked' });
});

// ── GET /api/admin/orders ─────────────────────────────────────
admin.get('/orders', ...isAdmin, async (c) => {
  const { page='1', limit='20', status, search } = c.req.query();
  const offset = (parseInt(page)-1)*parseInt(limit);
  const params = [];
  const filters = [];
  if (status) { params.push(status); filters.push(`o.status=$${params.length}`); }
  if (search) { params.push(`%${search}%`); filters.push(`(o.order_number ILIKE $${params.length} OR u.name ILIKE $${params.length})`); }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  params.push(parseInt(limit), offset);

  const { rows } = await query(c.env,
    `SELECT o.*,COALESCE(u.name,o.guest_name) AS customer_name, u.phone AS customer_phone
     FROM orders o LEFT JOIN users u ON o.user_id=u.id
     ${where} ORDER BY o.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
    params
  );
  return c.json({ success: true, data: rows });
});

export default admin;
