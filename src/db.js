'use strict';

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. On Railway: add a variable DATABASE_URL = ${{Postgres.DATABASE_URL}}');
  console.error('For local development without Postgres, set DATABASE_URL=memory');
  process.exit(1);
}

const SEED_COMPANIES = [
  { name: 'Baystate Benefit Services', domain: 'baystatebenefits.com', website: 'https://www.baystatebenefits.com/' },
  { name: 'Central Boston Elder Services', domain: 'centralboston.org', website: 'https://centralboston.org/' },
];

if (DATABASE_URL === 'memory') {
  const mem = require('./db-memory');
  module.exports = { ...mem, migrate: () => mem.migrate(SEED_COMPANIES) };
  return;
}

// Railway's private network (*.railway.internal) and local dev don't speak TLS; the public proxy does.
const needsSsl = !/railway\.internal|localhost|127\.0\.0\.1/.test(DATABASE_URL) && process.env.PGSSL !== 'disable';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  max: 5,
});

pool.on('error', (err) => console.error('[pg] idle client error', err));

/** Idempotent schema setup + seed. Safe to run on every boot. */
async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registered_companies (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      domain      TEXT NOT NULL,
      website     TEXT,
      invite_link TEXT,                              -- where this company's people land after submitting
      passcode    TEXT,                              -- reserved; not used by the form yet
      active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE registered_companies ADD COLUMN IF NOT EXISTS invite_link TEXT;
    ALTER TABLE registered_companies ADD COLUMN IF NOT EXISTS passcode TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS registered_companies_name_key ON registered_companies (lower(name));
    CREATE UNIQUE INDEX IF NOT EXISTS registered_companies_domain_key ON registered_companies (lower(domain));

    CREATE TABLE IF NOT EXISTS form_submissions (
      id                   SERIAL PRIMARY KEY,
      company_name         TEXT,                     -- exactly what the user typed / picked (null if left blank)
      matched_company_id   INTEGER REFERENCES registered_companies(id) ON DELETE SET NULL,
      matched_company_name TEXT,                     -- denormalized so it survives renames
      match_method         TEXT,                     -- selected | name | domain | none
      match_confidence     NUMERIC(4,3),
      email                TEXT NOT NULL,
      email_domain         TEXT,
      full_name            TEXT NOT NULL,
      phone                TEXT NOT NULL,
      city                 TEXT NOT NULL,
      state                TEXT NOT NULL,            -- 2-letter code
      preview_type         TEXT NOT NULL DEFAULT 'independent', -- executive | employee | hr | independent
      url_params           JSONB,                    -- every query param on the embed URL
      page_url             TEXT,                     -- parent funnel page, when known
      redirect_url         TEXT,                     -- where we sent them after submitting
      ip                   TEXT,
      user_agent           TEXT,
      ghl_webhook_status   TEXT,                     -- sent | failed | skipped
      ghl_webhook_response TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE form_submissions ALTER COLUMN company_name DROP NOT NULL;
    ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS redirect_url TEXT;
    CREATE INDEX IF NOT EXISTS form_submissions_created_at_idx ON form_submissions (created_at DESC);
    CREATE INDEX IF NOT EXISTS form_submissions_email_idx ON form_submissions (lower(email));
    CREATE INDEX IF NOT EXISTS form_submissions_company_idx ON form_submissions (matched_company_id);
  `);

  for (const c of SEED_COMPANIES) {
    await pool.query(
      `INSERT INTO registered_companies (name, domain, website)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [c.name, c.domain, c.website]
    );
  }
}

// ---------- Registered companies ----------

/** Public shape for the form's dropdown — never exposes invite_link or passcode. */
async function listCompanies() {
  const { rows } = await pool.query(
    `SELECT id, name, domain, website FROM registered_companies WHERE active ORDER BY name`
  );
  return rows;
}

/** Everything the server needs to route a submission (active companies only). */
async function listCompaniesForRouting() {
  const { rows } = await pool.query(
    `SELECT id, name, domain, website, invite_link FROM registered_companies WHERE active ORDER BY name`
  );
  return rows;
}

/** Admin view: all columns, inactive included. */
async function listCompaniesAdmin() {
  const { rows } = await pool.query(
    `SELECT id, name, domain, website, invite_link, passcode, active, created_at, updated_at
       FROM registered_companies ORDER BY active DESC, name`
  );
  return rows;
}

async function addCompany({ name, domain, website, invite_link, passcode }) {
  const { rows } = await pool.query(
    `INSERT INTO registered_companies (name, domain, website, invite_link, passcode)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, domain, website, invite_link, passcode, active, created_at, updated_at`,
    [name, domain, website || null, invite_link || null, passcode || null]
  );
  return rows[0];
}

async function updateCompany(id, { name, domain, website, invite_link, passcode, active }) {
  const { rows } = await pool.query(
    `UPDATE registered_companies
        SET name = $2, domain = $3, website = $4, invite_link = $5, passcode = $6, active = $7, updated_at = now()
      WHERE id = $1
      RETURNING id, name, domain, website, invite_link, passcode, active, created_at, updated_at`,
    [id, name, domain, website || null, invite_link || null, passcode || null, active]
  );
  return rows[0] || null;
}

async function deleteCompany(id) {
  const { rowCount } = await pool.query(`DELETE FROM registered_companies WHERE id = $1`, [id]);
  return rowCount > 0;
}

// ---------- Submissions ----------

async function insertSubmission(s) {
  const { rows } = await pool.query(
    `INSERT INTO form_submissions
       (company_name, matched_company_id, matched_company_name, match_method, match_confidence,
        email, email_domain, full_name, phone, city, state, preview_type, url_params, page_url, redirect_url, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING id, created_at`,
    [s.company_name, s.matched_company_id, s.matched_company_name, s.match_method, s.match_confidence,
     s.email, s.email_domain, s.full_name, s.phone, s.city, s.state, s.preview_type,
     s.url_params ? JSON.stringify(s.url_params) : null, s.page_url, s.redirect_url, s.ip, s.user_agent]
  );
  return rows[0];
}

async function updateWebhookStatus(id, status, response) {
  await pool.query(
    `UPDATE form_submissions SET ghl_webhook_status = $2, ghl_webhook_response = $3 WHERE id = $1`,
    [id, status, response ? String(response).slice(0, 2000) : null]
  );
}

async function listSubmissions({ limit = 100, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM form_submissions ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

module.exports = {
  pool, migrate,
  listCompanies, listCompaniesForRouting, listCompaniesAdmin, addCompany, updateCompany, deleteCompany,
  insertSubmission, updateWebhookStatus, listSubmissions,
};
