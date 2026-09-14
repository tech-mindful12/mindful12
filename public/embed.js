/*
 * Mindful12 embed loader — paste into a GHL "Custom HTML" element:
 *
 *   <div class="mindful12-form" data-preview-type="brochure"></div>
 *   <script src="https://YOUR-APP.up.railway.app/embed.js"></script>
 *
 * Any data-* attribute becomes a URL parameter on the form (data-preview-type -> preview_type,
 * data-bg -> bg, data-title -> title, data-redirect -> redirect, ...).
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

    var params = new URLSearchParams();
    Array.prototype.forEach.call(container.attributes, function (a) {
      if (a.name.indexOf('data-') === 0 && a.name !== 'data-mounted') {
        params.set(a.name.slice(5).replace(/-/g, '_'), a.value);
      }
    });
    new URLSearchParams(window.location.search).forEach(function (v, k) { params.set(k, v); });

    var iframe = document.createElement('iframe');
    iframe.src = base + '/?' + params.toString();
    iframe.title = 'Mindful12 form';
    iframe.style.cssText = 'width:100%;border:0;display:block;min-height:560px;overflow:hidden;';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('allowtransparency', 'true');
    container.appendChild(iframe);

    window.addEventListener('message', function (e) {
      if (e.source !== iframe.contentWindow || !e.data) return;
      if (e.data.type === 'mindful12:height' && e.data.height) {
        iframe.style.height = Math.ceil(e.data.height) + 'px';
        iframe.style.minHeight = '0';
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
