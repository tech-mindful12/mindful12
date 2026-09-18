/*
 * Setting the Stage (setting-the-stage.html). Runs before flow.js so the step list is final
 * when flow.js counts it.
 *
 * Audience comes from the path (/setting-the-stage/executive) or ?audience=executive.
 * Elements with data-audience="executive" only show for executives; data-audience-text spans
 * pick the wording for the current audience.
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var fromPath = /\/executive\/?$/.test(window.location.pathname) ? 'executive' : '';
  var audience = (params.get('audience') || fromPath || 'general').toLowerCase() === 'executive' ? 'executive' : 'general';
  document.documentElement.setAttribute('data-audience', audience);

  Array.prototype.forEach.call(document.querySelectorAll('[data-audience]'), function (el) {
    if (el.getAttribute('data-audience') !== audience) el.parentNode.removeChild(el);
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-audience-text]'), function (el) {
    if (el.getAttribute('data-audience-text') !== audience) el.parentNode.removeChild(el);
  });

  // "3 / 8" footer, kept in sync with whichever step flow.js activates.
  var counter = document.getElementById('stage-count');
  var steps = document.querySelectorAll('.lp-step');
  function updateCount() {
    var i = 0;
    for (var n = 0; n < steps.length; n++) if (steps[n].classList.contains('is-active')) i = n + 1;
    if (counter) counter.textContent = i + ' / ' + steps.length;
  }
  if (window.MutationObserver) {
    new MutationObserver(updateCount).observe(document.querySelector('.lp-steps'), { attributes: true, subtree: true, attributeFilter: ['class'] });
  }
  document.addEventListener('DOMContentLoaded', updateCount);

  // Same iframe-resize protocol as the form pages, so embed.js sizes this page too.
  var embedded = window.parent !== window;
  if (embedded) document.documentElement.classList.add('embedded');
  function postHeight() {
    if (!embedded) return;
    var main = document.querySelector('.m12');
    window.parent.postMessage({ type: 'mindful12:height', height: Math.ceil(main.getBoundingClientRect().height + main.offsetTop) }, '*');
  }
  if (window.ResizeObserver) new ResizeObserver(postHeight).observe(document.body);
  window.addEventListener('load', postHeight);
})();
