// ============================================================
// worker/src/routes/search.js — D1 FTS5 full-text search
// Replaces: PostgreSQL tsvector / plainto_tsquery
// ============================================================
import { Hono } from 'hono';
import { query } from '../db.js';

const search = new Hono();

search.get('/', async (c) => {
  const { q='', brand, category, minPrice, maxPrice,
          ram, storage, page='1', limit='20' } = c.req.query();

  const offset = (parseInt(page)-1)*parseInt(limit);
  const params  = [];
  const filters = ["p.status = 'published'"];

  // Full-text search via FTS5 or LIKE fallback
  if (q.trim()) {
    params.push(`${q.trim()}*`);  // FTS5 prefix search
    filters.push(`p.id IN (SELECT id FROM products_fts WHERE products_fts MATCH ?)`);
  }
  if (brand)    { params.push(brand);    filters.push('b.slug = ?'); }
  if (category) { params.push(category); filters.push('c.slug = ?'); }
  if (minPrice) { params.push(minPrice); filters.push('COALESCE(p.sale_price,p.price) >= ?'); }
  if (maxPrice) { params.push(maxPrice); filters.push('COALESCE(p.sale_price,p.price) <= ?'); }
  if (ram)      { params.push(ram);      filters.push('EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.ram=?)'); }
  if (storage)  { params.push(storage);  filters.push('EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.storage=?)'); }

  const where = filters.join(' AND ');
  const countParams = [...params];
  params.push(parseInt(limit), offset);

  const sql = `
    SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.images, p.avg_rating, p.review_count,
           b.name AS brand_name, c.name AS category_name
    FROM products p
    LEFT JOIN brands b ON p.brand_id=b.id
    LEFT JOIN categories c ON p.category_id=c.id
    WHERE ${where}
    ORDER BY p.total_sales DESC, p.avg_rating DESC
    LIMIT ? OFFSET ?`;

  const countSql = `SELECT COUNT(*) AS total FROM products p
    LEFT JOIN brands b ON p.brand_id=b.id LEFT JOIN categories c ON p.category_id=c.id
    WHERE ${where}`;

  try {
    const [data, count] = await Promise.all([
      query(c.env, sql, params),
      query(c.env, countSql, countParams),
    ]);
    const rows = data.rows.map((r) => ({ ...r, images: tryParse(r.images, []) }));
    return c.json({ success: true, data: rows,
      meta: { total: count.rows[0]?.total || 0, query: q, page: parseInt(page), limit: parseInt(limit) } });
  } catch (e) {
    console.error(e);
    // Fallback to LIKE if FTS5 fails
    if (q.trim()) {
      const fallbackFilters = [`p.status='published'`, `(p.name LIKE ? OR p.short_description LIKE ?)`];
      const likeQ = `%${q.trim()}%`;
      const fParams = [likeQ, likeQ];
      if (brand)    { fParams.push(brand);    fallbackFilters.push('b.slug = ?'); }
      if (category) { fParams.push(category); fallbackFilters.push('c.slug = ?'); }
      fParams.push(parseInt(limit), offset);
      const { rows: fRows } = await query(c.env,
        `SELECT p.id,p.name,p.slug,p.price,p.sale_price,p.images,p.avg_rating FROM products p
         LEFT JOIN brands b ON p.brand_id=b.id LEFT JOIN categories c ON p.category_id=c.id
         WHERE ${fallbackFilters.join(' AND ')} LIMIT ? OFFSET ?`, fParams);
      return c.json({ success: true, data: fRows.map((r) => ({ ...r, images: tryParse(r.images, []) })),
        meta: { total: fRows.length, query: q } });
    }
    return c.json({ success: false, message: 'Search failed' }, 500);
  }
});

const tryParse = (val, fallback) => { try { return JSON.parse(val); } catch { return fallback; } };
export default search;
