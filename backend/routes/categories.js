// ============================================================
// routes/categories.js — Product categories
// ============================================================
const express = require('express');
const router = express.Router();
const { query } = require('../database/db');

// Get all categories
router.get('/', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM categories WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

module.exports = router;
