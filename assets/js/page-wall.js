/* ============================================================================
 *  page-wall.js  ——  图墙
 *  1) 渲染图片列表（来源：本地存储 wall.items，或下面的 DEMO_ITEMS）
 *  2) 筛选 / 排序 / 搜索 / 灯箱
 *  3) 列数（默认列4，可在设置页改）
 *
 *  ★ 想手工挂图片（最简单、最适合纯静态站点）：
 *    把图片放进 assets/img/，然后照着 DEMO_ITEMS 加一条即可。
 * ==========================================================================*/

/* --------------------------------------------------------- 你可以直接改这里 */
const DEMO_ITEMS = [
  /* 把注释去掉并改成你自己的图片路径，图墙立刻就有内容：
  { name: '夏日祭', src: 'assets/img/1.jpg', tags: ['日常'], ts: Date.parse('2026-07-01') },
  { name: '海边的傍晚', src: 'assets/img/2.jpg', tags: ['风景'], ts: Date.parse('2026-08-12') },
  */
];
/* ------------------------------------------------------------------------- */

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    const wallEl = document.getElementById('wall');
    const emptyEl = document.getElementById('wallEmpty');
    const hintEl = document.getElementById('filterHint');
    const tplAdd = wallEl.querySelector('.wall__add'); // 「添加」按钮要留在最后
    const demos = Array.prototype.slice.call(wallEl.querySelectorAll('[data-demo]'));

    let state = {
      filter: 'all',
      sort: Store.get('wall.sort', 'new'),
      q: new URLSearchParams(location.search).get('q') || '',
    };

    /* -------------------------------------------------- 列数（响应式 + 偏好） */
    function applyColumns() {
      const pref = parseInt(Store.get('wall.columns', 4), 10) || 4;
      const w = window.innerWidth;
      let cols = pref;
      if (w < 1400) cols = Math.min(cols, 3);
      if (w < 900) cols = 2;
      if (w < 560) cols = 1;
      document.documentElement.style.setProperty('--wall-cols', cols);
    }
    applyColumns();
    window.addEventListener('resize', applyColumns);

    /* ------------------------------------------------------------ 数据来源 */
    function getItems() {
      const stored = Store.get('wall.items', []);
      return stored.length ? stored : DEMO_ITEMS;
    }

    function matches(it) {
      if (state.filter === 'fav' && !it.fav) return false;
      if (state.q) {
        const hay = ((it.name || '') + ' ' + (it.desc || '') + ' ' + ((it.tags || []).join(' '))).toLowerCase();
        if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
      }
      return true;
    }

    function sortItems(list) {
      const s = state.sort;
      return list.slice().sort(function (a, b) {
        if (s === 'name') return String(a.name || '').localeCompare(String(b.name || ''), 'zh');
        if (s === 'old') return (a.ts || 0) - (b.ts || 0);
        return (b.ts || 0) - (a.ts || 0);
      });
    }

    /* ------------------------------------------------------------ 渲染卡片 */
    function card(it, i) {
      const tags = (it.tags || []).join(' · ');
      const date = it.ts ? new Date(it.ts).toLocaleDateString('zh-CN') : '';
      const sub = [date, tags].filter(Boolean).join(' · ') || '未添加说明';
      const showMeta = Store.get('wall.showMeta', true);
      return (
        '<div class="wall__item" data-index="' + i + '">' +
          '<img class="wall__thumb" src="' + it.src + '" alt="' + (it.name || '') + '" loading="lazy">' +
          (showMeta
            ? '<div class="wall__meta"><div class="wall__name">' + (it.name || '未命名') + '</div>' +
              '<div class="wall__sub">' + sub + '</div></div>'
            : '') +
        '</div>'
      );
    }

    let current = [];

    function render() {
      const items = sortItems(getItems().filter(matches));

      /* 清掉上次渲染出来的卡片，留下示例与「添加」按钮 */
      wallEl.querySelectorAll('.wall__item[data-rendered]').forEach(function (n) { n.remove(); });

      current = items;

      if (!items.length) {
        const anyData = getItems().length > 0;
        emptyEl.hidden = anyData ? false : false;
        emptyEl.querySelector('.placeholder__title').textContent = anyData ? '没有符合条件的图片' : '图墙还是空的';
        if (anyData) {
          emptyEl.querySelector('div:nth-child(2)').innerHTML =
            '试试清除筛选条件，或者换一个关键词。当前筛选：<code>' + state.filter + '</code>' +
            (state.q ? ' · 关键词：<code>' + state.q + '</code>' : '');
        }
        return;
      }
      emptyEl.hidden = true;

      const html = items.map(card).join('');
      tplAdd.insertAdjacentHTML('beforebegin', html);
      /* 标记出来，方便下次清空 */
      wallEl.querySelectorAll('.wall__item:not([data-demo])').forEach(function (n) { n.setAttribute('data-rendered', '1'); });

      /* 有了真实数据就藏掉纯示例卡片 */
      demos.forEach(function (d) { d.hidden = true; });
      bindLightbox();
    }

    /* --------------------------------------------------------------- 灯箱 */
    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightboxImg');
    const lbCap = document.getElementById('lightboxCaption');

    function bindLightbox() {
      if (!Store.get('wall.lightbox', true)) return;
      wallEl.querySelectorAll('.wall__item[data-rendered], .wall__item[data-demo]').forEach(function (node) {
        node.addEventListener('click', function () {
          const img = node.querySelector('img');
          if (!img) return;
          lbImg.src = img.src;
          lbCap.textContent = node.querySelector('.wall__name')
            ? node.querySelector('.wall__name').textContent
            : img.alt;
          lb.classList.add('is-open');
        });
      });
    }

    function closeLightbox() { lb.classList.remove('is-open'); lbImg.src = ''; }
    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });

    /* ------------------------------------------------------- 工具栏交互 */
    document.getElementById('filterSeg').addEventListener('click', function (e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      this.querySelectorAll('button').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      state.filter = btn.dataset.filter;
      render();
    });

    const sortSel = document.getElementById('sortSelect');
    sortSel.value = state.sort;
    sortSel.addEventListener('change', function () {
      state.sort = this.value;
      Store.set('wall.sort', state.sort);
      render();
    });

    document.getElementById('clearFilterBtn').addEventListener('click', function () {
      state.filter = 'all';
      state.q = '';
      history.replaceState(null, '', location.pathname);
      document.querySelectorAll('#filterSeg button').forEach(function (b, i) {
        b.classList.toggle('is-active', i === 0);
      });
      hintEl.style.display = 'none';
      render();
    });

    if (state.q) {
      hintEl.style.display = 'block';
      hintEl.innerHTML = '正在搜索：<code>' + state.q + '</code>（点「清除筛选」可以回到全部图片）';
    }

    /* 顶栏搜索框在本页直接过滤，不跳页 */
    const gs = document.getElementById('globalSearch');
    if (gs) {
      gs.value = state.q;
      gs.addEventListener('input', function () {
        state.q = this.value.trim();
        render();
      });
    }

    render();
  });
})();
