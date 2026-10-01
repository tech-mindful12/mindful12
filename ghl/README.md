# GHL client portal code

Nothing in this folder runs from the repo or from Railway. It is the custom code pasted into
GoHighLevel, kept here so it has a history — a portal text box has none, and this is the kind of
thing that disappears in a UI edit with no way back.

## `portal-welcome.js`

Paste into **GHL → Sites → Client Portal → Custom JS** (one block, replacing any earlier redirect
script — don't run both, they'd each patch `history.pushState`).

Two jobs:

1. **First-login redirect.** The portal drops people on `/home` (the dashboard). This sends them to
   the community instead, so their first sight of Mindful 12 is the group, not an empty dashboard.
   It only fires during onboarding: a magic-link `?token=` or a `/password` page sets a session flag,
   and the next `/home` consumes it. Set `mode: 'always'` to redirect every `/home` visit.
2. **Welcome popup.** Shown once per login session until the person opts out.

### How the popup decides to show

| Key | Where | Meaning |
|---|---|---|
| `m12_onboarding` | sessionStorage | magic link / password page seen this session; a redirect is pending |
| `m12_welcome_shown` | sessionStorage | already shown this login, don't repeat while they browse |
| `m12_welcome_off` | localStorage | they clicked "Don't show this again" — never again on this device |
| `m12_welcome_first` | localStorage | when they first saw it, for `retireAfterDays` |

It stays quiet on password/login routes, on the magic-link landing URL (the portal is about to route
them onward — showing there would spend the once-per-session popup before they reach the community),
and on `/home` when the redirect is about to move them. **"Don't show this again" is the only thing
that sets the permanent flag** — closing normally, Escape and backdrop clicks all leave it on for
next time.

`retireAfterDays` (default 8) stops it on its own, so nobody in week three is still being told their
first challenge arrives Tuesday.

### Copy

Lives in `CONFIG.welcome` at the top of the file. It is written to be true on a *repeat* viewing —
"we've sent you an email", not "we've just sent you an email" — because it can appear on any login
until dismissed.

### Changing it

Edit here, commit, then paste the whole file into GHL. Keep the two in step; if someone edits the
portal box directly, this copy becomes a lie.

`debug: true` logs every route change and decision to the console. Leave it `false` in production.
