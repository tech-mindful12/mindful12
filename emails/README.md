# Mindful 12 emails

Table-based, inline-styled HTML built to the designer specs in `Pre-launch emails/Prelaunchemails.html`. Paste each file into a GHL email (Code editor) — merge fields already use GHL syntax.

Regenerate after editing copy in `build.py`:

```bash
python emails/build.py
```

## Files

| File | Subject | Preview text | When |
|---|---|---|---|
| `01-registration-complete.html` | Your registration is complete. Here's what's next | Your password is set, and your place in the Mindful 12 Preview is confirmed. | Right after the password is created — **sign-ups Tue–Thu** |
| `01b-registration-complete-sent-fri-sun.html` | same | same | Sign-ups **Fri–Sun** ("Today" replaces "Friday") |
| `01c-registration-complete-sent-mon-DRAFT.html` | same | same | Sign-ups **Mon** — copy still owed by Bob; this is a best guess from the doc's notes |
| `02-friday-reset-breath.html` | Your first experience with mindful awareness *(no subject in the doc — proposed)* | Today, we introduce the foundation for everything that follows. | Friday before launch |
| `03-monday-setting-the-stage.html` | Mindful 12 starts here | There's one simple idea behind everything you're about to experience. | Monday before launch |
| `04-week1-tuesday-challenge.html` | Your Mindfulness Challenge is ready | It takes about 5 minutes. | Week 1, Tue 7:00 AM ET |
| `05-week1-thursday-follow-up.html` | Your Follow-up is ready | It takes about 5 minutes. | Week 1, Thu 7:00 AM ET |
| `06-week1-friday-second-follow-up.html` | Your second Follow-up is ready | It takes less than 5 minutes. | Week 1 only, Fri 7:00 AM ET |
| `07-weekN-tuesday-challenge.html` | Your next Challenge is ready | You can't change what you can't see | Weeks 2–12, Tue |
| `08-weekN-thursday-follow-up.html` | Your next Follow-up is ready | You can't change what you can't see | Weeks 2–12, Thu |

## Before sending

- **Links**: every button points at `https://REPLACE-ME/...` — swap for the real URLs (or GHL custom values).
- **Logo**: `logo.png` is cropped from the design mock and hosted at `https://mindful12-production.up.railway.app/assets/email/logo.png`. Replace with the real logo file (same path, or upload to GHL's media library and change the `src`).
- **Merge field**: `{{contact.first_name}}`. Consider a GHL fallback value for contacts without a first name.
- Week 2–12 body copy in the doc points at a Google Doc; `07`/`08` reuse the week-one structure with "next" wording until that copy lands.

## Framework (from the spec)

Background `#EAF4FC`; white card 600 px, radius 10, 50 px side padding (24 px on mobile); Arial/Helvetica; logo centered ≤120 px with a 1 px `#BEDAF0` divider under it; greeting/body 16/24 `#3D4A56`; headers 20/28 regular `#2366A8` (no bold, no caps); italic supporting lines `#647483`; spacing 28 px greeting→header, 6 px header→support, 38–40 px between sections. All copy left-aligned; only buttons are centered.
