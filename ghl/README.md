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
| `m12_preview_type` | localStorage | which preview they signed up through, so later logins keep their copy |

**It only appears on `/communities/groups/*`.** Everything before that — the magic-link URL, whatever
interim screen the portal shows, the dashboard — is somewhere people are passing through, and the
redirect wipes anything shown there while still spending the once-per-session flag, so the popup
would never be seen. Scoping it to the destination is what makes it reliable.

**"Don't show this again" is the only thing that sets the permanent flag** — closing normally,
Escape and backdrop clicks all leave it on for next time.

`retireAfterDays` (default 8) stops it on its own, so nobody in week three is still being told their
first challenge arrives Tuesday.

### Copy, per preview type

`CONFIG.welcome.byType` at the top of the file. **employee** gets pointed at the community, because
their group is full of colleagues. **executive, independent and hr** fall through to `default`, which
points at the inbox — they don't know anybody in there yet, so the introduction (via the email) is the
thing worth doing. Add a key named after a preview type to split any of them out.

All of it is written to be true on a *repeat* viewing — "we've sent you an email", not "we've **just**
sent you an email" — because it can appear on any login until dismissed.

### How it knows the preview type

The portal never tells us, so the value is handed in. Three sources, first one that answers wins:

1. **`window.M12_PREVIEW_TYPE`** — if GHL renders merge fields in the portal's custom code, put this
   line *above* the script and every login gets the right copy:

   ```html
   <script>window.M12_PREVIEW_TYPE = "{{contact.preview_type}}";</script>
   ```

   (field `contact.preview_type`, id `I9aWwgBzr1oppWNHBwAI`). Worth testing — if GHL leaves the
   `{{…}}` unrendered the script ignores it and falls through, so trying it costs nothing.
2. **`?m12_type=` on the magic-link URL** — the signup form appends this when it redirects someone
   into the portal (`withPreviewType()` in `public/form.js`). Only present on that first arrival.
3. **Remembered** from an earlier login, in `m12_preview_type` (localStorage).

Anything unrecognised — a typo, an unrendered merge field, nothing at all — falls back to `default`,
which is the safe copy for everyone. The list of accepted values is `TYPES` in the script.

### Changing it

Edit here, commit, then paste the whole file into GHL. Keep the two in step; if someone edits the
portal box directly, this copy becomes a lie.

`debug: true` logs every route change and decision to the console. Leave it `false` in production.
