'use strict';

const path = require('path');
const express = require('express');
const db = require('./db');
const ghl = require('./ghl');
const match = require('../public/match.js');
const locations = require('../data/us-locations.json');

const PORT = process.env.PORT || 3000;
const GHL_WEBHOOK_URL = ghl.config.webhookUrl;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
// Where the form sends people after a successful submit. May contain {id}, {email}, {preview_type}, {company_id}.
const REDIRECT_URL = process.env.REDIRECT_URL || '';

const STATE_CODES = new Set(locations.states.map((s) => s.code));

// Preview types (set via URL on the embed). Company name is only collected for the first two.
const PREVIEW_TYPES = ['executive', 'employee', 'hr', 'independent'];
const DEFAULT_PREVIEW_TYPE = 'independent';
const COMPANY_REQUIRED_FOR = new Set(['executive', 'employee']);

const app = express();
app.set('trust proxy', true); // Railway sits behind a proxy; needed for req.ip
app.disable('x-powered-by');

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// The form is meant to be iframed inside GHL funnel pages — explicitly allow any parent.
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  next();
});

// CORS for the JSON API so the form could also be called from a page on another origin.
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
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
    });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'down', error: err.message });
  }
});

// ---------- Public API used by the form ----------

app.get('/api/companies', async (req, res, next) => {
  try {
    res.json(await db.listCompanies());
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

app.post('/api/submissions', async (req, res, next) => {
  const b = req.body || {};
  const input = {
    company_name: str(b.company_name),
    company_id: b.company_id ? parseInt(b.company_id, 10) : null,
    email: str(b.email).toLowerCase(),
    full_name: str(b.full_name),
    phone: str(b.phone, 40),
    city: str(b.city, 120),
    state: str(b.state, 2).toUpperCase(),
    preview_type: PREVIEW_TYPES.includes(str(b.preview_type, 120).toLowerCase()) ? str(b.preview_type, 120).toLowerCase() : DEFAULT_PREVIEW_TYPE,
    url_params: b.url_params && typeof b.url_params === 'object' ? b.url_params : null,
    page_url: str(b.page_url, 2000) || null,
  };

  const errors = {};
  if (COMPANY_REQUIRED_FOR.has(input.preview_type) && !input.company_name) errors.company_name = 'Company name is required';
  if (!EMAIL_RE.test(input.email)) errors.email = 'Enter a valid email address';
  if (!input.full_name) errors.full_name = 'Full name is required';
  if (input.phone.replace(/\D/g, '').length < 10) errors.phone = 'Enter a valid phone number';
  if (!input.city) errors.city = 'City is required';
  if (!STATE_CODES.has(input.state)) errors.state = 'Select a state';
  if (Object.keys(errors).length) return res.status(422).json({ ok: false, errors });

  try {
    // Resolve the registered company. The server is the final authority, whatever the browser sent.
    const companies = await db.listCompanies();
    const result = match.match(companies, input.company_name, input.email);
    let matched = null, method = 'none', confidence = null;

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

    const row = await db.insertSubmission({
      ...input,
      company_name: input.company_name || null,
      matched_company_id: matched ? matched.id : null,
      matched_company_name: matched ? matched.name : null,
      match_method: method,
      match_confidence: confidence,
      email_domain: match.emailDomain(input.email),
      ip: req.ip,
      user_agent: str(req.get('user-agent'), 500),
    });

    // Respond immediately; the webhook runs after and records its own outcome.
    res.status(201).json({
      ok: true,
      id: row.id,
      matched_company: matched ? { id: matched.id, name: matched.name } : null,
      match_method: method,
      redirect_url: buildRedirect({ id: row.id, email: input.email, preview_type: input.preview_type, company_id: matched ? matched.id : '' }),
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
      phone: input.phone,
      city: input.city,
      state: input.state,
      preview_type: input.preview_type,
      page_url: input.page_url,
      url_params: input.url_params,
    }).catch((err) => console.error('[ghl] unexpected error', err));
  } catch (err) { next(err); }
});

function buildRedirect(vars) {
  if (!REDIRECT_URL) return null;
  return REDIRECT_URL.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? encodeURIComponent(vars[key]) : m));
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

// ---------- Admin API (X-Admin-Key header) ----------

function requireAdmin(req, res, next) {
  if (!ADMIN_API_KEY) return res.status(404).json({ error: 'Admin API disabled (ADMIN_API_KEY not set)' });
  if (req.get('x-admin-key') !== ADMIN_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.post('/api/companies', requireAdmin, async (req, res, next) => {
  const name = str(req.body.name), domain = match.rootDomain(str(req.body.domain)), website = str(req.body.website, 500);
  if (!name || !domain) return res.status(422).json({ error: 'name and domain are required' });
  try {
    res.status(201).json(await db.addCompany({ name, domain, website }));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A company with that name or domain already exists' });
    next(err);
  }
});

app.get('/api/submissions', requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    res.json(await db.listSubmissions({ limit, offset }));
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
