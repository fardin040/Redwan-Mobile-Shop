// ============================================================
// worker/src/routes/wishlist.js
// ============================================================
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const wishlist = new Hono();

wishlist.get('/', authenticate, async (c) => {
  const { rows } = await query(c.env,
    `SELECT w.id, w.product_id, w.created_at,
            p.name, p.slug, p.price, p.sale_price, p.images, p.avg_rating
     FROM wishlist w JOIN products p ON w.product_id=p.id
     WHERE w.user_id=$1 ORDER BY w.created_at DESC`,
    [c.get('user').id]
  );
  return c.json({ success: true, data: rows });
});

wishlist.post('/', authenticate, async (c) => {
  const { product_id } = await c.req.json();
  if (!product_id) return c.json({ success: false, message: 'product_id required' }, 422);
  await query(c.env,
    'INSERT INTO wishlist (user_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [c.get('user').id, product_id]
  );
  return c.json({ success: true, message: 'Added to wishlist' });
});

wishlist.delete('/:productId', authenticate, async (c) => {
  await query(c.env,
    'DELETE FROM wishlist WHERE user_id=$1 AND product_id=$2',
    [c.get('user').id, c.req.param('productId')]
  );
  return c.json({ success: true, message: 'Removed from wishlist' });
});

export default wishlist;
