/*  ---- use ------------------------------------------------------------------------------------
     Typer.attach(input, options)  ->  { refresh(), setEnabled(bool), destroy(), running }

   input   an element or a selector.

   Typical setups:

     // names typed only while the box is focused and empty, session-shuffled, Hangul in Korean mode
     Typer.attach(box, { source: ['IU', 'RED VELVET'], queueKey: 'my-queue', when: 'focus',
                         localize: function (t) { return I18n.ko(t); } });

     // a phrase built fresh each round (may be async), typed all the time while the box is empty
     Typer.attach(box, { source: function () { return 'pink outfit, heart pose'; }, when: 'always' });

     // real values as examples (dates), only while focused
     Typer.attach(box, { source: function () { return pickRandomDate(); }, when: 'focus' });

   ---- options (defaults in Typer.defaults; change them there to change every instance) -----------
   source       array of strings, or a function returning a string / null / a Promise of either.
                A function is called at the start of every round; null = nothing to type right now.
   order        for an array: 'queue' (default) = shuffled queue, every item once before any repeats;
                'random' = random pick, never the same one twice in a row.
   queueKey     sessionStorage key. With it the shuffled queue survives page loads for the browser
                session (it carries on where it left off). Without it the queue lives in memory.
   when         'focus' = only while the input is focused and empty.
                'always' = whenever the input is empty and on screen.
   ghost        an element to paint into instead of the placeholder attribute (the "ghost" mode: you
                provide the overlay markup and CSS; use it when the placeholder must stay translatable
                or styled by something else). Without it the placeholder attribute is animated and the
                original placeholder comes back when the animation stops.
   host         element that gets the class typer-active while typing (default: the input; the input
                always gets it too). Handy for showing a ghost: .box.typer-active .ghost { display:flex }
   localize     function (text, lang) -> text to type for that language, or '' for "type it as is".
                Called only when I18n.lang is not 'en'. Any text that contains Hangul, whether a localized
                result or text that was Hangul to begin with (no localize needed), is typed jamo by jamo.
   exit         'erase' (default) = backspace / select-all delete. 'fade' = hold, then fade the
                placeholder out (placeholder mode only).
   speed        typing speed factor: 1 = normal, 0.6 = faster, 1.5 = slower.
   typoChance   chance a text gets a slip (0 = never); 1 in 5 of those get a second one.
   maxWrong     most wrong keys in one slip.  maxNotice  most correct keys typed before it is noticed.
   eraseSlow    backspace slowness: 1 = quick, higher = slower.  eraseMaxMs  longest a backspace run may
                take (long texts are sped up to fit).
   selectAll    chance an erase is select-all + delete (rises for long texts).
   noticeBase   [min, max] ms to spot a slip.   scanPerKey  [min, max] ms added per key typed after it.
   startDelay   [min, max] ms before the first key.  hold  [min, max] ms a finished text stays.
   gap          [min, max] ms between one text and the next.
   fadeMs       fade length for exit: 'fade'.   poll  ms between visibility / value checks.
   flashTypos   wrong keys flash red and shake while they are on screen (default true). Per character in
                ghost mode; a placeholder can't style single characters, so there the whole placeholder
                turns red while a wrong key is showing.

   ---- look -----------------------------------------------------------------------------------
   The select-all highlight uses CSS variables (set them on any ancestor):
     --typer-hl-bg   highlight background   (default var(--gold))
     --typer-hl-fg   highlighted text       (default var(--bg-deep))
     --typer-ko-font Hangul font stack      (default: the same stack as KO_FONT in i18n.js)
     --typer-error   colour of a wrong key  (default var(--error))
   Classes the engine toggles: typer-active (host + input), typer-selected / typer-selecting
   (select-all), typer-hangul (Hangul showing), typer-fade, typer-ghost-mode, typer-typo (a wrong
   character, ghost mode), typer-typo-now (a wrong key is showing, placeholder mode).

   In placeholder mode the input gets data-i18n-skip, so i18n.js leaves its placeholder alone.
   ============================================================================================== */
(function () {
  'use strict';
  if (window.Typer) return;

  var DEFAULTS = {
    source: null,
    order: 'queue',
    queueKey: null,
    when: 'focus',
    ghost: null,
    host: null,
    localize: null,
    exit: 'erase',
    speed: 1,
    typoChance: 0.4,
    maxWrong: 2,
    maxNotice: 3,
    eraseSlow: 1.6,
    eraseMaxMs: 2500,
    selectAll: 0.25,
    noticeBase: [150, 600],
    scanPerKey: [50, 200],
    startDelay: [320, 520],
    hold: [900, 1800],
    gap: [300, 700],
    fadeMs: 350,
    flashTypos: true,
    poll: 500
  };

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function between(r) { return rnd(r[0], r[1]); }
  function sread(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function swrite(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function upTo(max, p) {
    var n = 1;
    while (n < max && Math.random() < p) n++;
    return n;
  }

  var KO_STACK = '"Noto Sans KR","Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';   /* keep in sync with KO_FONT in i18n.js */
  var CSS =
    '.typer-selecting{caret-color:transparent}' +
    '.typer-selected:not(input){background:var(--typer-hl-bg,var(--gold,#d4af37));color:var(--typer-hl-fg,var(--bg-deep,#111))}' +
    'input.typer-selected::placeholder{background:linear-gradient(var(--typer-hl-bg,var(--gold,#d4af37)),var(--typer-hl-bg,var(--gold,#d4af37))) no-repeat 0 0/var(--typer-hl-w,100%) 100%;color:var(--typer-hl-fg,var(--bg-deep,#111))}' +
    'input.typer-ghost-mode.typer-active::placeholder{color:transparent!important}' +
    'input.typer-fade::placeholder{opacity:0;transition:opacity var(--typer-fade-ms,.35s) ease}' +
    '.typer-hangul:not(input){font-family:var(--typer-ko-font,' + KO_STACK + ');font-size:1.1em}' +
    'input.typer-hangul::placeholder{font-family:var(--typer-ko-font,' + KO_STACK + ')}' +
    '.typer-typo{display:inline-block;color:var(--typer-error,var(--error,#e5484d));animation:typer-shake .36s ease-in-out,typer-flash .7s ease-out}' +
    '@keyframes typer-shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-2px)}30%{transform:translateX(2px)}45%{transform:translateX(-1.5px)}60%{transform:translateX(1.5px)}75%{transform:translateX(-1px)}90%{transform:translateX(1px)}}' +
    '@keyframes typer-flash{0%{text-shadow:0 0 8px var(--typer-error,var(--error,#e5484d))}30%{opacity:.3}60%{opacity:1}100%{text-shadow:none}}' +
    'input.typer-typo-now::placeholder{color:var(--typer-error,var(--error,#e5484d))}';
  var cssDone = false;

  function injectCSS() {
    if (cssDone) return;
    cssDone = true;
    var st = document.createElement('style');
    st.setAttribute('data-typer', '');
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  var measureCtx = null;
  function textWidth(el, text) {
    try {
      measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
      var cs = getComputedStyle(el);
      measureCtx.font = [cs.fontStyle, cs.fontWeight, cs.fontSize, cs.fontFamily].join(' ');
      var w = measureCtx.measureText(text).width;
      var ls = parseFloat(cs.letterSpacing);
      return ls ? w + ls * text.length : w;
    } catch (e) { return 0; }
  }

  var NEAR = {
    q: 'wa', w: 'qes', e: 'wrd', r: 'etf', t: 'ryg', y: 'tuh', u: 'yij', i: 'uok', o: 'ipl', p: 'ol[',
    a: 'qsz', s: 'awdx', d: 'sefc', f: 'drgv', g: 'fthb', h: 'gyjn', j: 'hukm', k: 'jil', l: 'kop;',
    z: 'asx', x: 'zsc', c: 'xdv', v: 'cfb', b: 'vgn', n: 'bhm', m: 'nj,'
  };
  var KEY2JAMO = {
    q: 'ㅂ', w: 'ㅈ', e: 'ㄷ', r: 'ㄱ', t: 'ㅅ', y: 'ㅛ', u: 'ㅕ', i: 'ㅑ', o: 'ㅐ', p: 'ㅔ',
    a: 'ㅁ', s: 'ㄴ', d: 'ㅇ', f: 'ㄹ', g: 'ㅎ', h: 'ㅗ', j: 'ㅓ', k: 'ㅏ', l: 'ㅣ',
    z: 'ㅋ', x: 'ㅌ', c: 'ㅊ', v: 'ㅍ', b: 'ㅠ', n: 'ㅜ', m: 'ㅡ'
  };
  var JAMO2KEY = { 'ㅃ': 'q', 'ㅉ': 'w', 'ㄸ': 'e', 'ㄲ': 'r', 'ㅆ': 't', 'ㅒ': 'o', 'ㅖ': 'p' };   
  Object.keys(KEY2JAMO).forEach(function (k) { JAMO2KEY[KEY2JAMO[k]] = k; });

  function near(tok, hangul) {
    if (hangul) {
      var kb = JAMO2KEY[tok], jp = kb && NEAR[kb];
      if (!jp) return null;
      var jc = jp.split('').filter(function (c) { return KEY2JAMO[c]; });
      return jc.length ? KEY2JAMO[jc[Math.floor(Math.random() * jc.length)]] : null;
    }
    if (/^[0-9]$/.test(tok)) {                              
      var d = +tok, opts = [];
      if (d > 0) opts.push(d - 1);
      if (d < 9) opts.push(d + 1);
      return String(opts[Math.floor(Math.random() * opts.length)]);
    }
    var pool = NEAR[tok.toLowerCase()];
    if (!pool) return null;
    var pick = pool.charAt(Math.floor(Math.random() * pool.length));
    return tok !== tok.toLowerCase() ? pick.toUpperCase() : pick; 
  }
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  var JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  var JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ',
    'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  var V2 = { 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ' };
  var T2 = { 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ',
    'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ' };
  var V1 = {}, T1 = {};
  Object.keys(V2).forEach(function (k) { V1[V2[k]] = k; });
  Object.keys(T2).forEach(function (k) { T1[T2[k]] = k; });
  function isCons(c) { return c.length === 1 && CHO.indexOf(c) !== -1; }
  function isVowel(c) { return c.length === 1 && JUNG.indexOf(c) !== -1; }
  var HANGUL_RE = /[\u3131-\u318E\uAC00-\uD7A3]/;

  /* "현주" -> ㅎ ㅕ ㄴ ㅈ ㅜ */
  function hangulKeys(str) {
    var out = [];
    if (str.normalize) str = str.normalize('NFC');
    var chars = Array.from(str);
    for (var i = 0; i < chars.length; i++) {
      var c = chars[i].length === 1 ? chars[i].charCodeAt(0) - 0xAC00 : -1;
      if (c >= 0 && c < 11172) {
        out.push(CHO.charAt((c / 588) | 0));
        var v = JUNG.charAt(((c % 588) / 28) | 0);
        (V2[v] || v).split('').forEach(function (k) { out.push(k); });
        var t = JONG[c % 28];
        if (t) (T2[t] || t).split('').forEach(function (k) { out.push(k); });
      } else {
        out.push(chars[i]);
      }
    }
    return out;
  }

  /* the text an IME shows after these key presses: a final consonant stays on its syllable until
     a vowel arrives, then moves to start the next one (ㅎㅏㄴ -> 한, ㅎㅏㄴㅏ -> 하나) */
  function compose(keys) {
    var out = '', L = '', V = '', T = '';
    function flush() {
      if (L && V) out += String.fromCharCode(0xAC00 + (CHO.indexOf(L) * 21 + JUNG.indexOf(V)) * 28 + JONG.indexOf(T));
      else out += L + V + T;
      L = V = T = '';
    }
    keys.forEach(function (k) {
      if (isCons(k)) {
        if (!L) L = k;
        else if (!V) { flush(); L = k; }
        else if (!T) { if (JONG.indexOf(k) > 0) T = k; else { flush(); L = k; } }
        else if (T1[T + k]) T = T1[T + k];
        else { flush(); L = k; }
      } else if (isVowel(k)) {
        if (!L) out += k;
        else if (!V) V = k;
        else if (!T) { if (V1[V + k]) V = V1[V + k]; else { flush(); out += k; } }
        else {
          var two = T2[T];
          var moved = two ? two.charAt(1) : T;
          T = two ? two.charAt(0) : '';
          flush();
          L = moved; V = k;
        }
      } else {
        flush(); out += k;
      }
    });
    flush();
    return out;
  }

  function keyGap(c, cfg) {
    var d = rnd(65, 135);
    if (Math.random() < 0.18) d = rnd(38, 60);
    if (Math.random() < 0.07) d += rnd(140, 280);
    if (c === ' ') d += rnd(40, 110);
    return d * cfg.speed;
  }

  function eraseGaps(n, cfg) {
    var gaps = [], style = Math.random(), sum = 0;
    for (var k = 0; k < n; k++) {
      var g;
      if (style < 0.4) {
        g = rnd(20, 40) * (k < 3 ? 2.4 - k * 0.5 : 1);
      } else if (style < 0.75) {
        g = rnd(50, 140);
        if (Math.random() < 0.1) g += rnd(120, 260);
      } else {
        g = (k % 3 === 2 || Math.random() < 0.15) ? rnd(160, 380) : rnd(22, 45);
      }
      g *= cfg.eraseSlow;
      gaps.push(g);
      sum += g;
    }
    if (cfg.eraseMaxMs && sum > cfg.eraseMaxMs) {        
      var f = cfg.eraseMaxMs / sum;
      gaps = gaps.map(function (x) { return x * f; });
    }
    return gaps;
  }

  function slip(ops, toks, i, hangul, cfg) {
    var n = toks.length, wrong = [], skip = 0, j, w;
    var kind = Math.random();
    kind = (i === n) ? 'ins' : kind < 0.45 ? 'sub' : kind < 0.85 ? 'ins' : (i + 1 < n ? 'swap' : 'sub');

    if (kind === 'sub') {                                
      var run = Math.min(upTo(cfg.maxWrong, 0.45), n - i);
      for (j = 0; j < run; j++) {
        w = near(toks[i + j], hangul);
        if (!w) break;
        wrong.push(w);
      }
      skip = wrong.length;
    } else if (kind === 'ins') {                          
      var extraKeys = Math.min(upTo(cfg.maxWrong, 0.45), n - i + 1);
      for (j = 0; j < extraKeys; j++) {
        var base = toks[Math.min(i + (Math.random() < 0.5 ? 0 : -1), n - 1)] || toks[Math.min(i, n - 1)];
        w = Math.random() < 0.2 ? base : near(base, hangul);  
        if (!w) break;
        wrong.push(w);
      }
    } else if (toks[i] !== toks[i + 1]) {                  
      wrong = [toks[i + 1], toks[i]];
      skip = 2;
    }
    if (!wrong.length) return -1;

    var avail = n - (i + skip), extra = 0;                 
    var room = Math.min(cfg.maxNotice, avail, n + 1 - i - wrong.length);
    while (extra < room && Math.random() < 0.5) extra++;

    wrong.forEach(function (c) { ops.push({ k: 'add', c: c, bad: true }); });
    for (j = 0; j < extra; j++) ops.push({ k: 'add', c: toks[i + skip + j] });
    var spot = between(cfg.noticeBase);                     
    for (j = 0; j < wrong.length + extra - 1; j++) spot += between(cfg.scanPerKey);
    ops.push({ k: 'pause', ms: spot });
    eraseGaps(wrong.length + extra, cfg).forEach(function (g) { ops.push({ k: 'del', ms: g }); });
    ops.push({ k: 'pause', ms: rnd(80, 200) });
    for (j = 0; j < skip + extra; j++) ops.push({ k: 'add', c: toks[i + j] });
    return i + skip + extra;
  }

  function keystrokes(toks, hangul, cfg) {
    var ops = [], n = toks.length, plan = {};
    if (n && Math.random() < cfg.typoChance) {
      var slips = Math.random() < 0.2 ? 2 : 1;
      for (var s = 0; s < slips; s++) {
        var at = Math.floor(Math.random() * (n + 1));
        if (at === n && Math.random() < 0.6) at = Math.floor(Math.random() * n);
        plan[at] = 1;
      }
    }
    var i = 0;
    while (i <= n) {
      if (plan[i]) {
        delete plan[i];
        var next = slip(ops, toks, i, hangul, cfg);
        if (next !== -1) { i = next; continue; }
      }
      if (i < n) ops.push({ k: 'add', c: toks[i] });
      i++;
    }
    return ops;
  }

  function attach(input, opts) {
    if (typeof input === 'string') input = document.querySelector(input);
    if (!input) return null;
    if (input._typer) input._typer.destroy();

    var cfg = {};
    var k;
    for (k in DEFAULTS) cfg[k] = DEFAULTS[k];
    for (k in (opts || {})) if (opts[k] !== undefined) cfg[k] = opts[k];

    var src = cfg.source;
    if (!src) return null;
    injectCSS();

    var ghost = cfg.ghost || null;
    var host = cfg.host || input;
    var addedSkip = false;
    if (ghost) {
      input.classList.add('typer-ghost-mode');
    } else if (!input.hasAttribute('data-i18n-skip')) {
      input.setAttribute('data-i18n-skip', '');             /* i18n.js must not touch the placeholder we animate */
      addedSkip = true;
    }
    input.style.setProperty('--typer-fade-ms', cfg.fadeMs + 'ms');

    var names = [], queue = [], pos = 0, lastPicked = null;
    if (typeof src !== 'function') {
      var seen = {};
      src.forEach(function (s) {
        s = String(s == null ? '' : s).trim();
        if (s && !seen[s]) { seen[s] = 1; names.push(s); }
      });
      if (!names.length) return null;
    }

    function saveQueue() { if (cfg.queueKey) swrite(cfg.queueKey, JSON.stringify({ q: queue, i: pos })); }

    function reshuffle(last) {
      queue = shuffle(names.slice());
      if (last && queue.length > 1 && queue[0] === last) { 
        var j = 1 + Math.floor(Math.random() * (queue.length - 1));
        var t = queue[0]; queue[0] = queue[j]; queue[j] = t;
      }
      pos = 0;
    }

    function loadQueue() {
      if (cfg.queueKey) {
        try {
          var s = JSON.parse(sread(cfg.queueKey) || 'null');
          var ok = s && Array.isArray(s.q) && s.q.length === names.length &&
                   typeof s.i === 'number' && s.i >= 0 && s.i < s.q.length &&
                   names.every(function (n) { return s.q.indexOf(n) !== -1; });
          if (ok) { queue = s.q; pos = s.i | 0; return; }
        } catch (e) {}
      }
      reshuffle();
    }
    if (names.length) loadQueue();

    function pickText() {
      if (typeof src === 'function') return src();
      if (cfg.order === 'random') {
        var t;
        do { t = names[Math.floor(Math.random() * names.length)]; } while (names.length > 1 && t === lastPicked);
        lastPicked = t;
        return t;
      }
      if (pos >= queue.length) reshuffle(queue[queue.length - 1]);
      var n = queue[pos++];
      saveQueue();
      return n;
    }

    var timer = 0, running = false, enabled = true, epoch = 0;
    var keys = [], bad = [], spans = [], hangul = false, current = null, restoreTo = null;

    function setActive(on) {
      host.classList.toggle('typer-active', on);
      if (host !== input) input.classList.toggle('typer-active', on);
    }

    function badChars() {
      var set = {}, any = false;
      if (!cfg.flashTypos) return { set: set, any: false };
      for (var i = 0; i < bad.length; i++) {
        if (!bad[i]) continue;
        any = true;
        set[hangul ? Array.from(compose(keys.slice(0, i + 1))).length - 1 : i] = true;  
      }
      return { set: set, any: any };
    }

    function paint() {
      var text = hangul ? compose(keys) : keys.join('');
      var flag = badChars();
      if (ghost) {
        var chars = Array.from(text), i;
        while (spans.length > chars.length) ghost.removeChild(spans.pop());
        while (spans.length < chars.length) {
          var sp = document.createElement('span');
          ghost.appendChild(sp);
          spans.push(sp);
        }
        for (i = 0; i < chars.length; i++) {
          if (spans[i].textContent !== chars[i]) spans[i].textContent = chars[i];
          var isBad = !!flag.set[i];
          if (isBad !== !!spans[i]._bad) { spans[i]._bad = isBad; spans[i].classList.toggle('typer-typo', isBad); }
        }
        ghost.classList.toggle('typer-hangul', hangul);
      } else {
        input.setAttribute('placeholder', text);
        input.classList.toggle('typer-hangul', hangul && !!text);
        input.classList.toggle('typer-typo-now', flag.any);
      }
    }

    function clear() {
      keys = [];
      bad = [];
      paint();
      input.classList.remove('typer-fade', 'typer-selecting', 'typer-selected', 'typer-typo-now');
      input.style.removeProperty('--typer-hl-w');
      if (ghost) ghost.classList.remove('typer-selected');
    }

    function wait(fn, ms) { timer = setTimeout(fn, ms); }

    function erase() {
      if (!running) return;

      if (cfg.exit === 'fade' && !ghost) {
        input.classList.add('typer-fade');
        wait(function () {
          if (!running) return;
          clear();
          wait(nextRound, between(cfg.gap));
        }, cfg.fadeMs);
        return;
      }

      var chance = cfg.selectAll + Math.min(0.4, Math.max(0, keys.length - 12) * 0.02); 
      if (keys.length > 2 && Math.random() < chance) {
        wait(function () {
          if (!running) return;
          if (!ghost) {
            var w = textWidth(input, input.getAttribute('placeholder') || '');
            if (w) input.style.setProperty('--typer-hl-w', Math.ceil(w) + 'px');
          }
          (ghost || input).classList.add('typer-selected');
          input.classList.add('typer-selecting');
          wait(function () {
            if (!running) return;
            clear(); 
            wait(nextRound, between(cfg.gap));
          }, rnd(320, 620));
        }, rnd(150, 350));
        return;
      }

      var gaps = eraseGaps(keys.length, cfg), j = 0;
      (function tick() {
        if (!running) return;
        if (!keys.length) { wait(nextRound, between(cfg.gap)); return; }
        keys.pop(); 
        bad.pop();
        paint();
        wait(tick, gaps[j++]);
      })();
    }

    function play(text) {
      current = text;
      var lang = window.I18n && window.I18n.lang;
      var local = '';
      if (cfg.localize && lang && lang !== 'en') {
        try { local = cfg.localize(text, lang) || ''; } catch (e) { local = ''; }
      }
      var typed = local || text;
      hangul = HANGUL_RE.test(typed);      /* a localized name, or text that is already Hangul */
      keys = [];
      bad = [];
      paint();
      var toks = hangul ? hangulKeys(typed) : Array.from(typed);
      var ops = keystrokes(toks, hangul, cfg), n = 0;
      (function step() {
        if (!running) return;
        if (n >= ops.length) { wait(erase, between(cfg.hold)); return; }
        var op = ops[n++];
        if (op.k === 'add') { keys.push(op.c); bad.push(!!op.bad); paint(); wait(step, keyGap(op.c, cfg)); }
        else if (op.k === 'del') { keys.pop(); bad.pop(); paint(); wait(step, op.ms); }
        else { wait(step, op.ms); }
      })();
    }

    function nextRound() {
      if (!running) return;
      var e = epoch, got;
      try { got = pickText(); } catch (err) { got = null; }
      Promise.resolve(got).then(function (text) {
        if (!running || e !== epoch) return;
        if (text == null || text === '') { wait(nextRound, 1500); return; }
        play(String(text));
      }, function () {
        if (running && e === epoch) wait(nextRound, 3000);
      });
    }

    function start() {
      if (running) return;
      running = true;
      epoch++;
      if (!ghost) restoreTo = input.getAttribute('placeholder');
      clear();
      setActive(true);
      wait(nextRound, between(cfg.startDelay));
    }

    function stop() {
      if (!running) return;
      running = false;
      epoch++;
      clearTimeout(timer);
      hangul = false;
      clear();
      setActive(false);
      if (!ghost) {
        if (restoreTo == null) input.removeAttribute('placeholder');
        else input.setAttribute('placeholder', restoreTo);
        input.classList.remove('typer-hangul');
      } else {
        ghost.classList.remove('typer-hangul');
      }
    }

    function canRun() {
      if (!enabled || input.value || document.hidden || input.disabled || input.readOnly) return false;
      if (!input.getClientRects().length) return false;    
      return cfg.when === 'always' || document.activeElement === input;
    }

    function sync() {
      var ok = canRun();
      if (ok && !running) start();
      else if (!ok && running) stop();
    }

    function onFocus() { sync(); }
    function onBlur() { if (cfg.when === 'focus') stop(); }
    function onInput() { sync(); }
    function onKey(ev) { if (ev.key === 'Escape') setTimeout(sync, 0); } 
    function onLang() {
      if (!running || !cfg.localize) return;        
      clearTimeout(timer);
      epoch++;
      clear();
      wait(function () {
        if (!running) return;
        if (current != null) play(current); else nextRound();
      }, between([300, 500]));
    }

    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKey);
    document.addEventListener('lang-change', onLang);
    var poller = setInterval(sync, cfg.poll);            
    sync();

    var api = {
      get running() { return running; },
      refresh: sync,
      setEnabled: function (on) { enabled = !!on; sync(); },
      destroy: function () {
        clearInterval(poller);
        input.removeEventListener('focus', onFocus);
        input.removeEventListener('blur', onBlur);
        input.removeEventListener('input', onInput);
        input.removeEventListener('keydown', onKey);
        document.removeEventListener('lang-change', onLang);
        stop();
        input.classList.remove('typer-ghost-mode');
        if (addedSkip) input.removeAttribute('data-i18n-skip');
        delete input._typer;
      }
    };
    input._typer = api;
    return api;
  }

  window.Typer = { attach: attach, defaults: DEFAULTS };
})();