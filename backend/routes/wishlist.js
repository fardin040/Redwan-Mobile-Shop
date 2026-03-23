// ============================================================
// routes/wishlist.js — Wishlist management
// ============================================================
const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authenticate } = require('../middleware/auth');

// Get wishlist
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM wishlist_items WHERE user_id = $1', [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch wishlist' });
  }
});

module.exports = router;
