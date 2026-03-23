// ============================================================
// routes/reviews.js — Product reviews
// ============================================================
const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authenticate, optionalAuth } = require('../middleware/auth');

// Get reviews for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM reviews WHERE product_id = $1 AND status = $2 ORDER BY created_at DESC',
      [req.params.productId, 'approved']
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

// Post a review
router.post('/', authenticate, async (req, res) => {
  res.json({ success: true, message: 'Review submitted' });
});

module.exports = router;
