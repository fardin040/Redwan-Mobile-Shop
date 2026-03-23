// ============================================================
// routes/products.js
// ============================================================
const router = require('express').Router();
const { query } = require('../database/db');
const { authenticate, optionalAuth, isAdmin } = require('../middleware/auth');
const { body, query: qv, validationResult } = require('express-validator');
const slugify = require('slugify');
const { v4: uuid } = require('uuid');

// ── GET /api/products ─────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1, limit = 20, brand, category, minPrice, maxPrice,
      ram, storage, network, sort = 'newest', status = 'published',
    } = req.query;

    const offset  = (parseInt(page) - 1) * parseInt(limit);
    const params  = [];
    const filters = ['p.status = $1'];
    params.push(status);

    if (brand) {
      params.push(brand);
      filters.push(`b.slug = $${params.length}`);
    }
    if (category) {
      params.push(category);
      filters.push(`c.slug = $${params.length}`);
    }
    if (minPrice) { params.push(minPrice); filters.push(`COALESCE(p.sale_price, p.price) >= $${params.length}`); }
    if (maxPrice) { params.push(maxPrice); filters.push(`COALESCE(p.sale_price, p.price) <= $${params.length}`); }

    const sortMap = {
      newest:     'p.created_at DESC',
      oldest:     'p.created_at ASC',
      price_asc:  'COALESCE(p.sale_price, p.price) ASC',
      price_desc: 'COALESCE(p.sale_price, p.price) DESC',
      popular:    'p.total_sales DESC',
      rating:     'p.avg_rating DESC',
    };
    const orderBy = sortMap[sort] || 'p.created_at DESC';
    const where   = filters.join(' AND ');

    params.push(parseInt(limit), offset);
    const dataQ = `
      SELECT p.id, p.name, p.slug, p.sku, p.price, p.sale_price, p.images,
             p.avg_rating, p.review_count, p.total_sales, p.is_featured,
             b.name AS brand_name, b.slug AS brand_slug,
             c.name AS category_name, c.slug AS category_slug,
             (SELECT json_agg(json_build_object('color', v.color, 'color_hex', v.color_hex, 'storage', v.storage, 'stock', v.stock))
              FROM product_variants v WHERE v.product_id = p.id AND v.is_active = TRUE) AS variants
      FROM products p
      LEFT JOIN brands b     ON p.brand_id    = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const countQ = `
      SELECT COUNT(*) FROM products p
      LEFT JOIN brands b     ON p.brand_id    = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where}
    `;
    const countParams = params.slice(0, params.length - 2);

    const [data, count] = await Promise.all([
      query(dataQ, params),
      query(countQ, countParams),
    ]);

    res.json({
      success: true,
      data:  data.rows,
      meta: { total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit),
              pages: Math.ceil(count.rows[0].count / limit) },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

// ── GET /api/products/:slug ───────────────────────────────────
router.get('/:slug', optionalAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, b.name AS brand_name, b.slug AS brand_slug,
              c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN brands b     ON p.brand_id    = b.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.slug = $1 AND p.status = 'published'`,
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Product not found' });

    const product = rows[0];

    // Parallel: specs, variants, reviews
    const [specs, variants, reviews] = await Promise.all([
      query('SELECT group_name, spec_key, spec_value, sort_order FROM product_specs WHERE product_id = $1 ORDER BY sort_order', [product.id]),
      query('SELECT * FROM product_variants WHERE product_id = $1 AND is_active = TRUE', [product.id]),
      query(`SELECT r.*, u.name AS reviewer_name, u.avatar_url AS reviewer_avatar
             FROM reviews r JOIN users u ON r.user_id = u.id
             WHERE r.product_id = $1 AND r.status = 'approved'
             ORDER BY r.created_at DESC LIMIT 10`, [product.id]),
    ]);

    // Increment view count async
    query('UPDATE products SET view_count = view_count + 1 WHERE id = $1', [product.id]).catch(() => {});

    res.json({ success: true, data: { ...product, specs: specs.rows, variants: variants.rows, reviews: reviews.rows } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch product' });
  }
});

// ── POST /api/products (admin) ────────────────────────────────
router.post('/', isAdmin, async (req, res) => {
  try {
    const { name, brand_id, category_id, price, sale_price, short_description, description,
            images = [], tags = [], status = 'draft', specs = [], variants = [], sku } = req.body;

    if (!name || !price) return res.status(400).json({ success: false, message: 'name and price required' });

    const slug    = slugify(name, { lower: true, strict: true }) + '-' + Date.now();
    const skuCode = sku || 'SKU-' + Date.now();

    const { rows } = await query(
      `INSERT INTO products (name, slug, sku, brand_id, category_id, price, sale_price,
         short_description, description, images, tags, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name, slug, skuCode, brand_id || null, category_id || null, price, sale_price || null,
       short_description || null, description || null, JSON.stringify(images), tags, status]
    );
    const product = rows[0];

    // Insert specs
    for (const s of specs) {
      await query(
        'INSERT INTO product_specs (product_id, group_name, spec_key, spec_value, sort_order) VALUES ($1,$2,$3,$4,$5)',
        [product.id, s.group_name, s.spec_key, s.spec_value, s.sort_order || 0]
      );
    }
    // Insert variants
    for (const v of variants) {
      await query(
        'INSERT INTO product_variants (product_id, color, color_hex, storage, ram, extra_price, stock, low_stock_at, image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [product.id, v.color, v.color_hex, v.storage, v.ram, v.extra_price || 0, v.stock || 0, v.low_stock_at || 10, v.image_url || null]
      );
    }

    res.status(201).json({ success: true, data: product });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to create product' });
  }
});

// ── PUT /api/products/:id (admin) ─────────────────────────────
router.put('/:id', isAdmin, async (req, res) => {
  const { name, price, sale_price, status, images, short_description, description, tags, is_featured } = req.body;
  const { rows } = await query(
    `UPDATE products SET
       name = COALESCE($1, name), price = COALESCE($2, price),
       sale_price = $3, status = COALESCE($4, status),
       images = COALESCE($5, images), short_description = COALESCE($6, short_description),
       description = COALESCE($7, description), tags = COALESCE($8, tags),
       is_featured = COALESCE($9, is_featured), updated_at = NOW()
     WHERE id = $10 RETURNING *`,
    [name, price, sale_price, status, images ? JSON.stringify(images) : null,
     short_description, description, tags, is_featured, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Product not found' });
  res.json({ success: true, data: rows[0] });
});

// ── DELETE /api/products/:id (admin) ─────────────────────────
router.delete('/:id', isAdmin, async (req, res) => {
  await query("UPDATE products SET status = 'archived' WHERE id = $1", [req.params.id]);
  res.json({ success: true, message: 'Product archived' });
});

module.exports = router;


// ============================================================
// routes/search.js
// ============================================================
const searchRouter = require('express').Router();

searchRouter.get('/', async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  if (!q?.trim()) return res.json({ success: true, data: [], meta: { total: 0 } });

  try {
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const term   = q.trim();

    const { rows } = await query(
      `SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.images,
              p.avg_rating, p.review_count,
              b.name AS brand_name, b.slug AS brand_slug,
              ts_rank(p.search_vector, plainto_tsquery('english', $1)) AS rank
       FROM products p
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.status = 'published'
         AND (p.search_vector @@ plainto_tsquery('english', $1)
              OR p.name ILIKE $2
              OR b.name ILIKE $2)
       ORDER BY rank DESC, p.total_sales DESC
       LIMIT $3 OFFSET $4`,
      [term, `%${term}%`, parseInt(limit), offset]
    );

    res.json({ success: true, data: rows, meta: { query: term, total: rows.length, page: parseInt(page) } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Search failed' });
  }
});

// Autocomplete
searchRouter.get('/suggest', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ success: true, data: [] });
  try {
    const { rows } = await query(
      `SELECT DISTINCT p.name, p.slug, b.name AS brand_name
       FROM products p LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.status = 'published' AND (p.name ILIKE $1 OR b.name ILIKE $1)
       LIMIT 8`,
      [`%${q}%`]
    );
    res.json({ success: true, data: rows });
  } catch {
    res.json({ success: true, data: [] });
  }
});

module.exports = searchRouter;
