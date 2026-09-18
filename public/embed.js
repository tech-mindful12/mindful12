/*
 * Mindful12 embed loader — paste into a GHL "Custom HTML" element:
 *
 *   <div class="mindful12-form" data-preview-type="hr"></div>
 *   <script src="https://YOUR-APP.up.railway.app/embed.js"></script>
 *
 * data-page="preview" loads the multi-step walkthrough that ends with the form (preview.html)
 * instead of the bare form; data-page="admin" loads the registered-companies admin panel;
 * data-page="stage" / "stage-executive" load the Setting the Stage walkthrough;
 * data-page="reset-breath" loads The Reset Breath page with its audio player. Any other data-* attribute becomes a URL parameter on the form
 * (data-preview-type -> preview_type, data-bg -> bg, data-redirect -> redirect, ...).
 * Query parameters on the funnel page URL (?preview_type=..., ?email=..., utm_*) are forwarded too,
 * and win over data-* attributes, so one page can serve several preview types via its link.
 */
(function () {
  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName('script'); return s[s.length - 1];
  })();
  var base = script.src.replace(/\/embed\.js(\?.*)?$/, '');

  function mount(container) {
    if (container.getAttribute('data-mounted')) return;
    container.setAttribute('data-mounted', '1');

    var pages = { preview: '/preview.html', admin: '/admin', stage: '/setting-the-stage', 'stage-executive': '/setting-the-stage/executive', 'reset-breath': '/reset-breath' };
    var page = pages[container.getAttribute('data-page')] || '/';
    var params = new URLSearchParams();
    Array.prototype.forEach.call(container.attributes, function (a) {
      if (a.name.indexOf('data-') === 0 && a.name !== 'data-mounted' && a.name !== 'data-page') {
        params.set(a.name.slice(5).replace(/-/g, '_'), a.value);
      }
    });
    new URLSearchParams(window.location.search).forEach(function (v, k) { params.set(k, v); });

    var iframe = document.createElement('iframe');
    iframe.src = base + page + '?' + params.toString();
    iframe.title = 'Mindful12 form';
    iframe.style.cssText = 'width:100%;border:0;display:block;min-height:560px;overflow:hidden;';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('allowtransparency', 'true');
    container.appendChild(iframe);

    // If the app never reports its height (down, blocked, very slow) tell the visitor instead of showing a blank box.
    var fallback = document.createElement('p');
    fallback.style.cssText = 'font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0D2158;text-align:center;padding:16px;';
    fallback.textContent = 'The form is taking longer than usual to load. Please refresh the page or try again in a moment.';
    var fallbackTimer = setTimeout(function () { container.appendChild(fallback); }, 10000);

    window.addEventListener('message', function (e) {
      if (e.source !== iframe.contentWindow || !e.data) return;
      if (e.data.type === 'mindful12:height' && e.data.height) {
        clearTimeout(fallbackTimer);
        if (fallback.parentNode) fallback.parentNode.removeChild(fallback);
        iframe.style.height = Math.ceil(e.data.height) + 'px';
        iframe.style.minHeight = '0';
      }
      if (e.data.type === 'mindful12:scroll') {
        var top = iframe.getBoundingClientRect().top + window.pageYOffset - 16;
        if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: 'smooth' });
      }
      if (e.data.type === 'mindful12:submitted') {
        container.dispatchEvent(new CustomEvent('mindful12:submitted', { detail: e.data, bubbles: true }));
      }
    });
    iframe.addEventListener('load', function () {
      iframe.contentWindow.postMessage({ type: 'mindful12:page', url: window.location.href }, '*');
    });
  }

  function init() {
    var nodes = document.querySelectorAll('.mindful12-form, #mindful12-form');
    Array.prototype.forEach.call(nodes, mount);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
