// ============================================================
// Redwan Mobile Shop — Backend Server
// Stack: Node.js + Express + PostgreSQL + Redis
// ============================================================

require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const morgan       = require('morgan');
const compression  = require('compression');
const path         = require('path');

const app = express();

// ── Middleware ───────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── Rate limiting ─────────────────────────────────────────────
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const authLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' }
});
const otpLimiter     = rateLimit({ windowMs: 60 * 1000, max: 5 });
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

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), version: '1.0.0' });
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
