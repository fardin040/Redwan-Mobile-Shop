// ============================================================
// worker/src/routes/reviews.js
// ============================================================
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const reviews = new Hono();

reviews.get('/product/:productId', async (c) => {
  const { page='1', limit='10' } = c.req.query();
  const offset = (parseInt(page)-1)*parseInt(limit);
  const { rows } = await query(c.env,
    `SELECT r.*, u.name AS reviewer_name, u.avatar_url AS reviewer_avatar
     FROM reviews r JOIN users u ON r.user_id=u.id
     WHERE r.product_id=$1 AND r.status='approved'
     ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
    [c.req.param('productId'), parseInt(limit), offset]
  );
  return c.json({ success: true, data: rows });
});

reviews.post('/', authenticate, async (c) => {
  const { product_id, rating, title, body, images=[] } = await c.req.json();
  if (!product_id || !rating) return c.json({ success: false, message: 'product_id and rating required' }, 422);

  // Check purchased
  const { rows: orderRows } = await query(c.env,
    `SELECT 1 FROM order_items oi JOIN orders o ON oi.order_id=o.id
     WHERE o.user_id=$1 AND oi.product_id=$2 AND o.status='delivered' LIMIT 1`,
    [c.get('user').id, product_id]
  );

  const { rows } = await query(c.env,
    `INSERT INTO reviews (product_id,user_id,rating,title,body,images,is_verified_purchase,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
    [product_id, c.get('user').id, rating, title||null, body||null,
     JSON.stringify(images), orderRows.length > 0]
  );
  return c.json({ success: true, data: rows[0], message: 'Review submitted for approval' }, 201);
});

reviews.put('/:id/approve', ...isAdmin, async (c) => {
  const { rows } = await query(c.env,
    "UPDATE reviews SET status='approved',updated_at=NOW() WHERE id=$1 RETURNING *",
    [c.req.param('id')]
  );
  if (!rows.length) return c.json({ success: false, message: 'Review not found' }, 404);

  // Recalculate avg rating
  await query(c.env,
    `UPDATE products SET avg_rating=(SELECT AVG(rating) FROM reviews WHERE product_id=$1 AND status='approved'),
     review_count=(SELECT COUNT(*) FROM reviews WHERE product_id=$1 AND status='approved')
     WHERE id=$1`,
    [rows[0].product_id]
  );
  return c.json({ success: true, data: rows[0] });
});

reviews.delete('/:id', ...isAdmin, async (c) => {
  await query(c.env, 'DELETE FROM reviews WHERE id=$1', [c.req.param('id')]);
  return c.json({ success: true, message: 'Review deleted' });
});

export default reviews;
