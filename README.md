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
   | `ALLOWED_HOSTS` | Hosts allowed to embed the form / be redirect targets (default `mindful12.mycoursecreator360.com, mindful12.com, *.mindful12.com`) |
   | `REDIRECT_URL_INDEPENDENT`, `REDIRECT_URL_HR`, `REDIRECT_URL_EXECUTIVE`, `REDIRECT_URL_EMPLOYEE` | Where people with **no registered company** go after submitting, per preview type |
   | `REDIRECT_URL` | Generic fallback if the per-type one is blank. All redirect vars accept `{id}`, `{email}`, `{preview_type}`, `{company_id}` |
   | `ADMIN_PASSWORD` | Password for the admin panel at `/admin` |
   | `ADMIN_API_KEY` | Optional — lets scripts hit the admin API with an `X-Admin-Key` header |

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

That loads `public/preview.html` (steps in the HTML, styling in `flow.css`, Continue/Back in `flow.js`; Playfair Display headings, Inter body). The form is initialized on page load, so URL params apply even though it's only revealed on the last step; `?step=form` jumps straight to it.

The walkthrough adapts to `preview_type`: the HTML holds the HR version and `COPY` at the top of `flow.js` holds what differs — welcome copy, the pricing lead-in, and the "You're Ready to Begin" rows. Step 5 ("Why HR Leaders Start Here") is HR-only; step 6 ("Simple To Begin") is skipped for `independent`. Use one snippet per funnel page with the matching `data-preview-type`.

`embed.js` renders the form in an auto-resizing iframe. Every `data-*` attribute becomes a form URL parameter, and **query parameters on the funnel page URL are forwarded too** (and win over `data-*`), so `https://funnel.page/preview?preview_type=video` sets the hidden Preview Type without touching the page.

The page can react to a submission: `document.addEventListener('mindful12:submitted', e => console.log(e.detail))`.

You can also iframe `https://YOUR-APP/?preview_type=...` directly. `https://YOUR-APP/demo.html` shows the embed working on a stand-in page.

### URL parameters

| Param | Effect |
|---|---|
| `step` | `preview.html` only — open on this step number, or `form` for the last one |
| `preview_type` | `executive` \| `employee` \| `hr` \| `independent` (default `independent`). Hidden field, stored + sent to GHL; see below |
| `company`, `email`, `name`, `phone`, `city`, `state` | Prefill (state accepts `MA` or `Massachusetts`) |
| `bg` | `transparent` (default — the funnel page's background shows through), `white`, `wave` (branded background image) |
| `button` | Override the button label (default "Create My Account") |
| `success` | Override the thank-you text (only shown when no redirect is configured) |
| `redirect` | Override `REDIRECT_URL` for this embed — only honoured for hosts in `ALLOWED_HOSTS` (the *top* window is redirected) |
| anything else (`utm_*`, …) | Stored in `form_submissions.url_params` and sent to GHL |

### Preview types

The preview type sets the message above the form and whether Company Name is required. Visitors can click **Change?** to pick one of the other descriptions (radio list + Confirm), which updates the hidden `preview_type` that gets stored and sent to GHL.

| `preview_type` | Message | Company field |
|---|---|---|
| `executive` | You're here because your company is considering Mindful12. | shown, required |
| `employee` | You're here because your company has invited you to preview Mindful12. | shown, required |
| `hr` | You're here to see how Mindful12 could support your people. | hidden |
| `independent` (default) | You're exploring Mindful12 on your own. | hidden |

Phone is optional for everyone (validated only if entered).

Messages and options live in `PREVIEW_TYPES` at the top of `public/form.js`; the server-side list is in `src/server.js`.

## Setting the Stage pages

Two editions of the Monday "Setting the Stage" walkthrough (8 steps, same Continue/Back mechanics and styling as the signup flow), content from `Mindful12_Executive_Preview_Setting_the_Stage.pdf`:

- `https://YOUR-APP/setting-the-stage/executive` — `public/setting-the-stage-executive.html`, the PDF verbatim (8 steps)
- `https://YOUR-APP/setting-the-stage` — `public/setting-the-stage.html`, the non-executive copy (7 steps: Setting the Stage, The First Practice, Tomorrow Morning, Notice the Moment, Mindful Awareness, One Breath, The Beginning)

Embed with `data-page="stage"` or `data-page="stage-executive"`. `public/stage.js` keeps the "n / N" footer in sync and reports height to the embed.

## How company matching works

1. **Dropdown** — the Company Name field autocompletes from `registered_companies` via `GET /api/companies/lookup` once 3+ characters are typed. The browser never receives the list — only up to 3 close matches (names + ids) for what was typed, so registered companies can't be browsed.
2. **"Did you mean…?"** — if what they typed is a variation of a registered name (typo, missing "Services", acronym like `CBES`, "Bay State" vs "Baystate"), they're asked to confirm. Exact/near-exact matches attach silently.
3. **Email domain check** — if the email is on a company domain (not gmail/yahoo/etc.) that matches a registered company's domain, they're asked to confirm that company. If nothing was typed yet, it's filled in.
4. **Submit gate** — if a suggestion is pending, submit is blocked until they choose Yes or No.
5. **Server is the final authority** — on submit the server re-runs the matcher and records `matched_company_id`, `match_method` (`selected` | `name` | `domain` | `none`) and `match_confidence`, so borderline cases can be reviewed later.

## After submit: where people go

Decided server-side, in this order:

1. **Matched a registered company with an Invite Link** → that link (e.g. `https://login.mindful12.com/communities/groups/baystate-benefit-services/private-group?invite=invite`).
2. `?redirect=` on the embed URL, if it points at an allowed host.
3. `REDIRECT_URL_<PREVIEW_TYPE>` — e.g. `REDIRECT_URL_INDEPENDENT`, `REDIRECT_URL_HR`.
4. `REDIRECT_URL`.
5. Nothing configured → built-in thank-you card.

The chosen URL is stored on the submission (`redirect_url`) and included in the GHL webhook payload. The whole page (not just the iframe) is redirected.

## Admin panel

`https://YOUR-APP/admin` — password from `ADMIN_PASSWORD`. Edit registered companies inline (name, domain, website, **invite link**, passcode, tag, active), add new ones, delete. Sessions are signed tokens valid for 12 h; login is rate-limited (10 tries / 15 min per IP).

Embed it on a page like `mindful12.com/admin` with:

```html
<div class="mindful12-form" data-page="admin"></div>
<script src="https://YOUR-APP/embed.js"></script>
```

`passcode` is stored and editable but not used by the form yet.

## Security notes

- Only hosts in `ALLOWED_HOSTS` (plus the app itself) can iframe the form (`Content-Security-Policy: frame-ancestors`) or be `?redirect=` targets; the API only answers cross-origin requests from those hosts.
- `POST /api/submissions` is rate-limited (30 per IP per 10 min; 120 API requests per IP per minute) and has a honeypot field (`website`) — bots that fill it get a fake success and nothing is stored or sent to GHL.
- All DB access is parameterized; user input is never rendered as HTML; secrets stay in Railway env vars and never reach the browser.
- `trust proxy` is set to one hop so `req.ip` can't be spoofed with `X-Forwarded-For`.
- The embed shows a "taking longer than usual" message if the app doesn't respond within 10s.
- The registered-company list is never sent to the browser; `GET /api/companies/lookup` answers only for 3+ typed characters with at most 3 names, rate-limited. Invite links, passcodes, domains and websites are only readable through the authenticated admin API.
- Admin sessions are HMAC-signed tokens derived from `ADMIN_PASSWORD` (changing the password invalidates them); login attempts are rate-limited.

## Database

**`registered_companies`** — `id, name, domain, website, invite_link, passcode, tag, active, created_at, updated_at`
Seeded with Baystate Benefit Services (`baystatebenefits.com`) and Central Boston Elder Services (`centralboston.org`).

**`form_submissions`** — every submission: `company_name` (as typed; null if left blank), `matched_company_id/name`, `match_method`, `match_confidence`, `email`, `email_domain`, `full_name`, `phone`, `city`, `state`, `preview_type`, `url_params` (jsonb), `page_url`, `redirect_url`, `ip`, `user_agent`, `ghl_webhook_status` (`sent` | `failed` | `skipped`), `ghl_webhook_response`, `created_at`.

## API

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | DB + config status |
| `GET` | `/api/companies/lookup?q=&email=` | Up to 3 name matches for `q` (3+ chars) + email-domain match; names/ids only |
| `GET` | `/api/locations/states` | US states/territories |
| `GET` | `/api/locations/cities?state=MA` | Cities for a state |
| `POST` | `/api/submissions` | Store submission + fire GHL webhook; returns `id`, `matched_company`, `redirect_url` |
| `POST` | `/api/admin/login` | `{password}` → `{token}` (12 h) |
| `GET/POST` | `/api/admin/companies` | List / add — `Authorization: Bearer <token>` or `X-Admin-Key` |
| `PUT/DELETE` | `/api/admin/companies/:id` | Update / delete |
| `GET` | `/api/admin/submissions?limit=100&offset=0` | List submissions |

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
