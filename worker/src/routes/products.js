// ============================================================
// worker/src/routes/products.js — D1/SQLite version
// Using json_group_array + json_object instead of json_agg
// ============================================================
import { Hono }  from 'hono';
import { query, uuid } from '../db.js';
import { authenticate, optionalAuth, isAdmin } from '../middleware/auth.js';

const products = new Hono();

const slugify = (str) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ── GET /api/products ─────────────────────────────────────────
products.get('/', optionalAuth, async (c) => {
  try {
    const { page='1', limit='20', brand, category, minPrice, maxPrice,
            sort='newest', status='published' } = c.req.query();
    const offset  = (parseInt(page)-1) * parseInt(limit);
    const params  = [status];
    const filters = ['p.status = ?'];

    if (brand)    { params.push(brand);    filters.push('b.slug = ?'); }
    if (category) { params.push(category); filters.push('c.slug = ?'); }
    if (minPrice) { params.push(minPrice); filters.push('COALESCE(p.sale_price, p.price) >= ?'); }
    if (maxPrice) { params.push(maxPrice); filters.push('COALESCE(p.sale_price, p.price) <= ?'); }

    const sortMap = {
      newest:     'p.created_at DESC', oldest: 'p.created_at ASC',
      price_asc:  'COALESCE(p.sale_price,p.price) ASC',
      price_desc: 'COALESCE(p.sale_price,p.price) DESC',
      popular:    'p.total_sales DESC', rating: 'p.avg_rating DESC',
    };
    const orderBy = sortMap[sort] || 'p.created_at DESC';
    const where   = filters.join(' AND ');

    const countParams = [...params];
    params.push(parseInt(limit), offset);

    const dataQ = `
      SELECT p.id, p.name, p.slug, p.sku, p.price, p.sale_price, p.images,
             p.avg_rating, p.review_count, p.total_sales, p.is_featured,
             b.name AS brand_name, b.slug AS brand_slug,
             c.name AS category_name, c.slug AS category_slug,
             (SELECT json_group_array(json_object('color', v.color, 'storage', v.storage, 'stock', v.stock))
              FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS variants
      FROM products p
      LEFT JOIN brands b     ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;

    const countQ = `
      SELECT COUNT(*) AS total FROM products p
      LEFT JOIN brands b ON p.brand_id=b.id LEFT JOIN categories c ON p.category_id=c.id
      WHERE ${where}`;

    const [data, count] = await Promise.all([
      query(c.env, dataQ, params),
      query(c.env, countQ, countParams),
    ]);

    // Parse JSON strings from D1
    const rows = data.rows.map((r) => ({
      ...r,
      images:   tryParse(r.images,   []),
      variants: tryParse(r.variants, []),
    }));

    return c.json({ success: true, data: rows,
      meta: { total: count.rows[0]?.total || 0, page: parseInt(page), limit: parseInt(limit),
              pages: Math.ceil((count.rows[0]?.total || 0) / parseInt(limit)) } });
  } catch (e) {
    console.error(e);
    return c.json({ success: false, message: 'Failed to fetch products' }, 500);
  }
});

// ── GET /api/products/:slug ───────────────────────────────────
products.get('/:slug', optionalAuth, async (c) => {
  try {
    const { rows } = await query(c.env,
      `SELECT p.*, b.name AS brand_name, b.slug AS brand_slug,
              c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN brands b ON p.brand_id=b.id LEFT JOIN categories c ON p.category_id=c.id
       WHERE p.slug = ? AND p.status = 'published'`,
      [c.req.param('slug')]
    );
    if (!rows.length) return c.json({ success: false, message: 'Product not found' }, 404);
    const product = { ...rows[0], images: tryParse(rows[0].images, []), tags: tryParse(rows[0].tags, []) };

    const [specs, variants, reviews] = await Promise.all([
      query(c.env, 'SELECT group_name,spec_key,spec_value,sort_order FROM product_specs WHERE product_id=? ORDER BY sort_order', [product.id]),
      query(c.env, 'SELECT * FROM product_variants WHERE product_id=? AND is_active=1', [product.id]),
      query(c.env, `SELECT r.*, u.name AS reviewer_name, u.avatar_url AS reviewer_avatar
             FROM reviews r JOIN users u ON r.user_id=u.id
             WHERE r.product_id=? AND r.status='approved' ORDER BY r.created_at DESC LIMIT 10`, [product.id]),
    ]);

    // Async view count
    query(c.env, 'UPDATE products SET view_count = view_count + 1 WHERE id = ?', [product.id]).catch(() => {});

    return c.json({ success: true, data: {
      ...product,
      specs:    specs.rows,
      variants: variants.rows,
      reviews:  reviews.rows.map((r) => ({ ...r, images: tryParse(r.images, []) })),
    }});
  } catch (e) {
    console.error(e);
    return c.json({ success: false, message: 'Failed to fetch product' }, 500);
  }
});

// ── POST /api/products (admin) ────────────────────────────────
products.post('/', ...isAdmin, async (c) => {
  try {
    const { name, brand_id, category_id, price, sale_price, short_description,
            description, images=[], tags=[], status='draft', specs=[], variants=[], sku } = await c.req.json();
    if (!name || !price)
      return c.json({ success: false, message: 'name and price required' }, 400);

    const id      = uuid();
    const slug    = slugify(name) + '-' + Date.now();
    const skuCode = sku || 'SKU-' + Date.now();

    await query(c.env,
      `INSERT INTO products (id,name,slug,sku,brand_id,category_id,price,sale_price,
         short_description,description,images,tags,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, name, slug, skuCode, brand_id||null, category_id||null, price, sale_price||null,
       short_description||null, description||null, JSON.stringify(images), JSON.stringify(tags), status]
    );

    // Insert specs and variants in batch
    const writes = [];
    for (const s of specs) {
      writes.push({ sql: 'INSERT INTO product_specs (id,product_id,group_name,spec_key,spec_value,sort_order) VALUES (?,?,?,?,?,?)',
        params: [uuid(), id, s.group_name, s.spec_key, s.spec_value, s.sort_order||0] });
    }
    for (const v of variants) {
      writes.push({ sql: 'INSERT INTO product_variants (id,product_id,color,color_hex,storage,ram,extra_price,stock,low_stock_at,image_url) VALUES (?,?,?,?,?,?,?,?,?,?)',
        params: [uuid(), id, v.color, v.color_hex, v.storage, v.ram, v.extra_price||0, v.stock||0, v.low_stock_at||10, v.image_url||null] });
    }
    if (writes.length) {
      const { batch } = await import('../db.js');
      await batch(c.env, writes);
    }

    const { rows } = await query(c.env, 'SELECT * FROM products WHERE id = ?', [id]);
    return c.json({ success: true, data: { ...rows[0], images, tags } }, 201);
  } catch (e) {
    console.error(e);
    return c.json({ success: false, message: 'Failed to create product' }, 500);
  }
});

// ── PUT /api/products/:id (admin) ─────────────────────────────
products.put('/:id', ...isAdmin, async (c) => {
  const { name, price, sale_price, status, images, short_description,
          description, tags, is_featured } = await c.req.json();
  const { rows } = await query(c.env,
    `UPDATE products SET
       name = COALESCE(?,name), price = COALESCE(?,price), sale_price = ?,
       status = COALESCE(?,status), images = COALESCE(?,images),
       short_description = COALESCE(?,short_description), description = COALESCE(?,description),
       tags = COALESCE(?,tags), is_featured = COALESCE(?,is_featured),
       updated_at = datetime('now') WHERE id = ? RETURNING *`,
    [name, price, sale_price, status,
     images ? JSON.stringify(images) : null,
     short_description, description,
     tags ? JSON.stringify(tags) : null,
     is_featured !== undefined ? (is_featured ? 1 : 0) : null,
     c.req.param('id')]
  );
  if (!rows.length) return c.json({ success: false, message: 'Product not found' }, 404);
  return c.json({ success: true, data: rows[0] });
});

// ── DELETE /api/products/:id (admin) ─────────────────────────
products.delete('/:id', ...isAdmin, async (c) => {
  await query(c.env, "UPDATE products SET status='archived' WHERE id=?", [c.req.param('id')]);
  return c.json({ success: true, message: 'Product archived' });
});

// Utility
const tryParse = (val, fallback) => {
  if (!val) return fallback;
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return fallback; }
};

export default products;
