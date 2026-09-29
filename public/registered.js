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

  // ---------- Day-aware wording ----------
  // Challenges send Tuesday 7:00 AM ET and the run-up is Friday (Reset Breath) then Monday, so the
  // copy is written against New York time, not the visitor's. Same three cases Bob approved for the
  // registration emails: Mon / Tue-Thu / Fri-Sun.
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function easternDay() {
    // ?day=friday pins the weekday so the copy can be reviewed without waiting for the week.
    var forced = new URLSearchParams(window.location.search).get('day');
    if (forced) {
      var f = DAYS.indexOf(forced.charAt(0).toUpperCase() + forced.slice(1).toLowerCase());
      if (f !== -1) return f;
    }
    try {
      var name = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' }).format(new Date());
      var i = DAYS.indexOf(name);
      return i === -1 ? null : i;
    } catch (e) {
      return null;   // no Intl/tz support: leave the copy exactly as written
    }
  }

  /** "Today" / "Tomorrow" / the weekday name, for a day that is still ahead of them. */
  function relativeDay(today, target) {
    if (today === target) return 'Today';
    if ((today + 1) % 7 === target) return 'Tomorrow';
    return DAYS[target];
  }

  function applyDayWording() {
    var today = easternDay();
    if (today === null) return;
    var MON = 1, TUE = 2, FRI = 5;

    var challenge = document.getElementById('challenge-day');
    if (challenge) {
      // Tue-Thu have just missed this week's send, so theirs is a full week out.
      challenge.textContent = today === MON ? 'tomorrow'
        : (today >= TUE && today <= 4) ? 'next Tuesday'
        : 'Tuesday';
    }

    var friLabel = document.getElementById('label-friday');
    var friRow = document.getElementById('day-friday');
    if (friLabel) friLabel.textContent = relativeDay(today, FRI);
    // Sat/Sun/Mon: that Friday is behind them, so the row would read as something still coming.
    if (friRow && (today === 6 || today === 0 || today === MON)) friRow.hidden = true;

    var monLabel = document.getElementById('label-monday');
    if (monLabel) monLabel.textContent = relativeDay(today, MON);
  }

  applyDayWording();

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
})();
