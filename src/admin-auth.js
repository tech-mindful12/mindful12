'use strict';

const crypto = require('crypto');
const { safeEqual } = require('./security');

/**
 * Password login for the admin panel (ADMIN_PASSWORD) that hands out a signed, stateless
 * session token good for SESSION_HOURS. The signing key is derived from the password, so
 * changing the password logs everyone out. No DB, survives redeploys.
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_HOURS = 12;
const secret = ADMIN_PASSWORD
  ? crypto.createHash('sha256').update('mindful12-admin-session:' + ADMIN_PASSWORD).digest()
  : null;

const isConfigured = () => Boolean(ADMIN_PASSWORD);

function sign(payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function login(password) {
  if (!isConfigured() || !safeEqual(password, ADMIN_PASSWORD)) return null;
  const exp = String(Date.now() + SESSION_HOURS * 3600 * 1000);
  return { token: `${exp}.${sign(exp)}`, expiresAt: Number(exp) };
}

function verify(token) {
  if (!isConfigured() || typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

/** Express middleware: Authorization: Bearer <token>. */
function requireSession(req, res, next) {
  if (!isConfigured()) return res.status(503).json({ ok: false, error: 'Admin panel disabled (ADMIN_PASSWORD not set)' });
  const auth = req.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!verify(token)) return res.status(401).json({ ok: false, error: 'Please sign in again' });
  next();
}

module.exports = { isConfigured, login, verify, requireSession, SESSION_HOURS };
