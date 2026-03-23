// ============================================================
// routes/search.js — Product search
// ============================================================
const express = require('express');
const router = express.Router();
const { query } = require('../database/db');

// Search products
router.get('/', async (req, res) => {
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
router.get('/suggest', async (req, res) => {
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

module.exports = router;
