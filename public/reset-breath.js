/* The Reset Breath page: custom audio player + iframe height reporting. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var audio = $('rb-audio'), player = $('rb-player'), play = $('rb-play'), label = $('rb-play-label');
  var progress = $('rb-progress'), fill = $('rb-progress-fill'), current = $('rb-current'), duration = $('rb-duration');

  function fmt(s) {
    if (!isFinite(s)) return '–:––';
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function setPlaying(on) {
    player.classList.toggle('is-playing', on);
    label.textContent = on ? 'Pause' : (audio.currentTime > 0 && audio.currentTime < audio.duration ? 'Resume' : 'Listen to the Reset Breath');
    play.setAttribute('aria-label', on ? 'Pause the Reset Breath' : 'Play the Reset Breath');
  }

  play.addEventListener('click', function () {
    if (audio.paused) {
      var p = audio.play();
      if (p && p.catch) p.catch(function () { setPlaying(false); });
    } else {
      audio.pause();
    }
  });

  audio.addEventListener('play', function () { setPlaying(true); });
  audio.addEventListener('pause', function () { setPlaying(false); });
  audio.addEventListener('ended', function () { audio.currentTime = 0; setPlaying(false); update(); });
  audio.addEventListener('loadedmetadata', update);
  audio.addEventListener('durationchange', update);
  audio.addEventListener('timeupdate', update);

  function update() {
    var d = audio.duration, t = audio.currentTime;
    var pct = isFinite(d) && d > 0 ? (t / d) * 100 : 0;
    fill.style.width = pct + '%';
    progress.setAttribute('aria-valuenow', Math.round(pct));
    current.textContent = fmt(t);
    duration.textContent = fmt(d);
  }

  // Click / drag / keyboard on the progress bar
  function seekTo(clientX) {
    var r = progress.getBoundingClientRect();
    var ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    if (isFinite(audio.duration)) { audio.currentTime = ratio * audio.duration; update(); }
  }
  var dragging = false;
  progress.addEventListener('pointerdown', function (e) { dragging = true; progress.setPointerCapture(e.pointerId); seekTo(e.clientX); });
  progress.addEventListener('pointermove', function (e) { if (dragging) seekTo(e.clientX); });
  progress.addEventListener('pointerup', function () { dragging = false; });
  progress.addEventListener('pointercancel', function () { dragging = false; });
  progress.addEventListener('keydown', function (e) {
    if (!isFinite(audio.duration)) return;
    if (e.key === 'ArrowRight') { audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - 5); e.preventDefault(); }
    if (e.key === ' ' || e.key === 'Enter') { play.click(); e.preventDefault(); }
    update();
  });

  // Same iframe-resize protocol as the other pages, so embed.js sizes this page too.
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
