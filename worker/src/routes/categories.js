// ============================================================
// worker/src/routes/categories.js
// ============================================================
import { Hono } from 'hono';
import { query } from '../db.js';
import { isAdmin } from '../middleware/auth.js';

const categories = new Hono();

categories.get('/', async (c) => {
  const { rows } = await query(c.env, 'SELECT * FROM categories WHERE is_active=TRUE ORDER BY sort_order,name');
  return c.json({ success: true, data: rows });
});

categories.get('/brands', async (c) => {
  const { rows } = await query(c.env, 'SELECT * FROM brands WHERE is_active=TRUE ORDER BY sort_order,name');
  return c.json({ success: true, data: rows });
});

categories.post('/', ...isAdmin, async (c) => {
  const { name, slug, image_url, parent_id, sort_order=0 } = await c.req.json();
  if (!name || !slug) return c.json({ success: false, message: 'name and slug required' }, 422);
  const { rows } = await query(c.env,
    'INSERT INTO categories (name,slug,image_url,parent_id,sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [name, slug, image_url||null, parent_id||null, sort_order]
  );
  return c.json({ success: true, data: rows[0] }, 201);
});

export default categories;
