'use strict';

/**
 * GoHighLevel configuration + API client.
 * The webhook is used today; the REST client is here for the endpoints that come next.
 */
const config = {
  webhookUrl: process.env.GHL_WEBHOOK_URL || '',
  locationId: process.env.GHL_LOCATION_ID || '',
  pitToken: process.env.GHL_PIT_TOKEN || '',
  apiBase: process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com',
  apiVersion: process.env.GHL_API_VERSION || '2021-07-28',
};

function isApiConfigured() {
  return Boolean(config.locationId && config.pitToken);
}

/** Authenticated call to the GHL REST API. Throws on non-2xx with the response body in the message. */
async function api(method, endpoint, body) {
  if (!isApiConfigured()) throw new Error('GHL API not configured (GHL_LOCATION_ID / GHL_PIT_TOKEN)');
  const resp = await fetch(config.apiBase + endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${config.pitToken}`,
      Version: config.apiVersion,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!resp.ok) {
    const err = new Error(`GHL ${method} ${endpoint} -> ${resp.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    err.status = resp.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Reading {{contact.private_channel_link}} back off the contact.
 *
 * GHL returns custom fields on a contact as [{ id, value }] — ids, not keys — so we look the
 * field id up once from the location's custom-field list (cached) and match on that. Some
 * responses do carry fieldKey/key, so those are honoured too.
 */
const CHANNEL_FIELD_KEY = (process.env.GHL_CHANNEL_LINK_FIELD || 'private_channel_link').replace(/^contact\./, '');
// "Private Community Invite Link" (contact.private_channel_link) on the Mindful12 location.
// Set GHL_CHANNEL_LINK_FIELD_ID to override; blank it to look the id up by key instead.
const CHANNEL_FIELD_ID = process.env.GHL_CHANNEL_LINK_FIELD_ID !== undefined
  ? process.env.GHL_CHANNEL_LINK_FIELD_ID.trim()
  : 'ZVPibuKKScCRcqDQWFFL';
const FIELD_CACHE_MS = 10 * 60 * 1000;
let fieldCache = { id: null, at: 0 };

async function channelFieldId() {
  if (CHANNEL_FIELD_ID) return CHANNEL_FIELD_ID;
  if (fieldCache.id && Date.now() - fieldCache.at < FIELD_CACHE_MS) return fieldCache.id;
  const data = await api('GET', `/locations/${config.locationId}/customFields`);
  const fields = (data && (data.customFields || data.customField)) || [];
  const wanted = fields.find((f) => {
    const key = String(f.fieldKey || f.key || '').replace(/^contact\./, '').toLowerCase();
    return key === CHANNEL_FIELD_KEY.toLowerCase();
  });
  fieldCache = { id: wanted ? wanted.id : null, at: Date.now() };
  return fieldCache.id;
}

async function findContactByEmail(email) {
  const qs = `?locationId=${encodeURIComponent(config.locationId)}&email=${encodeURIComponent(email)}`;
  try {
    const data = await api('GET', `/contacts/search/duplicate${qs}`);
    if (data && data.contact) return data.contact;
  } catch (err) {
    if (err.status && err.status !== 404 && err.status !== 400) throw err;
  }
  // Older/alternate lookup, in case the duplicate-search endpoint isn't available on this location.
  const alt = await api('GET', `/contacts/?locationId=${encodeURIComponent(config.locationId)}&query=${encodeURIComponent(email)}&limit=1`);
  const list = (alt && (alt.contacts || alt.contact)) || [];
  return Array.isArray(list) ? list[0] || null : list || null;
}

function readChannelField(contact, fieldId) {
  if (!contact) return '';
  const direct = contact[CHANNEL_FIELD_KEY];
  if (typeof direct === 'string' && direct) return direct;
  const fields = contact.customFields || contact.customField || [];
  for (const f of Array.isArray(fields) ? fields : []) {
    const key = String(f.fieldKey || f.key || '').replace(/^contact\./, '').toLowerCase();
    if ((fieldId && f.id === fieldId) || (key && key === CHANNEL_FIELD_KEY.toLowerCase())) {
      const v = f.value != null ? f.value : f.field_value;
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return '';
}

/** The contact's private channel link, or '' while GHL hasn't filled it in yet. */
async function getPrivateChannelLink(email) {
  if (!isApiConfigured()) return '';
  const fieldId = await channelFieldId().catch(() => null);
  const contact = await findContactByEmail(email);
  return readChannelField(contact, fieldId);
}

module.exports = { config, isApiConfigured, api, getPrivateChannelLink, readChannelField };
