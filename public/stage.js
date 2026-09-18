/*
 * Setting the Stage pages (setting-the-stage.html, setting-the-stage-executive.html):
 * keeps the "n / N" footer in sync and reports height to the embed loader.
 */
(function () {
  'use strict';

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
