# Mindful 12 emails

Table-based, inline-styled HTML built to the designer specs in `Pre-launch emails/Prelaunchemails.html`. Paste each file into a GHL email (Code editor).

Regenerate after editing copy in `build.py`:

```bash
python emails/build.py
```

## Merge fields

Only standard GHL fields are used: `{{contact.first_name}}` and `{{unsubscribe_link}}`. No custom fields were created.

## Links to map

`links.csv` in this folder is the source of truth: `build.py` reads it and drops each `custom_value` straight into the button's `href` (falling back to the `placeholder` column while a row is blank). Change a link there, rerun `python build.py`, done. Every field below has to exist in GHL before these send.

| Key | Button | Used in | Goes to |
|---|---|---|---|
| `create_password` | Create My Password | 00 | `{{contact.private_channel_link}}` |
| `new_registration` | What to expect | 01z | `{{custom_values.new_registration}}` |
| `reset_breath` | Experience the Reset Breath | 02 | `{{custom_values.reset_breath}}` |
| `setting_the_stage` | Setting the Stage | 03 | `{{custom_values.setting_the_stage}}` |
| `setting_the_stage_exec` | Setting the Stage | 03b | `{{custom_values.setting_the_stage_executive}}` |
| `week1_challenge` | Listen to Your First Challenge | 04 | `{{contact.week_1_c}}` |
| `week1_follow_up` | Listen to Your First Follow-up | 05 | `{{contact.week_1_f1}}` |
| `week1_follow_up_2` | Listen to Your Second Follow-up | 06 | `{{contact.week_1_f2}}` |
| `week2_challenge` | Listen to Your Next Challenge | 07 | `{{contact.week_2_c}}` |
| `week2_follow_up` | Listen to Your Next Follow-up | 08 | `{{contact.week_2_f}}` |
| `next_challenge` | Listen to Your Next Challenge | 09 | `{{contact.next_challenge}}` |
| `next_follow_up` | Listen to Your Next Follow-up | 10 | `{{contact.next_followup}}` |
| `hr_calendar` | Pick a Time | 11 | `{{custom_values.team_rollout_call}}` |
| `independent_form` | Tell Us Who to Reach | 12 | `{{custom_values.independent_outreach_form}}` |

## Files

| File | Subject | Preview text | When / who |
|---|---|---|---|
| `00-create-your-password.html` | *(not in the doc — proposed:)* Create your Mindful 12 password | — | Right after the registration form; opens the web app. Bob's layout (image1): 924 px card, quiet button |
| `01z-registration-complete.html` | Your registration is complete. Here’s what’s next | See what’s ahead, as well as something you can explore today. | After the password is created — every sign-up, any day. Replaced the old 01 / 01b / 01c day variants |
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
