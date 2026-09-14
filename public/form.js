(function () {
  'use strict';

  var M = window.Mindful12Match;
  var $ = function (id) { return document.getElementById(id); };

  var form = $('m12-form');
  var els = {
    company: $('company_name'), companyId: $('company_id'), companyList: $('company-list'),
    companySuggest: $('company-suggest'), companyMatched: $('company-matched'),
    email: $('email'), emailSuggest: $('email-suggest'),
    fullName: $('full_name'), phone: $('phone'),
    state: $('state'), city: $('city'), cityList: $('city-list'),
    previewType: $('preview_type'), submit: $('submit-btn'), formError: $('form-error'),
    success: $('m12-success'), successText: $('success-text'),
    redirect: $('m12-redirect'), redirectEmail: $('redirect-email'), redirectCount: $('redirect-count'), redirectNow: $('redirect-now'),
    companyField: $('company-field'), companyOptional: $('company-optional'), companyHelp: $('company-help'),
    context: $('m12-context'), contextText: $('context-text'), contextChange: $('context-change'),
    chooser: $('context-chooser'), options: $('context-options'), confirm: $('context-confirm'), cancel: $('context-cancel'),
  };

  var cities = [];          // for the currently selected state
  var params = new URLSearchParams(window.location.search);
  var allParams = {};
  params.forEach(function (v, k) { allParams[k] = v; });

  // ---------- URL parameters ----------
  // ?preview_type=...  hidden field
  // ?company= ?email= ?name= (or full_name) ?phone= ?city= ?state=   prefill
  // ?bg=transparent (default)|white|wave   ?button=   ?redirect= (overrides the REDIRECT_URL server variable)

  // ---------- Preview type ----------
  // Drives the message above the form and whether Company Name is collected.

  var PREVIEW_TYPES = {
    executive:   { message: 'You’re here because your company is considering Mindful12.',
                   option: 'My company is considering Mindful12', company: true },
    employee:    { message: 'You’re here because your company has invited you to preview Mindful12.',
                   option: 'My company invited me to preview Mindful12', company: true },
    hr:          { message: 'You’re here to see how Mindful12 could support your people.',
                   option: 'I want to see how Mindful12 could support my people', company: false },
    independent: { message: 'You’re exploring Mindful12 on your own.',
                   option: 'I’m exploring Mindful12 on my own', company: false },
  };
  var DEFAULT_PREVIEW_TYPE = 'independent';

  function normalizePreviewType(v) {
    v = String(v || '').trim().toLowerCase();
    return PREVIEW_TYPES[v] ? v : DEFAULT_PREVIEW_TYPE;
  }

  // Company Name is shown (and required) for executive/employee; hidden for hr/independent.
  function companyShown() { return PREVIEW_TYPES[els.previewType.value].company; }

  function applyPreviewType(type) {
    els.previewType.value = type;
    if (els.context) { // the message + chooser markup may be commented out
      els.contextText.textContent = PREVIEW_TYPES[type].message;
      els.context.hidden = false;
      els.chooser.hidden = true;
    }
    els.companyField.hidden = !companyShown();
    if (!companyShown()) { hideSuggest(); els.emailSuggest.hidden = true; setError('company_name', ''); }
    postHeight();
  }

  function openChooser() {
    els.options.innerHTML = '';
    Object.keys(PREVIEW_TYPES).forEach(function (key) {
      if (key === els.previewType.value) return; // offer the *other* descriptions
      var label = document.createElement('label');
      var radio = document.createElement('input');
      radio.type = 'radio'; radio.name = 'preview_type_choice'; radio.value = key;
      radio.addEventListener('change', function () { els.confirm.disabled = false; });
      label.appendChild(radio);
      label.appendChild(document.createTextNode(PREVIEW_TYPES[key].option));
      els.options.appendChild(label);
    });
    els.confirm.disabled = true;
    els.chooser.hidden = false;
    postHeight();
  }

  if (els.context) {
    els.contextChange.addEventListener('click', openChooser);
    els.cancel.addEventListener('click', function () { els.chooser.hidden = true; postHeight(); });
    els.confirm.addEventListener('click', function () {
      var picked = els.options.querySelector('input:checked');
      if (picked) applyPreviewType(picked.value);
    });
  }

  els.previewType.value = normalizePreviewType(params.get('preview_type') || params.get('previewType'));

  var bg = (params.get('bg') || 'transparent').toLowerCase(); // the host page supplies the background
  document.body.className = 'bg-' + (['white', 'wave', 'transparent'].indexOf(bg) !== -1 ? bg : 'white');

  if (params.get('button')) els.submit.querySelector('span').textContent = params.get('button');

  els.company.value = params.get('company') || params.get('company_name') || '';
  els.email.value = params.get('email') || '';
  els.fullName.value = params.get('name') || params.get('full_name') || '';
  els.phone.value = formatPhone(params.get('phone') || '');

  // ---------- Embed helpers (iframe in GHL) ----------

  var embedded = window.parent !== window;
  if (embedded) document.documentElement.classList.add('embedded');

  function postHeight() {
    if (!embedded) return;
    var main = document.querySelector('.m12');
    var h = main.getBoundingClientRect().height + main.offsetTop; // content only, so the frame can shrink too
    window.parent.postMessage({ type: 'mindful12:height', height: Math.ceil(h) }, '*');
  }
  if (window.ResizeObserver) new ResizeObserver(postHeight).observe(document.body);
  window.addEventListener('load', postHeight);

  var pageUrl = document.referrer || '';
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'mindful12:page' && typeof e.data.url === 'string') pageUrl = e.data.url;
  });

  // ---------- Generic combobox ----------

  function combobox(opts) {
    var input = opts.input, menu = opts.menu, active = -1, items = [];

    function render(list) {
      items = list;
      menu.innerHTML = '';
      active = -1;
      if (!list.length) { close(); return; }
      list.forEach(function (it, i) {
        var li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.dataset.index = i;
        if (it.empty) { li.className = 'empty'; li.textContent = it.label; }
        else {
          var span = document.createElement('span'); span.textContent = it.label; li.appendChild(span);
          if (it.tag) { var t = document.createElement('span'); t.className = 'tag'; t.textContent = it.tag; li.appendChild(t); }
          li.addEventListener('mousedown', function (e) { e.preventDefault(); choose(i); });
        }
        menu.appendChild(li);
      });
      menu.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
    function close() { menu.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }
    function choose(i) { var it = items[i]; if (!it || it.empty) return; close(); opts.onSelect(it); }
    function highlight(i) {
      var lis = menu.querySelectorAll('li');
      lis.forEach(function (li) { li.removeAttribute('aria-selected'); });
      if (i >= 0 && lis[i]) { lis[i].setAttribute('aria-selected', 'true'); lis[i].scrollIntoView({ block: 'nearest' }); }
      active = i;
    }
    function refresh() { render(opts.getItems(input.value)); }

    input.addEventListener('input', function () { opts.onInput && opts.onInput(); refresh(); });
    input.addEventListener('focus', refresh);
    input.addEventListener('blur', function () { setTimeout(close, 120); });
    input.addEventListener('keydown', function (e) {
      if (menu.hidden) { if (e.key === 'ArrowDown') { refresh(); } return; }
      var n = items.filter(function (it) { return !it.empty; }).length;
      if (e.key === 'ArrowDown') { e.preventDefault(); highlight((active + 1) % n); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlight((active - 1 + n) % n); }
      else if (e.key === 'Enter') { if (active >= 0) { e.preventDefault(); choose(active); } else close(); }
      else if (e.key === 'Escape') close();
    });
    return { refresh: refresh, close: close };
  }

  // ---------- Company field ----------
  // The registered-company list never reaches the browser. We send what was typed (3+ chars) and the
  // email to /api/companies/lookup and get back at most a few close matches, names only.

  var MIN_LOOKUP_CHARS = 3;
  var lastLookup = { key: null, result: null }; // memo of the most recent server answer
  var selectedCompany = null;                   // { id, name } once attached

  function lookupKey(name, email) { return M.normalize(name) + '|' + String(email || '').trim().toLowerCase(); }

  /** Ask the server which registered company (if any) this looks like. Resolves to { suggestions, autoMatch, best, byDomain }. */
  function lookup(name, email) {
    var key = lookupKey(name, email);
    if (lastLookup.key === key && lastLookup.result) return Promise.resolve(lastLookup.result);
    var qs = '?q=' + encodeURIComponent(M.normalize(name).length >= MIN_LOOKUP_CHARS ? name.trim() : '') +
             '&email=' + encodeURIComponent(String(email || '').trim());
    return fetch('/api/companies/lookup' + qs)
      .then(function (r) { return r.ok ? r.json() : { suggestions: [], autoMatch: null, best: null, byDomain: null }; })
      .catch(function () { return { suggestions: [], autoMatch: null, best: null, byDomain: null }; })
      .then(function (result) { lastLookup = { key: key, result: result }; return result; });
  }

  function setCompany(c) {
    selectedCompany = { id: c.id, name: c.name };
    els.company.value = c.name;
    els.companyId.value = c.id;
    hideSuggest();
    showMatched(c, true);
    setError('company_name', '');
  }

  function showMatched(c, explicit) {
    els.companyMatched.hidden = false;
    els.companyMatched.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
      '<span></span>';
    els.companyMatched.querySelector('span').textContent =
      explicit ? 'Registered company' : 'Matched to ' + c.name;
  }
  function hideMatched() { els.companyMatched.hidden = true; }

  function showSuggest(el, text, c, yesLabel) {
    el.innerHTML = '';
    var span = document.createElement('span'); span.textContent = text; el.appendChild(span);
    var yes = document.createElement('button'); yes.type = 'button'; yes.textContent = yesLabel; el.appendChild(yes);
    var no = document.createElement('button'); no.type = 'button'; no.className = 'dismiss'; no.textContent = 'No'; el.appendChild(no);
    yes.addEventListener('click', function () { setCompany(c); els.emailSuggest.hidden = true; });
    no.addEventListener('click', function () { el.hidden = true; el.dataset.dismissed = c.id; setError('company_name', ''); postHeight(); });
    el.hidden = false;
  }
  function hideSuggest() { els.companySuggest.hidden = true; }

  var companyCombo = combobox({
    input: els.company, menu: els.companyList,
    // Only what the server returned for exactly what's in the box right now — never a full list.
    getItems: function (q) {
      var r = lastLookup.result;
      if (!r || lastLookup.key !== lookupKey(q, els.email.value) || M.normalize(q).length < MIN_LOOKUP_CHARS) return [];
      return r.suggestions.map(function (c) { return { label: c.name, value: c.id, tag: 'Registered', company: c }; });
    },
    onSelect: function (it) { setCompany(it.company); },
    onInput: function () {
      // Typing anything after a selection means it's free text again.
      if (!selectedCompany || selectedCompany.name !== els.company.value) { selectedCompany = null; els.companyId.value = ''; hideMatched(); }
      hideSuggest();
      debounce('company', refreshCompany, 300);
    },
  });

  /** Fetch suggestions for the current text, show the dropdown, and auto-attach / offer "Did you mean?". */
  function refreshCompany() {
    if (!companyShown()) return;
    var typed = els.company.value.trim();
    if (!typed) { els.companyId.value = ''; hideMatched(); hideSuggest(); return; }
    if (els.companyId.value) return; // already attached
    lookup(typed, els.email.value).then(function (r) {
      if (els.company.value.trim() !== typed) return; // they kept typing; a newer lookup is on its way
      if (document.activeElement === els.company) companyCombo.refresh();
      applyCompanyMatch(r);
    });
  }

  function applyCompanyMatch(r) {
    if (els.companyId.value) return;
    if (r.autoMatch) {
      selectedCompany = { id: r.autoMatch.id, name: r.autoMatch.name };
      els.companyId.value = r.autoMatch.id;
      showMatched(r.autoMatch, false);
      hideSuggest();
    } else if (r.best && els.companySuggest.dataset.dismissed !== String(r.best.id)) {
      showSuggest(els.companySuggest, 'Did you mean', r.best, '\u201c' + r.best.name + '\u201d?');
    } else {
      hideSuggest();
    }
    postHeight();
  }

  els.company.addEventListener('blur', function () { setTimeout(refreshCompany, 130); });

  /**
   * Before submitting: if the typed name looks like a registered company (or the email domain says so)
   * and the user hasn't said yes or no yet, make them decide so the lead lands with the right company.
   * Resolves true when we're blocking on that decision.
   */
  function needsCompanyDecision() {
    if (!companyShown() || els.companyId.value) return Promise.resolve(false);
    return lookup(els.company.value, els.email.value).then(function (r) {
      var pending = null, el = null;
      if (r.byDomain && els.emailSuggest.dataset.dismissed !== String(r.byDomain.id)) {
        pending = r.byDomain; el = els.emailSuggest;
        showSuggest(el, 'Your email is @' + M.rootDomain(M.emailDomain(els.email.value)) + ' \u2014 is your company', pending, pending.name + '?');
      } else if (r.best && r.best.score >= 0.7 && els.companySuggest.dataset.dismissed !== String(r.best.id)) {
        pending = r.best; el = els.companySuggest;
        showSuggest(el, 'Did you mean', pending, '\u201c' + pending.name + '\u201d?');
      }
      if (!pending) return false;
      setError('company_name', 'Please confirm your company above (choose Yes or No).');
      el.querySelector('button').focus();
      postHeight();
      return true;
    });
  }

  /** If the email is on a registered company's domain, make sure the submission lands there. */
  function checkEmailDomain() {
    if (!companyShown()) return;
    var email = els.email.value.trim();
    if (!/@[^@\s]+\.[^@\s]+$/.test(email)) return;
    lookup('', email).then(function (r) {
      if (els.email.value.trim() !== email) return;
      els.emailSuggest.hidden = true;
      if (!r.byDomain) return;
      if (Number(els.companyId.value) === r.byDomain.id) return;
      if (els.emailSuggest.dataset.dismissed === String(r.byDomain.id)) return;

      var typed = els.company.value.trim();
      if (!typed) { setCompany(r.byDomain); return; } // nothing typed yet: just fill it in
      showSuggest(els.emailSuggest,
        'Your email is @' + M.rootDomain(M.emailDomain(email)) + ' \u2014 is your company',
        r.byDomain, r.byDomain.name + '?');
      postHeight();
    });
  }
  els.email.addEventListener('blur', checkEmailDomain);
  els.email.addEventListener('input', function () { debounce('email', checkEmailDomain, 500); });

  // ---------- State + City ----------

  function loadCities(code) {
    cities = [];
    els.city.value = '';
    els.city.disabled = true;
    els.city.placeholder = code ? 'Loading cities…' : 'Select a state first';
    if (!code) return Promise.resolve();
    return fetch('/api/locations/cities?state=' + encodeURIComponent(code))
      .then(function (r) { return r.json(); })
      .then(function (list) {
        cities = list;
        els.city.disabled = false;
        els.city.placeholder = 'Start typing your city';
      })
      .catch(function () { els.city.disabled = false; els.city.placeholder = 'Type your city'; });
  }

  els.state.addEventListener('change', function () {
    setError('state', '');
    loadCities(els.state.value);
  });

  combobox({
    input: els.city, menu: els.cityList,
    getItems: function (q) {
      var nq = q.trim().toLowerCase();
      if (!nq) return cities.slice(0, 50).map(function (c) { return { label: c, value: c }; });
      var starts = [], contains = [];
      for (var i = 0; i < cities.length && starts.length + contains.length < 50; i++) {
        var lc = cities[i].toLowerCase();
        if (lc.indexOf(nq) === 0) starts.push(cities[i]);
        else if (lc.indexOf(nq) !== -1) contains.push(cities[i]);
      }
      var out = starts.concat(contains).map(function (c) { return { label: c, value: c }; });
      return out.length ? out : [{ label: 'No matching city — you can keep what you typed', empty: true }];
    },
    onSelect: function (it) { els.city.value = it.value; setError('city', ''); },
    onInput: function () { setError('city', ''); },
  });
  // Snap free-typed city to its canonical casing when it's in the list.
  els.city.addEventListener('blur', function () {
    var v = els.city.value.trim().toLowerCase();
    if (!v) return;
    var hit = cities.find(function (c) { return c.toLowerCase() === v; });
    if (hit) els.city.value = hit;
  });

  // ---------- Phone ----------

  function formatPhone(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    if (d.length > 10) return v; // international or extension — leave alone
    if (d.length <= 3) return d;
    if (d.length <= 6) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  }
  els.phone.addEventListener('input', function () { els.phone.value = formatPhone(els.phone.value); });

  // ---------- Validation + submit ----------

  function setError(field, msg) {
    var box = form.querySelector('.m12-error[data-for="' + field + '"]');
    if (box) box.textContent = msg;
    var wrap = box && box.closest('.m12-field');
    if (wrap) wrap.classList.toggle('invalid', !!msg);
  }

  function validate() {
    var errors = {};
    if (companyShown() && !els.company.value.trim()) errors.company_name = 'Enter your company name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(els.email.value.trim())) errors.email = 'Enter a valid email address';
    if (!els.fullName.value.trim()) errors.full_name = 'Enter your full name';
    var digits = els.phone.value.replace(/\D/g, '');
    if (digits.length && digits.length < 10) errors.phone = 'Enter a valid phone number, or leave it blank';
    if (!els.state.value) errors.state = 'Select a state';
    if (!els.city.value.trim()) errors.city = 'Enter your city';
    ['company_name', 'email', 'full_name', 'phone', 'state', 'city'].forEach(function (f) { setError(f, errors[f] || ''); });
    return errors;
  }

  ['email', 'full_name', 'phone'].forEach(function (f) {
    $(f).addEventListener('input', function () { setError(f, ''); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    els.formError.textContent = '';
    var errors = validate();
    if (Object.keys(errors).length) {
      var first = form.querySelector('.m12-field.invalid input, .m12-field.invalid select');
      if (first) first.focus();
      postHeight();
      return;
    }
    needsCompanyDecision().then(function (blocked) { if (!blocked) submit(); });
  });

  function submit() {
    var payload = {
      company_name: companyShown() ? els.company.value.trim() : '',
      company_id: companyShown() ? (els.companyId.value || null) : null,
      email: els.email.value.trim(),
      full_name: els.fullName.value.trim(),
      phone: els.phone.value.trim(),
      city: els.city.value.trim(),
      state: els.state.value,
      preview_type: els.previewType.value,
      url_params: allParams,
      page_url: pageUrl || null,
      redirect: params.get('redirect') || null, // validated server-side against the allowed hosts
      website: $('website') ? $('website').value : '',
    };

    els.submit.disabled = true; els.submit.classList.add('loading');
    fetch('/api/submissions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        if (res.status === 422 && res.body.errors) {
          Object.keys(res.body.errors).forEach(function (f) { setError(f, res.body.errors[f]); });
          throw new Error('validation');
        }
        if (!res.body.ok) throw new Error(res.body.error || 'Something went wrong');
        onSuccess(res.body);
      })
      .catch(function (err) {
        if (err.message !== 'validation') els.formError.textContent = 'We couldn’t submit the form. Please try again.';
      })
      .finally(function () { els.submit.disabled = false; els.submit.classList.remove('loading'); postHeight(); });
  }

  function onSuccess(body) {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'mindful12:submitted', id: body.id, matched_company: body.matched_company }, '*');
    }
    form.hidden = true;
    // The server picked the destination: the company's invite link, or the per-preview-type fallback.
    var redirect = body.redirect_url;
    if (redirect && /^https?:\/\//i.test(redirect)) {
      if (els.redirect) return showRedirectNotice(redirect);
      return go(redirect);
    }
    if (params.get('success')) els.successText.textContent = params.get('success');
    els.success.hidden = false;
    postHeight();
  }

  /** Redirect the whole page (not just the iframe). */
  function go(url) {
    try { window.top.location.href = url; } catch (e) { window.location.href = url; }
  }

  var REDIRECT_DELAY_S = 30;

  /**
   * The destination asks them to create a login (name, email, password). Explain that first so
   * nobody closes the signup modal and misses the session; then send them on, or sooner if they click.
   */
  function showRedirectNotice(url) {
    var seconds = REDIRECT_DELAY_S, done = false;
    els.redirectEmail.textContent = els.email.value.trim();
    els.redirectCount.textContent = seconds;
    els.redirect.hidden = false;
    postHeight();
    if (window.parent !== window) window.parent.postMessage({ type: 'mindful12:scroll' }, '*');

    function leave() { if (done) return; done = true; clearInterval(timer); go(url); }
    els.redirectNow.addEventListener('click', leave);
    var timer = setInterval(function () {
      seconds -= 1;
      els.redirectCount.textContent = seconds;
      if (seconds <= 0) leave();
    }, 1000);
  }

  // ---------- Utilities ----------

  var timers = {};
  function debounce(key, fn, ms) { clearTimeout(timers[key]); timers[key] = setTimeout(fn, ms); }

  // ---------- Boot ----------

  fetch('/api/locations/states').then(function (r) { return r.json(); }).then(function (states) {
    states.forEach(function (s) {
      var o = document.createElement('option'); o.value = s.code; o.textContent = s.name; els.state.appendChild(o);
    });

    // Apply URL prefill that depends on loaded data.
    var st = (params.get('state') || '').trim();
    if (st) {
      var byName = states.find(function (s) { return s.code === st.toUpperCase() || s.name.toLowerCase() === st.toLowerCase(); });
      if (byName) {
        els.state.value = byName.code;
        loadCities(byName.code).then(function () {
          if (params.get('city')) { els.city.value = params.get('city'); els.city.dispatchEvent(new Event('blur')); }
        });
      }
    }
    applyPreviewType(els.previewType.value);
    if (els.company.value) refreshCompany();
    if (els.email.value) checkEmailDomain();
    postHeight();
  }).catch(function () {
    els.formError.textContent = 'The form couldn’t load. Please refresh the page.';
  });
})();
