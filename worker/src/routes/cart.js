// ============================================================
// worker/src/routes/cart.js — Cloudflare KV-backed cart
// Replaces: Redis (ioredis)
// ============================================================
import { Hono } from 'hono';
import { optionalAuth } from '../middleware/auth.js';
import { query } from '../db.js';

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
const getSessionId = (c, explicitId = null) => {
  const user = c.get('user');
  if (user) return `user_${user.id}`;
  const sessionToken = explicitId || c.req.header('cartId') || c.req.header('X-Session-Token') || c.req.query('session') || c.req.query('cartId');
  return sessionToken ? `guest_${sessionToken}` : null;
};

// ── GET /api/cart ─────────────────────────────────────────────
cart.get('/', optionalAuth, async (c) => {
  const sid = getSessionId(c);
  if (!sid) return c.json({ success: true, data: { items: [], subtotal: 0 } });
  
  const items = await getCart(c.env, sid);
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  return c.json({ success: true, data: { items, subtotal } });
});

// ── POST /api/cart — Add item ─────────────────────────────────
cart.post('/', optionalAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sid = getSessionId(c, body.cartId);
  if (!sid) return c.json({ success: false, message: 'Session required' }, 400);

  // Parse frontend format which wraps items: [{product_id, quantity}]
  let product_id, variant_id, quantity = 1;

  if (body.items && Array.isArray(body.items) && body.items.length > 0) {
    product_id = body.items[0].product_id;
    variant_id = body.items[0].variant_id;
    quantity = body.items[0].quantity || 1;
  } else {
    // Fallback if they sent a flat object
    product_id = body.product_id || body.productId;
    variant_id = body.variant_id || body.variantId;
    quantity = body.quantity || 1;
  }

  if (!product_id)
    return c.json({ success: false, message: 'product_id is required' }, 422);

  // Securely Fetch actual price and name from DB!
  const { rows } = await query(c.env, 
    `SELECT p.id, p.name, p.price, p.sale_price, p.images, v.id as var_id, v.color, v.storage 
     FROM products p 
     LEFT JOIN product_variants v ON v.id = ? AND v.product_id = p.id
     WHERE p.id = ?`, 
     [variant_id || null, product_id]
  );

  if (!rows || rows.length === 0) {
      return c.json({ success: false, message: 'Product not found in database' }, 404);
  }

  const p = rows[0];
  const finalPrice = parseFloat(p.sale_price || p.price);
  
  let imageUrl = null;
  try {
      const imgs = JSON.parse(p.images);
      if(imgs && imgs.length > 0) imageUrl = imgs[0];
  } catch(e) { /* ignore */ }

  const items = await getCart(c.env, sid);
  const key   = `${p.id}_${p.var_id || 'default'}`;
  const idx   = items.findIndex((i) => i.key === key);

  if (idx >= 0) {
    items[idx].quantity += parseInt(quantity);
  } else {
    items.push({ 
        key, 
        product_id: p.id, 
        variant_id: p.var_id || null, 
        name: p.name, 
        price: finalPrice, 
        image: imageUrl, // frontend uses item.image
        color: p.color || null, 
        storage: p.storage || null, 
        quantity: parseInt(quantity) 
    });
  }
  
  await saveCart(c.env, sid, items);
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  return c.json({ success: true, data: { items, subtotal } });
});

// ── PUT /api/cart/item — Update quantity ──────────────────────
cart.put('/item', optionalAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sid = getSessionId(c, body.cartId);
  if (!sid) return c.json({ success: false, message: 'Session required' }, 400);

  const product_id = body.productId || body.product_id;
  const variant_id = body.variantId || body.variant_id;
  const quantity = body.quantity;
  const key = `${product_id}_${variant_id || 'default'}`;

  const items = await getCart(c.env, sid);
  const idx   = items.findIndex((i) => i.key === key || (i.product_id === product_id && i.variant_id == variant_id));
  if (idx < 0) return c.json({ success: false, message: 'Item not found' }, 404);

  if (parseInt(quantity) <= 0) {
    items.splice(idx, 1);
  } else {
    items[idx].quantity = parseInt(quantity);
  }
  
  await saveCart(c.env, sid, items);
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  return c.json({ success: true, data: { items, subtotal } });
});

// ── POST /api/cart/item/remove — Remove item ──────────────────────
cart.post('/item/remove', optionalAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sid = getSessionId(c, body.cartId);
  if (!sid) return c.json({ success: false, message: 'Session required' }, 400);

  let items = await getCart(c.env, sid);
  const product_id = body.productId || body.product_id;
  const variant_id = body.variantId || body.variant_id;
  const keyToM = `${product_id}_${variant_id || 'default'}`;

  items = items.filter((i) => i.key !== keyToM && !(i.product_id === product_id && i.variant_id == variant_id));
  
  await saveCart(c.env, sid, items);
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  return c.json({ success: true, data: { items, subtotal } });
});

// ── DELETE /api/cart — Clear cart ────────────────────────────
cart.delete('/', optionalAuth, async (c) => {
  const sid = getSessionId(c);
  if (sid) await c.env.CART_KV.delete(cartKey(sid));
  return c.json({ success: true, message: 'Cart cleared' });
});

export default cart;
