// ============================================================
// routes/upload.js — Image upload (Cloudinary)
// ============================================================
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Upload image
router.post('/', authenticate, async (req, res) => {
  res.json({ success: true, url: '/placeholder.jpg' });
});

module.exports = router;
