/* Step navigation for preview.html. Continue/Back buttons carry data-m12-next / data-m12-back. */
(function () {
  'use strict';

  var steps = Array.prototype.slice.call(document.querySelectorAll('.lp-step'));
  if (!steps.length) return;

  var params = new URLSearchParams(window.location.search);
  var current = Math.min(Math.max(parseInt(params.get('step'), 10) || 1, 1), steps.length); // ?step=7 jumps straight to the form

  function show(n) {
    current = n;
    steps.forEach(function (s, i) { s.classList.toggle('is-active', i + 1 === n); });
    // Scroll the step into view — top of the iframe when embedded, top of the page otherwise.
    if (window.parent !== window) window.parent.postMessage({ type: 'mindful12:scroll' }, '*');
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    var focusTarget = steps[n - 1].querySelector('h1, h2');
    if (focusTarget) { focusTarget.setAttribute('tabindex', '-1'); focusTarget.focus({ preventScroll: true }); }
  }

  document.addEventListener('click', function (e) {
    var next = e.target.closest('[data-m12-next]');
    var back = e.target.closest('[data-m12-back]');
    if (next && current < steps.length) show(current + 1);
    else if (back && current > 1) show(current - 1);
  });

  show(current);
})();
