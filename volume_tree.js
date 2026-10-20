function executeScripts(container) {
  container.querySelectorAll('script').forEach(function (oldScript) {
    var s = document.createElement('script');
    if (oldScript.src) s.src = oldScript.src; else s.textContent = oldScript.textContent;
    document.body.appendChild(s);
    oldScript.remove();
  });
}

function loadPartial(id, url, after) {
  return fetch(url, { cache: 'no-cache' }).then(function (res) {
    return res.text().then(function (html) {
      var c = document.getElementById(id);
      c.innerHTML = html;
      if (after) after(c, res.url);
      executeScripts(c);
    });
  });
}

function rewriteSidebarLinks(container, sidebarUrl) {
  var siteRoot = new URL('.', sidebarUrl);
  container.querySelectorAll('a[href^="/"]').forEach(function (a) {
    var path = a.getAttribute('href').slice(1);
    a.setAttribute('href', new URL(path, siteRoot).pathname);
  });
}

try {
  var _theme = localStorage.getItem('theme');
  if (!_theme) { _theme = 'dark'; localStorage.setItem('theme', _theme); }
  document.documentElement.classList.toggle('dark', _theme === 'dark');
} catch (e) {}

function toggleDarkMode() {
  var isDark = document.documentElement.classList.toggle('dark');
  try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (e) {}
  new Image().src = 'https://terril.duckdns.org/event/darkmode-toggle/' + (isDark ? 'dark' : 'light');
}

function vtLog(path) {
  if (typeof logEvent === 'function') logEvent(path);
  else new Image().src = 'https://terril.duckdns.org/event/' + path;
}

document.documentElement.classList.add('loading');
document.body.classList.add('loading');

window.addEventListener('DOMContentLoaded', async function () {
  await loadPartial('topbar-container', 'topbar.html');
  await loadPartial('sidebar-container', 'sidebar.html', rewriteSidebarLinks);
  await loadPartial('auth-container', 'auth.html');
  await loadPartial('footer-container', 'footer.html');
  if (typeof checkLogin === 'function') checkLogin();
  if (typeof loadFavorites === 'function') loadFavorites();

  await Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 4000); })]);

  setTimeout(function () {
    var loader = document.getElementById('page-loader');
    loader.classList.add('dismissing');
    var cleanup = function () {
      loader.remove();
      setTimeout(function () {
        document.body.classList.remove('loading');
        document.documentElement.classList.remove('loading');
      }, 100);
    };
    loader.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 5000);
  }, 450);
});

function fetchJSON(url) {
  return fetch(url, { cache: 'no-cache' }).then(function (r) {
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  });
}

(function stats() {
  var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };

  fetchJSON('unique_images.json').then(function (d) { set('unique-images', d.unique_images.toLocaleString()); })
    .catch(function (e) { console.error(e); });
  fetchJSON('unassigned_count.json').then(function (d) { set('unassigned-images', d.unassigned_count.toLocaleString()); })
    .catch(function (e) { console.error(e); });

  fetchJSON('member_counts_last.json').then(function (counts) {
    var groups = {}, total = 0, members = 0;
    Object.keys(counts).forEach(function (k) {
      if (k.charAt(0) === '_') return;
      var g = k.split('/')[0];
      groups[g] = (groups[g] || 0) + counts[k];
      total += counts[k];
      members++;
    });
    var nGroups = Object.keys(groups).length;
    var gb = counts._archive_size ? parseFloat(String(counts._archive_size).replace(/\s*GB/i, '')) : 0;

    set('total-images', total.toLocaleString());
    set('total-groups', nGroups);
    set('total-members', members);
    set('avg-images-per-group', Math.round(total / nGroups).toLocaleString());
    set('avg-images-per-member', Math.round(total / members).toLocaleString());
    set('archive-size', counts._archive_size || 'N/A');
    set('images-per-gb', gb > 0 ? Math.round(total / gb).toLocaleString() : 'N/A');
    set('avg-size-per-image', gb > 0 ? ((gb * 1024) / total).toFixed(2) + ' MB' : 'N/A');
  }).catch(function (e) { console.error(e); });
})();

var VT = { data: null, view: '2021', tiles: {} };
try { VT.view = localStorage.getItem('graph-view') === 'full' ? 'full' : '2021'; } catch (e) {}

function vtColor(i) {
  var l = document.documentElement.classList.contains('dark') ? 68 : 45;
  return 'hsl(' + ((i * 137.508) % 360).toFixed(1) + ', 65%, ' + l + '%)';
}

function vtEsc(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}

function vtFmtShort(n) {
  if (n >= 10000) return Math.round(n / 1000) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function vtNiceMax(v) {
  if (v <= 0) return 10;
  var m = v * 1.08, p = Math.pow(10, Math.floor(Math.log10(m))), f = m / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function vtStartIndex() {
  var d = VT.data.dates;
  if (VT.view === 'full') {
    var first = 0;
    outer: for (var i = 0; i < d.length; i++) {
      for (var g = 0; g < VT.data.groups.length; g++) {
        if (VT.data.totals[VT.data.groups[g]][i] > 0) { first = i; break outer; }
      }
    }
    return Math.max(0, first - 3);
  }
  var s = d.findIndex(function (x) { return x.slice(0, 4) >= '2021'; });
  return s < 0 ? 0 : s;
}

function vtSeriesFor(group) {
  var D = VT.data;
  if (group === 'All') {
    return D.groups.map(function (g, i) { return { name: g, values: D.totals[g], color: vtColor(i) }; });
  }
  var mm = D.members[group] || {};
  return Object.keys(mm).map(function (m, i) { return { name: m, values: mm[m], color: vtColor(i) }; });
}

function vtTicks(dates, s) {
  var n = dates.length, years = [];
  for (var i = s; i < n; i++) {
    var y = dates[i].slice(0, 4);
    if (i === s || y !== dates[i - 1].slice(0, 4)) years.push({ y: y, i: i });
  }
  var step = years.length > 12 ? 3 : years.length > 6 ? 2 : 1;
  var span = Math.max(1, n - 1 - s);
  return years.filter(function (t, k) { return k % step === 0; }).map(function (t) {
    return '<span style="left:' + (((t.i - s) / span) * 100).toFixed(2) + '%">' + (t.i === s ? t.y : "'" + t.y.slice(2)) + '</span>';
  }).join('');
}

function vtRenderTile(tile) {
  var D = VT.data, s = vtStartIndex(), n = D.dates.length, span = Math.max(1, n - 1 - s);
  var series = vtSeriesFor(tile.group);
  tile.series = series;
  tile.s = s;

  var max = 0;
  series.forEach(function (se) { for (var i = s; i < n; i++) if (se.values[i] > max) max = se.values[i]; });
  var ymax = vtNiceMax(max), W = 300, H = 100;

  var paths = '';
  [0.25, 0.5, 0.75].forEach(function (f) {
    paths += '<line class="grid" x1="0" x2="' + W + '" y1="' + (H * f) + '" y2="' + (H * f) + '"/>';
  });
  series.forEach(function (se, idx) {
    var pts = [];
    for (var i = s; i < n; i++) {
      pts.push(((i - s) / span * W).toFixed(1) + ',' + (H - 2 - (se.values[i] / ymax) * (H - 6)).toFixed(1));
    }
    paths += '<path class="ln" data-i="' + idx + '" stroke="' + se.color + '" d="M' + pts.join('L') + '"/>';
  });

  tile.svg.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + paths + '</svg>';
  tile.yl.textContent = vtFmtShort(ymax);
  tile.ticks.innerHTML = vtTicks(D.dates, s);
  tile.el.removeAttribute('data-hi');

  if (tile.group === 'All') {
    document.querySelectorAll('.vt-group').forEach(function (g) {
      var i = D.groups.indexOf(g.dataset.group);
      var dot = g.querySelector('.vt-gdot');
      if (dot && i >= 0) dot.style.setProperty('--c', vtColor(i));
    });
  } else {
    var grp = document.querySelector('.vt-group[data-group="' + CSS.escape(tile.group) + '"]');
    if (grp) grp.querySelectorAll('.vt-row').forEach(function (row) {
      var i = Object.keys(D.members[tile.group] || {}).indexOf(row.dataset.member);
      row.querySelector('.vt-dot').style.setProperty('--c', i >= 0 ? vtColor(i) : 'transparent');
    });
  }
}

function vtBuildTile(group, totalText) {
  var el = document.createElement('div');
  el.className = 'vt-tile' + (group === 'All' ? ' vt-tile-all' : '');
  el.innerHTML =
    '<button type="button" class="vt-tile-head" title="Open the interactive graph">' +
      '<span class="vt-tile-name">' + vtEsc(group) + '</span><span class="vt-tile-total">' + vtEsc(totalText) + '</span></button>' +
    '<div class="vt-plot"><div class="vt-svg"></div><span class="vt-yl"></span><div class="vt-guide"></div></div>' +
    '<div class="vt-ticks"></div>';
  var tile = {
    group: group, el: el, series: [], s: 0,
    plot: el.querySelector('.vt-plot'), svg: el.querySelector('.vt-svg'),
    yl: el.querySelector('.vt-yl'), guide: el.querySelector('.vt-guide'), ticks: el.querySelector('.vt-ticks')
  };
  el.querySelector('.vt-svg').style.cssText = 'position:absolute;inset:0';

  el.querySelector('.vt-tile-head').addEventListener('click', function () { vtOpenModal(group); });

  var tip = document.getElementById('vt-tip');
  tile.plot.addEventListener('pointermove', function (e) {
    if (!tile.series.length) return;
    var r = tile.plot.getBoundingClientRect(), n = VT.data.dates.length, s = tile.s;
    var fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    var idx = s + Math.round(fx * (n - 1 - s));
    var gx = ((idx - s) / Math.max(1, n - 1 - s)) * 100;
    tile.guide.style.display = 'block';
    tile.guide.style.left = gx + '%';

    var rows = tile.series.map(function (se) { return { name: se.name, v: se.values[idx], c: se.color }; })
      .sort(function (a, b) { return b.v - a.v; });
    tip.innerHTML = '<div class="vt-tip-date">' + vtEsc(VT.data.dates[idx].slice(0, 7)) + ' \u00b7 ' + vtEsc(group) + '</div>' +
      rows.map(function (x) {
        return '<div class="vt-tip-row"><i style="background:' + x.c + '"></i>' + vtEsc(x.name) + '<b>' + x.v.toLocaleString() + '</b></div>';
      }).join('');
    tip.style.display = 'block';
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = e.clientX + 14, y = e.clientY + 14;
    if (x + tw > window.innerWidth - 8) x = e.clientX - tw - 14;
    if (y + th > window.innerHeight - 8) y = window.innerHeight - th - 8;
    tip.style.left = x + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  });
  tile.plot.addEventListener('pointerleave', function () {
    tile.guide.style.display = 'none';
    tip.style.display = 'none';
  });
  return tile;
}

function vtRenderGraphs() {
  Object.keys(VT.tiles).forEach(function (k) { vtRenderTile(VT.tiles[k]); });
}

function vtInitGraphs() {
  var host = document.getElementById('vt-graphs');
  if (!host) return;

  var groups = Array.prototype.map.call(document.querySelectorAll('.vt-group'), function (g) {
    return { name: g.dataset.group, total: g.querySelector('.vt-group-total').textContent };
  });

  fetchJSON('member_activity.json').then(function (data) {
    VT.data = data;
    host.innerHTML = '';
    var allTotal = groups.reduce(function (a, g) { return a + parseInt(g.total.replace(/,/g, ''), 10); }, 0);
    var order = [{ name: 'All', total: allTotal.toLocaleString() }].concat(groups);
    order.forEach(function (g) {
      if (g.name !== 'All' && !data.members[g.name]) return;
      var tile = vtBuildTile(g.name, g.total);
      VT.tiles[g.name] = tile;
      host.appendChild(tile.el);
    });
    vtRenderGraphs();
    vtWireRows();

    var wasDark = document.documentElement.classList.contains('dark');
    new MutationObserver(function () {
      var d = document.documentElement.classList.contains('dark');
      if (d !== wasDark) { wasDark = d; vtRenderGraphs(); }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }).catch(function (e) {
    console.error('member_activity.json', e);
    host.innerHTML = '<div class="vt-empty">graph data unavailable</div>';
  });
}

function vtWireRows() {
  document.querySelectorAll('.vt-group').forEach(function (g) {
    var group = g.dataset.group;
    var tile = VT.tiles[group];
    var all = VT.tiles['All'];
    if (!tile) return;

    function clear(t) {
      t.el.removeAttribute('data-hi');
      t.svg.querySelectorAll('.ln.hi').forEach(function (p) { p.classList.remove('hi'); });
    }
    function light(t, i) {
      if (i < 0) return;
      t.el.dataset.hi = i;
      var p = t.svg.querySelector('.ln[data-i="' + i + '"]');
      if (p) p.classList.add('hi');
    }

    g.querySelectorAll('.vt-row').forEach(function (row) {
      row.addEventListener('mouseenter', function () {
        light(tile, Object.keys(VT.data.members[group] || {}).indexOf(row.dataset.member));
        if (all) light(all, VT.data.groups.indexOf(group));
      });
      row.addEventListener('mouseleave', function () {
        clear(tile);
        if (all) clear(all);
      });
    });

    var head = g.querySelector('.folder-label');
    if (head && all) {
      head.addEventListener('mouseenter', function () { light(all, VT.data.groups.indexOf(group)); });
      head.addEventListener('mouseleave', function () { clear(all); });
    }
  });
}

(function graphControls() {
  var btns = document.querySelectorAll('.graph-view-btn[data-graph-view]');
  function mark() { btns.forEach(function (b) { b.classList.toggle('active', b.dataset.graphView === VT.view); }); }
  mark();
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      VT.view = b.dataset.graphView;
      try { localStorage.setItem('graph-view', VT.view); } catch (e) {}
      mark();
      if (VT.data) vtRenderGraphs();
      vtLog('volume-tree-graph-view/' + VT.view);
    });
  });
})();

function vtOpenModal(group) {
  group = group || 'All';
  var modal = document.getElementById('interactive-graph-modal');
  var frame = document.getElementById('interactive-graph-frame');
  var win = frame.contentWindow;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  if (win && win.__activityReady && typeof win.openMode === 'function') {
    var show = function () { frame.style.visibility = ''; };
    frame.style.visibility = 'hidden';
    win.openMode(group);
    win.requestAnimationFrame(function () { win.requestAnimationFrame(show); });
    setTimeout(show, 400);
  } else {
    frame.setAttribute('src', 'member-activity.html#' + encodeURIComponent(group));
  }
  vtLog('volume-tree-graph-interactive/' + group);
}

(function modal() {
  var modal = document.getElementById('interactive-graph-modal');
  if (!modal) return;
  document.body.appendChild(modal);
  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  document.getElementById('open-interactive-graph').addEventListener('click', function () { vtOpenModal('All'); });
  document.getElementById('close-interactive-graph').addEventListener('click', close);
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('open')) close(); });
})();


function parseChangelog(text) {
  var lines = String(text).replace(/\r/g, '').split('\n');
  var entries = [], cur = null, sec = null;
  var DATE = '(\\d{6}|\\{date\\})';
  var reBlock = new RegExp('^##\\s+' + DATE + '\\s*(?:\\[([^\\]]*)\\])?\\s*(?:[\\u2013\\u2014-]\\s*(.*))?$');
  var reLegacy = new RegExp('^' + DATE + '\\s*(?:\\[([^\\]]*)\\])?\\s*[\\u2013\\u2014-]\\s*(.+)$');
  var reSection = /^###\s+(.+)$/;
  var reBullet = /^[*-]\s+(.+)$/;
  var tags = function (s) { return s ? s.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : []; };
  var clean = function (s) { return s.trim().replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1'); };

  lines.forEach(function (raw) {
    var line = raw.trim(), m;
    if (!line) return;
    if ((m = reBlock.exec(line))) {
      cur = { date: m[1], tags: tags(m[2]), title: clean(m[3] || ''), sections: [], items: [] };
      entries.push(cur); sec = null; return;
    }
    if ((m = reLegacy.exec(line))) {
      cur = {
        date: m[1], tags: tags(m[2]), title: '', sections: [],
        items: m[3].split(/;\s*/).map(clean).filter(Boolean)
      };
      entries.push(cur); sec = null; return;
    }
    if (!cur) return;
    if ((m = reSection.exec(line))) { sec = { name: clean(m[1]), items: [] }; cur.sections.push(sec); return; }
    if ((m = reBullet.exec(line))) { (sec ? sec.items : cur.items).push(clean(m[1])); return; }
    var list = sec ? sec.items : cur.items;
    if (list.length) list[list.length - 1] += ' ' + clean(line);
  });

  entries.forEach(function (e) {
    if (!e.tags.length) e.tags = e.sections.map(function (s) { return s.name; });
  });
  return entries;
}

function renderChangelog(entries) {
  var list = document.getElementById('changelog-list');
  if (!list) return;

  var li = function (t) { return '<li>' + vtEsc(t) + '</li>'; };

  list.innerHTML = entries.map(function (e, idx) {
    var date = e.date === '{date}' ? 'draft' : e.date;
    var peek = e.title || (e.items[0] || '');
    var chips = e.tags.length
      ? '<span class="cl-tags">' + e.tags.map(function (t) { return '<span class="cl-tag">' + vtEsc(t) + '</span>'; }).join('') + '</span>'
      : '<span class="cl-peek">' + vtEsc(peek) + '</span>';
    var body = '';
    if (e.title) body += '<div class="cl-title">' + vtEsc(e.title) + '</div>';
    if (e.items.length) body += '<ul class="cl-items">' + e.items.map(li).join('') + '</ul>';
    e.sections.forEach(function (s) {
      body += '<div class="cl-sec">' + vtEsc(s.name) + '</div><ul class="cl-items">' + s.items.map(li).join('') + '</ul>';
    });
    return '<li class="cl-entry' + (idx === 0 ? ' latest' : '') + '" data-i="' + idx + '">' +
      '<button type="button" class="cl-head" aria-expanded="false"><i class="ti ti-chevron-right cl-chev" aria-hidden="true"></i>' +
      '<span class="cl-date">' + vtEsc(date) + '</span>' + chips + '</button>' +
      '<div class="cl-body"><div>' + body + '</div></div></li>';
  }).join('');
}

(function changelog() {
  var list = document.getElementById('changelog-list');
  if (!list) return;
  var MODES = ['tags', 'latest', 'all'];
  var mode = 'latest';
  try { var saved = localStorage.getItem('changelog-mode'); if (MODES.indexOf(saved) >= 0) mode = saved; } catch (e) {}

  var btns = document.querySelectorAll('.graph-view-btn[data-cl-mode]');
  function setOpen(entry, open) {
    entry.classList.toggle('open', open);
    entry.querySelector('.cl-head').setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function apply() {
    btns.forEach(function (b) { b.classList.toggle('active', b.dataset.clMode === mode); });
    list.querySelectorAll('.cl-entry').forEach(function (el, i) {
      setOpen(el, mode === 'all' || (mode === 'latest' && i === 0));
    });
  }

  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.dataset.clMode;
      try { localStorage.setItem('changelog-mode', mode); } catch (e) {}
      apply();
      vtLog('changelog-mode/volume_tree/' + mode);
    });
  });

  list.addEventListener('click', function (e) {
    var head = e.target.closest('.cl-head');
    if (!head) return;
    var entry = head.parentElement;
    var open = !entry.classList.contains('open');
    setOpen(entry, open);
    vtLog('changelog-entry/volume_tree/' + entry.dataset.i + '/' + (open ? 'open' : 'closed'));
  });

  fetch('changelog.txt', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('changelog.txt ' + r.status); return r.text(); })
    .then(function (text) { renderChangelog(parseChangelog(text)); apply(); })
    .catch(function (e) { console.error(e); list.innerHTML = '<li class="vt-empty">changelog unavailable</li>'; });
})();

vtInitGraphs();

if (typeof module !== 'undefined') module.exports = { parseChangelog: parseChangelog };