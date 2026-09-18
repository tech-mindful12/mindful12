/* FAQ page: "ask us directly" form + iframe height reporting. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var form = $('ask-form'), sent = $('ask-sent'), submit = $('ask-submit'), formError = $('ask-error');

  // Same iframe-resize protocol as the other pages. Accordion toggles resize the body, so the observer covers those too.
  var embedded = window.parent !== window;
  if (embedded) document.documentElement.classList.add('embedded');
  function postHeight() {
    if (!embedded) return;
    var main = document.querySelector('.m12');
    window.parent.postMessage({ type: 'mindful12:height', height: Math.ceil(main.getBoundingClientRect().height + main.offsetTop) }, '*');
  }
  if (window.ResizeObserver) new ResizeObserver(postHeight).observe(document.body);
  window.addEventListener('load', postHeight);

  // In-page anchor ("form to ask us directly") inside an iframe: scroll the iframe's own document, then ask the parent to follow.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (embedded) window.parent.postMessage({ type: 'mindful12:scrollTo', offset: target.getBoundingClientRect().top + window.pageYOffset }, '*');
  });

  function setError(field, msg) {
    var box = form.querySelector('.m12-error[data-for="' + field + '"]');
    if (box) box.textContent = msg;
    var wrap = box && box.closest('.m12-field');
    if (wrap) wrap.classList.toggle('invalid', !!msg);
  }

  ['name', 'email', 'question'].forEach(function (f) {
    form.elements[f].addEventListener('input', function () { setError(f, ''); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formError.textContent = '';
    var data = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      question: form.elements.question.value.trim(),
      website: form.elements.website.value,
      page_url: document.referrer || null,
    };
    var errors = {};
    if (!data.name) errors.name = 'Enter your name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) errors.email = 'Enter a valid email address';
    if (data.question.length < 5) errors.question = 'Tell us a little more';
    ['name', 'email', 'question'].forEach(function (f) { setError(f, errors[f] || ''); });
    if (Object.keys(errors).length) { postHeight(); return; }

    submit.disabled = true; submit.classList.add('loading');
    fetch('/api/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        if (res.status === 422 && res.body.errors) {
          Object.keys(res.body.errors).forEach(function (f) { setError(f, res.body.errors[f]); });
          throw new Error('validation');
        }
        if (!res.body.ok) throw new Error(res.body.error || 'Something went wrong');
        $('ask-sent-email').textContent = data.email;
        form.hidden = true;
        sent.hidden = false;
        postHeight();
      })
      .catch(function (err) {
        if (err.message !== 'validation') formError.textContent = 'We couldn’t send your question. Please try again, or email support@mindful12.com.';
      })
      .finally(function () { submit.disabled = false; submit.classList.remove('loading'); postHeight(); });
  });
})();
