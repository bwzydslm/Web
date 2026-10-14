/* ============================================================================
 *  page-home.js  ——  首页
 *  只做三件事：套用配置里的文案、统计图片数量、渲染「最近更新」。
 *  想加自己的模块，照抄这里任意一段即可。
 * ==========================================================================*/

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    const CFG = (window.UI && window.UI.config) || {};
    const home = CFG.home || {};

    /* ---------- 1. 主视觉文案 ---------- */
    if (home.heroTitle) document.getElementById('heroTitle').textContent = home.heroTitle;
    if (home.heroText) document.getElementById('heroText').textContent = home.heroText;

    /* ---------- 2. 取图片数据（图墙用的是同一个 storage key） ---------- */
    const items = Store.get('wall.items', []);

    /* ---------- 3. 统计卡片 ---------- */
    const grid = document.getElementById('statsGrid');
    if (grid) {
      const bytes = items.reduce(function (sum, it) { return sum + (it.size || 0); }, 0);
      const mb = (bytes / 1024 / 1024).toFixed(1);
      const latest = items.length
        ? new Date(Math.max.apply(null, items.map(function (i) { return i.ts || 0; }))).toLocaleDateString('zh-CN')
        : '—';

      const stats = home.stats && home.stats.length
        ? [
            { label: home.stats[0].label, value: items.length, unit: home.stats[0].unit },
            { label: home.stats[1].label, value: mb, unit: home.stats[1].unit },
            { label: home.stats[2].label, value: items.length ? latest : '—', unit: '' },
          ]
        : [
            { label: '图片总数', value: items.length, unit: '张' },
            { label: '占用空间', value: mb, unit: 'MB' },
            { label: '最近更新', value: items.length ? latest : '—', unit: '' },
          ];

      grid.innerHTML = stats
        .map(function (s) {
          return '<div class="stat"><div class="stat__label">' + s.label + '</div>' +
                 '<div class="stat__value">' + s.value + '<span class="stat__unit">' + (s.unit || '') + '</span></div></div>';
        })
        .join('');
    }

    /* ---------- 4. 快捷入口（也可以直接在 HTML 里写死） ---------- */
    const quick = document.getElementById('quickLinks');
    if (quick && home.quickLinks && home.quickLinks.length) {
      quick.innerHTML = home.quickLinks
        .map(function (q) {
          return '<a class="quick" href="' + q.href + '"><span class="quick__ico">' + window.icon(q.icon, 18) + '</span>' +
                 '<span><span class="quick__label">' + q.label + '</span></span></a>';
        })
        .join('');
    }

    /* ---------- 5. 最近更新：取最新 4 张 ---------- */
    const holder = document.getElementById('recentPlaceholder');
    if (holder && items.length) {
      const recent = items.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).slice(0, 4);
      holder.outerHTML =
        '<div class="grid grid--2" style="gap:12px">' +
        recent
          .map(function (it) {
            return '<a class="quick" href="wall.html"><img src="' + it.src + '" alt="' + (it.name || '') + '" ' +
                   'style="width:52px;height:52px;border-radius:11px;object-fit:cover;flex:none">' +
                   '<span><span class="quick__label">' + (it.name || '未命名') + '</span><br>' +
                   '<span class="quick__sub">' + new Date(it.ts || Date.now()).toLocaleString('zh-CN') + '</span></span></a>';
          })
          .join('') +
        '</div>';
    }

    /* ---------- 6. 滚动位置记忆（可在设置里关闭） ---------- */
    if (Store.get('ui.rememberScroll', false)) {
      const y = Store.get('ui.scrollY', 0);
      if (y) window.scrollTo(0, y);
      window.addEventListener('beforeunload', function () {
        Store.set('ui.scrollY', window.scrollY);
      });
    }
  });
})();
