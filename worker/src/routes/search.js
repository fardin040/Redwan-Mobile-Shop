// ============================================================
// worker/src/routes/search.js — Full-text product search
// ============================================================
import { Hono } from 'hono';
import { query } from '../db.js';

const search = new Hono();

search.get('/', async (c) => {
  const { q='', brand, category, minPrice, maxPrice,
          ram, storage, network, page='1', limit='20' } = c.req.query();

  const offset = (parseInt(page)-1)*parseInt(limit);
  const params = [];
  const filters = ["p.status='published'"];

  if (q.trim()) {
    params.push(q.trim());
    filters.push(`(p.search_vector @@ plainto_tsquery('english',$${params.length})
                  OR p.name ILIKE '%' || $${params.length} || '%')`);
  }
  if (brand)    { params.push(brand);    filters.push(`b.slug=$${params.length}`); }
  if (category) { params.push(category); filters.push(`c.slug=$${params.length}`); }
  if (minPrice) { params.push(minPrice); filters.push(`COALESCE(p.sale_price,p.price)>=$${params.length}`); }
  if (maxPrice) { params.push(maxPrice); filters.push(`COALESCE(p.sale_price,p.price)<=$${params.length}`); }
  if (ram)      { params.push(ram);      filters.push(`EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.ram=$${params.length})`); }
  if (storage)  { params.push(storage);  filters.push(`EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.storage=$${params.length})`); }
  if (network)  { params.push(`%${network}%`); filters.push(`p.tags::text ILIKE $${params.length}`); }

  const where = filters.join(' AND ');
  params.push(parseInt(limit), offset);

  const sql = `
    SELECT p.id,p.name,p.slug,p.price,p.sale_price,p.images,p.avg_rating,p.review_count,
           b.name AS brand_name, c.name AS category_name
    FROM products p
    LEFT JOIN brands b ON p.brand_id=b.id
    LEFT JOIN categories c ON p.category_id=c.id
    WHERE ${where}
    ORDER BY ${q.trim() ? `ts_rank(p.search_vector, plainto_tsquery('english',$1)) DESC,` : ''} p.created_at DESC
    LIMIT $${params.length-1} OFFSET $${params.length}`;

  const countSql = `SELECT COUNT(*) FROM products p
    LEFT JOIN brands b ON p.brand_id=b.id LEFT JOIN categories c ON p.category_id=c.id
    WHERE ${where}`;

  try {
    const [data, count] = await Promise.all([
      query(c.env, sql, params),
      query(c.env, countSql, params.slice(0,-2)),
    ]);
    return c.json({ success: true, data: data.rows,
      meta: { total: parseInt(count.rows[0].count), query: q, page: parseInt(page), limit: parseInt(limit) } });
  } catch (e) {
    console.error(e);
    return c.json({ success: false, message: 'Search failed' }, 500);
  }
});

export default search;
