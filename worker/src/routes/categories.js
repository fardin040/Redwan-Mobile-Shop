// ============================================================
// worker/src/routes/categories.js — D1/SQLite version
// ============================================================
import { Hono } from 'hono';
import { query, uuid } from '../db.js';
import { isAdmin } from '../middleware/auth.js';

const categories = new Hono();

categories.get('/', async (c) => {
  const { rows } = await query(c.env, 'SELECT * FROM categories WHERE is_active=1 ORDER BY sort_order, name');
  return c.json({ success: true, data: rows });
});

categories.get('/brands', async (c) => {
  const { rows } = await query(c.env, 'SELECT * FROM brands WHERE is_active=1 ORDER BY sort_order, name');
  return c.json({ success: true, data: rows });
});

categories.post('/', ...isAdmin, async (c) => {
  const { name, slug, image_url, parent_id, sort_order=0 } = await c.req.json();
  if (!name || !slug) return c.json({ success: false, message: 'name and slug required' }, 422);
  const id = uuid();
  await query(c.env,
    'INSERT INTO categories (id, name, slug, image_url, parent_id, sort_order) VALUES (?,?,?,?,?,?)',
    [id, name, slug, image_url||null, parent_id||null, sort_order]
  );
  const { rows } = await query(c.env, 'SELECT * FROM categories WHERE id=?', [id]);
  return c.json({ success: true, data: rows[0] }, 201);
});

categories.post('/brands', ...isAdmin, async (c) => {
  const { name, slug, logo_url, sort_order=0 } = await c.req.json();
  if (!name || !slug) return c.json({ success: false, message: 'name and slug required' }, 422);
  const id = uuid();
  await query(c.env, 'INSERT INTO brands (id, name, slug, logo_url, sort_order) VALUES (?,?,?,?,?)',
    [id, name, slug, logo_url||null, sort_order]);
  const { rows } = await query(c.env, 'SELECT * FROM brands WHERE id=?', [id]);
  return c.json({ success: true, data: rows[0] }, 201);
});

export default categories;
