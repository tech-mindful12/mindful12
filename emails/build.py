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


def esc(s):
    return html.escape(s, quote=False)


# ---- text blocks (all left-aligned, table cells so Outlook honours spacing) ----

def p(text, size=16, color=DARK, lh=24, weight="normal", italic=False, pad_bottom=0, raw=False):
    style = (
        f"margin:0;padding:0 0 {pad_bottom}px 0;font-family:{FONT};font-size:{size}px;line-height:{lh}px;"
        f"color:{color};font-weight:{weight};{'font-style:italic;' if italic else ''}text-align:left;"
    )
    body = text if raw else esc(text)
    return f'<tr><td style="{style}">{body}</td></tr>'


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

        button("Experience the Reset Breath", "https://REPLACE-ME/reset-breath"),
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

def monday_setting_the_stage():
    rows = [
        logo_block(),
        body(f"Hi {FIRST},", pad_bottom=24),
        body("There’s one simple idea behind everything you’re about to experience.", pad_bottom=36),

        header("Mindful Awareness", pad_bottom=8),
        body("It starts with noticing your day a little differently.", pad_bottom=36),

        p("Take one minute to experience what that means.", size=16, lh=24, weight="bold", color=BLACK, pad_bottom=28),

        button("Setting the Stage →", "https://REPLACE-ME/setting-the-stage"),
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
        "Listen to Your First Challenge", "https://REPLACE-ME/week-1-challenge",
    )


def week1_thursday():
    return notification(
        "Your Follow-up is ready", "It takes about 5 minutes.",
        "Welcome back",
        ["Your Follow-up is ready.",
         "It takes about 5 minutes.",
         "As you listen, continue the mindful act of noticing how often your attention wanders.",
         "No judgment, just notice, and come back."],
        "Listen to Your First Follow-up", "https://REPLACE-ME/week-1-follow-up",
    )


def week1_friday():
    return notification(
        "Your second Follow-up is ready", "It takes less than 5 minutes.",
        "Welcome back",
        ["This is your only week with two follow-ups.",
         "It takes less than 5 minutes.",
         "Continue to notice when your attention wanders, and when it does, deepen your breath, and bring yourself back.",
         "No judgment, just notice, breathe, and come back."],
        "Listen to Your Second Follow-up", "https://REPLACE-ME/week-1-follow-up-2",
    )


def weekN_tuesday():
    return notification(
        "Your next Challenge is ready", "You can’t change what you can’t see",
        "Your next Mindfulness Challenge is ready",
        ["It takes about 5 minutes.",
         "As you listen, notice how often your attention wanders.",
         "No need to judge it, just notice and come back."],
        "Listen to Your Next Challenge", "https://REPLACE-ME/week-N-challenge",
    )


def weekN_thursday():
    return notification(
        "Your next Follow-up is ready", "You can’t change what you can’t see",
        "Welcome back",
        ["Your next Follow-up is ready.",
         "It takes about 5 minutes.",
         "As you listen, continue the mindful act of noticing how often your attention wanders.",
         "No judgment, just notice, and come back."],
        "Listen to Your Next Follow-up", "https://REPLACE-ME/week-N-follow-up",
    )


FILES = {
    "01-registration-complete.html": registration_email("tue-thu"),
    "01b-registration-complete-sent-fri-sun.html": registration_email("fri-sun"),
    "01c-registration-complete-sent-mon-DRAFT.html": registration_email("mon"),
    "02-friday-reset-breath.html": friday_reset_breath(),
    "03-monday-setting-the-stage.html": monday_setting_the_stage(),
    "04-week1-tuesday-challenge.html": week1_tuesday(),
    "05-week1-thursday-follow-up.html": week1_thursday(),
    "06-week1-friday-second-follow-up.html": week1_friday(),
    "07-weekN-tuesday-challenge.html": weekN_tuesday(),
    "08-weekN-thursday-follow-up.html": weekN_thursday(),
}

if __name__ == "__main__":
    for name, content in FILES.items():
        with open(os.path.join(HERE, name), "w", encoding="utf-8") as f:
            f.write(content)
        print("wrote", name, len(content), "bytes")
