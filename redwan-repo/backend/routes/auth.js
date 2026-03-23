// ============================================================
// routes/auth.js — Register, Login, OTP, Refresh, Logout
// ============================================================
const router    = require('express').Router();
const bcrypt    = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/db');
const { signAccessToken, signRefreshToken, authenticate } = require('../middleware/auth');
const { sendOTPSms, sendWelcomeEmail } = require('../services/notifications');
const redis     = require('../services/redis');
const jwt       = require('jsonwebtoken');

// ── Validation helpers ────────────────────────────────────────
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ success: false, errors: errors.array() });
  return null;
};

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register',
  [
    body('name').trim().notEmpty().isLength({ min: 2, max: 120 }),
    body('phone').trim().matches(/^\+?880[0-9]{10}$/),
    body('email').optional().isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
  ],
  async (req, res) => {
    const err = validate(req, res); if (err) return;
    const { name, phone, email, password } = req.body;
    try {
      // Check duplicate
      const dup = await query(
        'SELECT id FROM users WHERE phone = $1 OR (email IS NOT NULL AND email = $2)',
        [phone, email || null]
      );
      if (dup.rows.length)
        return res.status(409).json({ success: false, message: 'Phone or email already registered' });

      const password_hash = await bcrypt.hash(password, 12);
      const { rows } = await query(
        `INSERT INTO users (name, phone, email, password_hash, role)
         VALUES ($1, $2, $3, $4, 'customer') RETURNING id, name, phone, email, role`,
        [name, phone, email || null, password_hash]
      );
      const user = rows[0];

      // Send welcome email (async, don't await)
      if (email) sendWelcomeEmail(email, name).catch(console.error);

      const accessToken  = signAccessToken({ id: user.id, role: user.role });
      const refreshToken = signRefreshToken({ id: user.id });

      // Store refresh token
      await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

      res.status(201).json({ success: true, message: 'Account created successfully', data: { user, accessToken, refreshToken } });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, message: 'Registration failed' });
    }
  }
);

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login',
  [
    body('identifier').trim().notEmpty(),  // phone or email
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const err = validate(req, res); if (err) return;
    const { identifier, password } = req.body;
    try {
      const { rows } = await query(
        'SELECT * FROM users WHERE phone = $1 OR email = $1',
        [identifier]
      );
      if (!rows.length)
        return res.status(401).json({ success: false, message: 'Invalid credentials' });

      const user = rows[0];
      if (user.is_blocked)
        return res.status(403).json({ success: false, message: 'Your account has been blocked. Contact support.' });

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match)
        return res.status(401).json({ success: false, message: 'Invalid credentials' });

      const accessToken  = signAccessToken({ id: user.id, role: user.role });
      const refreshToken = signRefreshToken({ id: user.id });

      await query(
        'UPDATE users SET refresh_token = $1, last_login = NOW() WHERE id = $2',
        [refreshToken, user.id]
      );

      const { password_hash: _, otp: __, ...safeUser } = user;
      res.json({ success: true, data: { user: safeUser, accessToken, refreshToken } });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  }
);

// ── POST /api/auth/send-otp ───────────────────────────────────
router.post('/send-otp',
  [body('phone').trim().matches(/^\+?880[0-9]{10}$/)],
  async (req, res) => {
    const err = validate(req, res); if (err) return;
    const { phone } = req.body;
    try {
      const otp        = Math.floor(100000 + Math.random() * 900000).toString();
      const otp_expires = new Date(Date.now() + parseInt(process.env.OTP_EXPIRES_MINUTES || '10') * 60000);

      // Upsert user if new, or update OTP if existing
      await query(
        `INSERT INTO users (phone, otp, otp_expires, role)
         VALUES ($1, $2, $3, 'customer')
         ON CONFLICT (phone) DO UPDATE SET otp = $2, otp_expires = $3`,
        [phone, otp, otp_expires]
      );

      await sendOTPSms(phone, otp);

      // In dev: return OTP in response for testing
      const devOTP = process.env.NODE_ENV === 'development' ? { otp } : {};
      res.json({ success: true, message: `OTP sent to ${phone}`, ...devOTP });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
  }
);

// ── POST /api/auth/verify-otp ─────────────────────────────────
router.post('/verify-otp',
  [body('phone').trim().notEmpty(), body('otp').trim().isLength({ min: 6, max: 6 })],
  async (req, res) => {
    const err = validate(req, res); if (err) return;
    const { phone, otp } = req.body;
    try {
      const { rows } = await query(
        'SELECT * FROM users WHERE phone = $1 AND otp = $2 AND otp_expires > NOW()',
        [phone, otp]
      );
      if (!rows.length)
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

      const user = rows[0];
      await query(
        'UPDATE users SET is_verified = TRUE, otp = NULL, otp_expires = NULL WHERE id = $1',
        [user.id]
      );

      const accessToken  = signAccessToken({ id: user.id, role: user.role });
      const refreshToken = signRefreshToken({ id: user.id });
      await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

      const { password_hash: _, otp: __, ...safeUser } = user;
      res.json({ success: true, data: { user: safeUser, accessToken, refreshToken } });
    } catch (e) {
      res.status(500).json({ success: false, message: 'OTP verification failed' });
    }
  }
);

// ── POST /api/auth/refresh ────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(400).json({ success: false, message: 'Refresh token required' });
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const { rows } = await query(
      'SELECT id, role, refresh_token FROM users WHERE id = $1',
      [decoded.id]
    );
    if (!rows.length || rows[0].refresh_token !== refreshToken)
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });

    const accessToken = signAccessToken({ id: rows[0].id, role: rows[0].role });
    res.json({ success: true, data: { accessToken } });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  await query('UPDATE users SET refresh_token = NULL WHERE id = $1', [req.user.id]).catch(() => {});
  res.json({ success: true, message: 'Logged out successfully' });
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const { rows } = await query(
    'SELECT id, name, email, phone, role, avatar_url, tier, is_verified, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  res.json({ success: true, data: rows[0] });
});

// ── PUT /api/auth/profile ─────────────────────────────────────
router.put('/profile', authenticate,
  [body('name').optional().trim().isLength({ min: 2, max: 120 })],
  async (req, res) => {
    const { name, email } = req.body;
    const { rows } = await query(
      'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), updated_at = NOW() WHERE id = $3 RETURNING id, name, email, phone, role',
      [name || null, email || null, req.user.id]
    );
    res.json({ success: true, data: rows[0] });
  }
);

// ── PUT /api/auth/change-password ────────────────────────────
router.put('/change-password', authenticate,
  [body('oldPassword').notEmpty(), body('newPassword').isLength({ min: 6 })],
  async (req, res) => {
    const err = validate(req, res); if (err) return;
    const { oldPassword, newPassword } = req.body;
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const match = await bcrypt.compare(oldPassword, rows[0].password_hash);
    if (!match) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
    res.json({ success: true, message: 'Password updated successfully' });
  }
);

module.exports = router;
