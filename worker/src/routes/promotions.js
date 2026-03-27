// ============================================================
// worker/src/routes/promotions.js — Coupons & flash sales
// ============================================================
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const promotions = new Hono();

// ── GET /api/promotions/validate-coupon ───────────────────────
promotions.post('/validate-coupon', async (c) => {
  const { code, subtotal=0 } = await c.req.json();
  if (!code) return c.json({ success: false, message: 'Coupon code required' }, 422);

  const { rows } = await query(c.env,
    `SELECT * FROM coupons WHERE code=$1 AND is_active=TRUE
     AND (expires_at IS NULL OR expires_at>NOW())
     AND (usage_limit IS NULL OR used_count<usage_limit)`,
    [code.toUpperCase()]
  );
  if (!rows.length) return c.json({ success: false, message: 'Invalid or expired coupon' }, 404);

  const coupon = rows[0];
  if (parseFloat(subtotal) < parseFloat(coupon.min_order))
    return c.json({ success: false, message: `Minimum order ৳${coupon.min_order} required` }, 400);

  let discount = 0;
  if (coupon.type === 'percentage')
    discount = Math.min(parseFloat(subtotal) * coupon.value/100, coupon.max_discount||Infinity);
  else if (coupon.type === 'flat')
    discount = coupon.value;
  else if (coupon.type === 'free_shipping')
    discount = 0;

  return c.json({ success: true, data: { ...coupon, calculated_discount: discount } });
});

// ── GET /api/promotions/flash-sale ────────────────────────────
promotions.get('/flash-sale', async (c) => {
  const { rows } = await query(c.env,
    `SELECT p.id,p.name,p.slug,p.price,p.sale_price,p.images,p.avg_rating,p.is_flash_sale,p.flash_sale_ends_at
     FROM products p WHERE p.is_flash_sale=TRUE AND p.status='published'
     AND (p.flash_sale_ends_at IS NULL OR p.flash_sale_ends_at>NOW())
     ORDER BY p.created_at DESC LIMIT 12`
  );
  return c.json({ success: true, data: rows });
});

// ── Admin: Coupons CRUD ──────────────────────────────────────
promotions.get('/coupons', ...isAdmin, async (c) => {
  const { rows } = await query(c.env, 'SELECT * FROM coupons ORDER BY created_at DESC');
  return c.json({ success: true, data: rows });
});

promotions.post('/coupons', ...isAdmin, async (c) => {
  const { code, type, value, min_order=0, max_discount, expires_at, usage_limit } = await c.req.json();
  if (!code || !type || !value) return c.json({ success: false, message: 'code, type and value required' }, 422);
  const { rows } = await query(c.env,
    `INSERT INTO coupons (code,type,value,min_order,max_discount,expires_at,usage_limit)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [code.toUpperCase(), type, value, min_order, max_discount||null, expires_at||null, usage_limit||null]
  );
  return c.json({ success: true, data: rows[0] }, 201);
});

promotions.delete('/coupons/:id', ...isAdmin, async (c) => {
  await query(c.env, 'DELETE FROM coupons WHERE id=$1', [c.req.param('id')]);
  return c.json({ success: true, message: 'Coupon deleted' });
});

export default promotions;
