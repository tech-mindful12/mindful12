"""
Builds the Mindful 12 email HTML files from one shared, table-based framework so every
email has identical spacing and typography (per the designer specs in
"Pre-launch emails/Prelaunchemails.html").

    python emails/build.py

Merge fields use GoHighLevel syntax ({{contact.first_name}}). Link placeholders are
https://REPLACE-ME/... — swap them for the real URLs (or GHL custom values) when loading
into GHL.
"""
import html
import os

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO_URL = "https://mindful12-production.up.railway.app/assets/email/logo.png"

# ---- framework tokens (from the "Email framework" spec) ----
BG = "#EAF4FC"
CARD = "#FFFFFF"
BLUE = "#2366A8"
DARK = "#3D4A56"
GRAY = "#647483"
BLACK = "#17212B"
DIVIDER = "#BEDAF0"
FONT = "Arial, Helvetica, sans-serif"

FIRST = "{{contact.first_name}}"
UNSUB = "{{unsubscribe_link}}"  # GHL's standard unsubscribe merge field

# Every link the emails need. links.csv is the source of truth (filled in by the client with GHL merge
# fields / URLs); the placeholder column is the fallback while a row is still blank.
import csv as _csv
LINKS = {}
with open(os.path.join(HERE, "links.csv"), encoding="utf-8", newline="") as _f:
    for _row in _csv.DictReader(_f):
        LINKS[_row["key"].strip()] = (_row.get("custom_value") or "").strip() or _row["placeholder"].strip()


def esc(s):
    return html.escape(s, quote=False)


# ---- text blocks (all left-aligned, table cells so Outlook honours spacing) ----

MOBILE_CLASS = {27: "m12-body", 20: "m12-label", 48: "m12-h1", 38: "m12-h2", 21: "m12-spam"}


def p(text, size=16, color=DARK, lh=24, weight="normal", italic=False, pad_bottom=0, raw=False):
    cls = f' class="{MOBILE_CLASS[size]}"' if size in MOBILE_CLASS else ""
    style = (
        f"margin:0;padding:0 0 {pad_bottom}px 0;font-family:{FONT};font-size:{size}px;line-height:{lh}px;"
        f"color:{color};font-weight:{weight};{'font-style:italic;' if italic else ''}text-align:left;"
    )
    body = text if raw else esc(text)
    return f'<tr><td{cls} style="{style}">{body}</td></tr>'


def header(text, size=20, color=BLUE, lh=28, weight="normal", pad_bottom=6):
    return p(text, size=size, color=color, lh=lh, weight=weight, pad_bottom=pad_bottom)


def body(text, pad_bottom=0, italic=False, color=None):
    return p(text, size=16, color=color or (GRAY if italic else DARK), lh=24, italic=italic, pad_bottom=pad_bottom)


def gap(px):
    return f'<tr><td style="height:{px}px;line-height:{px}px;font-size:0;">&nbsp;</td></tr>'


def divider(px=1, pad_top=0, pad_bottom=0):
    return (
        f'<tr><td style="padding:{pad_top}px 0 {pad_bottom}px 0;">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
        f'<tr><td style="height:{px}px;line-height:{px}px;font-size:0;background:{DIVIDER};">&nbsp;</td></tr>'
        f'</table></td></tr>'
    )


def button(label, href, prominent=True):
    """Centered, bulletproof-ish button. prominent=True is the saturated blue CTA."""
    if prominent:
        bg, border, color = BLUE, BLUE, "#FFFFFF"
    else:
        bg, border, color = "#F4F8FC", "#C9DDEC", "#4F7699"
    return (
        '<tr><td align="center" style="padding:0;">'
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">'
        f'<tr><td align="center" bgcolor="{bg}" style="background:{bg};border:2px solid {border};border-radius:8px;">'
        f'<a href="{href}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:{FONT};font-size:16px;'
        f'line-height:20px;font-weight:bold;color:{color};text-decoration:none;">{esc(label)}</a>'
        '</td></tr></table></td></tr>'
    )


def logo_block():
    return (
        '<tr><td align="center" style="padding:0 0 24px 0;">'
        f'<img src="{LOGO_URL}" width="120" alt="Mindful 12" style="display:block;width:120px;max-width:120px;height:auto;border:0;margin:0 auto;">'
        '</td></tr>'
        + divider(1, 0, 28)
    )


def shell(title, preheader, rows):
    """600px white card on #EAF4FC, 50px side padding (24px on mobile), logo + divider on top."""
    inner = "".join(rows)
    pre = (
        f'<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:{BG};opacity:0;">'
        f'{esc(preheader)}{"&nbsp;&zwnj;" * 40}</div>' if preheader else ""
    )
    return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>{esc(title)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body {{ margin:0; padding:0; background:{BG}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }}
    table {{ border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }}
    img {{ border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }}
    a {{ color:{BLUE}; }}
    @media only screen and (max-width: 620px) {{
      .m12-wrap {{ padding:24px 12px !important; }}
      .m12-card {{ width:100% !important; }}
      .m12-inner {{ padding:32px 24px 40px 24px !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background:{BG};">
  {pre}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{BG}" style="background:{BG};">
    <tr>
      <td align="center" class="m12-wrap" style="padding:32px 16px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
        <table role="presentation" class="m12-card" width="600" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="{CARD}" style="width:600px;max-width:600px;background:{CARD};border-radius:10px;">
          <tr>
            <td class="m12-inner" style="padding:22px 50px 50px 50px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                {inner}
              </table>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
"""


# =====================================================================
# 1. Registration complete — sent right after the password is created
# =====================================================================

def registration_email(variant):
    """
    variant: 'tue-thu' (base, matches the approved mock), 'fri-sun', 'mon'
    Only the two day sections change.
    """
    if variant == "tue-thu":
        arrives = "Your first challenge arrives Tuesday"
        day1, day1_text = "Friday", "Your first experience with mindful awareness."
        day2, day2_text = "Monday", "Discover what becomes possible when you begin to notice."
    elif variant == "fri-sun":
        arrives = "Your first challenge arrives Tuesday"
        day1, day1_text = "Today", "You’ll also be receiving your first experience with mindful awareness."
        day2, day2_text = "Monday", "Discover what becomes possible when you begin to notice."
    else:  # mon — copy still to come from Bob; placeholder follows the doc's notes
        arrives = "Your first challenge arrives tomorrow"
        day1, day1_text = "Today", "You’ll also be receiving your first experience with mindful awareness."
        day2, day2_text = "Tomorrow", "Discover what becomes possible when you begin to notice."

    rows = [
        logo_block(),
        body(f"Hi {FIRST},", pad_bottom=28),

        header("You are registered"),
        body("Your password is set, and your place in the Mindful 12 Preview is confirmed.", pad_bottom=38),

        header(arrives),
        body("Before then, two short emails will begin the experience.", italic=True, pad_bottom=38),

        header(day1),
        body(day1_text, pad_bottom=38),

        header(day2),
        body(day2_text, pad_bottom=38),

        header("Each email is short. Each one matters."),
        body("Together, they set the stage for everything that follows.", pad_bottom=38),

        body("For now, you’re all set.", pad_bottom=38),

        header("Welcome to Mindful 12.", pad_bottom=0),
        gap(22),  # 50px below the closing line incl. card padding
    ]
    return shell(
        "Your registration is complete. Here’s what’s next",
        "Your password is set, and your place in the Mindful 12 Preview is confirmed.",
        rows,
    )


# =====================================================================
# 2. Friday — The Reset Breath
# =====================================================================

def friday_reset_breath():
    rows = [
        logo_block(),
        body(f"Hi {FIRST},", pad_bottom=28),

        header("Your First Mindfulness Challenge Arrives Tuesday", size=19, lh=26, weight="bold", pad_bottom=8),
        p("Today, we introduce the foundation for everything that follows.", size=14, lh=22, pad_bottom=36),

        header("The Reset Breath", size=19, lh=26, color=BLACK, weight="bold", pad_bottom=10),
        p("Stress often begins before we realize it.", size=14, lh=22, pad_bottom=4),
        p("The body tightens.", size=14, lh=22, pad_bottom=4),
        p("Pressure builds.", size=14, lh=22, pad_bottom=36),

        header("One Breath Can Change What Happens Next", size=19, lh=26, weight="bold", pad_bottom=8),
        p("Give it one minute and see what you notice.", size=14, lh=22, pad_bottom=32),

        button("Experience the Reset Breath", LINKS["reset_breath"]),
        gap(10),
    ]
    return shell(
        "Your first experience with mindful awareness",
        "Today, we introduce the foundation for everything that follows.",
        rows,
    )


# =====================================================================
# 3. Monday — Setting the Stage
# =====================================================================

def monday_setting_the_stage(link_key="setting_the_stage"):
    """Same email for everyone for now; the executive version only differs by where the button goes."""
    rows = [
        logo_block(),
        body(f"Hi {FIRST},", pad_bottom=24),
        body("There’s one simple idea behind everything you’re about to experience.", pad_bottom=36),

        header("Mindful Awareness", pad_bottom=8),
        body("It starts with noticing your day a little differently.", pad_bottom=36),

        p("Take one minute to experience what that means.", size=16, lh=24, weight="bold", color=BLACK, pad_bottom=28),

        button("Setting the Stage →", LINKS[link_key]),
        gap(40),

        p("Thank you,", size=14, lh=20, color=GRAY, pad_bottom=2),
        p("Mindful 12", size=14, lh=20, color=GRAY, weight="bold"),
    ]
    return shell("Mindful 12 starts here", "There’s one simple idea behind everything you’re about to experience.", rows)


# =====================================================================
# 4–8. Program notifications (Tue 7:00 AM / Thu 7:00 AM / Fri 7:00 AM week one only)
# =====================================================================

def notification(subject, preheader, greeting, lines, cta_label, cta_href):
    rows = [logo_block(), body(f"Hi {FIRST},", pad_bottom=24), header(greeting, pad_bottom=10)]
    for i, line in enumerate(lines):
        rows.append(body(line, pad_bottom=(32 if i == len(lines) - 1 else 6)))
    rows += [button(cta_label, cta_href), gap(10)]
    return shell(subject, preheader, rows)


def week1_tuesday():
    return notification(
        "Your Mindfulness Challenge is ready", "It takes about 5 minutes.",
        "Welcome to your first Mindfulness Challenge",
        ["It takes about 5 minutes.",
         "As you listen, notice how often your attention wanders.",
         "No need to judge it, just notice and come back."],
        "Listen to Your First Challenge", LINKS["week1_challenge"],
    )


def week1_thursday():
    return notification(
        "Your Follow-up is ready", "It takes about 5 minutes.",
        "Welcome back",
        ["Your Follow-up is ready.",
         "It takes about 5 minutes.",
         "As you listen, continue the mindful act of noticing how often your attention wanders.",
         "No judgment, just notice, and come back."],
        "Listen to Your First Follow-up", LINKS["week1_follow_up"],
    )


def week1_friday():
    return notification(
        "Your second Follow-up is ready", "It takes less than 5 minutes.",
        "Welcome back",
        ["This is your only week with two follow-ups.",
         "It takes less than 5 minutes.",
         "Continue to notice when your attention wanders, and when it does, deepen your breath, and bring yourself back.",
         "No judgment, just notice, breathe, and come back."],
        "Listen to Your Second Follow-up", LINKS["week1_follow_up_2"],
    )


def week2_tuesday():
    # Body copy for week 2 lives in the client's Google Doc; structure mirrors week one until it lands.
    return notification(
        "Your next Challenge is ready", "You can’t change what you can’t see",
        "Your second Mindfulness Challenge is ready",
        ["It takes about 5 minutes.",
         "As you listen, notice how often your attention wanders.",
         "No need to judge it, just notice and come back."],
        "Listen to Your Next Challenge", LINKS["week2_challenge"],
    )


def week2_thursday():
    return notification(
        "Your next Follow-up is ready", "You can’t change what you can’t see",
        "Welcome back",
        ["Your next Follow-up is ready.",
         "It takes about 5 minutes.",
         "As you listen, continue the mindful act of noticing how often your attention wanders.",
         "No judgment, just notice, and come back."],
        "Listen to Your Next Follow-up", LINKS["week2_follow_up"],
    )


def weeks3to12_tuesday():
    """Generic: the same email every Tuesday for weeks 3-12."""
    return notification(
        "Your next Challenge is ready", "It takes about 5 minutes.",
        "Your next Mindfulness Challenge is ready",
        ["It takes about 5 minutes.",
         "As you listen, notice how often your attention wanders.",
         "No need to judge it, just notice and come back."],
        "Listen to Your Next Challenge", LINKS["next_challenge"],
    )


def weeks3to12_thursday():
    return notification(
        "Your next Follow-up is ready", "It takes about 5 minutes.",
        "Welcome back",
        ["Your next Follow-up is ready.",
         "It takes about 5 minutes.",
         "As you listen, continue the mindful act of noticing how often your attention wanders.",
         "No judgment, just notice, and come back."],
        "Listen to Your Next Follow-up", LINKS["next_follow_up"],
    )


# =====================================================================
# Week one, done: end of the first trial week (hr / independent)
# =====================================================================

def signoff():
    return [
        gap(14),
        p("Robert Jacobs", size=16, lh=24, pad_bottom=0),
        p("Mindful 12", size=16, lh=24, color=GRAY, pad_bottom=32),
        p(UNSUB, size=13, lh=20, color=GRAY, raw=True),
    ]


def week_one_done_hr():
    rows = [
        logo_block(),
        body(f"Hi {FIRST},", pad_bottom=24),
        body("That’s your first week of Mindful 12 finished.", pad_bottom=24),
        body("If you want to talk about testing it with your team, pick a time here:", pad_bottom=14),
        button("Pick a Time", LINKS["hr_calendar"]),
        gap(24),
        body("We’ll keep your program running while you think it over. Next week is mindful listening.", pad_bottom=0),
    ] + signoff()
    return shell("Week one, done", "That’s your first week of Mindful 12 finished.", rows)


def week_one_done_independent():
    rows = [
        logo_block(),
        body(f"Hi {FIRST},", pad_bottom=24),
        body("That’s your first week of Mindful 12 finished.", pad_bottom=24),
        body("If you’d like us to talk to your company about it, tell us who to reach:", pad_bottom=14),
        button("Tell Us Who to Reach", LINKS["independent_form"]),
        gap(14),
        body("Takes about thirty seconds. Company name, and the person we should speak with.", pad_bottom=24),
        body("We’ll keep your program running in the meantime. Next week is mindful listening.", pad_bottom=0),
    ] + signoff()
    return shell("Week one, done", "That’s your first week of Mindful 12 finished.", rows)


# =====================================================================
# Create Your Password: the email that opens the web app (Bob's layout, image1)
# =====================================================================

def create_password_email():
    """Own framework per its spec: 924 px card, larger type, quiet button, two dividers, logo above the button."""
    NAVY, BODY, LABEL_BLUE, BTN_TEXT = "#17212B", "#3D4A56", "#2366A8", "#4F7699"
    rows = "".join([
        f'<tr><td align="center" class="m12-welcome" style="padding:0 0 26px 0;font-family:{FONT};font-size:27px;line-height:36px;color:{NAVY};">Welcome to Mindful 12.</td></tr>',
        divider(2, 0, 44),
        p("YOU’RE ALMOST THERE", size=20, lh=26, color=LABEL_BLUE, weight="bold", pad_bottom=10),
        p("Create Your Password", size=48, lh=56, color=NAVY, weight="bold", pad_bottom=26),
        p("The Mindful 12 web app will open automatically.", size=27, lh=42, color=BODY, pad_bottom=50),
        divider(2, 0, 44),
        p("When the Browser Opens", size=38, lh=46, color=LABEL_BLUE, weight="bold", pad_bottom=16),
        p("Close it. There is nothing to do there yet.", size=27, lh=42, color=BODY, pad_bottom=44),
        p("Return to Your Inbox", size=38, lh=46, color=LABEL_BLUE, weight="bold", pad_bottom=16),
        p("An email will be waiting with everything you need to get started.", size=27, lh=42, color=BODY, pad_bottom=22),
        p("If you do not see it, check your spam folder.", size=21, lh=30, color=GRAY, italic=True, pad_bottom=48),
        '<tr><td align="center" style="padding:0 0 44px 0;">'
        f'<img src="{LOGO_URL}" width="180" alt="Mindful 12" style="display:block;width:180px;max-width:180px;height:auto;border:0;margin:0 auto;"></td></tr>',
        '<tr><td align="center" style="padding:0;">'
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="m12-quiet" style="width:604px;max-width:100%;">'
        '<tr><td align="center" bgcolor="#F4F8FC" style="background:#F4F8FC;border:2px solid #C9DDEC;border-radius:8px;">'
        f'<a href="{LINKS["create_password"]}" target="_blank" style="display:block;padding:28px 20px;font-family:{FONT};font-size:22px;line-height:22px;font-weight:bold;color:{BTN_TEXT};text-decoration:none;">Create My Password</a>'
        '</td></tr></table></td></tr>',
    ])
    return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Create Your Password</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body {{ margin:0; padding:0; background:{BG}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }}
    table {{ border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }}
    img {{ border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }}
    @media only screen and (max-width: 700px) {{
      .m12-wrap {{ padding:16px !important; }}
      .m12-card {{ width:100% !important; }}
      .m12-inner {{ padding:28px 24px !important; }}
      .m12-quiet {{ width:100% !important; }}
      .m12-quiet a {{ padding:17px 12px !important; font-size:17px !important; line-height:22px !important; }}
      .m12-welcome {{ font-size:18px !important; line-height:26px !important; }}
      .m12-label {{ font-size:14px !important; line-height:20px !important; }}
      .m12-h1 {{ font-size:32px !important; line-height:38px !important; }}
      .m12-h2 {{ font-size:26px !important; line-height:32px !important; }}
      .m12-body {{ font-size:18px !important; line-height:28px !important; }}
      .m12-spam {{ font-size:15px !important; line-height:22px !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background:{BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{BG}" style="background:{BG};">
    <tr>
      <td align="center" class="m12-wrap" style="padding:60px 16px;">
        <!--[if mso]><table role="presentation" width="924" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
        <table role="presentation" class="m12-card" width="924" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="{CARD}" style="width:924px;max-width:924px;background:{CARD};border-radius:14px;">
          <tr>
            <td class="m12-inner" style="padding:56px 80px 80px 80px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                {rows}
              </table>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
"""


FILES = {
    "00-create-your-password.html": create_password_email(),
    "01-registration-complete.html": registration_email("tue-thu"),
    "01b-registration-complete-sent-fri-sun.html": registration_email("fri-sun"),
    "01c-registration-complete-sent-mon-DRAFT.html": registration_email("mon"),
    "02-friday-reset-breath.html": friday_reset_breath(),
    "03-monday-setting-the-stage.html": monday_setting_the_stage(),
    "03b-monday-setting-the-stage-executive.html": monday_setting_the_stage("setting_the_stage_exec"),
    "04-week1-tuesday-challenge.html": week1_tuesday(),
    "05-week1-thursday-follow-up.html": week1_thursday(),
    "06-week1-friday-second-follow-up.html": week1_friday(),
    "07-week2-tuesday-challenge.html": week2_tuesday(),
    "08-week2-thursday-follow-up.html": week2_thursday(),
    "09-weeks3-12-tuesday-challenge.html": weeks3to12_tuesday(),
    "10-weeks3-12-thursday-follow-up.html": weeks3to12_thursday(),
    "11-week-one-done-hr.html": week_one_done_hr(),
    "12-week-one-done-independent.html": week_one_done_independent(),
}

# Shown on /email-previews (subject, preview text, when it sends). Keep in step with FILES.
META = {
    "00-create-your-password.html": ("Create your Mindful 12 password (proposed)", "", "Right after the registration form. Opens the web app to set a password."),
    "01-registration-complete.html": ("Your registration is complete. Here’s what’s next", "Your password is set, and your place in the Mindful 12 Preview is confirmed.", "After the password is created — sign-ups Tue–Thu"),
    "01b-registration-complete-sent-fri-sun.html": ("Your registration is complete. Here’s what’s next", "same", "Sign-ups Fri–Sun (“Today” replaces “Friday”)"),
    "01c-registration-complete-sent-mon-DRAFT.html": ("Your registration is complete. Here’s what’s next", "same", "Sign-ups Mon — DRAFT, copy still to confirm"),
    "02-friday-reset-breath.html": ("Your first experience with mindful awareness (proposed)", "Today, we introduce the foundation for everything that follows.", "Friday before launch"),
    "03-monday-setting-the-stage.html": ("Mindful 12 starts here", "There’s one simple idea behind everything you’re about to experience.", "Monday before launch — HR / employee / independent"),
    "03b-monday-setting-the-stage-executive.html": ("Mindful 12 starts here", "There’s one simple idea behind everything you’re about to experience.", "Monday before launch — EXECUTIVES (same copy for now; button goes to the executive Setting the Stage)"),
    "04-week1-tuesday-challenge.html": ("Your Mindfulness Challenge is ready", "It takes about 5 minutes.", "Week 1 — Tuesday 7:00 AM ET"),
    "05-week1-thursday-follow-up.html": ("Your Follow-up is ready", "It takes about 5 minutes.", "Week 1 — Thursday 7:00 AM ET"),
    "06-week1-friday-second-follow-up.html": ("Your second Follow-up is ready", "It takes less than 5 minutes.", "Week 1 only — Friday 7:00 AM ET"),
    "07-week2-tuesday-challenge.html": ("Your next Challenge is ready", "You can’t change what you can’t see", "Week 2 — Tuesday (body copy from the Google Doc still to drop in)"),
    "08-week2-thursday-follow-up.html": ("Your next Follow-up is ready", "You can’t change what you can’t see", "Week 2 — Thursday"),
    "09-weeks3-12-tuesday-challenge.html": ("Your next Challenge is ready", "It takes about 5 minutes.", "Weeks 3–12 — every Tuesday"),
    "10-weeks3-12-thursday-follow-up.html": ("Your next Follow-up is ready", "It takes about 5 minutes.", "Weeks 3–12 — every Thursday"),
    "11-week-one-done-hr.html": ("Week one, done", "That’s your first week of Mindful 12 finished.", "End of the trial week — HR"),
    "12-week-one-done-independent.html": ("Week one, done", "That’s your first week of Mindful 12 finished.", "End of the trial week — Independent"),
}

if __name__ == "__main__":
    import json
    for name, content in FILES.items():
        with open(os.path.join(HERE, name), "w", encoding="utf-8") as f:
            f.write(content)
        print("wrote", name, len(content), "bytes")
    manifest = [{"file": n, "subject": META[n][0], "preview": META[n][1], "when": META[n][2]} for n in FILES]
    with open(os.path.join(HERE, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print("wrote manifest.json")
