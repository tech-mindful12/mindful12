# Mindful12

Railway service for Mindful12: an embeddable intake form (stored in Postgres, forwarded to GoHighLevel via webhook) and, going forward, the endpoints that talk to the GHL API.

## Stack

- Node 18+ / Express — `src/server.js`
- Postgres via `pg` — `src/db.js` (schema is created/seeded automatically on boot)
- Static form in `public/` — no build step
- Shared fuzzy company matcher `public/match.js` (used by both the browser and the server)

## Railway setup

1. **Service variables** (Railway → your service → Variables):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference to the Postgres service) |
   | `GHL_WEBHOOK_URL` | GHL inbound-webhook URL that receives each submission |
   | `GHL_LOCATION_ID` | GHL sub-account (location) ID |
   | `GHL_PIT_TOKEN` | GHL Private Integration Token |
   | `REDIRECT_URL` | Where to send people after submitting. Placeholders `{id}`, `{email}`, `{preview_type}`, `{company_id}` are filled per submission, e.g. `https://funnel.page/next?sid={id}&preview_type={preview_type}`. Blank = built-in thank-you card |
   | `ADMIN_API_KEY` | any long random string — enables the admin endpoints (optional) |

2. Deploy (push to `main`). On first boot the app creates the tables and seeds the two registered companies.
3. Add a public domain to the service (Settings → Networking). That domain is `YOUR-APP` below.
4. Check `https://YOUR-APP/health` → `{"ok":true,"db":"up",...}`.

## Embedding in a GHL funnel page

Add a **Custom HTML** element and paste:

```html
<div class="mindful12-form" data-preview-type="brochure"></div>
<script src="https://YOUR-APP/embed.js"></script>
```

For the full **HR Preview walkthrough** (7 steps ending in the form) add `data-page="preview"`:

```html
<div class="mindful12-form" data-page="preview" data-preview-type="hr"></div>
<script src="https://YOUR-APP/embed.js"></script>
```

That loads `public/preview.html` (steps in the HTML, styling in `flow.css`, Continue/Back in `flow.js`; Playfair Display headings, Inter body). The form is initialized on page load, so URL params apply even though it's only revealed on step 7; `?step=7` jumps straight to it.

`embed.js` renders the form in an auto-resizing iframe. Every `data-*` attribute becomes a form URL parameter, and **query parameters on the funnel page URL are forwarded too** (and win over `data-*`), so `https://funnel.page/preview?preview_type=video` sets the hidden Preview Type without touching the page.

The page can react to a submission: `document.addEventListener('mindful12:submitted', e => console.log(e.detail))`.

You can also iframe `https://YOUR-APP/?preview_type=...` directly. `https://YOUR-APP/demo.html` shows the embed working on a stand-in page.

### URL parameters

| Param | Effect |
|---|---|
| `step` | `preview.html` only — open on this step (1–7) |
| `preview_type` | `executive` \| `employee` \| `hr` \| `independent` (default `independent`). Hidden field, stored + sent to GHL; see below |
| `company`, `email`, `name`, `phone`, `city`, `state` | Prefill (state accepts `MA` or `Massachusetts`) |
| `bg` | `white` (default), `wave` (branded background image), `transparent` |
| `button` | Override the button label (default "Create My Account") |
| `success` | Override the thank-you text (only shown when no redirect is configured) |
| `redirect` | Override `REDIRECT_URL` for this embed (the *top* window is redirected) |
| anything else (`utm_*`, …) | Stored in `form_submissions.url_params` and sent to GHL |

### Preview types

The preview type sets the message above the form and whether Company Name is required. Visitors can click **Change?** to pick one of the other descriptions (radio list + Confirm), which updates the hidden `preview_type` that gets stored and sent to GHL.

| `preview_type` | Message | Company field |
|---|---|---|
| `executive` | You're here because your company is considering Mindful12. | required |
| `employee` | You're here because your company has invited you to preview Mindful12. | required |
| `hr` | You're here to see how Mindful12 could support your people. | required |
| `independent` (default) | You're exploring Mindful12 on your own. | optional — "If you don't have a company, leave this blank." |

Messages and options live in `PREVIEW_TYPES` at the top of `public/form.js`; the server-side list is in `src/server.js`.

## How company matching works

1. **Dropdown** — the Company Name field autocompletes from `registered_companies`.
2. **"Did you mean…?"** — if what they typed is a variation of a registered name (typo, missing "Services", acronym like `CBES`, "Bay State" vs "Baystate"), they're asked to confirm. Exact/near-exact matches attach silently.
3. **Email domain check** — if the email is on a company domain (not gmail/yahoo/etc.) that matches a registered company's domain, they're asked to confirm that company. If nothing was typed yet, it's filled in.
4. **Submit gate** — if a suggestion is pending, submit is blocked until they choose Yes or No.
5. **Server is the final authority** — on submit the server re-runs the matcher and records `matched_company_id`, `match_method` (`selected` | `name` | `domain` | `none`) and `match_confidence`, so borderline cases can be reviewed later.

## Database

**`registered_companies`** — `id, name, domain, website, active, created_at, updated_at`
Seeded with Baystate Benefit Services (`baystatebenefits.com`) and Central Boston Elder Services (`centralboston.org`).

**`form_submissions`** — every submission: `company_name` (as typed; null if left blank), `matched_company_id/name`, `match_method`, `match_confidence`, `email`, `email_domain`, `full_name`, `phone`, `city`, `state`, `preview_type`, `url_params` (jsonb), `page_url`, `ip`, `user_agent`, `ghl_webhook_status` (`sent` | `failed` | `skipped`), `ghl_webhook_response`, `created_at`.

## API

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | DB + config status |
| `GET` | `/api/companies` | Registered companies (for the dropdown) |
| `GET` | `/api/locations/states` | US states/territories |
| `GET` | `/api/locations/cities?state=MA` | Cities for a state |
| `POST` | `/api/submissions` | Store submission + fire GHL webhook |
| `POST` | `/api/companies` | Add a registered company — `{name, domain, website}` — header `X-Admin-Key` |
| `GET` | `/api/submissions?limit=100&offset=0` | List submissions — header `X-Admin-Key` |

Add a company:

```bash
curl -X POST https://YOUR-APP/api/companies -H "X-Admin-Key: $ADMIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Example Co","domain":"example.com","website":"https://example.com"}'
```

### GHL webhook payload

```json
{
  "submission_id": 42, "submitted_at": "2026-09-13T20:00:00Z",
  "company_name": "baystate benefits", "matched_company_id": 1,
  "matched_company_name": "Baystate Benefit Services", "matched_company_domain": "baystatebenefits.com",
  "match_method": "selected", "match_confidence": 1,
  "email": "jane@baystatebenefits.com", "full_name": "Jane Doe", "first_name": "Jane", "last_name": "Doe",
  "phone": "(617) 555-1234", "city": "Braintree", "state": "MA",
  "preview_type": "brochure", "page_url": "https://funnel.page/preview", "url_params": { "utm_source": "email" }
}
```

## Local development

```bash
npm install
DATABASE_URL=memory npm start      # in-memory DB, no Postgres needed (nothing persists)
npm test
```

Or point `DATABASE_URL` at a real Postgres (copy `.env.example` to `.env` and load it with your shell).

## Branding

Highlight `#2D67FF`, text `#0D2158`, Inter (body) + Playfair Display (walkthrough headings), 5px corner radius everywhere, white background; `public/assets/bg.jpg` is the wave background (compressed from the source PNG), shown with `?bg=wave`.
