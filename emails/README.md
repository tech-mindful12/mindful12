# Mindful 12 emails

Table-based, inline-styled HTML built to the designer specs in `Pre-launch emails/Prelaunchemails.html`. Paste each file into a GHL email (Code editor).

Regenerate after editing copy in `build.py`:

```bash
python emails/build.py
```

## Merge fields

Only standard GHL fields are used: `{{contact.first_name}}` and `{{unsubscribe_link}}`. No custom fields were created.

## Links to map

Every button/link is a placeholder `https://REPLACE-ME/...` defined once in `LINKS` at the top of `build.py`. Map each to a GHL custom value or trigger link, then rebuild (or find-and-replace in the HTML):

| Placeholder | Used in | Needs |
|---|---|---|
| `https://REPLACE-ME/create-password` | 00 | Web-app signup URL (the "Create My Password" destination) |
| `https://REPLACE-ME/reset-breath` | 02 | Friday Reset Breath experience |
| `https://REPLACE-ME/setting-the-stage` | 03 | Monday Setting the Stage page (general) |
| `https://REPLACE-ME/setting-the-stage-executive` | 03b | Monday Setting the Stage page (executive edition) |
| `https://REPLACE-ME/week-1-challenge` | 04 | Week 1 challenge |
| `https://REPLACE-ME/week-1-follow-up` | 05 | Week 1 follow-up |
| `https://REPLACE-ME/week-1-follow-up-2` | 06 | Week 1 second follow-up |
| `https://REPLACE-ME/week-2-challenge` | 07 | Week 2 challenge |
| `https://REPLACE-ME/week-2-follow-up` | 08 | Week 2 follow-up |
| `https://REPLACE-ME/next-challenge` | 09 | Weeks 3–12 challenge (value changes per week) |
| `https://REPLACE-ME/next-follow-up` | 10 | Weeks 3–12 follow-up (value changes per week) |
| `https://REPLACE-ME/book-a-call` | 11 | HR week-one-done: calendar booking link |
| `https://REPLACE-ME/tell-us-your-company` | 12 | Independent week-one-done: "who should we contact" form |

## Files

| File | Subject | Preview text | When / who |
|---|---|---|---|
| `00-create-your-password.html` | *(not in the doc — proposed:)* Create your Mindful 12 password | — | Right after the registration form; opens the web app. Bob's layout (image1): 924 px card, quiet button |
| `01-registration-complete.html` | Your registration is complete. Here's what's next | Your password is set, and your place in the Mindful 12 Preview is confirmed. | After the password is created — **sign-ups Tue–Thu** |
| `01b-registration-complete-sent-fri-sun.html` | same | same | Sign-ups **Fri–Sun** ("Today" replaces "Friday") |
| `01c-registration-complete-sent-mon-DRAFT.html` | same | same | Sign-ups **Mon** — copy still owed by Bob |
| `02-friday-reset-breath.html` | *(proposed)* Your first experience with mindful awareness | Today, we introduce the foundation for everything that follows. | Friday before launch |
| `03-monday-setting-the-stage.html` | Mindful 12 starts here | There's one simple idea behind everything you're about to experience. | Monday before launch — HR / employee / independent |
| `03b-monday-setting-the-stage-executive.html` | same | same | Monday before launch — **executives**. Same copy for now; only the button destination differs (`setting_the_stage_exec`) |
| `04-week1-tuesday-challenge.html` | Your Mindfulness Challenge is ready | It takes about 5 minutes. | Week 1 Tue 7:00 AM ET |
| `05-week1-thursday-follow-up.html` | Your Follow-up is ready | It takes about 5 minutes. | Week 1 Thu |
| `06-week1-friday-second-follow-up.html` | Your second Follow-up is ready | It takes less than 5 minutes. | Week 1 Fri only |
| `07-week2-tuesday-challenge.html` | Your next Challenge is ready | You can't change what you can't see | Week 2 Tue — body copy from Bob's Google Doc still to drop in |
| `08-week2-thursday-follow-up.html` | Your next Follow-up is ready | You can't change what you can't see | Week 2 Thu |
| `09-weeks3-12-tuesday-challenge.html` | Your next Challenge is ready | It takes about 5 minutes. | Generic, every Tue weeks 3–12 |
| `10-weeks3-12-thursday-follow-up.html` | Your next Follow-up is ready | It takes about 5 minutes. | Generic, every Thu weeks 3–12 |
| `11-week-one-done-hr.html` | Week one, done | That's your first week of Mindful 12 finished. | End of trial week — **HR** |
| `12-week-one-done-independent.html` | Week one, done | same | End of trial week — **Independent** |

## Before sending

- Map the links above.
- **Logo**: `logo.png` is cropped from the design mock and hosted at `https://mindful12-production.up.railway.app/assets/email/logo.png`. Replace with the real logo file (same path, or upload to GHL's media library and change the `src`).
- Consider a GHL fallback value for contacts without a first name.

## Framework (from the spec)

Background `#EAF4FC`; white card 600 px, radius 10, 50 px side padding (24 px on mobile); Arial/Helvetica; logo centered ≤120 px with a 1 px `#BEDAF0` divider under it; greeting/body 16/24 `#3D4A56`; headers 20/28 regular `#2366A8` (no bold, no caps); italic supporting lines `#647483`; spacing 28 px greeting→header, 6 px header→support, 38–40 px between sections. All copy left-aligned; only buttons are centered.

`00-create-your-password.html` follows its own spec: 924 px card, radius 14, 80 px padding; 27 px body, 48 px heading, 38 px instruction headings, 2 px dividers, quiet 604×82 button (`#F4F8FC` / `#C9DDEC` border / `#4F7699` text); mobile sizes per the doc.
