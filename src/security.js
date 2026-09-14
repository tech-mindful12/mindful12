'use strict';

const crypto = require('crypto');

/**
 * Hosts allowed to (a) iframe the form and (b) be redirect targets.
 * Override with ALLOWED_HOSTS="a.example.com, example.com, *.example.com".
 */
const DEFAULT_ALLOWED_HOSTS = ['mindful12.mycoursecreator360.com', 'mindful12.com', '*.mindful12.com'];

const allowedHosts = (process.env.ALLOWED_HOSTS || DEFAULT_ALLOWED_HOSTS.join(','))
  .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);

function hostAllowed(host) {
  host = String(host || '').toLowerCase().replace(/:\d+$/, '');
  if (!host) return false;
  return allowedHosts.some((pattern) =>
    pattern.startsWith('*.') ? host.endsWith(pattern.slice(1)) && host !== pattern.slice(2) : host === pattern
  );
}

/** Value for Content-Security-Policy: frame-ancestors. 'self' keeps demo.html working. */
function frameAncestors() {
  return ["'self'"].concat(allowedHosts.map((h) => `https://${h}`)).join(' ');
}

/** A redirect target supplied by the page URL is only honoured if it points at an allowed host. */
function safeRedirect(url) {
  try {
    const u = new URL(String(url || ''));
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && u.hostname === 'localhost')) return null;
    return hostAllowed(u.hostname) || u.hostname === 'localhost' ? u.href : null;
  } catch (e) {
    return null;
  }
}

/** Constant-time comparison for the admin key. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a || '')), bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb);
}

/**
 * Small in-memory rate limiter (one instance on Railway, so no shared store needed).
 * rateLimit({ windowMs, max }) -> express middleware. Keyed by req.ip.
 */
function rateLimit({ windowMs, max, message = 'Too many requests, please try again later.' }) {
  const hits = new Map(); // ip -> { count, resetAt }
  setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    let h = hits.get(req.ip);
    if (!h || h.resetAt <= now) { h = { count: 0, resetAt: now + windowMs }; hits.set(req.ip, h); }
    h.count += 1;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - h.count));
    if (h.count > max) {
      res.setHeader('Retry-After', Math.ceil((h.resetAt - now) / 1000));
      return res.status(429).json({ ok: false, error: message });
    }
    next();
  };
}

module.exports = { allowedHosts, hostAllowed, frameAncestors, safeRedirect, safeEqual, rateLimit };
