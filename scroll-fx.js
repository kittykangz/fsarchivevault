(function (global) {
  'use strict';

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function initScrollFX(target, options) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return null;

    const opts = Object.assign({ ease: 0.15, wheelMultiplier: 1 }, options || {});

    let current = el.scrollTop;
    let targetScroll = el.scrollTop;
    let rafId = null;

    function maxScroll() {
      return el.scrollHeight - el.clientHeight;
    }

    function onWheel(e) {
      if (e.ctrlKey) return;
      e.preventDefault();
      targetScroll = clamp(targetScroll + e.deltaY * opts.wheelMultiplier, 0, maxScroll());
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function tick() {
      current += (targetScroll - current) * opts.ease;
      const done = Math.abs(targetScroll - current) < 0.5;
      if (done) current = targetScroll;
      el.scrollTop = current;
      if (done) {
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    function syncFromNative() {
      if (rafId) return;
      current = el.scrollTop;
      targetScroll = el.scrollTop;
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', syncFromNative, { passive: true });

    return {
      destroy() {
        el.removeEventListener('wheel', onWheel);
        el.removeEventListener('scroll', syncFromNative);
        if (rafId) cancelAnimationFrame(rafId);
      },
    };
  }

  global.ScrollFX = { init: initScrollFX };
})(window);