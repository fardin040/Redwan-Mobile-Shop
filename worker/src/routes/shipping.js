// ============================================================
// worker/src/routes/shipping.js — Pathao & Steadfast couriers
// ============================================================
import { Hono } from 'hono';
import { authenticate, isAdmin } from '../middleware/auth.js';

const shipping = new Hono();

// ── GET /api/shipping/rates ───────────────────────────────────
shipping.get('/rates', async (c) => {
  return c.json({
    success: true,
    data: [
      { method: 'standard',  name: 'Standard Delivery',  days: '3-5',  charge: 80  },
      { method: 'express',   name: 'Express Delivery',   days: '1-2',  charge: 150 },
      { method: 'same_day',  name: 'Same Day Delivery',  days: '0-1',  charge: 200 },
      { method: 'pickup',    name: 'Store Pickup',        days: '0',    charge: 0   },
    ],
  });
});

// ── POST /api/shipping/pathao/order (admin) ───────────────────
shipping.post('/pathao/order', ...isAdmin, async (c) => {
  try {
    const { orderId, ...shipmentData } = await c.req.json();

    // Pathao token
    const tokenRes = await fetch('https://hermes.pathao.com/aladdin/api/v1/issue-token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        client_id:     c.env.PATHAO_CLIENT_ID,
        client_secret: c.env.PATHAO_CLIENT_SECRET,
        username:      c.env.PATHAO_USERNAME,
        password:      c.env.PATHAO_PASSWORD,
        grant_type:    'password',
      }),
    });
    const tokenData = await tokenRes.json();

    const orderRes = await fetch('https://hermes.pathao.com/aladdin/api/v1/orders', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenData.access_token}` },
      body:    JSON.stringify(shipmentData),
    });
    const orderData = await orderRes.json();
    return c.json({ success: true, data: orderData });
  } catch (e) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

// ── POST /api/shipping/steadfast/order (admin) ────────────────
shipping.post('/steadfast/order', ...isAdmin, async (c) => {
  try {
    const shipmentData = await c.req.json();
    const res = await fetch('https://portal.steadfast.com.bd/api/v1/create_order', {
      method:  'POST',
      headers: {
        'Api-Key':    c.env.STEADFAST_API_KEY,
        'Secret-Key': c.env.STEADFAST_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shipmentData),
    });
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

// ── GET /api/shipping/track/:trackingId ───────────────────────
shipping.get('/track/:trackingId', async (c) => {
  return c.json({
    success: true,
    data: {
      tracking_id: c.req.param('trackingId'),
      message: 'Track your order via courier website',
      pathao:     'https://pathao.com/track',
      steadfast:  'https://portal.steadfast.com.bd',
    },
  });
});

export default shipping;
