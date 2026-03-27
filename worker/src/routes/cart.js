// ============================================================
// worker/src/routes/cart.js — Cloudflare KV-backed cart
// Replaces: Redis (ioredis)
// ============================================================
import { Hono } from 'hono';
import { optionalAuth } from '../middleware/auth.js';

const cart = new Hono();

const cartKey  = (id) => `cart:${id}`;
const CART_TTL = 86400 * 7; // 7 days

const getCart = async (env, id) => {
  const raw = await env.CART_KV.get(cartKey(id));
  return raw ? JSON.parse(raw) : [];
};

const saveCart = (env, id, items) =>
  env.CART_KV.put(cartKey(id), JSON.stringify(items), { expirationTtl: CART_TTL });

// Derive session ID: user ID or anonymous session token
const getSessionId = (c) => {
  const user = c.get('user');
  if (user) return `user_${user.id}`;
  const sessionToken = c.req.header('X-Session-Token') || c.req.query('session');
  return sessionToken ? `guest_${sessionToken}` : null;
};

// ── GET /api/cart ─────────────────────────────────────────────
cart.get('/', optionalAuth, async (c) => {
  const sid = getSessionId(c);
  if (!sid) return c.json({ success: true, data: [] });
  const items = await getCart(c.env, sid);
  return c.json({ success: true, data: items });
});

// ── POST /api/cart — Add item ─────────────────────────────────
cart.post('/', optionalAuth, async (c) => {
  const sid = getSessionId(c);
  if (!sid) return c.json({ success: false, message: 'Session required' }, 400);

  const { product_id, variant_id, name, price, image_url, color, storage, quantity=1 } = await c.req.json();
  if (!product_id || !name || !price)
    return c.json({ success: false, message: 'product_id, name and price are required' }, 422);

  const items = await getCart(c.env, sid);
  const key   = `${product_id}_${variant_id||'default'}`;
  const idx   = items.findIndex((i) => i.key === key);

  if (idx >= 0) {
    items[idx].quantity += parseInt(quantity);
  } else {
    items.push({ key, product_id, variant_id: variant_id||null, name, price, image_url, color, storage, quantity: parseInt(quantity) });
  }
  await saveCart(c.env, sid, items);
  return c.json({ success: true, data: items });
});

// ── PUT /api/cart/:key — Update quantity ──────────────────────
cart.put('/:key', optionalAuth, async (c) => {
  const sid = getSessionId(c);
  if (!sid) return c.json({ success: false, message: 'Session required' }, 400);

  const { quantity } = await c.req.json();
  const items = await getCart(c.env, sid);
  const idx   = items.findIndex((i) => i.key === c.req.param('key'));
  if (idx < 0) return c.json({ success: false, message: 'Item not found' }, 404);

  if (parseInt(quantity) <= 0) {
    items.splice(idx, 1);
  } else {
    items[idx].quantity = parseInt(quantity);
  }
  await saveCart(c.env, sid, items);
  return c.json({ success: true, data: items });
});

// ── DELETE /api/cart/:key — Remove item ──────────────────────
cart.delete('/:key', optionalAuth, async (c) => {
  const sid = getSessionId(c);
  if (!sid) return c.json({ success: false, message: 'Session required' }, 400);

  let items = await getCart(c.env, sid);
  items = items.filter((i) => i.key !== c.req.param('key'));
  await saveCart(c.env, sid, items);
  return c.json({ success: true, data: items });
});

// ── DELETE /api/cart — Clear cart ────────────────────────────
cart.delete('/', optionalAuth, async (c) => {
  const sid = getSessionId(c);
  if (sid) await c.env.CART_KV.delete(cartKey(sid));
  return c.json({ success: true, message: 'Cart cleared' });
});

export default cart;
