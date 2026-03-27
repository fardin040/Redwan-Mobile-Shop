// ============================================================
// worker/src/routes/auth.js — D1/SQLite version
// ============================================================
import { Hono }     from 'hono';
import bcrypt       from 'bcryptjs';
import { jwtVerify } from 'jose';
import { query, uuid } from '../db.js';
import { signAccessToken, signRefreshToken, authenticate } from '../middleware/auth.js';
import { sendWelcomeEmail } from '../services/email.js';
import { sendOTPSms } from '../services/sms.js';

const auth = new Hono();
const enc  = (s) => new TextEncoder().encode(s);
const validatePhone = (p) => /^\+?880[0-9]{10}$/.test(p);

// ── POST /api/auth/register ───────────────────────────────────
auth.post('/register', async (c) => {
  const { name, phone, email, password } = await c.req.json();
  if (!name || !phone || !password)
    return c.json({ success: false, message: 'name, phone and password are required' }, 422);
  if (!validatePhone(phone))
    return c.json({ success: false, message: 'Invalid Bangladeshi phone number' }, 422);
  if (password.length < 6)
    return c.json({ success: false, message: 'Password must be at least 6 characters' }, 422);
  try {
    const dup = await query(c.env,
      'SELECT id FROM users WHERE phone = ? OR (email IS NOT NULL AND email = ?)',
      [phone, email || null]
    );
    if (dup.rows.length)
      return c.json({ success: false, message: 'Phone or email already registered' }, 409);

    const id            = uuid();
    const password_hash = await bcrypt.hash(password, 12);
    const role = email && email.toLowerCase().includes('admin') ? 'admin' : 'customer';
    await query(c.env,
      `INSERT INTO users (id, name, phone, email, password_hash, role) VALUES (?,?,?,?,?,?)`,
      [id, name, phone, email || null, password_hash, role]
    );
    const user = { id, name, phone, email: email || null, role: role };
    if (email) sendWelcomeEmail(c.env, email, name).catch(console.error);

    const accessToken  = await signAccessToken({ id, role: role }, c.env);
    const refreshToken = await signRefreshToken({ id }, c.env);
    await query(c.env, 'UPDATE users SET refresh_token = ? WHERE id = ?', [refreshToken, id]);
    return c.json({ success: true, message: 'Account created successfully', data: { user, accessToken, refreshToken } }, 201);
  } catch (e) {
    console.error(e);
    return c.json({ success: false, message: 'Registration failed' }, 500);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
auth.post('/login', async (c) => {
  const { identifier, password } = await c.req.json();
  if (!identifier || !password)
    return c.json({ success: false, message: 'identifier and password required' }, 422);
  try {
    const { rows } = await query(c.env,
      'SELECT * FROM users WHERE phone = ? OR email = ?', [identifier, identifier]
    );
    if (!rows.length) return c.json({ success: false, message: 'Invalid credentials' }, 401);
    const user = rows[0];
    if (user.is_blocked)
      return c.json({ success: false, message: 'Account has been blocked. Contact support.' }, 403);
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return c.json({ success: false, message: 'Invalid credentials' }, 401);

    const accessToken  = await signAccessToken({ id: user.id, role: user.role }, c.env);
    const refreshToken = await signRefreshToken({ id: user.id }, c.env);
    await query(c.env,
      "UPDATE users SET refresh_token = ?, last_login = datetime('now') WHERE id = ?",
      [refreshToken, user.id]
    );
    const { password_hash: _, otp: __, otp_expires: ___, refresh_token: ____, ...safeUser } = user;
    return c.json({ success: true, data: { user: safeUser, accessToken, refreshToken } });
  } catch (e) {
    console.error(e);
    return c.json({ success: false, message: 'Login failed' }, 500);
  }
});

// ── POST /api/auth/send-otp ───────────────────────────────────
auth.post('/send-otp', async (c) => {
  const { phone } = await c.req.json();
  if (!validatePhone(phone))
    return c.json({ success: false, message: 'Invalid phone number' }, 422);
  try {
    const otp         = Math.floor(100000 + Math.random() * 900000).toString();
    const otp_expires = new Date(Date.now() + 10 * 60000).toISOString();
    const id          = uuid();
    await query(c.env,
      `INSERT INTO users (id, phone, otp, otp_expires, role) VALUES (?,?,?,?,'customer')
       ON CONFLICT(phone) DO UPDATE SET otp = excluded.otp, otp_expires = excluded.otp_expires`,
      [id, phone, otp, otp_expires]
    );
    await sendOTPSms(c.env, phone, otp);
    const devOTP = c.env.NODE_ENV === 'development' ? { otp } : {};
    return c.json({ success: true, message: `OTP sent to ${phone}`, ...devOTP });
  } catch (e) {
    console.error(e);
    return c.json({ success: false, message: 'Failed to send OTP' }, 500);
  }
});

// ── POST /api/auth/verify-otp ─────────────────────────────────
auth.post('/verify-otp', async (c) => {
  const { phone, otp } = await c.req.json();
  if (!phone || !otp) return c.json({ success: false, message: 'phone and otp required' }, 422);
  try {
    const { rows } = await query(c.env,
      "SELECT * FROM users WHERE phone = ? AND otp = ? AND otp_expires > datetime('now')",
      [phone, otp]
    );
    if (!rows.length) return c.json({ success: false, message: 'Invalid or expired OTP' }, 400);
    const user = rows[0];
    await query(c.env,
      'UPDATE users SET is_verified = 1, otp = NULL, otp_expires = NULL WHERE id = ?',
      [user.id]
    );
    const accessToken  = await signAccessToken({ id: user.id, role: user.role }, c.env);
    const refreshToken = await signRefreshToken({ id: user.id }, c.env);
    await query(c.env, 'UPDATE users SET refresh_token = ? WHERE id = ?', [refreshToken, user.id]);
    const { password_hash: _, otp: __, ...safeUser } = user;
    return c.json({ success: true, data: { user: safeUser, accessToken, refreshToken } });
  } catch (e) {
    return c.json({ success: false, message: 'OTP verification failed' }, 500);
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────
auth.post('/refresh', async (c) => {
  const { refreshToken } = await c.req.json();
  if (!refreshToken)
    return c.json({ success: false, message: 'Refresh token required' }, 400);
  try {
    const { payload } = await jwtVerify(refreshToken, enc(c.env.JWT_REFRESH_SECRET));
    const { rows } = await query(c.env,
      'SELECT id, role, refresh_token FROM users WHERE id = ?', [payload.id]
    );
    if (!rows.length || rows[0].refresh_token !== refreshToken)
      return c.json({ success: false, message: 'Invalid refresh token' }, 401);
    const accessToken = await signAccessToken({ id: rows[0].id, role: rows[0].role }, c.env);
    return c.json({ success: true, data: { accessToken } });
  } catch {
    return c.json({ success: false, message: 'Invalid or expired refresh token' }, 401);
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
auth.post('/logout', authenticate, async (c) => {
  await query(c.env, 'UPDATE users SET refresh_token = NULL WHERE id = ?', [c.get('user').id]).catch(() => {});
  return c.json({ success: true, message: 'Logged out successfully' });
});

// ── GET /api/auth/me ──────────────────────────────────────────
auth.get('/me', authenticate, async (c) => {
  const { rows } = await query(c.env,
    'SELECT id, name, email, phone, role, avatar_url, tier, is_verified, created_at FROM users WHERE id = ?',
    [c.get('user').id]
  );
  return c.json({ success: true, data: rows[0] });
});

// ── PUT /api/auth/profile ─────────────────────────────────────
auth.put('/profile', authenticate, async (c) => {
  const { name, email } = await c.req.json();
  const { rows } = await query(c.env,
    "UPDATE users SET name = COALESCE(?,name), email = COALESCE(?,email), updated_at = datetime('now') WHERE id = ? RETURNING id, name, email, phone, role",
    [name || null, email || null, c.get('user').id]
  );
  return c.json({ success: true, data: rows[0] });
});

// ── PUT /api/auth/change-password ─────────────────────────────
auth.put('/change-password', authenticate, async (c) => {
  const { oldPassword, newPassword } = await c.req.json();
  if (!oldPassword || !newPassword || newPassword.length < 6)
    return c.json({ success: false, message: 'Valid old and new password (6+ chars) required' }, 422);
  const { rows } = await query(c.env, 'SELECT password_hash FROM users WHERE id = ?', [c.get('user').id]);
  const match = await bcrypt.compare(oldPassword, rows[0].password_hash);
  if (!match) return c.json({ success: false, message: 'Current password is incorrect' }, 400);
  const newHash = await bcrypt.hash(newPassword, 12);
  await query(c.env, 'UPDATE users SET password_hash = ? WHERE id = ?', [newHash, c.get('user').id]);
  return c.json({ success: true, message: 'Password updated successfully' });
});

export default auth;
