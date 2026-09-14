(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    login: $('ad-login'), loginForm: $('login-form'), password: $('password'), loginError: $('login-error'), loginBtn: $('login-btn'),
    panel: $('ad-panel'), rows: $('ad-rows'), empty: $('ad-empty'), flash: $('ad-flash'),
    addBtn: $('add-btn'), logoutBtn: $('logout-btn'), template: $('row-template'),
  };

  var TOKEN_KEY = 'mindful12_admin_token';
  var token = '';
  try { token = sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { /* storage blocked */ }

  // ---------- Embed helpers ----------

  var embedded = window.parent !== window;
  if (embedded) document.documentElement.classList.add('embedded');
  function postHeight() {
    if (!embedded) return;
    var main = document.querySelector('.m12');
    window.parent.postMessage({ type: 'mindful12:height', height: Math.ceil(main.getBoundingClientRect().height + main.offsetTop) }, '*');
  }
  if (window.ResizeObserver) new ResizeObserver(postHeight).observe(document.body);

  // ---------- API ----------

  function api(method, path, body) {
    return fetch(path, {
      method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && path !== '/api/admin/login') { signOut(); throw new Error('Your session expired — please sign in again.'); }
        if (!r.ok) { var err = new Error(j.error || 'Request failed'); err.errors = j.errors; err.status = r.status; throw err; }
        return j;
      });
    });
  }

  // ---------- Auth ----------

  function setToken(t) {
    token = t || '';
    try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }

  function showLogin(message) {
    els.panel.hidden = true;
    els.login.hidden = false;
    els.loginError.textContent = message || '';
    els.password.value = '';
    setTimeout(function () { els.password.focus(); }, 50);
    postHeight();
  }

  function signOut() { setToken(''); showLogin(''); }

  els.loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    els.loginError.textContent = '';
    els.loginBtn.disabled = true;
    api('POST', '/api/admin/login', { password: els.password.value })
      .then(function (j) { setToken(j.token); return openPanel(); })
      .catch(function (err) { els.loginError.textContent = err.message; })
      .finally(function () { els.loginBtn.disabled = false; postHeight(); });
  });

  els.logoutBtn.addEventListener('click', signOut);

  // ---------- Panel ----------

  function flash(kind, text) {
    els.flash.className = 'ad-flash ' + kind;
    els.flash.textContent = text;
    els.flash.hidden = false;
    clearTimeout(flash.timer);
    flash.timer = setTimeout(function () { els.flash.hidden = true; postHeight(); }, kind === 'ok' ? 3000 : 6000);
    postHeight();
  }

  function openPanel() {
    return api('GET', '/api/admin/companies').then(function (j) {
      els.login.hidden = true;
      els.panel.hidden = false;
      render(j.companies);
    });
  }

  function render(companies) {
    els.rows.innerHTML = '';
    companies.forEach(function (c) { els.rows.appendChild(buildRow(c)); });
    els.empty.hidden = companies.length > 0;
    postHeight();
  }

  var FIELDS = ['name', 'domain', 'website', 'invite_link', 'passcode', 'tag'];

  function buildRow(c) {
    var tr = els.template.content.firstElementChild.cloneNode(true);
    tr.dataset.id = c.id || '';
    fill(tr, c);
    tr.classList.toggle('inactive', c.active === false);
    if (!c.id) setEditing(tr, true); // brand-new row starts in edit mode
    return tr;
  }

  function fill(tr, c) {
    FIELDS.forEach(function (f) { tr.querySelector('[name="' + f + '"]').value = c[f] || ''; });
    tr.querySelector('[name="active"]').checked = c.active !== false;
    tr._snapshot = read(tr);
  }

  function read(tr) {
    var out = {};
    FIELDS.forEach(function (f) { out[f] = tr.querySelector('[name="' + f + '"]').value.trim(); });
    out.active = tr.querySelector('[name="active"]').checked;
    return out;
  }

  function setEditing(tr, on) {
    tr.classList.toggle('editing', on);
    tr.querySelectorAll('input').forEach(function (i) { i.disabled = !on; i.classList.remove('invalid'); });
    tr.querySelector('[data-act="edit"]').hidden = on;
    tr.querySelector('[data-act="delete"]').hidden = on;
    tr.querySelector('[data-act="save"]').hidden = !on;
    tr.querySelector('[data-act="cancel"]').hidden = !on;
    if (on) tr.querySelector('[name="name"]').focus();
    postHeight();
  }

  function busy(tr, on) { tr.querySelectorAll('button').forEach(function (b) { b.disabled = on; }); }

  els.rows.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var tr = btn.closest('tr');
    var act = btn.dataset.act;
    if (act === 'edit') setEditing(tr, true);
    else if (act === 'cancel') cancel(tr);
    else if (act === 'save') save(tr);
    else if (act === 'delete') remove(tr);
  });

  els.rows.addEventListener('keydown', function (e) {
    var tr = e.target.closest('tr');
    if (!tr || !tr.classList.contains('editing')) return;
    if (e.key === 'Enter') { e.preventDefault(); save(tr); }
    if (e.key === 'Escape') cancel(tr);
  });

  function cancel(tr) {
    if (!tr.dataset.id) { tr.remove(); postHeight(); return; } // unsaved new row
    fill(tr, tr._snapshot);
    setEditing(tr, false);
  }

  function save(tr) {
    var data = read(tr);
    var id = tr.dataset.id;
    busy(tr, true);
    api(id ? 'PUT' : 'POST', '/api/admin/companies' + (id ? '/' + id : ''), data)
      .then(function (j) {
        tr.dataset.id = j.company.id;
        fill(tr, j.company);
        tr.classList.toggle('inactive', j.company.active === false);
        setEditing(tr, false);
        flash('ok', (id ? 'Saved ' : 'Added ') + j.company.name + '.');
      })
      .catch(function (err) {
        if (err.errors) {
          Object.keys(err.errors).forEach(function (f) {
            var input = tr.querySelector('[name="' + f + '"]');
            if (input) input.classList.add('invalid');
          });
          flash('err', Object.values(err.errors).join(' '));
        } else {
          flash('err', err.message);
        }
      })
      .finally(function () { busy(tr, false); });
  }

  function remove(tr) {
    var name = tr.querySelector('[name="name"]').value || 'this company';
    if (!window.confirm('Delete ' + name + '? Past sign-ups keep their record, but will no longer link to this company.')) return;
    busy(tr, true);
    api('DELETE', '/api/admin/companies/' + tr.dataset.id)
      .then(function () { tr.remove(); flash('ok', 'Deleted ' + name + '.'); els.empty.hidden = els.rows.children.length > 0; postHeight(); })
      .catch(function (err) { flash('err', err.message); busy(tr, false); });
  }

  els.addBtn.addEventListener('click', function () {
    var tr = buildRow({ active: true });
    els.rows.insertBefore(tr, els.rows.firstChild);
    els.empty.hidden = true;
    tr.querySelector('[name="name"]').focus();
    postHeight();
  });

  // ---------- Boot ----------

  if (token) {
    openPanel().catch(function () { showLogin(''); });
  } else {
    showLogin('');
  }
})();
