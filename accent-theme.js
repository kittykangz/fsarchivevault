/* accent-theme.js
 * API:  AccentTheme.get()            -> {h, s, l} currently in effect
 *       AccentTheme.set({h,s,l}, persist = true)
 *       AccentTheme.random()
 *       AccentTheme.reset()
 *       AccentTheme.isDefault()
 */
(function () {
  'use strict';

  var KEY = 'accent-theme';
  var STOCK = { h: 48, s: 42, l: 0 };
  var GOLD_L = 63;   
  var DEEP_L = 33;   

  var state = null;  
  var styleEl = null;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }

  function sanitize(o) {
    return {
      h: ((Math.round(num(o && o.h, STOCK.h)) % 360) + 360) % 360,
      s: clamp(Math.round(num(o && o.s, STOCK.s)), 0, 100),
      l: clamp(Math.round(num(o && o.l, 0)), -15, 15)
    };
  }

  function hsl2rgb(h, s, l) {
    s /= 100; l /= 100;
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
  function hex(rgb) {
    return '#' + rgb.map(function (c) { return ('0' + c.toString(16)).slice(-2); }).join('');
  }

  function buildCss(t) {
    var goldRgb = hsl2rgb(t.h, t.s, clamp(GOLD_L + t.l, 40, 80));
    var deepRgb = hsl2rgb(t.h, clamp(t.s * 1.07, 0, 100), clamp(DEEP_L + t.l * 0.6, 22, 45));
    var ntLight = hex(hsl2rgb(t.h, t.s * 0.83, 91));
    var ntDark  = hex(hsl2rgb(t.h, t.s * 0.35, 12));
    var gold = hex(goldRgb);

    return (
      ':root:root{' +
        '--gold:' + gold + ';' +
        '--gold-rgb:' + goldRgb.join(',') + ';' +
        '--gold-deep:' + hex(deepRgb) + ';' +
        '--gold-deep-rgb:' + deepRgb.join(',') + ';' +
        '--gold-bg-nt:' + ntLight + ';' +
      '}' +
      'html.dark:root{' +
        '--gold-deep:' + gold + ';' +
        '--gold-deep-rgb:' + goldRgb.join(',') + ';' +
        '--gold-bg-nt:' + ntDark + ';' +
      '}'
    );
  }

  function apply() {
    if (!state) {
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      styleEl = null;
      return;
    }
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'accent-theme-style';
      (document.head || document.documentElement).appendChild(styleEl);
    }
    styleEl.textContent = buildCss(state);
  }

  function save() {
    try {
      if (state) localStorage.setItem(KEY, JSON.stringify(state));
      else localStorage.removeItem(KEY);
    } catch (e) {}
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? sanitize(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }

  function notify() {
    try { document.dispatchEvent(new CustomEvent('accent-change', { detail: api.get() })); } catch (e) {}
  }

  var api = window.AccentTheme = {
    STOCK: STOCK,
    get: function () { return state ? { h: state.h, s: state.s, l: state.l } : { h: STOCK.h, s: STOCK.s, l: STOCK.l }; },
    isDefault: function () { return state === null; },
    set: function (partial, persist) {
      state = sanitize(Object.assign(api.get(), partial));
      apply();
      if (persist !== false) save();
      notify();
    },
    random: function () {
      api.set({ h: Math.floor(Math.random() * 360), s: 38 + Math.floor(Math.random() * 25), l: 0 });
    },
    reset: function () {
      state = null;
      apply();
      save();
      notify();
    }
  };

  state = load();
  apply();

  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    state = load();
    apply();
    notify();
  });
})();
