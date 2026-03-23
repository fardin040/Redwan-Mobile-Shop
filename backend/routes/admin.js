// ============================================================
// routes/admin.js — Admin operations
// ============================================================
const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authenticate, isAdmin } = require('../middleware/auth');

// Get dashboard stats
router.get('/dashboard', authenticate, isAdmin, async (req, res) => {
  res.json({ success: true, data: { orders: 0, revenue: 0, users: 0 } });
});

// Get all orders
router.get('/orders', authenticate, isAdmin, async (req, res) => {
  res.json({ success: true, data: [] });
});

module.exports = router;
