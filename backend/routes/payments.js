// ============================================================
// routes/payments.js — Payment processing
// ============================================================
const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authenticate } = require('../middleware/auth');

// Get payment methods
router.get('/methods', async (req, res) => {
  res.json({ success: true, data: ['bkash', 'nagad', 'ssl_commerz', 'card'] });
});

// Process payment
router.post('/', authenticate, async (req, res) => {
  res.json({ success: true, message: 'Payment initiated' });
});

module.exports = router;
