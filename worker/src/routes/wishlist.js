// ============================================================
// worker/src/routes/wishlist.js — D1/SQLite version
// ============================================================
import { Hono } from 'hono';
import { query, uuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const wishlist = new Hono();

wishlist.get('/', authenticate, async (c) => {
  const { rows } = await query(c.env,
    `SELECT w.id, w.product_id, w.created_at,
            p.name, p.slug, p.price, p.sale_price, p.images, p.avg_rating
     FROM wishlist w JOIN products p ON w.product_id=p.id
     WHERE w.user_id=? ORDER BY w.created_at DESC`,
    [c.get('user').id]
  );
  return c.json({ success: true, data: rows.map((r) => ({ ...r, images: tryParse(r.images, []) })) });
});

wishlist.post('/', authenticate, async (c) => {
  const { product_id } = await c.req.json();
  if (!product_id) return c.json({ success: false, message: 'product_id required' }, 422);
  try {
    await query(c.env,
      'INSERT INTO wishlist (id, user_id, product_id) VALUES (?,?,?)',
      [uuid(), c.get('user').id, product_id]
    );
    return c.json({ success: true, message: 'Added to wishlist' });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return c.json({ success: true, message: 'Already in wishlist' });
    return c.json({ success: false, message: 'Failed to add to wishlist' }, 500);
  }
});

wishlist.delete('/:productId', authenticate, async (c) => {
  await query(c.env,
    'DELETE FROM wishlist WHERE user_id=? AND product_id=?',
    [c.get('user').id, c.req.param('productId')]
  );
  return c.json({ success: true, message: 'Removed from wishlist' });
});

const tryParse = (val, fallback) => { try { return JSON.parse(val); } catch { return fallback; } };
export default wishlist;
