/**
 * Senvia OS — Embed Script v1.0
 * 
 * Usage:
 *   Mode iframe (form inline):
 *     <div id="senvia-form"></div>
 *     <script src="https://app.senvia.pt/embed.js" data-form="slug" data-mode="iframe"></script>
 *
 *   Mode redirect (floating button):
 *     <script src="https://app.senvia.pt/embed.js" data-form="slug" data-mode="redirect"></script>
 */
(function () {
  'use strict';

  var SENVIA_BASE = 'https://app.senvia.pt';

  // Find our own script tag
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  var formSlug = currentScript.getAttribute('data-form');
  var mode = currentScript.getAttribute('data-mode') || 'redirect';
  var formPath = currentScript.getAttribute('data-path') || 'c'; // c = conversational, f = traditional
  var buttonText = currentScript.getAttribute('data-text') || 'Contacte-nos';
  var buttonColor = currentScript.getAttribute('data-color') || '#6366f1';

  if (!formSlug) {
    console.error('[Senvia Embed] data-form attribute is required');
    return;
  }

  // Capture tracking params from parent URL
  function getTrackingParams() {
    var params = new URLSearchParams(window.location.search);
    var trackingKeys = [
      'fbclid', 'gclid', 'ttclid', 'msclkid', 'li_fat_id',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'
    ];
    var result = new URLSearchParams();
    trackingKeys.forEach(function (key) {
      var val = params.get(key);
      if (val) result.set(key, val);
    });
    return result.toString();
  }

  function buildFormUrl() {
    var url = SENVIA_BASE + '/' + formPath + '/' + formSlug;
    var tracking = getTrackingParams();
    if (tracking) url += '?' + tracking;
    return url;
  }

  // ===== IFRAME MODE =====
  if (mode === 'iframe') {
    var container = document.getElementById('senvia-form') || currentScript.parentElement;
    if (!container) {
      console.error('[Senvia Embed] No container found. Add <div id="senvia-form"></div> before the script tag.');
      return;
    }

    var iframe = document.createElement('iframe');
    iframe.src = buildFormUrl();
    iframe.style.cssText = 'border:none;width:100%;min-height:600px;display:block;';
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.setAttribute('loading', 'lazy');
    iframe.title = 'Formulário de contacto';

    container.appendChild(iframe);

    // Listen for resize messages from the form
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'senvia-resize' && typeof e.data.height === 'number') {
        iframe.style.height = e.data.height + 'px';
      }
    });
    return;
  }

  // ===== REDIRECT MODE (floating button) =====
  var btn = document.createElement('a');
  btn.href = buildFormUrl();
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.textContent = buttonText;
  btn.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'right:24px',
    'z-index:9999',
    'padding:14px 28px',
    'border-radius:50px',
    'background:' + buttonColor,
    'color:#fff',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
    'font-size:15px',
    'font-weight:600',
    'text-decoration:none',
    'box-shadow:0 4px 14px rgba(0,0,0,0.25)',
    'transition:transform 0.2s,box-shadow 0.2s',
    'cursor:pointer'
  ].join(';');

  btn.addEventListener('mouseenter', function () {
    btn.style.transform = 'scale(1.05)';
    btn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
  });
  btn.addEventListener('mouseleave', function () {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 14px rgba(0,0,0,0.25)';
  });

  // Update href on click to capture latest tracking params
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    window.open(buildFormUrl(), '_blank', 'noopener,noreferrer');
  });

  document.body.appendChild(btn);
})();
