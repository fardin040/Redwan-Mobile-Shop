// ============================================================
// worker/src/routes/reviews.js — D1/SQLite version
// ============================================================
import { Hono } from 'hono';
import { query, uuid } from '../db.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const reviews = new Hono();

reviews.get('/product/:productId', async (c) => {
  const { page='1', limit='10', sort='newest' } = c.req.query();
  const offset  = (parseInt(page)-1)*parseInt(limit);
  const sortMap = { newest: 'r.created_at DESC', highest: 'r.rating DESC', lowest: 'r.rating ASC', helpful: 'r.helpful DESC' };
  const orderBy = sortMap[sort] || 'r.created_at DESC';
  const { rows } = await query(c.env,
    `SELECT r.id, r.rating, r.title, r.body, r.images, r.helpful, r.is_verified_purchase, r.created_at,
            u.name AS reviewer_name, u.avatar_url
     FROM reviews r JOIN users u ON r.user_id=u.id
     WHERE r.product_id=? AND r.status='approved'
     ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [c.req.param('productId'), parseInt(limit), offset]
  );
  return c.json({ success: true, data: rows.map((r) => ({ ...r, images: tryParse(r.images, []) })) });
});

reviews.post('/', authenticate, async (c) => {
  const { product_id, rating, title, body, images=[] } = await c.req.json();
  if (!product_id || !rating)
    return c.json({ success: false, message: 'product_id and rating required' }, 422);

  const { rows: orderRows } = await query(c.env,
    `SELECT 1 FROM order_items oi JOIN orders o ON oi.order_id=o.id
     WHERE o.user_id=? AND oi.product_id=? AND o.status='delivered' LIMIT 1`,
    [c.get('user').id, product_id]
  );

  try {
    const id = uuid();
    await query(c.env,
      `INSERT INTO reviews (id,product_id,user_id,rating,title,body,images,is_verified_purchase,status)
       VALUES (?,?,?,?,?,?,?,?,'pending')`,
      [id, product_id, c.get('user').id, rating, title||null, body||null,
       JSON.stringify(images), orderRows.length > 0 ? 1 : 0]
    );
    const { rows } = await query(c.env, 'SELECT * FROM reviews WHERE id=?', [id]);
    return c.json({ success: true, data: rows[0], message: 'Review submitted for approval' }, 201);
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return c.json({ success: false, message: 'You already reviewed this product' }, 409);
    return c.json({ success: false, message: 'Failed to submit review' }, 500);
  }
});

reviews.post('/:id/helpful', authenticate, async (c) => {
  await query(c.env, 'UPDATE reviews SET helpful = helpful + 1 WHERE id = ?', [c.req.param('id')]);
  return c.json({ success: true });
});

reviews.put('/:id/approve', ...isAdmin, async (c) => {
  const { rows } = await query(c.env,
    "UPDATE reviews SET status='approved', updated_at=datetime('now') WHERE id=? RETURNING *",
    [c.req.param('id')]
  );
  if (!rows.length) return c.json({ success: false, message: 'Review not found' }, 404);

  // Recalculate avg rating
  await query(c.env,
    `UPDATE products SET
       avg_rating   = (SELECT AVG(rating) FROM reviews WHERE product_id=? AND status='approved'),
       review_count = (SELECT COUNT(*) FROM reviews WHERE product_id=? AND status='approved')
     WHERE id=?`,
    [rows[0].product_id, rows[0].product_id, rows[0].product_id]
  );
  return c.json({ success: true, data: rows[0] });
});

reviews.delete('/:id', ...isAdmin, async (c) => {
  await query(c.env, 'DELETE FROM reviews WHERE id=?', [c.req.param('id')]);
  return c.json({ success: true, message: 'Review deleted' });
});

const tryParse = (val, fallback) => { try { return JSON.parse(val); } catch { return fallback; } };
export default reviews;
