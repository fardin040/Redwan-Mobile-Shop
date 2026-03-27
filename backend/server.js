// ============================================================
// Redwan Mobile Shop — Backend Server
// Stack: Node.js + Express + PostgreSQL + Redis
// Cloudflare-ready: proxy trust, real IP, CDN cache headers
// ============================================================

require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const morgan       = require('morgan');
const compression  = require('compression');
const path         = require('path');
const { pool }     = require('./database/db');
const { SCHEMA }   = require('./database/schema');

const app = express();

// ── Trust Cloudflare proxy ────────────────────────────────────
// Cloudflare sits between clients and server — trust 1 proxy hop
// so req.ip, rate limiting, and logs use the REAL client IP
app.set('trust proxy', 1);

// ── Real IP middleware (Cloudflare sends CF-Connecting-IP) ────
app.use((req, res, next) => {
  req.realIP =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.ip;
  next();
});

// ── Force HTTPS behind Cloudflare proxy ───────────────────────
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] &&
    req.headers['x-forwarded-proto'] !== 'https'
  ) {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

// ── Cloudflare country/ray info (optional logging) ────────────
app.use((req, res, next) => {
  req.cfCountry = req.headers['cf-ipcountry'] || 'XX';
  req.cfRay     = req.headers['cf-ray'] || null;
  next();
});

// ── Auto-run database migrations on startup ────────────────
(async () => {
  try {
    const client = await pool.connect();
    console.log('🔄 Checking database schema...');
    
    // Check if users table exists
    const result = await client.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='users')`
    );
    
    if (!result.rows[0].exists) {
      console.log('⏳ Creating database schema...');
      await client.query(SCHEMA);
      console.log('✅ Database schema created successfully');
    } else {
      console.log('✅ Database schema already exists');
    }
    
    client.release();
  } catch (err) {
    console.warn('⚠️  Database setup warning:', err.message);
    // Don't exit - allow app to run with limited functionality
  }
})();

// ── Middleware ───────────────────────────────────────────────
// Helmet — adjusted for Cloudflare (CF handles its own HSTS/SSL)
app.use(helmet({
  // Cloudflare already handles SSL, but keep HSTS in app too
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  // Allow Cloudflare's CDN to embed content
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      fontSrc:    ["'self'", "fonts.gstatic.com", "data:"],
      imgSrc:     ["'self'", "data:", "res.cloudinary.com", "*.cloudflare.com"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Log real IP (CF-Connecting-IP) in morgan
morgan.token('real-ip', (req) => req.realIP || req.ip);
morgan.token('cf-ray',  (req) => req.cfRay  || '-');
app.use(morgan(process.env.NODE_ENV === 'production'
  ? ':real-ip :method :url :status :res[content-length] - :response-time ms [CF-Ray: :cf-ray]'
  : 'dev'
));

// ── Serve frontend static files with Cloudflare cache headers ─
// Cloudflare will cache these at the edge for faster global delivery
app.use(express.static(path.join(__dirname, '../frontend'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      // HTML: don't cache (always fresh)
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (/\.(js|css)$/.test(filePath)) {
      // JS/CSS: cache 7 days, CDN can cache
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    } else if (/\.(png|jpg|jpeg|gif|webp|svg|ico)$/.test(filePath)) {
      // Images: cache 30 days
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    } else if (/\.(woff|woff2|ttf|eot)$/.test(filePath)) {
      // Fonts: cache 1 year
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    // Cloudflare Vary header — important for proper caching
    res.setHeader('Vary', 'Accept-Encoding');
  },
}));

// ── Rate limiting (uses real IP via CF-Connecting-IP) ─────────
// keyGenerator uses req.realIP so Cloudflare's proxy IP isn't rate-limited
const realIPKeyGen = (req) => req.realIP || req.ip;

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: realIPKeyGen,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: realIPKeyGen,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: realIPKeyGen,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/send-otp', otpLimiter);

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/cart',       require('./routes/cart'));
app.use('/api/wishlist',   require('./routes/wishlist'));
app.use('/api/reviews',    require('./routes/reviews'));
app.use('/api/payments',   require('./routes/payments'));
app.use('/api/shipping',   require('./routes/shipping'));
app.use('/api/admin',      require('./routes/admin'));
app.use('/api/search',     require('./routes/search'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/upload',     require('./routes/upload'));

// ── Health check (no-cache so Cloudflare doesn't cache it) ────
app.get('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    timestamp: new Date(),
    version: '1.0.0',
    ip: req.realIP,
    country: req.cfCountry,
    ray: req.cfRay,
  });
});

// ── Serve frontend SPA routes ──────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    // Never cache HTML — always fresh from server
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
});

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status  = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Something went wrong'
    : err.message;
  res.status(status).json({ success: false, message });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅  Redwan Mobile Shop API running on port ${PORT}`);
  console.log(`📡  Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
