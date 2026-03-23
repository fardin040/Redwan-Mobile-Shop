// ============================================================
// routes/shipping.js — Courier and shipping management
// ============================================================
const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authenticate, isAdmin } = require('../middleware/auth');

// Get shipping providers
router.get('/providers', async (req, res) => {
  res.json({ success: true, data: ['pathao', 'steadfast'] });
});

// Track shipment
router.get('/track/:trackingId', async (req, res) => {
  res.json({ success: true, data: { status: 'shipped' } });
});

module.exports = router;
