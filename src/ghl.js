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

module.exports = { config, isApiConfigured, api };
