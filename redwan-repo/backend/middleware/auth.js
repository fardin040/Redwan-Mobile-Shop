// ============================================================
// middleware/auth.js — JWT authentication middleware
// ============================================================
const jwt  = require('jsonwebtoken');
const { query } = require('../database/db');

// ── Sign tokens ───────────────────────────────────────────────
const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' });

// ── Verify access token middleware ────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await query(
      'SELECT id, name, email, phone, role, is_blocked, tier FROM users WHERE id = $1',
      [decoded.id]
    );

    if (!rows.length)
      return res.status(401).json({ success: false, message: 'User not found' });

    if (rows[0].is_blocked)
      return res.status(403).json({ success: false, message: 'Account is blocked' });

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ── Optional auth (doesn't fail if no token) ─────────────────
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await query('SELECT id, name, role FROM users WHERE id = $1', [decoded.id]);
      if (rows.length) req.user = rows[0];
    }
  } catch {}
  next();
};

// ── Role guard ────────────────────────────────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: 'Authentication required' });
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  next();
};

const isAdmin    = requireRole('admin', 'superadmin');
const isSuperAdmin = requireRole('superadmin');

module.exports = { authenticate, optionalAuth, requireRole, isAdmin, isSuperAdmin, signAccessToken, signRefreshToken };
