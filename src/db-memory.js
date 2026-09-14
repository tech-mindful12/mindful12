'use strict';

/**
 * In-memory stand-in for db.js so the form can run locally without Postgres.
 * Enabled with DATABASE_URL=memory. Same interface as db.js; nothing persists.
 */
const companies = [];
const submissions = [];
let nextCompanyId = 1;
let nextSubmissionId = 1;

const pool = { query: async () => ({ rows: [] }) };

async function migrate(seed) {
  for (const c of seed) {
    if (!companies.some((x) => x.name.toLowerCase() === c.name.toLowerCase())) {
      companies.push({ id: nextCompanyId++, active: true, ...c });
    }
  }
  console.warn('[db] Using in-memory database — submissions will NOT persist');
}

async function listCompanies() {
  return companies.filter((c) => c.active).map(({ id, name, domain, website }) => ({ id, name, domain, website }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function addCompany({ name, domain, website }) {
  if (companies.some((c) => c.name.toLowerCase() === name.toLowerCase() || c.domain.toLowerCase() === domain.toLowerCase())) {
    const err = new Error('duplicate'); err.code = '23505'; throw err;
  }
  const row = { id: nextCompanyId++, name, domain, website: website || null, active: true };
  companies.push(row);
  return { id: row.id, name, domain, website: row.website };
}

async function insertSubmission(s) {
  const row = { id: nextSubmissionId++, created_at: new Date(), ghl_webhook_status: null, ghl_webhook_response: null, ...s };
  submissions.push(row);
  return { id: row.id, created_at: row.created_at };
}

async function updateWebhookStatus(id, status, response) {
  const row = submissions.find((s) => s.id === id);
  if (row) { row.ghl_webhook_status = status; row.ghl_webhook_response = response || null; }
}

async function getSubmissionStatus(id, token) {
  const s = submissions.find((x) => x.id === id && x.wait_token === token);
  return s ? { id: s.id, private_channel_link: s.private_channel_link || null, ghl_webhook_status: s.ghl_webhook_status, created_at: s.created_at } : null;
}

async function setPrivateLink({ submissionId, email, link, contactId }) {
  const candidates = submissions
    .filter((s) => (submissionId ? s.id === submissionId : email && s.email.toLowerCase() === email.toLowerCase()))
    .sort((a, b) => (a.private_channel_link ? 1 : 0) - (b.private_channel_link ? 1 : 0) || b.created_at - a.created_at);
  const row = candidates[0];
  if (!row) return null;
  row.private_channel_link = link;
  row.ghl_contact_id = contactId || row.ghl_contact_id || null;
  row.link_received_at = new Date();
  return { id: row.id, email: row.email };
}

async function listSubmissions({ limit = 100, offset = 0 } = {}) {
  return submissions.slice().reverse().slice(offset, offset + limit);
}

module.exports = {
  pool, migrate, listCompanies, addCompany, insertSubmission, updateWebhookStatus,
  getSubmissionStatus, setPrivateLink, listSubmissions,
};
