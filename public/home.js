/* Homepage: the mobile menu toggle and the footer year. */
(function () {
  'use strict';

  // CSS owns whether the menu is a row (desktop) or a panel (narrow); this only opens the panel.
  var nav = document.querySelector('.hp-nav');
  var burger = document.getElementById('hp-burger');
  if (nav && burger) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
  }

  var year = document.getElementById('hp-year');
  if (year) year.textContent = new Date().getFullYear();

  // Same iframe-resize protocol as the other pages, so embed.js can size this one too.
  var embedded = window.parent !== window;
  if (!embedded) return;
  document.documentElement.classList.add('embedded');
  function postHeight() {
    window.parent.postMessage({ type: 'mindful12:height', height: Math.ceil(document.body.getBoundingClientRect().height) }, '*');
  }
  if (window.ResizeObserver) new ResizeObserver(postHeight).observe(document.body);
  window.addEventListener('load', postHeight);
})();
