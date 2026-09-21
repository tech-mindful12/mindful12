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
      companies.push({ id: nextCompanyId++, active: true, invite_link: null, group_link: null, passcode: null, tag: null, created_at: new Date(), updated_at: new Date(), ...c });
    }
  }
  console.warn('[db] Using in-memory database — submissions will NOT persist');
}

const byName = (a, b) => a.name.localeCompare(b.name);
const publicShape = ({ id, name, domain, website }) => ({ id, name, domain, website });
const routingShape = ({ id, name, domain, website, invite_link, group_link, passcode }) => ({ id, name, domain, website, invite_link, group_link, passcode });

async function listCompanies() {
  return companies.filter((c) => c.active).sort(byName).map(publicShape);
}

async function listCompaniesForRouting() {
  return companies.filter((c) => c.active).sort(byName).map(routingShape);
}

async function listCompaniesAdmin() {
  return companies.slice().sort((a, b) => (b.active - a.active) || byName(a, b)).map((c) => ({ ...c }));
}

function assertUnique({ name, domain }, exceptId) {
  if (companies.some((c) => c.id !== exceptId && (c.name.toLowerCase() === name.toLowerCase() || c.domain.toLowerCase() === domain.toLowerCase()))) {
    const err = new Error('duplicate'); err.code = '23505'; throw err;
  }
}

async function addCompany({ name, domain, website, invite_link, group_link, passcode, tag }) {
  assertUnique({ name, domain });
  const row = { id: nextCompanyId++, name, domain, website: website || null, invite_link: invite_link || null, group_link: group_link || null, passcode: passcode || null, tag: tag || null, active: true, created_at: new Date(), updated_at: new Date() };
  companies.push(row);
  return { ...row };
}

async function updateCompany(id, { name, domain, website, invite_link, group_link, passcode, tag, active }) {
  const row = companies.find((c) => c.id === id);
  if (!row) return null;
  assertUnique({ name, domain }, id);
  Object.assign(row, { name, domain, website: website || null, invite_link: invite_link || null, group_link: group_link || null, passcode: passcode || null, tag: tag || null, active, updated_at: new Date() });
  return { ...row };
}

async function deleteCompany(id) {
  const i = companies.findIndex((c) => c.id === id);
  if (i === -1) return false;
  companies.splice(i, 1);
  submissions.forEach((s) => { if (s.matched_company_id === id) s.matched_company_id = null; });
  return true;
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

const questions = [];
let nextQuestionId = 1;

async function insertQuestion(q) {
  const row = { id: nextQuestionId++, created_at: new Date(), ghl_webhook_status: null, ghl_webhook_response: null, ...q };
  questions.push(row);
  return { id: row.id, created_at: row.created_at };
}

async function updateQuestionWebhookStatus(id, status, response) {
  const row = questions.find((q) => q.id === id);
  if (row) { row.ghl_webhook_status = status; row.ghl_webhook_response = response || null; }
}

async function listQuestions({ limit = 100, offset = 0 } = {}) {
  return questions.slice().reverse().slice(offset, offset + limit);
}

async function listSubmissions({ limit = 100, offset = 0 } = {}) {
  return submissions.slice().reverse().slice(offset, offset + limit);
}

module.exports = {
  pool, migrate,
  listCompanies, listCompaniesForRouting, listCompaniesAdmin, addCompany, updateCompany, deleteCompany,
  insertSubmission, updateWebhookStatus, listSubmissions,
  insertQuestion, updateQuestionWebhookStatus, listQuestions,
};
