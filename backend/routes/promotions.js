// ============================================================
// routes/promotions.js — Coupons and promotions
// ============================================================
const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authenticate } = require('../middleware/auth');

// Get active promotions
router.get('/', async (req, res) => {
  res.json({ success: true, data: [] });
});

// Validate coupon
router.post('/validate-coupon', authenticate, async (req, res) => {
  res.json({ success: true, discount: 0 });
});

module.exports = router;
