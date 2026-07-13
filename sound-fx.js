window.SoundFX = (function () {
  const STORAGE_KEY = 'sfx-muted';
  const SOUND_BASE = 'https://terril.duckdns.org/ASSETS/SOUND/';
  const SOUNDS = {
    generic_click: {
      file: 'generic_click.ogg',
      volume: 0.01,
      volumeJitter: 0,
      rateRange: [0.98, 1.02],
    },
    generic_click_reverse: {
      file: 'generic_click_reverse.ogg',
      volume: 0.01,
      volumeJitter: 0,
      rateRange: [0.98, 1.02],
    },
    error: {
      file: 'error.ogg',
      volume: 0.02,
      volumeJitter: 0,
      rateRange: [0.98, 1.02],
    },
    heavy_click: {
      file: 'heavy_click.ogg',
      volume: 0.015,
      volumeJitter: 0,
      rateRange: [0.98, 1.02],
    },
    heavy_click_reverse: {
      file: 'heavy_click_reverse.ogg',
      volume: 0.01,
      volumeJitter: 0,
      rateRange: [0.98, 1.02],
    },
    reset: {
      file: 'reset.ogg',
      volume: 0.01,
      volumeJitter: 0,
      rateRange: [0.98, 1.02],
    },
    tick: {
      file: 'generic_click.ogg',
      volume: 0.01,
      volumeJitter: 0,
      rateRange: [0.9, 1.1],
    },
    deep_click: {
      file: 'deep_click.ogg',
      volume: 0.1,
      volumeJitter: 0,
      rateRange: [0.95, 1.05],
    },     
    report: {
      file: 'report.ogg',
      volume: 0.008,
      volumeJitter: 0,
      rateRange: [0.98, 1.02],
    },     
  };

  let ctx = null;
  let masterGain = null;
  let muted = localStorage.getItem(STORAGE_KEY) === '1';

  const buffers = new Map();
  const pending = new Map();

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);
    return ctx;
  }

  function armAutoResume() {
    const tryResume = () => {
      const c = ensureContext();
      if (c.state === 'suspended') c.resume().catch(() => {});
    };
    ['pointerdown', 'keydown'].forEach((evt) =>
      document.addEventListener(evt, tryResume, { once: true, passive: true })
    );
  }

  function loadBuffer(name) {
    if (buffers.has(name)) return Promise.resolve(buffers.get(name));
    if (pending.has(name)) return pending.get(name);

    const def = SOUNDS[name];
    if (!def) return Promise.resolve(null);

    const c = ensureContext();
    const p = fetch(SOUND_BASE + def.file)
      .then((res) => res.arrayBuffer())
      .then((data) => c.decodeAudioData(data))
      .then((buf) => {
        buffers.set(name, buf);
        pending.delete(name);
        return buf;
      })
      .catch((err) => {
        pending.delete(name);
        console.warn(`[SoundFX] couldn't load "${name}":`, err);
        return null;
      });

    pending.set(name, p);
    return p;
  }

  function preload(names) {
    (names || Object.keys(SOUNDS)).forEach(loadBuffer);
  }

  async function play(name, opts) {
    if (muted) return;
    const def = SOUNDS[name];
    if (!def) return;

    const c = ensureContext();
    if (c.state === 'suspended') {
      try {
        await c.resume();
      } catch {
        return;
      }
    }

    const buf = buffers.get(name) || (await loadBuffer(name));
    if (!buf) return;

    opts = opts || {};
    const [minRate, maxRate] = opts.rateRange || def.rateRange || [1, 1];
    const rate = minRate + Math.random() * (maxRate - minRate);

    const baseVol = opts.volume ?? def.volume ?? 1;
    const jitter = opts.volumeJitter ?? def.volumeJitter ?? 0;
    const vol = Math.min(1, Math.max(0, baseVol + (Math.random() * 2 - 1) * jitter));

    const source = c.createBufferSource();
    source.buffer = buf;
    source.playbackRate.value = rate;

    const gain = c.createGain();
    gain.gain.value = vol;

    source.connect(gain);
    gain.connect(masterGain);
    source.start(0);
  }

  function setMuted(next) {
    muted = !!next;
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    if (masterGain) masterGain.gain.value = muted ? 0 : 1;
    document.dispatchEvent(new CustomEvent('sfx-mute-change', { detail: { muted } }));
  }

  function isMuted() {
    return muted;
  }
  function bindClicks(selector, name, opts) {
    document.addEventListener('click', (e) => {
      const target = e.target.closest(selector);
      if (target) play(name, opts);
    });
  }
  const lastPlayedAt = new Map();
  function playThrottled(name, key, intervalMs, opts) {
    const now = performance.now();
    const last = lastPlayedAt.get(key) || 0;
    if (now - last < intervalMs) return;
    lastPlayedAt.set(key, now);
    play(name, opts);
  }

  armAutoResume();

  return { preload, play, playThrottled, setMuted, isMuted, bindClicks };
})();

document.addEventListener('DOMContentLoaded', () => {
  SoundFX.preload();
  SoundFX.bindClicks('#controls button', 'generic_click');
  SoundFX.bindClicks('.graph-view-buttons button', 'heavy_click');
  SoundFX.bindClicks('#close-interactive-graph', 'heavy_click_reverse');
  SoundFX.bindClicks('#graph-svg-link', 'generic_click');
  SoundFX.bindClicks('#toggle-darkmode', 'generic_click');
  SoundFX.bindClicks('#toggle-sidebar', 'deep_click');
  SoundFX.bindClicks('.folder-toggle', 'heavy_click');
  
});