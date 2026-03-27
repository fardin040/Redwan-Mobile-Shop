// ============================================================
// worker/src/index.js — Main Cloudflare Worker Entry Point
// Framework: Hono | Replaces: Express
// ============================================================
import { Hono }   from 'hono';
import { cors }   from 'hono/cors';
import { logger } from 'hono/logger';

import auth       from './routes/auth.js';
import products   from './routes/products.js';
import categories from './routes/categories.js';
import orders     from './routes/orders.js';
import cart       from './routes/cart.js';
import wishlist   from './routes/wishlist.js';
import reviews    from './routes/reviews.js';
import payments   from './routes/payments.js';
import shipping   from './routes/shipping.js';
import admin      from './routes/admin.js';
import search     from './routes/search.js';
import promotions from './routes/promotions.js';
import upload     from './routes/upload.js';

const app = new Hono();

// ── CORS ─────────────────────────────────────────────────────
app.use('*', async (c, next) => {
  const origin  = c.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  const handler = cors({
    origin,
    allowMethods:  ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders:  ['Content-Type', 'Authorization', 'X-Session-Token', 'X-Requested-With'],
    exposeHeaders: ['X-Request-Id'],
    credentials:   true,
    maxAge:        86400,
  });
  return handler(c, next);
});

// ── Logger ────────────────────────────────────────────────────
app.use('*', logger());

// ── Real IP from Cloudflare ───────────────────────────────────
app.use('*', async (c, next) => {
  c.set('realIP',
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Real-IP')        ||
    c.req.header('X-Forwarded-For')?.split(',')[0].trim() || 'unknown'
  );
  c.set('cfCountry', c.req.header('CF-IPCountry') || 'XX');
  c.set('cfRay',     c.req.header('CF-Ray')       || null);
  await next();
});

// ── Health Check ─────────────────────────────────────────────
app.get('/api/health', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    version:   '2.0.0',
    runtime:   'Cloudflare Workers',
    ip:        c.get('realIP'),
    country:   c.get('cfCountry'),
    ray:       c.get('cfRay'),
  });
});

// ── API Routes ────────────────────────────────────────────────
app.route('/api/auth',       auth);
app.route('/api/products',   products);
app.route('/api/categories', categories);
app.route('/api/orders',     orders);
app.route('/api/cart',       cart);
app.route('/api/wishlist',   wishlist);
app.route('/api/reviews',    reviews);
app.route('/api/payments',   payments);
app.route('/api/shipping',   shipping);
app.route('/api/admin',      admin);
app.route('/api/search',     search);
app.route('/api/promotions', promotions);
app.route('/api/upload',     upload);

// ── 404 Handler ───────────────────────────────────────────────
app.notFound((c) =>
  c.json({ success: false, message: 'Route not found' }, 404)
);

// ── Global Error Handler ──────────────────────────────────────
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({
    success: false,
    message: c.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
  }, err.status || 500);
});

export default app;
