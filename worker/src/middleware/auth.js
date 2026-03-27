// ============================================================
// worker/src/middleware/auth.js — JWT auth via jose
// Replaces: jsonwebtoken
// ============================================================
import { SignJWT, jwtVerify } from 'jose';
import { query } from '../db.js';

const enc = (secret) => new TextEncoder().encode(secret);

// ── Sign tokens ───────────────────────────────────────────────
export const signAccessToken = (payload, env) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(env.JWT_EXPIRES_IN || '7d')
    .sign(enc(env.JWT_SECRET));

export const signRefreshToken = (payload, env) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(env.JWT_REFRESH_EXPIRES_IN || '30d')
    .sign(enc(env.JWT_REFRESH_SECRET));

// ── Verify access token middleware ────────────────────────────
export const authenticate = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer '))
      return c.json({ success: false, message: 'No token provided' }, 401);

    const token = authHeader.split(' ')[1];
    const { payload } = await jwtVerify(token, enc(c.env.JWT_SECRET));

    const { rows } = await query(
      c.env,
      'SELECT id, name, email, phone, role, is_blocked, tier FROM users WHERE id = $1',
      [payload.id]
    );

    if (!rows.length)
      return c.json({ success: false, message: 'User not found' }, 401);
    if (rows[0].is_blocked)
      return c.json({ success: false, message: 'Account is blocked' }, 403);

    c.set('user', rows[0]);
    await next();
  } catch (err) {
    const msg = err.code === 'ERR_JWT_EXPIRED' ? 'Token expired' : 'Invalid token';
    const code = err.code === 'ERR_JWT_EXPIRED' ? 'TOKEN_EXPIRED' : undefined;
    return c.json({ success: false, message: msg, ...(code && { code }) }, 401);
  }
};

// ── Optional auth ─────────────────────────────────────────────
export const optionalAuth = async (c, next) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (token) {
      const { payload } = await jwtVerify(token, enc(c.env.JWT_SECRET));
      const { rows } = await query(
        c.env,
        'SELECT id, name, role FROM users WHERE id = $1',
        [payload.id]
      );
      if (rows.length) c.set('user', rows[0]);
    }
  } catch {}
  await next();
};

// ── Role guard ────────────────────────────────────────────────
export const requireRole = (...roles) => async (c, next) => {
  const user = c.get('user');
  if (!user)
    return c.json({ success: false, message: 'Authentication required' }, 401);
  if (!roles.includes(user.role))
    return c.json({ success: false, message: 'Insufficient permissions' }, 403);
  await next();
};

export const isAdmin     = [authenticate, requireRole('admin', 'superadmin')];
export const isSuperAdmin = [authenticate, requireRole('superadmin')];
