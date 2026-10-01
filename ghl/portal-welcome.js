/*
 * Mindful 12 — GHL client portal custom JS.
 *
 * THIS FILE DOES NOT RUN FROM THE REPO. Paste it into the client portal's custom-code box
 * (GHL → Sites → Client Portal → Custom JS). It lives here so it is version controlled and
 * reviewable, because a portal text box has no history.
 *
 * Two jobs, one script — they share the same route watcher, so don't run this alongside the
 * older standalone redirect script or they'll both patch history.pushState.
 *
 *   1. First-time logins land on /home (the portal dashboard). Send them to the community instead.
 *   2. Show the welcome popup once per login session, until the person opts out of it.
 *
 * The portal is a single-page app, so route changes happen without page loads. We watch them
 * three ways: patched pushState/replaceState, popstate, and a light poll as a backstop.
 */
(function () {
  'use strict';

  var CONFIG = {
    // Where first-time logins should land instead of the dashboard.
    groupPath: '/communities/groups/',

    // 'onboarding' = only redirect /home right after a magic-link login or a password page.
    // 'always'     = redirect every /home visit (nobody ever sees the dashboard).
    mode: 'onboarding',

    // Console logging. Leave false in production.
    debug: false,

    welcome: {
      title: 'Welcome to Mindful 12',
      lines: [
        'Your first challenge arrives Tuesday.',
        'We’ve sent you an email with the steps between now and then — it’s in your inbox whenever you’re ready.',
      ],
      cta: 'Take a look around',
      optOut: 'Don’t show this again',
      // Stop showing it this many days after the person first saw it, so nobody in week three
      // is still being told their first challenge arrives Tuesday.
      retireAfterDays: 8,
    },
  };

  // sessionStorage: per tab/login. localStorage: per device, survives logout.
  var KEY_ONBOARDING = 'm12_onboarding';      // session — magic link or password page seen
  var KEY_SHOWN = 'm12_welcome_shown';        // session — already shown this login
  var KEY_OFF = 'm12_welcome_off';            // local   — they clicked "Don't show this again"
  var KEY_FIRST_SEEN = 'm12_welcome_first';   // local   — when they first saw it (for retireAfterDays)

  function log(msg) { if (CONFIG.debug) console.log('[m12] ' + msg); }
  function path() { return location.pathname.replace(/\/+$/, '') || '/'; }

  // Storage throws in some private-browsing modes, so every call is guarded.
  function read(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function write(store, key, value) { try { window[store].setItem(key, value); } catch (e) {} }
  function drop(store, key) { try { window[store].removeItem(key); } catch (e) {} }

  function setOnboardingFlag() { write('sessionStorage', KEY_ONBOARDING, '1'); }
  function hasOnboardingFlag() { return read('sessionStorage', KEY_ONBOARDING) === '1'; }

  // Signal 1: the magic link lands on /?token=… in this tab.
  if (/[?&]token=/.test(location.search)) {
    setOnboardingFlag();
    log('magic link token seen, onboarding flag set');
  }

  // ---------------------------------------------------------------- welcome popup

  var STYLE_ID = 'm12-welcome-style';
  var FONT_ID = 'm12-welcome-font';
  var openEl = null;
  var lastFocused = null;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    // Playfair for the headline, same as the rest of Mindful 12. Falls back to a serif if the
    // request is blocked, so the popup never waits on it.
    if (!document.getElementById(FONT_ID)) {
      var font = document.createElement('link');
      font.id = FONT_ID;
      font.rel = 'stylesheet';
      font.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&display=swap';
      document.head.appendChild(font);
    }

    var css = [
      // Never inherit the portal's box model — these have to size predictably on their own.
      '.m12-wm,.m12-wm *{box-sizing:border-box;}',
      '.m12-wm{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;',
      'padding:24px 16px;padding-bottom:calc(24px + env(safe-area-inset-bottom,0px));font-family:Inter,-apple-system,',
      'BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}',
      '.m12-wm__backdrop{position:absolute;inset:0;background:rgba(13,33,88,.45);}',
      '.m12-wm__card{position:relative;width:100%;max-width:440px;background:#fff;border-radius:5px;',
      'padding:32px 28px;box-shadow:0 24px 60px rgba(13,33,88,.28);text-align:left;',
      'max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);overflow-y:auto;',
      '-webkit-overflow-scrolling:touch;animation:m12wmIn .22s ease-out;}',
      '@keyframes m12wmIn{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:none;}}',
      '@media (prefers-reduced-motion:reduce){.m12-wm__card{animation:none;}}',
      '.m12-wm__title{margin:0 0 16px;font-family:"Playfair Display",Georgia,serif;font-weight:600;',
      'font-size:32px;line-height:1.2;color:#0D2158;}',
      '.m12-wm__text{margin:0 0 14px;font-size:16px;line-height:1.6;color:#0D2158;}',
      '.m12-wm__btn{display:block;width:100%;min-height:48px;margin:22px 0 0;padding:14px 24px;border:0;',
      'border-radius:5px;background:#2D67FF;color:#fff;font:inherit;font-size:16px;font-weight:600;cursor:pointer;}',
      '.m12-wm__btn:hover{background:#1F55E6;}',
      '.m12-wm__off{display:block;width:100%;min-height:44px;margin:6px 0 0;padding:10px;border:0;background:none;',
      'color:#5B6B8F;font:inherit;font-size:14px;text-decoration:underline;cursor:pointer;}',
      '.m12-wm__off:hover{color:#0D2158;}',
      '@media (max-width:480px){.m12-wm{padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px));}',
      '.m12-wm__card{padding:26px 20px;}.m12-wm__title{font-size:26px;}}',
      'html.m12-wm-open,body.m12-wm-open{overflow:hidden;}',
    ].join('');

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  function shouldShow() {
    if (read('localStorage', KEY_OFF) === '1') return false;     // they opted out, for good
    if (read('sessionStorage', KEY_SHOWN) === '1') return false; // already seen this login
    if (openEl) return false;

    // Mid-signup pages aren't the moment for it.
    var p = path();
    if (/password|login|sign-?in/i.test(p)) return false;

    // The magic-link URL is a staging post, not a destination — the portal is about to route them
    // onward. Showing here would spend the once-per-session popup before they reach the community.
    if (/[?&]token=/.test(location.search) && p.indexOf(CONFIG.groupPath) !== 0) return false;

    // Don't flash it on /home when the redirect below is about to move them anyway.
    if (p === '/home' && (CONFIG.mode === 'always' || hasOnboardingFlag())) return false;

    var first = Number(read('localStorage', KEY_FIRST_SEEN) || 0);
    if (first && (Date.now() - first) / 86400000 > CONFIG.welcome.retireAfterDays) {
      log('welcome retired (older than ' + CONFIG.welcome.retireAfterDays + ' days)');
      return false;
    }
    return true;
  }

  function close(permanent) {
    if (!openEl) return;
    if (permanent) {
      write('localStorage', KEY_OFF, '1');
      log('welcome turned off for this device');
    }
    document.removeEventListener('keydown', onKeydown, true);
    openEl.parentNode && openEl.parentNode.removeChild(openEl);
    openEl = null;
    document.documentElement.classList.remove('m12-wm-open');
    document.body.classList.remove('m12-wm-open');
    if (lastFocused && lastFocused.focus) { try { lastFocused.focus(); } catch (e) {} }
  }

  function onKeydown(e) {
    if (!openEl) return;
    if (e.key === 'Escape') { e.preventDefault(); close(false); return; }
    if (e.key !== 'Tab') return;
    // Keep focus inside the dialog.
    var stops = openEl.querySelectorAll('button');
    if (!stops.length) return;
    var first = stops[0], last = stops[stops.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function show() {
    injectStyle();
    lastFocused = document.activeElement;

    var w = CONFIG.welcome;
    var wrap = document.createElement('div');
    wrap.className = 'm12-wm';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'm12-wm-title');

    var backdrop = document.createElement('div');
    backdrop.className = 'm12-wm__backdrop';
    backdrop.addEventListener('click', function () { close(false); });

    var card = document.createElement('div');
    card.className = 'm12-wm__card';

    var title = document.createElement('h2');
    title.className = 'm12-wm__title';
    title.id = 'm12-wm-title';
    title.textContent = w.title;
    card.appendChild(title);

    w.lines.forEach(function (line) {
      var p = document.createElement('p');
      p.className = 'm12-wm__text';
      p.textContent = line;
      card.appendChild(p);
    });

    var cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'm12-wm__btn';
    cta.textContent = w.cta;
    cta.addEventListener('click', function () { close(false); });
    card.appendChild(cta);

    var off = document.createElement('button');
    off.type = 'button';
    off.className = 'm12-wm__off';
    off.textContent = w.optOut;
    off.addEventListener('click', function () { close(true); });
    card.appendChild(off);

    wrap.appendChild(backdrop);
    wrap.appendChild(card);
    document.body.appendChild(wrap);
    openEl = wrap;

    document.documentElement.classList.add('m12-wm-open');
    document.body.classList.add('m12-wm-open');
    document.addEventListener('keydown', onKeydown, true);
    try { cta.focus({ preventScroll: true }); } catch (e) { cta.focus(); }

    write('sessionStorage', KEY_SHOWN, '1');
    if (!read('localStorage', KEY_FIRST_SEEN)) write('localStorage', KEY_FIRST_SEEN, String(Date.now()));
    log('welcome shown');
  }

  function maybeShow() {
    if (shouldShow()) show();
  }

  // ---------------------------------------------------------------- route watching

  var last = null;
  function check() {
    var p = path();
    if (p !== last) {
      last = p;
      log('route ' + p);

      // Signal 2: any password page (set or reset) in this tab.
      if (/password/i.test(p)) setOnboardingFlag();

      if (p === '/home' && (CONFIG.mode === 'always' || hasOnboardingFlag())) {
        drop('sessionStorage', KEY_ONBOARDING);
        log('redirecting to ' + CONFIG.groupPath);
        location.replace(CONFIG.groupPath);
        return;
      }
    }
    maybeShow();
  }

  ['pushState', 'replaceState'].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function () {
      var result = orig.apply(this, arguments);
      setTimeout(check, 0);
      return result;
    };
  });
  window.addEventListener('popstate', check);
  setInterval(check, 300);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check);
  else check();
})();
