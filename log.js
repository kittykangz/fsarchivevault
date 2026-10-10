(function () {
  'use strict';
  if (window.Log) return;

  var BASE = 'https://terril.duckdns.org/event/';

  function enc(s) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/[\/\\]/g, '_').trim().slice(0, 80);
    return s ? encodeURIComponent(s) : '-';
  }
  function send(path) {
    var url = BASE + path;
    try {
      fetch(url, { mode: 'no-cors', keepalive: true, credentials: 'omit', cache: 'no-store' }).catch(function () {});
    } catch (e) {
      new Image().src = url;
    }
  }
  function ev(name) {
    var a = Array.prototype.slice.call(arguments, 1);
    return name + (a.length ? '/' + a.map(enc).join('/') : '');
  }

  function pageOf(href) {
    try {
      var u = new URL(href, location.href);
      if (u.origin !== location.origin) return null;
      var f = u.pathname.split('/').pop() || '';
      try { f = decodeURIComponent(f); } catch (e) {}
      f = f.replace(/\.html$/i, '');
      if (!f || f === 'index') return 'home';
      if (/\.[a-z0-9]{2,5}$/i.test(f)) return null;      
      return f;
    } catch (e) { return null; }
  }
  var PAGE = pageOf(location.href) || 'unknown';
  function ui(name) {
    var rest = Array.prototype.slice.call(arguments, 1);
    return ev.apply(null, [name, PAGE].concat(rest));
  }
  function txt(el) {
    return (window.I18n && I18n.original) ? I18n.original(el) : el.textContent.trim();
  }
  function safeDec(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

  var SRC = [
    ['.sb-recent', 'sidebar-recent'],
    ['#sb', 'sidebar'],
    ['.topbar', 'topbar'],
    ['.hero-cell', 'hero'],
    ['.recent-gallery-box', 'recent-uploads'],
    ['.tree-container', 'volume-tree'],
    ['#lbFt', 'lightbox-ft'],
    ['.lb-post-menu', 'post-menu'],
    ['#fav-context-menu', 'fav-menu'],
    ['#fav-modal', 'fav-modal'],
    ['#profile-modal', 'profile'],
    ['#premium-info-modal', 'premium-modal'],
    ['#auth-modal', 'auth-modal'],
    ['#footer-modal', 'footer'],
    ['.site-footer', 'footer'],
    ['#lightbox', 'lightbox']
  ];
  function srcOf(el) {
    for (var i = 0; i < SRC.length; i++) if (el.closest(SRC[i][0])) return SRC[i][1];
    return 'page';
  }
  var last = { src: '', t: 0 };
  function ctx() { return Date.now() - last.t < 1500 ? last.src : 'other'; }

  function posOf(a, src) {
    var sel = src === 'recent-uploads' ? '.recent-gallery-box a' : src === 'sidebar-recent' ? '#sb .sb-recent__link' : null;
    if (!sel) return '';
    var i = Array.prototype.indexOf.call(document.querySelectorAll(sel), a);
    return i < 0 ? '' : String(i + 1);
  }

  function setNav(dest, src, pos) {
    try { sessionStorage.setItem('log_nav', JSON.stringify({ d: dest, s: src, p: pos || '', t: Date.now() })); } catch (e) {}
  }
  function takeNav() {
    try {
      var o = JSON.parse(sessionStorage.getItem('log_nav'));
      sessionStorage.removeItem('log_nav');
      return o;
    } catch (e) { return null; }
  }
  function arrival() {
    var nav = takeNav(), type = '';
    try { type = performance.getEntriesByType('navigation')[0].type; } catch (e) {}
    if (type === 'reload') return 'reload';
    if (type === 'back_forward') return 'back-forward';
    if (nav && Date.now() - nav.t < 15000 && (nav.d === null || nav.d === PAGE)) return nav.s;
    var ref = document.referrer;
    if (!ref) return 'direct';
    try {
      var r = new URL(ref);
      return r.origin === location.origin ? 'internal-other' : 'ext:' + r.hostname.replace(/^www\./, '');
    } catch (e) { return 'direct'; }
  }
  var ARRIVAL = arrival();
  send(ev('pageview', PAGE, ARRIVAL));
  window.addEventListener('pageshow', function (e) { if (e.persisted) send(ev('pageview', PAGE, 'bfcache')); });

  function linkClick(a, e) {
    var href = a.getAttribute('href') || '';
    var src = srcOf(a);
    if (/^mailto:/i.test(href)) { send(ui('mailto', src)); return; }
    var u;
    try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin) {
      send(ev('outbound', u.hostname.replace(/^www\./, ''), PAGE, src));
      return;
    }
    var dest = pageOf(a.href);
    if (!dest) return;
    var pos = posOf(a, src);
    var newTab = e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1 || a.target === '_blank';
    send((newTab ? 'go-newtab/' : 'go/') + enc(dest) + '/' + enc(src) + (pos ? '/' + pos : ''));
    if (!newTab) setNav(dest, src, pos);
  }

  function heroClick(cell) {
    var g = cell.querySelector('.hero-badge'), n = cell.querySelector('.hero-name');
    if (!g || !n) return;
    var dest = txt(g) + '_' + txt(n);
    var cells = document.querySelectorAll('#hero-strip .hero-cell');
    var pos = String(Array.prototype.indexOf.call(cells, cell) + 1);
    send('go/' + enc(dest) + '/hero/' + pos);
    setNav(dest, 'hero', pos);
  }

  var footerKey = '';
  var RULES = [
    ['.sb-group__toggle', function (el) {
      var g = el.closest('.sb-group');
      return ui('sb-group', g.dataset.group, g.classList.contains('is-open') ? 'closed' : 'open');
    }],
    ['#sb [data-action="toggle-all"]', function () {
      return ui('sb-toggle-all', document.querySelector('#sb .sb-group.is-open') ? 'collapse' : 'expand');
    }],
    ['#sb [data-action="toggle-recent"]', function (el) {
      return ui('sb-recent-toggle', el.closest('.sb-recent').classList.contains('is-collapsed') ? 'open' : 'closed');
    }],
    ['#sb [data-action="remove-recent"]', function (el) {
      return ui('sb-recent-remove', (el.dataset.key || '').replace('/', '_'));
    }],
    ['#sb [data-action="premium"]', function (el) {
      return ui('sb-premium', el.classList.contains('is-premium') ? 'premium' : 'free');
    }],
    ['#sb [data-action="theme"]', function () {
      return ui('sb-theme', document.documentElement.classList.contains('dark') ? 'light' : 'dark');
    }],

    ['.topbar-logo', function () { return ui('topbar-logo'); }],
    ['#server-status', function () { return ui('status-click'); }],
    
    ['.site-footer-link', function (el) { footerKey = el.dataset.modal || ''; return ui('footer-open', footerKey); }],
    ['.footer-modal-close', function () { return ui('footer-close', footerKey, 'x'); }],
    ['.footer-modal', function (el, e) { return e.target === el ? ui('footer-close', footerKey, 'backdrop') : null; }],
    
    ['#go-register', function () { return ui('auth-switch', 'login', 'register'); }],
    ['#go-login-from-recover', function () { return ui('auth-switch', 'recover', 'login'); }],
    ['#go-login', function () { return ui('auth-switch', 'register', 'login'); }],
    ['#go-recover', function () { return ui('auth-switch', 'login', 'recover'); }],
    ['#login-btn', function () { return ui('auth-submit', 'login'); }],
    ['#register-btn', function () { return ui('auth-submit', 'register'); }],
    ['#recover-btn', function () { return ui('auth-submit', 'recover'); }],
    ['#profile-upgrade-btn', function () { return ui('profile-upgrade'); }],
    ['#profile-recovery-btn', function () { return ui('recovery-generate'); }],
    ['#copy-recovery-code', function () { return ui('recovery-copy'); }],
    ['#recovery-code-reveal', function () { return ui('recovery-reveal'); }],
    ['#recovery-code-continue', function (el) { return el.classList.contains('is-disabled') ? null : ui('recovery-continue'); }],
    ['#premium-info-continue', function () { return ui('premium-continue'); }],
    ['#premium-info-cancel', function () { return ui('premium-cancel'); }],
    
    ['#view-all-btn', function () { return ui('fav-view-all'); }],
    ['#fav-modal-close', function () { return ui('fav-modal-close'); }],
    ['.fav-ctx-item', function (el) { return ui('fav-menu', el.dataset.action); }],
    ['#fav-strip .fav-thumb', function () { return ui('fav-thumb', 'strip'); }],
    ['#fav-grid .grid-thumb', function () { return ui('fav-thumb', 'grid'); }],
    
    ['#hdrPfp', function (el) {
      var im = el.querySelector('.pfp-img.on');
      return ui('pfp-click', im && im.src ? safeDec(im.src.split('/').pop()) : 'not-ready');
    }],
    ['#lbPrev', function () { return ui('lb-nav', 'prev', 'click'); }],
    ['#lbNext', function () { return ui('lb-nav', 'next', 'click'); }],
    ['#lbClose', function () { return ui('lb-close', 'x'); }],
    ['#lightbox', function (el, e) { return e.target === el ? ui('lb-close', 'backdrop') : null; }],
    ['.multi-badge', function () { return ui('multi-badge-click'); }],
    ['#gallery .item .thumb', function (el) {
      var f = el.closest('.item').querySelector('.filename');
      return ui('lb-open', 'grid', f ? f.textContent : '');
    }],
    
    ['#aboutToggle', function () {
      return ui('about-toggle', document.getElementById('aboutMore').classList.contains('expanded') ? 'collapsed' : 'expanded');
    }],
    ['#feedback-btn', function () {
      var i = document.getElementById('feedback-input');
      return ui('feedback-click', i && i.value.trim() ? 'with-text' : 'empty');   
    }],
    
    ['.show-more-btn', function (el) {
      var more = el.previousElementSibling;
      return ui('pairings-toggle', more && more.style.display === 'none' ? 'expanded' : 'collapsed');
    }],
    ['#close-interactive-graph', function () { return ui('volume-tree-graph-close'); }],
    
    ['.auth-modal', function (el, e) { return e.target === el ? ui('modal-backdrop', el.id) : null; }]
  ];

  var interactions = 0;
  function onClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    interactions++;
    last = { src: srcOf(t), t: Date.now() };
    var a = t.closest('a[href]');
    if (a) linkClick(a, e);
    var cell = t.closest('.hero-cell');
    if (cell) { heroClick(cell); return; }
    for (var i = 0; i < RULES.length; i++) {
      var el = t.closest(RULES[i][0]);
      if (!el) continue;
      var p;
      try { p = RULES[i][1](el, e); } catch (x) { p = null; }
      if (p) send(p);
      break;
    }
  }
  document.addEventListener('click', onClick, true);
  document.addEventListener('auxclick', function (e) {      
    if (e.button !== 1 || !e.target || !e.target.closest) return;
    var a = e.target.closest('a[href]');
    if (a) linkClick(a, e);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && t.classList && t.classList.contains('sb-search__input') && e.key === 'Enter') {
      var q = t.value.trim();
      if (!q) return;
      var first = document.querySelector('#sb .sb-member:not([hidden]) a');
      var dest = first ? pageOf(first.href) : null;
      send(ui('sb-search', q, dest || 'none'));
      if (dest) { send('go/' + enc(dest) + '/sidebar-search'); setNav(dest, 'sidebar-search'); }
      return;
    }
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    var lb = document.getElementById('lightbox');
    if (lb && !lb.classList.contains('hidden')) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') send(ui(e.shiftKey ? 'lb-post-step' : 'lb-nav', e.key === 'ArrowRight' ? 'next' : 'prev', 'key'));
      else if (e.key === 'Escape') send(ui('lb-close', 'esc'));
      return;
    }
    if (e.key === '/') send(ui('hotkey', 'search'));
    else if ((e.key === '[' || e.key === ']') && document.querySelector('#sb.is-member')) {
      setNav(null, 'hotkey');
      send(ui('hotkey', e.key === '[' ? 'prev-member' : 'next-member'));
    }
  }, true);

  var missTimer;
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('sb-search__input')) return;
    clearTimeout(missTimer);
    missTimer = setTimeout(function () {
      var empty = document.querySelector('#sb .sb-empty');
      if (t.value.trim() && empty && !empty.hidden) send(ui('sb-search-miss', t.value));
    }, 900);
  }, true);

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'fav-filter-group') send(ui('fav-filter', 'group', t.value || 'all'));
    else if (t.id === 'fav-filter-member') send(ui('fav-filter', 'member', t.value || 'all'));
  }, true);

  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
  var WRAPS = {
    openLoginModal: function () { return ui('auth-open', ctx()); },
    openProfileModal: function () { return ui('profile-open', ctx()); },
    openPremiumInfoModal: function (ret) {
      return ui('premium-modal-open', ctx(), ret ? 'from-profile' : 'direct', localStorage.getItem('token') ? 'authed' : 'anon');
    },
    startPremiumCheckout: function () { return ui('premium-checkout-start'); },
    doLogout: function () { return ui('logout'); },
    showAuthError: function (modal, msg) { return ui('auth-error', modal, slug(msg)); },
    showAuthSuccess: function (modal) { return ui('auth-success', modal); },
    showRecoveryCodeReveal: function (code, context) { return ui('recovery-code-shown', context); }  
  };
  function wrap(name) {
    var f = window[name], make = WRAPS[name];
    window[name] = function () {
      try { var p = make.apply(null, arguments); if (p) send(p); } catch (e) {}
      return f.apply(this, arguments);
    };
    window[name].__logged = true;
  }
  var tries = 0;
  var wrapTimer = setInterval(function () {
    var pending = 0;
    for (var n in WRAPS) {
      var f = window[n];
      if (typeof f !== 'function') pending++;
      else if (!f.__logged) wrap(n);
    }
    if (!pending || ++tries > 100) clearInterval(wrapTimer);
  }, 300);

  document.addEventListener('DOMContentLoaded', function () {
    try { if (sessionStorage.getItem('log_sess')) return; sessionStorage.setItem('log_sess', '1'); } catch (e) {}
    var returning = false;
    try { returning = !!localStorage.getItem('log_seen'); localStorage.setItem('log_seen', '1'); } catch (e) {}
    var w = window.innerWidth;
    var device = matchMedia('(pointer:coarse)').matches ? (w < 768 ? 'phone' : 'tablet') : 'desktop';
    var theme = 'dark', authed = 'anon';
    try { theme = localStorage.getItem('theme') || 'dark'; authed = localStorage.getItem('token') ? 'authed' : 'anon'; } catch (e) {}
    send(ev('session-start', device, (Math.round(w / 100) * 100) + 'w', (Math.round((window.devicePixelRatio || 1) * 10) / 10) + 'x',
      theme, (window.I18n && I18n.lang) || 'en', authed, returning ? 'returning' : 'new', ARRIVAL));
  });

  var visSince = document.hidden ? 0 : Date.now(), activeMs = 0, sent = false, maxScroll = 0;
  document.addEventListener('scroll', function (e) {
    var el = e.target === document ? document.scrollingElement : e.target;
    if (!el || !el.scrollHeight || el.clientHeight < window.innerHeight * 0.5 || el.scrollHeight < el.clientHeight * 1.5) return;
    var p = (el.scrollTop + el.clientHeight) / el.scrollHeight;
    if (p > maxScroll) maxScroll = p;
  }, true);
  function flush() {
    if (visSince) { activeMs += Date.now() - visSince; visSince = 0; }
    if (sent) return;
    sent = true;
    send(ev('page-leave', PAGE, Math.round(activeMs / 1000) + 's', Math.round(maxScroll * 100) + 'pct', interactions + 'clicks'));
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) flush(); else { visSince = Date.now(); sent = false; }
  });
  window.addEventListener('pagehide', flush);

  var errs = 0;
  window.addEventListener('error', function (e) {
    if (errs++ >= 5) return;
    var f = (e.filename || '').split('/').pop().split('?')[0];
    send(ev('js-error', PAGE, f + ':' + e.lineno, e.message));
  });

  window.Log = { send: send, ev: ev, ui: ui, page: PAGE, arrival: ARRIVAL, setNav: setNav };
  window.logEvent = send;       
})();
