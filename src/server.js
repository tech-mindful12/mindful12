'use strict';

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const express = require('express');
const db = require('./db');
const ghl = require('./ghl');
const security = require('./security');
const adminAuth = require('./admin-auth');
const match = require('../public/match.js');
const locations = require('../data/us-locations.json');

const PORT = process.env.PORT || 3000;
const GHL_WEBHOOK_URL = ghl.config.webhookUrl;
// FAQ "ask us directly" questions go here; falls back to the main webhook (payload carries event: "faq_question").
const GHL_QUESTION_WEBHOOK_URL = process.env.GHL_QUESTION_WEBHOOK_URL || GHL_WEBHOOK_URL;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

// Nobody is sent to the community until GHL has filled in {{contact.private_channel_link}} for them.
// It reaches us either way round: GHL posts it to /api/channel-link, or (when the API creds are set)
// we read it off the contact while the browser waits. Links are host-checked so a leaked secret
// can't turn this into an open redirect.
const CHANNEL_LINK_SECRET = process.env.CHANNEL_LINK_SECRET || ADMIN_API_KEY;
const CHANNEL_LINK_HOSTS = (process.env.CHANNEL_LINK_HOSTS || 'mindful12.com, *.mindful12.com')
  .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
const CHANNEL_POLL_MIN_MS = 3000;          // don't hit the GHL API more often than this per signup
const channelPollAt = new Map();           // submission id -> last GHL API call

const STATE_CODES = new Set(locations.states.map((s) => s.code));

// Preview types (set via URL on the embed). Company name is only collected from executive/employee visitors;
// hr sign-ups are filed under a fixed group and independents carry no company at all.
const PREVIEW_TYPES = ['executive', 'employee', 'hr', 'independent'];
const DEFAULT_PREVIEW_TYPE = 'independent';
const COMPANY_REQUIRED_FOR = new Set(['executive', 'employee']);
const HR_GROUP_NAME = 'HR Preview Group';

/**
 * Where people go after submitting, in priority order:
 *   1. the matched registered company's invite_link
 *   2. REDIRECT_URL_<PREVIEW_TYPE>  (REDIRECT_URL_INDEPENDENT, REDIRECT_URL_HR, _EXECUTIVE, _EMPLOYEE)
 *   3. REDIRECT_URL                 (generic fallback)
 * Env values may contain {id}, {email}, {preview_type}, {company_id}.
 */
const REDIRECT_URL = process.env.REDIRECT_URL || '';
const REDIRECT_BY_TYPE = Object.fromEntries(
  PREVIEW_TYPES.map((t) => [t, process.env[`REDIRECT_URL_${t.toUpperCase()}`] || ''])
);

/**
 * Community invite link sent to GHL with every sign-up (payload field `invite_link`):
 *   1. the matched registered company's invite_link
 *   2. INVITE_LINK_<PREVIEW_TYPE> env var
 *   3. the built-in default below (independent + HR groups)
 * Under-review sign-ups get the same link as everyone else; GHL decides what to do with it.
 */
const DEFAULT_INVITE_LINKS = {
  independent: 'https://login.mindful12.com/communities/groups/mindful-12/home?invite=6ab193a3df56a636ece3cba3',
  hr: 'https://login.mindful12.com/communities/groups/human-resource-preview-group/home?invite=6ab193bce68c82f54025d468',
};
const INVITE_BY_TYPE = Object.fromEntries(
  PREVIEW_TYPES.map((t) => [t, process.env[`INVITE_LINK_${t.toUpperCase()}`] || DEFAULT_INVITE_LINKS[t] || ''])
);

const app = express();
app.set('trust proxy', 1); // exactly one hop (Railway's proxy) so req.ip can't be spoofed via X-Forwarded-For
app.disable('x-powered-by');

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// Only the client's funnel domains (and this app itself) may iframe the form / admin panel.
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', `frame-ancestors ${security.frameAncestors()}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// The pages run same-origin inside the iframe, so CORS is only opened for allowed funnel domains.
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  let originHost = '';
  try { originHost = origin ? new URL(origin).hostname : ''; } catch (e) { /* ignore bad origin */ }
  if (origin && security.hostAllowed(originHost)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const apiLimiter = security.rateLimit({ windowMs: 60 * 1000, max: 120 });
// The channel-link poll is chatty by design and carries its own (larger) limit.
app.use('/api', (req, res, next) => (req.path === '/channel-link' && req.method === 'GET' ? next() : apiLimiter(req, res, next)));
const submitLimiter = security.rateLimit({ windowMs: 10 * 60 * 1000, max: 30, message: 'Too many submissions from this network. Please try again in a few minutes.' });
const loginLimiter = security.rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many sign-in attempts. Please wait 15 minutes.' });

// Pretty URLs.
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
// Setting the Stage walkthrough: general and executive editions. One embed can serve both:
// ?audience=executive or ?preview_type=executive on the host page URL picks the executive edition.
const STAGE_GENERAL = path.join(__dirname, '..', 'public', 'setting-the-stage.html');
const STAGE_EXEC = path.join(__dirname, '..', 'public', 'setting-the-stage-executive.html');
app.get('/setting-the-stage', (req, res) => {
  const a = String(req.query.audience || req.query.preview_type || '').toLowerCase();
  res.sendFile(a === 'executive' ? STAGE_EXEC : STAGE_GENERAL);
});
app.get('/setting-the-stage/executive', (req, res) => res.sendFile(STAGE_EXEC));
// The Reset Breath: read-along practice + guided audio.
app.get('/reset-breath', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'reset-breath.html')));
// FAQ with the app tour and an "ask us directly" form.
app.get('/faq', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'faq.html')));

// Email previews for review: the gallery, the manifest, and each built email (with sample merge data when ?sample=1).
const EMAILS_DIR = path.join(__dirname, '..', 'emails');
app.get('/email-previews', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'email-previews.html')));
app.get('/email-previews/manifest.json', (req, res) => res.sendFile(path.join(EMAILS_DIR, 'manifest.json')));
app.get('/email-previews/:file', (req, res) => {
  const file = String(req.params.file);
  if (!/^[\w.-]+\.html$/.test(file)) return res.status(404).end();
  const full = path.join(EMAILS_DIR, file);
  if (!full.startsWith(EMAILS_DIR) || !fs.existsSync(full)) return res.status(404).end();
  let html = fs.readFileSync(full, 'utf8');
  if (req.query.sample) {
    html = html
      .replace(/\{\{contact\.first_name\}\}/g, 'Jane')
      .replace(/\{\{unsubscribe_link\}\}/g, '<a href="#" style="color:#647483;">Unsubscribe</a>')
      // Button hrefs are GHL merge tags ({{contact.week_1_c}} etc). Keep the link clickable and show the tag on hover.
      .replace(/href="(\{\{[^}]+\}\})"/g, (m, tag) => `href="#" title="${tag}"`);
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(html);
});

// Form files revalidate on every load (so updates reach live embeds immediately); images cache for a day.
app.use(express.static(path.join(__dirname, '..', 'public'), {
  etag: true,
  setHeaders(res, filePath) {
    res.setHeader('Cache-Control', filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=86400' : 'no-cache');
  },
}));

app.get('/health', async (req, res) => {
  try {
    await db.pool.query('SELECT 1');
    res.json({
      ok: true,
      db: 'up',
      ghl: { webhook: GHL_WEBHOOK_URL ? 'configured' : 'missing', api: ghl.isApiConfigured() ? 'configured' : 'missing' },
      admin: adminAuth.isConfigured() ? 'configured' : 'missing',
    });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'down', error: err.message });
  }
});

// ---------- Public API used by the form ----------

/**
 * Autocomplete + "did you mean" without ever sending the registered-company list to the browser.
 * q needs 3+ characters to get name suggestions; email alone still answers the domain check.
 * Returns names and ids only (no domains, websites, invite links).
 */
const MIN_LOOKUP_CHARS = 3;
const lookupLimiter = security.rateLimit({ windowMs: 60 * 1000, max: 240 });
app.get('/api/companies/lookup', lookupLimiter, async (req, res, next) => {
  const q = str(req.query.q, 200);
  const email = str(req.query.email, 200).toLowerCase();
  const pub = (c) => (c ? { id: c.id, name: c.name } : null);
  try {
    const companies = await db.listCompanies();
    const nq = match.normalize(q);
    const r = match.match(companies, nq.length >= MIN_LOOKUP_CHARS ? q : '', email);
    // Dropdown: plain substring hits first (what autocomplete users expect), then fuzzy ones, max 3.
    const contains = nq.length >= MIN_LOOKUP_CHARS ? companies.filter((c) => match.normalize(c.name).includes(nq)) : [];
    const seen = new Set();
    const suggestions = contains.concat(r.suggestions.map((s) => s.company))
      .filter((c) => !seen.has(c.id) && seen.add(c.id)).slice(0, 3);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      suggestions: suggestions.map(pub),
      autoMatch: pub(r.autoMatch),
      best: r.best ? { ...pub(r.best.company), score: Number(r.best.score.toFixed(3)) } : null,
      byDomain: pub(r.byDomain),
    });
  } catch (err) { next(err); }
});

// ---------- Private channel link: the browser waits here until GHL has one ----------

/** https, and on a host we expect the community to live on. */
function isChannelLink(url) {
  let u;
  try { u = new URL(String(url)); } catch (e) { return false; }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  return CHANNEL_LINK_HOSTS.some((h) => (h.startsWith('*.') ? host === h.slice(2) || host.endsWith(h.slice(1)) : host === h));
}

const channelPollLimiter = security.rateLimit({ windowMs: 10 * 60 * 1000, max: 600 });

/**
 * Polled by the form after submitting. Answers "not yet" until the link exists — it never hands
 * back a fallback destination, so nobody is redirected without their own link.
 */
app.get('/api/channel-link', channelPollLimiter, async (req, res, next) => {
  const token = String(req.query.token || '').trim();
  res.setHeader('Cache-Control', 'no-store');
  if (!token) return res.status(400).json({ ready: false, error: 'Missing token' });
  try {
    const sub = await db.findSubmissionByToken(token);
    if (!sub) return res.status(404).json({ ready: false, error: 'Unknown token' });
    if (sub.private_channel_link) return res.json({ ready: true, url: sub.private_channel_link });
    if (sub.under_review) return res.json({ ready: false, under_review: true });

    // Nothing pushed to us yet — ask GHL directly, if we have API credentials.
    if (ghl.isApiConfigured()) {
      const last = channelPollAt.get(sub.id) || 0;
      if (Date.now() - last >= CHANNEL_POLL_MIN_MS) {
        channelPollAt.set(sub.id, Date.now());
        try {
          const link = await ghl.getPrivateChannelLink(sub.email);
          if (link && isChannelLink(link)) {
            await db.setChannelLink(sub.id, link);
            return res.json({ ready: true, url: link });
          }
          if (link) console.warn(`[channel-link] GHL returned a link on an unexpected host for #${sub.id}: ${link}`);
        } catch (err) {
          console.error('[channel-link] GHL lookup failed', err.message);
        }
      }
    }
    res.json({ ready: false });
  } catch (err) { next(err); }
});

/**
 * GHL pushes the link here the moment its workflow sets it (fastest path, and the only one when
 * no API credentials are configured). Auth: X-Channel-Key / Bearer against CHANNEL_LINK_SECRET.
 */
app.post('/api/channel-link', async (req, res, next) => {
  if (!CHANNEL_LINK_SECRET) {
    console.error('[channel-link] inbound post rejected: CHANNEL_LINK_SECRET is not set');
    return res.status(503).json({ ok: false, error: 'Channel link endpoint is not configured' });
  }
  const header = String(req.get('X-Channel-Key') || req.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const supplied = header || String((req.body && req.body.secret) || '');
  if (!security.safeEqual(supplied, CHANNEL_LINK_SECRET)) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const b = req.body || {};
  const link = String(b.private_channel_link || b.link || b.url || '').trim();
  const token = String(b.wait_token || b.token || '').trim();
  const email = String(b.email || '').trim();
  if (!isChannelLink(link)) return res.status(422).json({ ok: false, error: 'private_channel_link must be an https link on an allowed host' });
  if (!token && !email) return res.status(422).json({ ok: false, error: 'Send wait_token or email' });

  try {
    const sub = token ? await db.findSubmissionByToken(token) : await db.findPendingSubmissionByEmail(email);
    if (!sub) return res.status(404).json({ ok: false, error: 'No matching signup' });
    await db.setChannelLink(sub.id, link);
    res.json({ ok: true, submission_id: sub.id });
  } catch (err) { next(err); }
});

app.get('/api/locations/states', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.json(locations.states);
});

app.get('/api/locations/cities', (req, res) => {
  const state = String(req.query.state || '').toUpperCase();
  if (!STATE_CODES.has(state)) return res.status(400).json({ error: 'Unknown state code' });
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.json(locations.cities[state] || []);
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v, max = 200) => (v == null ? '' : String(v)).trim().slice(0, max);
const isHttpsUrl = (v) => { try { return new URL(v).protocol === 'https:'; } catch (e) { return false; } };

app.post('/api/submissions', submitLimiter, async (req, res, next) => {
  const b = req.body || {};

  // Honeypot: a hidden field real visitors never see. Bots fill it in — pretend success, store nothing.
  if (str(b.website)) return res.status(201).json({ ok: true, id: 0, matched_company: null, match_method: 'none', redirect_url: null });

  const input = {
    company_name: str(b.company_name),
    company_id: b.company_id ? parseInt(b.company_id, 10) : null,
    email: str(b.email).toLowerCase(),
    full_name: str(b.full_name),
    phone: str(b.phone, 40),
    city: str(b.city, 120),
    state: str(b.state, 2).toUpperCase(),
    passcode: str(b.passcode, 200),
    preview_type: PREVIEW_TYPES.includes(str(b.preview_type, 120).toLowerCase()) ? str(b.preview_type, 120).toLowerCase() : DEFAULT_PREVIEW_TYPE,
    url_params: sanitizeParams(b.url_params),
    page_url: str(b.page_url, 2000) || null,
    redirect: str(b.redirect, 2000),
  };

  const errors = {};
  if (COMPANY_REQUIRED_FOR.has(input.preview_type) && !input.company_name) errors.company_name = 'Company name is required';
  if (!EMAIL_RE.test(input.email)) errors.email = 'Enter a valid email address';
  if (!input.full_name) errors.full_name = 'Full name is required';
  const phoneDigits = input.phone.replace(/\D/g, '');
  if (phoneDigits.length && phoneDigits.length < 10) errors.phone = 'Enter a valid phone number, or leave it blank';
  if (!input.city) errors.city = 'City is required';
  if (!STATE_CODES.has(input.state)) errors.state = 'Select a state';
  if (Object.keys(errors).length) return res.status(422).json({ ok: false, errors });

  try {
    let matched = null, method = 'none', confidence = null;
    let underReview = false, reviewReason = null, passcodeVerified = false;

    if (input.preview_type === 'hr') {
      input.company_name = HR_GROUP_NAME;          // everyone in the HR preview is filed together
    } else if (input.preview_type === 'independent') {
      input.company_name = '';                     // no company at all
    } else {
      // Resolve the registered company. The server is the final authority, whatever the browser sent.
      const companies = await db.listCompaniesForRouting();
      const result = match.match(companies, input.company_name, input.email);
      const selected = input.company_id && companies.find((c) => c.id === input.company_id);
      if (selected) {
        matched = selected; method = 'selected'; confidence = 1;
      } else if (result.autoMatch) {
        matched = result.autoMatch; method = 'name'; confidence = result.best.score;
      } else if (result.byDomain) {
        matched = result.byDomain; method = 'domain'; confidence = result.best ? result.best.score : null;
      } else if (result.best) {
        // Close but not close enough to assert; record the score so it's reviewable.
        confidence = result.best.score;
      }

      // Employees + execs are only added automatically when their email is on their company's domain,
      // or when they give the company's passcode. A wrong passcode is a 422 so a typo can be fixed
      // (clearing the field submits for review instead).
      const emailRoot = match.rootDomain(match.emailDomain(input.email));
      if (input.preview_type === 'employee' && !matched) {
        underReview = true; reviewReason = 'company_not_registered';
      } else if (matched && emailRoot !== match.rootDomain(matched.domain)) {
        if (input.passcode) {
          if (matched.passcode && security.safeEqual(input.passcode.toLowerCase(), matched.passcode.trim().toLowerCase())) passcodeVerified = true;
          else return res.status(422).json({ ok: false, errors: { passcode: 'That passcode didn’t match. Check it with your company, or clear it to submit for review.' } });
        } else { underReview = true; reviewReason = 'email_domain_mismatch'; }
      }
    }

    const redirectUrl = underReview ? null : resolveRedirect({ matched, input, id: null });

    const waitToken = crypto.randomBytes(24).toString('hex');

    const row = await db.insertSubmission({
      ...input,
      company_name: input.company_name || null,
      phone: input.phone || null,
      matched_company_id: matched ? matched.id : null,
      matched_company_name: matched ? matched.name : null,
      match_method: method,
      match_confidence: confidence,
      email_domain: match.emailDomain(input.email),
      redirect_url: redirectUrl,
      under_review: underReview,
      review_reason: reviewReason,
      wait_token: waitToken,
      ip: req.ip,
      user_agent: str(req.get('user-agent'), 500),
    });

    // Placeholders like {id} need the row id, so fill them in now.
    const finalRedirect = fillPlaceholders(redirectUrl, { id: row.id, email: input.email, preview_type: input.preview_type, company_id: matched ? matched.id : '' });

    // Respond immediately; the webhook runs after and records its own outcome.
    res.status(201).json({
      ok: true,
      id: row.id,
      matched_company: matched ? { id: matched.id, name: matched.name } : null,
      match_method: method,
      redirect_url: finalRedirect,
      under_review: underReview,
      // The form waits on this instead of redirecting: no private channel link, no redirect.
      wait_token: underReview ? null : waitToken,
    });

    sendToGhl(row.id, {
      submission_id: row.id,
      submitted_at: row.created_at,
      company_name: input.company_name || null,
      matched_company_id: matched ? matched.id : null,
      matched_company_name: matched ? matched.name : null,
      matched_company_domain: matched ? matched.domain : null,
      match_method: method,
      match_confidence: confidence,
      email: input.email,
      full_name: input.full_name,
      first_name: input.full_name.split(/\s+/)[0],
      last_name: input.full_name.split(/\s+/).slice(1).join(' '),
      phone: input.phone || null,
      city: input.city,
      state: input.state,
      preview_type: input.preview_type,
      under_review: underReview,
      review_reason: reviewReason,
      passcode_verified: passcodeVerified,
      wait_token: waitToken,
      invite_link: resolveInviteLink({ matched, input }),
      group_link: matched && matched.group_link ? matched.group_link : null,
      redirect_url: finalRedirect,
      page_url: input.page_url,
      url_params: input.url_params,
    }).catch((err) => console.error('[ghl] unexpected error', err));
  } catch (err) { next(err); }
});

// ---------- FAQ: ask us directly ----------

const questionLimiter = security.rateLimit({ windowMs: 10 * 60 * 1000, max: 10, message: 'Too many questions from this network. Please try again in a few minutes.' });

app.post('/api/questions', questionLimiter, async (req, res, next) => {
  const b = req.body || {};
  if (str(b.website)) return res.status(201).json({ ok: true, id: 0 }); // honeypot

  const input = {
    name: str(b.name, 120),
    email: str(b.email).toLowerCase(),
    question: str(b.question, 4000),
    page_url: str(b.page_url, 2000) || null,
  };
  const errors = {};
  if (!input.name) errors.name = 'Name is required';
  if (!EMAIL_RE.test(input.email)) errors.email = 'Enter a valid email address';
  if (input.question.length < 5) errors.question = 'Tell us a little more';
  if (Object.keys(errors).length) return res.status(422).json({ ok: false, errors });

  try {
    const row = await db.insertQuestion({ ...input, ip: req.ip, user_agent: str(req.get('user-agent'), 500) });
    res.status(201).json({ ok: true, id: row.id });

    postWebhook(GHL_QUESTION_WEBHOOK_URL, {
      event: 'faq_question',
      question_id: row.id,
      submitted_at: row.created_at,
      full_name: input.name,
      first_name: input.name.split(/\s+/)[0],
      last_name: input.name.split(/\s+/).slice(1).join(' '),
      email: input.email,
      question: input.question,
      page_url: input.page_url,
    }).then(
      (r) => db.updateQuestionWebhookStatus(row.id, r.status, r.detail),
      (err) => console.error('[ghl] unexpected error', err)
    );
  } catch (err) { next(err); }
});

/** POST JSON to a GHL inbound webhook; resolves to { status: 'sent' | 'failed' | 'skipped', detail }. */
async function postWebhook(url, payload) {
  if (!url) return { status: 'skipped', detail: 'webhook URL not set' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    const text = await resp.text().catch(() => '');
    if (!resp.ok) console.error(`[ghl] webhook responded ${resp.status}`);
    return { status: resp.ok ? 'sent' : 'failed', detail: `${resp.status} ${text}` };
  } catch (err) {
    console.error('[ghl] webhook failed:', err.message);
    return { status: 'failed', detail: err.message };
  } finally {
    clearTimeout(timer);
  }
}

/** Company invite link (executive/employee) > ?redirect= (allowed hosts only) > per-preview-type env > generic env. */
function resolveInviteLink({ matched, input }) {
  if (matched && matched.invite_link && isHttpsUrl(matched.invite_link)) return matched.invite_link;
  return INVITE_BY_TYPE[input.preview_type] || null;
}

function resolveRedirect({ matched, input }) {
  if (matched && matched.invite_link && isHttpsUrl(matched.invite_link)) return matched.invite_link;
  return security.safeRedirect(input.redirect) || REDIRECT_BY_TYPE[input.preview_type] || REDIRECT_URL || null;
}

function fillPlaceholders(url, vars) {
  if (!url) return null;
  return url.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? encodeURIComponent(vars[key]) : m));
}

/** Keep url_params bounded: at most 40 keys, short strings only. */
function sanitizeParams(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const out = {};
  for (const key of Object.keys(p).slice(0, 40)) out[str(key, 100)] = str(p[key], 500);
  return Object.keys(out).length ? out : null;
}

async function sendToGhl(submissionId, payload) {
  if (!GHL_WEBHOOK_URL) {
    await db.updateWebhookStatus(submissionId, 'skipped', 'GHL_WEBHOOK_URL not set');
    return;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await resp.text().catch(() => '');
    await db.updateWebhookStatus(submissionId, resp.ok ? 'sent' : 'failed', `${resp.status} ${text}`);
    if (!resp.ok) console.error(`[ghl] webhook responded ${resp.status} for submission ${submissionId}`);
  } catch (err) {
    await db.updateWebhookStatus(submissionId, 'failed', err.message);
    console.error(`[ghl] webhook failed for submission ${submissionId}:`, err.message);
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Admin panel API (password login -> Bearer session token) ----------

app.post('/api/admin/login', loginLimiter, (req, res) => {
  if (!adminAuth.isConfigured()) return res.status(503).json({ ok: false, error: 'Admin panel disabled (ADMIN_PASSWORD not set)' });
  const session = adminAuth.login(str(req.body.password, 500));
  if (!session) return res.status(401).json({ ok: false, error: 'Incorrect password' });
  res.json({ ok: true, ...session });
});

app.get('/api/admin/session', adminAuth.requireSession, (req, res) => res.json({ ok: true }));

/** Accepts either an admin-panel session or the ADMIN_API_KEY header (for scripts). */
function requireAdmin(req, res, next) {
  if (ADMIN_API_KEY && security.safeEqual(req.get('x-admin-key'), ADMIN_API_KEY)) return next();
  return adminAuth.requireSession(req, res, next);
}

function parseCompany(body) {
  const b = body || {};
  const c = {
    name: str(b.name),
    domain: match.rootDomain(str(b.domain)),
    website: str(b.website, 500),
    invite_link: str(b.invite_link, 2000),
    group_link: str(b.group_link, 2000),
    passcode: str(b.passcode, 200),
    tag: str(b.tag, 100),
    active: b.active === undefined ? true : Boolean(b.active),
  };
  const errors = {};
  if (!c.name) errors.name = 'Name is required';
  if (!c.domain || !c.domain.includes('.')) errors.domain = 'Enter a domain like example.com';
  if (c.website && !/^https?:\/\//i.test(c.website)) c.website = 'https://' + c.website;
  if (c.invite_link && !isHttpsUrl(c.invite_link)) errors.invite_link = 'Invite link must start with https://';
  if (c.group_link && !isHttpsUrl(c.group_link)) errors.group_link = 'Group link must start with https://';
  return { company: c, errors };
}

function handleCompanyError(err, res, next) {
  if (err.code === '23505') return res.status(409).json({ ok: false, error: 'A company with that name or domain already exists' });
  next(err);
}

app.get('/api/admin/companies', requireAdmin, async (req, res, next) => {
  try { res.json({ ok: true, companies: await db.listCompaniesAdmin() }); } catch (err) { next(err); }
});

app.post('/api/admin/companies', requireAdmin, async (req, res, next) => {
  const { company, errors } = parseCompany(req.body);
  if (Object.keys(errors).length) return res.status(422).json({ ok: false, errors });
  try {
    res.status(201).json({ ok: true, company: await db.addCompany(company) });
  } catch (err) { handleCompanyError(err, res, next); }
});

app.put('/api/admin/companies/:id', requireAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const { company, errors } = parseCompany(req.body);
  if (!id) return res.status(400).json({ ok: false, error: 'Bad id' });
  if (Object.keys(errors).length) return res.status(422).json({ ok: false, errors });
  try {
    const updated = await db.updateCompany(id, company);
    if (!updated) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, company: updated });
  } catch (err) { handleCompanyError(err, res, next); }
});

app.delete('/api/admin/companies/:id', requireAdmin, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'Bad id' });
  try {
    const gone = await db.deleteCompany(id);
    if (!gone) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get('/api/admin/questions', requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    res.json({ ok: true, questions: await db.listQuestions({ limit, offset }) });
  } catch (err) { next(err); }
});

app.get('/api/admin/submissions', requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    res.json({ ok: true, submissions: await db.listSubmissions({ limit, offset }) });
  } catch (err) { next(err); }
});

// ---------- Errors ----------

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

db.migrate()
  .then(() => {
    app.listen(PORT, () => console.log(`Mindful12 listening on :${PORT}`));
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
