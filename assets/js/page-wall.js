/* ============================================================================
 *  page-wall.js  ——  图墙（云端优先，静态回退）
 *
 *  数据来源优先级：
 *    1) 后端 API（D1 + R2）—— 绑定配好后自动生效
 *    2) 浏览器本地（localStorage）—— 后端不可用时回退，页面不会是空的
 *
 *  想手工挂静态图片（不用后端时最省事）：
 *    图片丢进 assets/img/，在下面 DEMO_ITEMS 里登记。
 * ==========================================================================*/

/* --------------------------------------------------------- 你可以直接改这里 */
const DEMO_ITEMS = [
  /* 例子（去掉注释就能用）：
  { name: '夏日祭', src: 'assets/img/1.jpg', tags: ['日常'], ts: Date.parse('2026-07-01') },
  { name: '海边的傍晚', src: 'assets/img/2.jpg', tags: ['风景'], ts: Date.parse('2026-08-12') },
  */
];
/* ------------------------------------------------------------------------- */

(function () {
  'use strict';

  const PAGE_SIZE = 60;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    /* 这个页面被 site.config.js 的 features 关掉了：不绑定任何事件，也不请求接口 */
    if (document.body.dataset.pageLocked) return;

    const wallEl = document.getElementById('wall');
    const emptyEl = document.getElementById('wallEmpty');
    const hintEl = document.getElementById('filterHint');
    const noticeEl = document.getElementById('wallNotice');
    const addTile = wallEl.querySelector('.wall__add');
    const demos = Array.prototype.slice.call(wallEl.querySelectorAll('[data-demo]'));

    const state = {
      filter: 'all',                                 // all | fav | recent
      sort: Store.get('wall.sort', 'new'),
      q: new URLSearchParams(location.search).get('q') || '',
      source: 'local',                               // local | server
      raw: [],
      offset: 0,
      total: 0,
      canWrite: false,
    };

    /* -------------------------------------------------------- 列数自适应 */
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

    /* ------------------------------------------------------------ 提示条 */
    function notice(text, kind) {
      if (!noticeEl) return;
      if (!text) { noticeEl.hidden = true; return; }
      noticeEl.hidden = false;
      noticeEl.className = 'notice' + (kind ? ' notice--' + kind : '');
      noticeEl.textContent = text;
    }

    /* ------------------------------------------------------------ 数据源 */
    function fromLocal() {
      const stored = Store.get('wall.items', []);
      const list = stored.length ? stored : DEMO_ITEMS;
      return list.map(function (it) {
        return {
          id: it.id || null,
          key: it.key || null,
          name: it.name || '未命名',
          description: it.description || it.desc || '',
          tags: it.tags || [],
          album: it.album || '',
          src: it.src,
          ts: it.ts || 0,
          fav: !!it.fav,
          visibility: it.visibility || 'public',
          size: it.size || 0,
          server: false,
        };
      });
    }

    function fromServer(items) {
      return items.map(function (it) {
        return {
          id: it.id,
          key: it.key,
          name: it.name || '未命名',
          description: it.description || '',
          tags: it.tags || [],
          album: it.album || '',
          src: Api.fileUrl(it.key),
          ts: it.ts || 0,
          fav: !!it.fav,
          visibility: it.visibility || 'public',
          size: it.size || 0,
          server: true,
        };
      });
    }

    async function loadServer(append) {
      const res = await Api.list({
        q: state.q,
        sort: state.sort,
        limit: PAGE_SIZE,
        offset: append ? state.offset : 0,
        all: Api.isConfigured() ? 1 : 0,
      });
      const items = fromServer(res.items || []);
      state.total = res.total || items.length;
      state.offset = (append ? state.offset : 0) + items.length;
      state.raw = append ? state.raw.concat(items) : items;
      state.source = 'server';
      state.canWrite = Api.isConfigured();
    }

    function loadLocalData() {
      state.raw = fromLocal();
      state.total = state.raw.length;
      state.offset = state.raw.length;
      state.source = 'local';
      state.canWrite = false;
    }

    async function refresh(append) {
      if (!append) notice('正在从云端加载…');
      try {
        await loadServer(append);
        const limited = state.raw.length < state.total;
        notice(
          '已连接后端 · 共 ' + state.total + ' 张' + (limited ? '（当前显示 ' + state.raw.length + ' 张）' : ''),
          'ok'
        );
      } catch (e) {
        if (append) {
          notice('加载更多失败：' + e.message, 'warn');
          return;
        }
        loadLocalData();
        notice('后端未连接（' + e.message + '），当前显示浏览器本地数据', 'warn');
      }
      render();
    }

    /* ------------------------------------------------------------ 过滤 */
    function visibleItems() {
      let list = state.raw.slice();

      if (state.filter === 'fav') list = list.filter(function (it) { return it.fav; });
      if (state.filter === 'recent') {
        const week = Date.now() - 7 * 24 * 3600 * 1000;
        list = list.filter(function (it) { return (it.ts || 0) >= week; });
      }
      if (state.q) {
        const q = state.q.toLowerCase();
        list = list.filter(function (it) {
          const hay = [it.name, it.description, (it.tags || []).join(' '), it.album]
            .join(' ')
            .toLowerCase();
          return hay.indexOf(q) !== -1;
        });
      }

      list.sort(function (a, b) {
        if (state.sort === 'name') return String(a.name).localeCompare(String(b.name), 'zh');
        if (state.sort === 'old') return (a.ts || 0) - (b.ts || 0);
        return (b.ts || 0) - (a.ts || 0);
      });
      return list;
    }

    /* ------------------------------------------------------------ 渲染 */
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function card(it) {
      const showMeta = Store.get('wall.showMeta', true);
      const date = it.ts ? new Date(it.ts).toLocaleDateString('zh-CN') : '';
      const sub = [date, (it.tags || []).join(' · ')].filter(Boolean).join(' · ') || '未添加说明';
      const badges =
        (it.visibility === 'private' ? ' <span class="tag">私密</span>' : '') +
        (it.fav ? ' <span class="tag tag--accent">★</span>' : '');

      const actions =
        it.server && state.canWrite
          ? '<div class="wall__actions">' +
            '<button class="icon-btn icon-btn--sm" data-act="fav" title="收藏 / 取消收藏">★</button>' +
            '<button class="icon-btn icon-btn--sm" data-act="del" title="删除这张图">✕</button>' +
            '</div>'
          : '';

      return (
        '<div class="wall__item" data-id="' + esc(it.id || '') + '">' +
          actions +
          '<img class="wall__thumb" src="' + esc(it.src) + '" alt="' + esc(it.name) + '" loading="lazy" decoding="async">' +
          (showMeta
            ? '<div class="wall__meta">' +
                '<div class="wall__name">' + esc(it.name) + badges + '</div>' +
                '<div class="wall__sub">' + esc(sub) + '</div>' +
              '</div>'
            : '') +
        '</div>'
      );
    }

    function render() {
      const items = visibleItems();

      wallEl.querySelectorAll('.wall__item[data-rendered]').forEach(function (n) { n.remove(); });
      const moreBtn = document.getElementById('loadMoreBtn');
      if (moreBtn) moreBtn.remove();

      demos.forEach(function (d) { d.hidden = true; });

      if (!items.length) {
        emptyEl.hidden = false;
        /* 空状态里已经有一个「开始上传」按钮了，别再显示末尾那块「添加新图片」 */
        if (addTile) addTile.hidden = true;
        const hasAny = state.raw.length > 0;
        emptyEl.querySelector('.placeholder__title').textContent =
          hasAny ? '没有符合条件的图片' : '图墙还是空的';
        if (hasAny) {
          emptyEl.querySelector('div:nth-child(2)').innerHTML =
            '试试清除筛选条件。当前筛选：<code>' + esc(state.filter) + '</code>' +
            (state.q ? ' · 关键词：<code>' + esc(state.q) + '</code>' : '');
        }
        return;
      }
      emptyEl.hidden = true;
      if (addTile) addTile.hidden = false;

      addTile.insertAdjacentHTML('beforebegin', items.map(card).join(''));
      wallEl.querySelectorAll('.wall__item:not([data-demo])').forEach(function (n) {
        n.setAttribute('data-rendered', '1');
      });

      if (state.source === 'server' && state.raw.length < state.total) {
        addTile.insertAdjacentHTML(
          'beforebegin',
          '<button class="btn btn--block" id="loadMoreBtn" type="button" data-rendered="1">' +
            '加载更多（还有 ' + (state.total - state.raw.length) + ' 张）</button>'
        );
        document.getElementById('loadMoreBtn').addEventListener('click', function () {
          refresh(true);
        });
      }

      bindCardEvents();
    }

    /* -------------------------------------------------- 卡片点击 / 按钮 */
    function bindCardEvents() {
      wallEl.querySelectorAll('.wall__item[data-rendered]').forEach(function (node) {
        if (node.dataset.bound) return;
        node.dataset.bound = '1';
        node.addEventListener('click', function (e) {
          const act = e.target.closest('[data-act]');
          if (act) {
            e.stopPropagation();
            handleAction(act.dataset.act, node);
            return;
          }
          openLightbox(node);
        });
      });
    }

    async function handleAction(act, node) {
      const id = node.dataset.id;
      const item = state.raw.filter(function (x) { return x.id === id; })[0];
      if (!id || !item) return;

      if (act === 'del') {
        if (!confirm('确定删除「' + item.name + '」吗？\nD1 记录和 R2 里的文件都会删掉，无法撤销。')) return;
        try {
          await Api.remove(id);
          UI.toast('已删除', 'success');
          refresh();
        } catch (e) {
          UI.toast('删除失败：' + e.message, 'error');
        }
      }

      if (act === 'fav') {
        try {
          await Api.update(id, { fav: !item.fav });
          UI.toast(item.fav ? '已取消收藏' : '已收藏', 'success');
          refresh();
        } catch (e) {
          UI.toast('操作失败：' + e.message, 'error');
        }
      }
    }

    /* ---------------------------------------------------- 灯箱 + 缩放 ---
     * 交互（都很克制，没有多余 UI）：
     *   滚轮 / 双指捏合  → 以指针为中心缩放
     *   放大后拖动        → 平移
     *   双击              → 2.5 倍 / 还原之间切换
     *   底部 − 100% +     → 按钮缩放，点百分比数字还原
     *   键盘 + / - / 0    → 放大 / 缩小 / 还原，Esc 关闭
     * ------------------------------------------------------------------ */
    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightboxImg');
    const lbCap = document.getElementById('lightboxCaption');
    const lbStage = document.getElementById('lightboxStage');
    const zoomPct = document.getElementById('zoomReset');

    const MIN_SCALE = 0.5;
    const MAX_SCALE = 6;
    let scale = 1;
    let tx = 0;
    let ty = 0;

    function applyTransform() {
      lbImg.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
      if (zoomPct) zoomPct.textContent = Math.round(scale * 100) + '%';
      if (lbStage) lbStage.classList.toggle('is-zoomed', scale > 1.01);
    }

    /** 围绕 (cx,cy) 缩放，让这个点保持在原地；不传则围绕中心 */
    function zoomTo(next, cx, cy) {
      next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
      if (Math.abs(next - scale) < 0.0001) return;

      if (cx === undefined) { cx = 0; cy = 0; }
      tx = cx - (cx - tx) * (next / scale);
      ty = cy - (cy - ty) * (next / scale);
      scale = next;

      /* 缩回 100% 以内时顺便复位，避免图被推到看不见的地方 */
      if (scale <= 1) { tx = 0; ty = 0; }
      applyTransform();
    }

    function resetZoom() {
      scale = 1; tx = 0; ty = 0;
      applyTransform();
    }

    function openLightbox(node) {
      if (!Store.get('wall.lightbox', true)) return;
      const img = node.querySelector('img');
      if (!img) return;
      lbImg.src = img.src;
      const nameEl = node.querySelector('.wall__name');
      lbCap.textContent = nameEl ? nameEl.textContent : img.alt;
      resetZoom();
      lb.classList.add('is-open');
    }

    function closeLightbox() {
      lb.classList.remove('is-open');
      lbImg.src = '';
      resetZoom();
    }

    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });

    /* 滚轮缩放（以光标为中心） */
    if (lbStage) {
      lbStage.addEventListener('wheel', function (e) {
        e.preventDefault();
        const rect = lbStage.getBoundingClientRect();
        zoomTo(
          scale * Math.exp(-e.deltaY * 0.0015),
          e.clientX - rect.left - rect.width / 2,
          e.clientY - rect.top - rect.height / 2
        );
      }, { passive: false });

      /* 拖动平移（仅放大后） */
      let dragging = false;
      let startX = 0, startY = 0, baseX = 0, baseY = 0;

      lbStage.addEventListener('pointerdown', function (e) {
        if (scale <= 1 || !e.isPrimary) return;
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        baseX = tx; baseY = ty;
        lbStage.classList.add('is-dragging');
        try { lbStage.setPointerCapture(e.pointerId); } catch (err) {}
      });

      lbStage.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        tx = baseX + (e.clientX - startX);
        ty = baseY + (e.clientY - startY);
        applyTransform();
      });

      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
        lbStage.addEventListener(ev, function () {
          if (!dragging) return;
          dragging = false;
          lbStage.classList.remove('is-dragging');
        });
      });

      /* 双击：放大 / 还原 */
      lbStage.addEventListener('dblclick', function (e) {
        e.preventDefault();
        if (scale > 1.01) { resetZoom(); return; }
        const rect = lbStage.getBoundingClientRect();
        zoomTo(
          2.5,
          e.clientX - rect.left - rect.width / 2,
          e.clientY - rect.top - rect.height / 2
        );
      });

      /* 双指捏合 */
      let pinchStart = 0;
      lbStage.addEventListener('touchstart', function (e) {
        if (e.touches.length === 2) {
          dragging = false;
          pinchStart = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
      }, { passive: true });

      lbStage.addEventListener('touchmove', function (e) {
        if (e.touches.length !== 2 || !pinchStart) return;
        e.preventDefault();
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        zoomTo(scale * (d / pinchStart));
        pinchStart = d;
      }, { passive: false });

      lbStage.addEventListener('touchend', function () { pinchStart = 0; });
    }

    /* 底部按钮 */
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    if (zoomInBtn) zoomInBtn.addEventListener('click', function () { zoomTo(scale * 1.5); });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', function () { zoomTo(scale / 1.5); });
    if (zoomPct) zoomPct.addEventListener('click', resetZoom);

    /* 键盘 */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeLightbox(); return; }
      if (!lb.classList.contains('is-open')) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(scale * 1.5); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomTo(scale / 1.5); }
      else if (e.key === '0') { e.preventDefault(); resetZoom(); }
    });

    /* ------------------------------------------------------------ 工具栏 */
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
      refresh();
    });

    document.getElementById('clearFilterBtn').addEventListener('click', function () {
      state.filter = 'all';
      state.q = '';
      history.replaceState(null, '', location.pathname);
      document.querySelectorAll('#filterSeg button').forEach(function (b, i) {
        b.classList.toggle('is-active', i === 0);
      });
      hintEl.style.display = 'none';
      const gs0 = document.getElementById('globalSearch');
      if (gs0) gs0.value = '';
      refresh();
    });

    if (state.q) {
      hintEl.style.display = 'block';
      hintEl.innerHTML = '正在搜索：<code>' + esc(state.q) + '</code>（点「清除筛选」回到全部图片）';
    }

    const gs = document.getElementById('globalSearch');
    if (gs) {
      gs.value = state.q;
      gs.addEventListener('input', function () {
        state.q = this.value.trim();
        render();
      });
    }

    refresh();
  });
})();
