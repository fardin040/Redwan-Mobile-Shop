// ============================================================
// routes/cart.js — Redis-backed cart
// ============================================================
const express = require('express');
const router = express.Router();
const redis = require('../services/redis');
const { authenticate, optionalAuth } = require('../middleware/auth');

const cartKey = (req) => req.user ? `cart:user:${req.user.id}` : `cart:guest:${req.headers['x-guest-id'] || 'anon'}`;

router.get('/',    optionalAuth, async (req, res) => {
  try {
    const data = await redis.get(cartKey(req));
    res.json({ success: true, data: data ? JSON.parse(data) : [] });
  } catch (e) {
    res.json({ success: true, data: [] });
  }
});

router.post('/add', optionalAuth, async (req, res) => {
  try {
    const { product_id, variant_id, quantity = 1, name, price, image_url, color, storage } = req.body;
    const key  = cartKey(req);
    const data = await redis.get(key);
    const cart = data ? JSON.parse(data) : [];

    const idx = cart.findIndex(i => i.product_id === product_id && i.variant_id === variant_id);
    if (idx >= 0) cart[idx].quantity += quantity;
    else cart.push({ product_id, variant_id, quantity, name, price, image_url, color, storage });

    await redis.setex(key, 7 * 24 * 3600, JSON.stringify(cart));
    res.json({ success: true, data: cart });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to add to cart' });
  }
});

router.put('/update', optionalAuth, async (req, res) => {
  try {
    const { product_id, variant_id, quantity } = req.body;
    const key  = cartKey(req);
    const data = await redis.get(key);
    let cart   = data ? JSON.parse(data) : [];

    if (quantity <= 0) cart = cart.filter(i => !(i.product_id === product_id && i.variant_id === variant_id));
    else {
      const idx = cart.findIndex(i => i.product_id === product_id && i.variant_id === variant_id);
      if (idx >= 0) cart[idx].quantity = quantity;
    }
    await redis.setex(key, 7 * 24 * 3600, JSON.stringify(cart));
    res.json({ success: true, data: cart });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to update cart' });
  }
});

router.delete('/clear', optionalAuth, async (req, res) => {
  try {
    await redis.del(cartKey(req));
    res.json({ success: true, message: 'Cart cleared' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to clear cart' });
  }
});

module.exports = router;
