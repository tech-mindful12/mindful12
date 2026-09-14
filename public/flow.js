/* Step navigation for preview.html. Continue/Back buttons carry data-m12-next / data-m12-back. */
(function () {
  'use strict';

  // ---------- Copy per preview type ----------
  // The HTML carries the HR version. Everything that differs for the other types lives here.
  // Elements with data-for="a,b" only show for those types; data-copy="key" gets its text swapped;
  // data-rows="key" gets its icon rows rebuilt.

  var WELCOME_TITLE = 'Welcome to Mindful<span class="lp-accent">12</span>';
  var COPY = {
    hr: {},
    executive: {
      welcome_title: WELCOME_TITLE,
      welcome_lede: 'A different way to move through your day.',
      welcome_body: 'Before deciding whether Mindful 12 could be right for your company, we invite you to experience the first week for yourself.',
      pricing_lead: 'After the 12 weeks, employees who choose to continue:',
      ready_rows: [
        { icon: 'fas fa-calendar-alt', text: 'Create your account and join us next Tuesday.' },
      ],
    },
    employee: {
      welcome_title: WELCOME_TITLE,
      welcome_lede: 'A different way to move through your day.',
      welcome_body: 'Before deciding whether Mindful 12 is right for you, we invite you to experience the first week.',
      pricing_lead: 'If you choose to continue after the first 12-week series:',
      ready_rows: [
        { icon: 'fas fa-calendar-alt', text: 'The next session begins on Tuesday.' },
        { icon: 'fas fa-user-friends', text: 'Create your account and join us.' },
      ],
    },
    independent: {
      welcome_title: 'Interested in Mindful<span class="lp-accent">12</span>?',
      welcome_lede: 'Mindful 12 is offered as a company sponsored employee benefit.',
      welcome_body: 'If your company is not currently participating, we invite you to experience the first week of Mindful 12. If you find it valuable, you can share it with your employer to see if they would like to offer it as an employee benefit.',
      ready_rows: [
        { icon: 'fas fa-calendar-alt', text: 'The next session begins on Tuesday.' },
        { icon: 'fas fa-user-friends', text: 'Create your account and join us.' },
      ],
    },
  };

  var typeInput = document.getElementById('preview_type'); // form.js has already normalized it
  var type = typeInput && COPY[typeInput.value] ? typeInput.value : 'independent';
  var copy = COPY[type];

  // Drop sections/paragraphs that aren't for this type.
  Array.prototype.forEach.call(document.querySelectorAll('[data-for]'), function (el) {
    var allowed = el.getAttribute('data-for').split(',').map(function (t) { return t.trim(); });
    if (allowed.indexOf(type) === -1) el.parentNode.removeChild(el);
  });
  // Swap copy (constants above, never user input).
  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (el) {
    var key = el.getAttribute('data-copy');
    if (copy[key]) el.innerHTML = copy[key];
  });
  // Rebuild icon rows.
  Array.prototype.forEach.call(document.querySelectorAll('[data-rows]'), function (el) {
    var rows = copy[el.getAttribute('data-rows')];
    if (!rows) return;
    el.innerHTML = rows.map(function (r) {
      return '<div class="lp-item"><div class="lp-chip"><i class="' + r.icon + '" aria-hidden="true"></i></div>' +
             '<div><p class="lp-label">' + r.text + '</p></div></div>';
    }).join('');
  });

  var steps = Array.prototype.slice.call(document.querySelectorAll('.lp-step'));
  if (!steps.length) return;

  var params = new URLSearchParams(window.location.search);
  // ?step=N (counted over this type's visible steps) or ?step=form jumps ahead; the form is always last.
  var requested = params.get('step') === 'form' ? steps.length : parseInt(params.get('step'), 10) || 1;
  var current = Math.min(Math.max(requested, 1), steps.length);

  function show(n, initial) {
    current = n;
    steps.forEach(function (s, i) { s.classList.toggle('is-active', i + 1 === n); });
    if (initial) return;
    // Scroll the step into view — top of the iframe when embedded, top of the page otherwise.
    if (window.parent !== window) window.parent.postMessage({ type: 'mindful12:scroll' }, '*');
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    // Move focus to the new heading for screen readers (the visible ring is suppressed in flow.css).
    var focusTarget = steps[n - 1].querySelector('h1, h2');
    if (focusTarget) { focusTarget.setAttribute('tabindex', '-1'); focusTarget.focus({ preventScroll: true }); }
  }

  document.addEventListener('click', function (e) {
    var next = e.target.closest('[data-m12-next]');
    var back = e.target.closest('[data-m12-back]');
    if (next && current < steps.length) show(current + 1);
    else if (back && current > 1) show(current - 1);
  });

  show(current, true);
})();
