// ============================================================
// worker/src/routes/products.js — Products CRUD
// ============================================================
import { Hono }   from 'hono';
import { query }  from '../db.js';
import { authenticate, optionalAuth, isAdmin } from '../middleware/auth.js';

const products = new Hono();

const slugify = (str) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ── GET /api/products ─────────────────────────────────────────
products.get('/', optionalAuth, async (c) => {
  try {
    const { page = '1', limit = '20', brand, category, minPrice, maxPrice,
            sort = 'newest', status = 'published' } = c.req.query();
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params  = [status];
    const filters = ['p.status = $1'];

    if (brand)    { params.push(brand);    filters.push(`b.slug = $${params.length}`); }
    if (category) { params.push(category); filters.push(`c.slug = $${params.length}`); }
    if (minPrice) { params.push(minPrice); filters.push(`COALESCE(p.sale_price,p.price) >= $${params.length}`); }
    if (maxPrice) { params.push(maxPrice); filters.push(`COALESCE(p.sale_price,p.price) <= $${params.length}`); }

    const sortMap = {
      newest: 'p.created_at DESC', oldest: 'p.created_at ASC',
      price_asc: 'COALESCE(p.sale_price,p.price) ASC',
      price_desc: 'COALESCE(p.sale_price,p.price) DESC',
      popular: 'p.total_sales DESC', rating: 'p.avg_rating DESC',
    };
    const orderBy = sortMap[sort] || 'p.created_at DESC';
    const where   = filters.join(' AND ');
    params.push(parseInt(limit), offset);

    const dataQ = `
      SELECT p.id,p.name,p.slug,p.sku,p.price,p.sale_price,p.images,
             p.avg_rating,p.review_count,p.total_sales,p.is_featured,
             b.name AS brand_name, b.slug AS brand_slug,
             c.name AS category_name, c.slug AS category_slug,
             (SELECT json_agg(json_build_object('color',v.color,'storage',v.storage,'stock',v.stock))
              FROM product_variants v WHERE v.product_id = p.id AND v.is_active=TRUE) AS variants
      FROM products p
      LEFT JOIN brands b     ON p.brand_id    = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where} ORDER BY ${orderBy}
      LIMIT $${params.length-1} OFFSET $${params.length}`;

    const countQ = `SELECT COUNT(*) FROM products p
      LEFT JOIN brands b ON p.brand_id=b.id LEFT JOIN categories c ON p.category_id=c.id
      WHERE ${where}`;

    const [data, count] = await Promise.all([
      query(c.env, dataQ, params),
      query(c.env, countQ, params.slice(0, -2)),
    ]);

    return c.json({
      success: true, data: data.rows,
      meta: { total: parseInt(count.rows[0].count), page: parseInt(page),
              limit: parseInt(limit), pages: Math.ceil(count.rows[0].count / parseInt(limit)) },
    });
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
       WHERE p.slug = $1 AND p.status = 'published'`,
      [c.req.param('slug')]
    );
    if (!rows.length) return c.json({ success: false, message: 'Product not found' }, 404);

    const product = rows[0];
    const [specs, variants, reviews] = await Promise.all([
      query(c.env, 'SELECT group_name,spec_key,spec_value,sort_order FROM product_specs WHERE product_id=$1 ORDER BY sort_order', [product.id]),
      query(c.env, 'SELECT * FROM product_variants WHERE product_id=$1 AND is_active=TRUE', [product.id]),
      query(c.env, `SELECT r.*,u.name AS reviewer_name,u.avatar_url AS reviewer_avatar
             FROM reviews r JOIN users u ON r.user_id=u.id
             WHERE r.product_id=$1 AND r.status='approved' ORDER BY r.created_at DESC LIMIT 10`, [product.id]),
    ]);

    // async view count
    query(c.env, 'UPDATE products SET view_count=view_count+1 WHERE id=$1', [product.id]).catch(() => {});

    return c.json({ success: true, data: { ...product, specs: specs.rows, variants: variants.rows, reviews: reviews.rows } });
  } catch (e) {
    return c.json({ success: false, message: 'Failed to fetch product' }, 500);
  }
});

// ── POST /api/products (admin) ────────────────────────────────
products.post('/', ...isAdmin, async (c) => {
  try {
    const { name, brand_id, category_id, price, sale_price, short_description,
            description, images = [], tags = [], status = 'draft',
            specs = [], variants = [], sku } = await c.req.json();

    if (!name || !price)
      return c.json({ success: false, message: 'name and price required' }, 400);

    const slug    = slugify(name) + '-' + Date.now();
    const skuCode = sku || 'SKU-' + Date.now();

    const { rows } = await query(c.env,
      `INSERT INTO products (name,slug,sku,brand_id,category_id,price,sale_price,
         short_description,description,images,tags,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name, slug, skuCode, brand_id||null, category_id||null, price, sale_price||null,
       short_description||null, description||null, JSON.stringify(images), tags, status]
    );
    const product = rows[0];

    for (const s of specs) {
      await query(c.env,
        'INSERT INTO product_specs (product_id,group_name,spec_key,spec_value,sort_order) VALUES ($1,$2,$3,$4,$5)',
        [product.id, s.group_name, s.spec_key, s.spec_value, s.sort_order||0]
      );
    }
    for (const v of variants) {
      await query(c.env,
        'INSERT INTO product_variants (product_id,color,color_hex,storage,ram,extra_price,stock,low_stock_at,image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [product.id, v.color, v.color_hex, v.storage, v.ram, v.extra_price||0, v.stock||0, v.low_stock_at||10, v.image_url||null]
      );
    }
    return c.json({ success: true, data: product }, 201);
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
    `UPDATE products SET name=COALESCE($1,name),price=COALESCE($2,price),
       sale_price=$3,status=COALESCE($4,status),images=COALESCE($5,images),
       short_description=COALESCE($6,short_description),description=COALESCE($7,description),
       tags=COALESCE($8,tags),is_featured=COALESCE($9,is_featured),updated_at=NOW()
     WHERE id=$10 RETURNING *`,
    [name, price, sale_price, status, images?JSON.stringify(images):null,
     short_description, description, tags, is_featured, c.req.param('id')]
  );
  if (!rows.length) return c.json({ success: false, message: 'Product not found' }, 404);
  return c.json({ success: true, data: rows[0] });
});

// ── DELETE /api/products/:id (admin) ─────────────────────────
products.delete('/:id', ...isAdmin, async (c) => {
  await query(c.env, "UPDATE products SET status='archived' WHERE id=$1", [c.req.param('id')]);
  return c.json({ success: true, message: 'Product archived' });
});

export default products;
