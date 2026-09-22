/*
 * /registered — points the "Read the introduction" button at the companion book.
 *
 * The destination is a GHL custom value, which GHL can only fill in on its own page, not inside
 * this iframe. So the funnel page passes it down on the embed:
 *
 *   <div class="mindful12-form" data-page="registered"
 *        data-introduction="{{custom_values.introduction}}"></div>
 *
 * embed.js turns any data-* into a query param, so that arrives here as ?introduction=…
 * Failing that we use INTRODUCTION_URL from the server. With neither, the button stays hidden
 * rather than sitting there doing nothing.
 */
(function () {
  'use strict';

  var link = document.getElementById('introduction-link');
  if (!link) return;

  var fromParams = new URLSearchParams(window.location.search).get('introduction');
  var url = httpsOnly(fromParams) || httpsOnly(window.M12_INTRODUCTION_URL);

  if (url) {
    link.href = url;
    link.hidden = false;
  }

  // The host page hands us this URL, so don't take javascript:/data: or an unfilled merge field.
  function httpsOnly(value) {
    var v = String(value || '').trim();
    if (!v || v.indexOf('{{') === 0) return '';
    try { return new URL(v).protocol === 'https:' ? v : ''; } catch (e) { return ''; }
  }

  // The logo is ours; the funnel page may already show one. data-logo="off" hides it.
  if (new URLSearchParams(window.location.search).get('logo') === 'off') {
    var logo = document.getElementById('page-logo');
    if (logo) logo.hidden = true;
  }
})();
