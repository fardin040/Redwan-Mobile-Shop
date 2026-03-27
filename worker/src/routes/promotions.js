// ============================================================
// worker/src/routes/promotions.js — D1/SQLite version
// ============================================================
import { Hono } from 'hono';
import { query, uuid } from '../db.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const promotions = new Hono();

promotions.post('/validate-coupon', async (c) => {
  const { code, subtotal=0 } = await c.req.json();
  if (!code) return c.json({ success: false, message: 'Coupon code required' }, 422);

  const { rows } = await query(c.env,
    `SELECT * FROM coupons WHERE code=? AND is_active=1
     AND (expires_at IS NULL OR expires_at > datetime('now'))
     AND (usage_limit IS NULL OR used_count < usage_limit)`,
    [code.toUpperCase()]
  );
  if (!rows.length) return c.json({ success: false, message: 'Invalid or expired coupon' }, 404);

  const coupon = rows[0];
  if (parseFloat(subtotal) < parseFloat(coupon.min_order))
    return c.json({ success: false, message: `Minimum order ৳${coupon.min_order} required` }, 400);

  let discount = 0;
  if (coupon.type === 'percentage')
    discount = Math.min(parseFloat(subtotal) * coupon.value/100, coupon.max_discount || Infinity);
  else if (coupon.type === 'flat') discount = coupon.value;

  return c.json({ success: true, data: { ...coupon, calculated_discount: discount } });
});

promotions.get('/flash-sale', async (c) => {
  const { rows } = await query(c.env,
    `SELECT id, name, slug, price, sale_price, images, avg_rating, is_flash_sale, flash_sale_ends_at
     FROM products WHERE is_flash_sale=1 AND status='published'
     AND (flash_sale_ends_at IS NULL OR flash_sale_ends_at > datetime('now'))
     ORDER BY created_at DESC LIMIT 12`
  );
  return c.json({ success: true, data: rows.map((r) => ({ ...r, images: tryParse(r.images, []) })) });
});

promotions.get('/coupons', ...isAdmin, async (c) => {
  const { rows } = await query(c.env, 'SELECT * FROM coupons ORDER BY created_at DESC');
  return c.json({ success: true, data: rows });
});

promotions.post('/coupons', ...isAdmin, async (c) => {
  const { code, type, value, min_order=0, max_discount, expires_at, usage_limit } = await c.req.json();
  if (!code || !type || !value) return c.json({ success: false, message: 'code, type and value required' }, 422);
  const id = uuid();
  await query(c.env,
    'INSERT INTO coupons (id,code,type,value,min_order,max_discount,expires_at,usage_limit,created_by) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, code.toUpperCase(), type, value, min_order, max_discount||null, expires_at||null, usage_limit||null, c.get('user')?.id||null]
  );
  const { rows } = await query(c.env, 'SELECT * FROM coupons WHERE id=?', [id]);
  return c.json({ success: true, data: rows[0] }, 201);
});

promotions.put('/coupons/:id', ...isAdmin, async (c) => {
  const { is_active } = await c.req.json();
  await query(c.env, 'UPDATE coupons SET is_active=? WHERE id=?', [is_active ? 1 : 0, c.req.param('id')]);
  return c.json({ success: true, message: 'Coupon updated' });
});

promotions.delete('/coupons/:id', ...isAdmin, async (c) => {
  await query(c.env, 'DELETE FROM coupons WHERE id=?', [c.req.param('id')]);
  return c.json({ success: true, message: 'Coupon deleted' });
});

promotions.get('/banners', async (c) => {
  const { rows } = await query(c.env,
    `SELECT * FROM banners WHERE is_active=1
     AND (starts_at IS NULL OR starts_at <= datetime('now'))
     AND (ends_at IS NULL OR ends_at > datetime('now'))
     ORDER BY sort_order`
  );
  return c.json({ success: true, data: rows });
});

const tryParse = (val, fallback) => { try { return JSON.parse(val); } catch { return fallback; } };
export default promotions;
