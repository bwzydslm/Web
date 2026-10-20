/* ============================================================================
 *  app.js  ——  全站公共逻辑
 *  1) 根据 site.config.js 渲染侧边栏 / 顶栏 / 页脚
 *  2) 侧边栏展开收起（含手机端抽屉）
 *  3) 深浅色主题切换
 *  4) 本地存储封装 Store + 轻提示 UI.toast
 *  一般不需要改这个文件，改 site.config.js 就够了。
 * ==========================================================================*/

(function () {
  'use strict';

  const CFG = Object.assign(
    {
      brand: { name: '我的网站', subtitle: '', logo: '◆', homeUrl: 'index.html' },
      nav: [],
      topbarActions: [],
      showSearch: true,
      searchPlaceholder: '搜索…',
      footer: { text: '', note: '', social: [] },
      theme: { accent: '#a78bfa', accent2: '#7c5cf0', defaultMode: 'dark', defaultCollapsed: false },
      api: { uploadEndpoint: '', galleryEndpoint: '', headers: {} },
    },
    window.SITE_CONFIG || {}
  );

  /* ---------------------------------------------------------------- 图标库 */
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M4 17.5l4.8-4.3a1.6 1.6 0 0 1 2.2.1L15 17.5"/><path d="M14 14.6l1.7-1.6a1.6 1.6 0 0 1 2.2 0L20 15.2"/>',
    music: '<path d="M9 18V6.6l10-2v11.2"/><circle cx="6.5" cy="18" r="2.6"/><circle cx="16.5" cy="15.8" r="2.6"/>',
    upload: '<path d="M12 16V4.5"/><path d="M7.5 9 12 4.5 16.5 9"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.2v2.1M12 18.7v2.1M4.8 7.7l1.8 1.1M17.4 15.2l1.8 1.1M4.8 16.3l1.8-1.1M17.4 8.8l1.8-1.1"/>',
    link: '<path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"/>',
    github: '<path d="M9 20.5c-4 1-4-2-5.5-2.5M15 21v-3.3a2.9 2.9 0 0 0-.8-2.2c2.7-.3 4.8-1.4 4.8-5.6a4.4 4.4 0 0 0-1.2-3 4.1 4.1 0 0 0-.1-3s-1.3-.4-4.1 1.5a10 10 0 0 0-5.2 0C5.6 3.5 4.3 3.9 4.3 3.9a4.1 4.1 0 0 0-.1 3A4.4 4.4 0 0 0 3 9.9c0 4.2 2.1 5.3 4.8 5.6a2.9 2.9 0 0 0-.8 2.2V21"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 5.5L20 7"/>',
    instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="12" cy="12" r="3.8"/><circle cx="16.9" cy="7.1" r="0.9" fill="currentColor" stroke="none"/>',
    bilibili: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M8 3.5 10.5 6M16 3.5 13.5 6M8.5 11v3.5M15.5 11v3.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
    refresh: '<path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5"/><path d="M4 4.5v4h4"/><path d="M4 12.5a8 8 0 0 0 13.7 5.2L20 15.5"/><path d="M20 19.5v-4h-4"/>',
    download: '<path d="M12 4v11.5"/><path d="M7.5 11 12 15.5 16.5 11"/><path d="M4 19h16"/>',
    trash: '<path d="M4.5 7h15"/><path d="M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7"/><path d="M6.5 7l1 12.1A1.5 1.5 0 0 0 9 20.5h6a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    list: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
    chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 20v-6M12.5 20V9M17 20v-3.5"/>',
  };

  function icon(name, size) {
    const path = ICONS[name];
    const s = size || 18;
    if (!path) return '<span class="ico-emoji" style="font-size:' + s + 'px">' + (name || '•') + '</span>';
    return (
      '<svg class="ico" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      path +
      '</svg>'
    );
  }
  window.icon = icon;

  /* ------------------------------------------------------- 本地存储 + 提示 */
  const NS = 'izakaya.';
  const Store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(NS + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(NS + key, JSON.stringify(value));
      } catch (e) {}
      return value;
    },
    remove(key) {
      try { localStorage.removeItem(NS + key); } catch (e) {}
    },
    all() {
      const out = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf(NS) === 0) out[k.slice(NS.length)] = JSON.parse(localStorage.getItem(k));
        }
      } catch (e) {}
      return out;
    },
    clear() {
      Object.keys(Store.all()).forEach(Store.remove);
    },
  };

  const Toast = {
    host: null,
    show(msg, type, ms) {
      if (!Toast.host) {
        Toast.host = document.createElement('div');
        Toast.host.className = 'toast-host';
        document.body.appendChild(Toast.host);
      }
      const el = document.createElement('div');
      el.className = 'toast toast--' + (type || 'info');
      el.innerHTML = icon(type === 'error' ? 'close' : type === 'success' ? 'check' : 'link', 16) + '<span></span>';
      el.lastChild.textContent = msg;
      Toast.host.appendChild(el);
      requestAnimationFrame(() => el.classList.add('is-in'));
      setTimeout(() => {
        el.classList.remove('is-in');
        setTimeout(() => el.remove(), 260);
      }, ms || 2400);
    },
  };

  window.Store = Store;
  window.UI = {
    icon: icon,
    toast: (m, t) => Toast.show(m, t),
    config: CFG,
    /* 供各页面调用：把 api.uploadEndpoint 之类的地址拼好 */
    apiUrl(key) {
      return (CFG.api && CFG.api[key]) || '';
    },
  };

  /* ------------------------------------------------------------ 主题与状态 */
  const root = document.documentElement;

  function applyAccent() {
    const accent = Store.get('theme.accent', CFG.theme.accent);
    const accent2 = Store.get('theme.accent2', CFG.theme.accent2);
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-2', accent2);
    root.style.setProperty('--accent-soft', hexToRgba(accent, 0.16));
    root.style.setProperty('--accent-line', hexToRgba(accent, 0.38));
  }

  function hexToRgba(hex, a) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '').trim());
    if (!m) return 'rgba(167,139,250,' + a + ')';
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')';
  }
  window.UI.hexToRgba = hexToRgba;

  /**
   * 'auto' = 跟随时间：早 7 点到晚 7 点用浅色，其余时间用深色。
   * 判断逻辑和 site.config.js 末尾的「首帧初始化」保持一致。
   */
  function effectiveMode(mode) {
    if (mode !== 'auto') return mode === 'light' ? 'light' : 'dark';
    const h = new Date().getHours();
    return h >= 7 && h < 19 ? 'light' : 'dark';
  }

  function applyMode(mode) {
    const pref = mode || Store.get('theme.mode', CFG.theme.defaultMode) || 'dark';
    const m = effectiveMode(pref);
    root.dataset.theme = m;

    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.innerHTML = icon(m === 'dark' ? 'sun' : 'moon', 17);
      btn.title =
        (pref === 'auto' ? '跟随时间 · ' : '') +
        (m === 'dark' ? '当前深色，点击切换到浅色' : '当前浅色，点击切换到深色');
    }
    return m;
  }

  /* -------------------------------------------------------------- 渲染侧栏 */

  /** 某个功能页是不是被 site.config.js 关掉了（features 里显式设为 false） */
  function isFeatureOff(id) {
    const f = CFG.features || {};
    return Object.prototype.hasOwnProperty.call(f, id) && f[id] === false;
  }

  /**
   * 把「开发中」的页面锁掉，三层保险：
   *   1) 给已有内容加 inert —— 鼠标点不到、Tab 也聚焦不进去
   *   2) 内容模糊变淡，让人一眼看出不可用
   *   3) 盖一层提示面板，替代原本的操作区
   * 另外页面脚本会检查 body.dataset.pageLocked，发现自己被锁就完全不初始化。
   */
  function lockFeaturePage(id) {
    document.body.dataset.pageLocked = '1';

    const content = document.querySelector('.content');
    if (!content) return;

    const item = (CFG.nav || []).filter(function (n) { return n.id === id; })[0] || {};
    const label = item.label || '这个功能';

    Array.prototype.forEach.call(content.children, function (el) {
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    });

    const box = document.createElement('div');
    box.className = 'dev-lock';
    box.innerHTML =
      '<div class="dev-lock__box">' +
        '<span class="dev-lock__badge">开发中</span>' +
        '<h2 class="dev-lock__title">' + label + '还没做好</h2>' +
        '<p class="dev-lock__text">这个功能正在开发，暂时不能使用。先去首页或设置页看看吧。</p>' +
        '<div class="dev-lock__actions">' +
          '<a class="btn btn--primary" href="index.html">回到首页</a>' +
          '<a class="btn" href="settings.html">打开设置</a>' +
        '</div>' +
      '</div>';

    content.classList.add('is-locked');
    content.appendChild(box);
  }

  /** 侧边栏底部的小卡片，内容读 site.config.js 的 sidebarCard */
  function sidebarCardHtml() {
    const c = CFG.sidebarCard || {};
    const inner =
      '<div class="mini-card__cover">' + (c.emoji || '✦') + '</div>' +
      '<div class="mini-card__meta">' +
        '<div class="mini-card__title">' + (c.title || CFG.brand.name) + '</div>' +
        '<div class="mini-card__sub">' + (c.subtitle || '') + '</div>' +
      '</div>';
    return c.href
      ? '<a class="mini-card" href="' + c.href + '">' + inner + '</a>'
      : '<div class="mini-card">' + inner + '</div>';
  }

  function currentPage() {
    return document.body.dataset.page || 'home';
  }

  function renderSidebar() {
    const host = document.getElementById('sidebar');
    if (!host) return;
    const active = currentPage();
    const brand = CFG.brand;

    const logoHtml = brand.logoImage
      ? '<img class="brand__img" src="' + brand.logoImage + '" alt="logo">'
      : '<span class="brand__logo">' + (brand.logo || '◆') + '</span>';

    const navHtml = CFG.nav
      .map(function (item) {
        const on = item.id === active ? ' is-active' : '';
        const locked = isFeatureOff(item.id);
        return (
          '<a class="nav-item' + on + (locked ? ' is-disabled' : '') + '" href="' + item.href +
            '" title="' + item.label + (locked ? '（开发中）' : '') + '" data-nav="' + item.id + '">' +
            '<span class="nav-item__ico">' + icon(item.icon, 18) + '</span>' +
            '<span class="nav-item__text">' + item.label + '</span>' +
            '<span class="nav-item__en">' + (item.en || '') + '</span>' +
            (locked ? '<span class="nav-item__lock">开发中</span>' : '') +
          '</a>'
        );
      })
      .join('');

    host.innerHTML =
      '<div class="sidebar__head">' +
        '<a class="brand" href="' + brand.homeUrl + '">' +
          logoHtml +
          '<span class="brand__text">' +
            '<span class="brand__name">' + brand.name + '</span>' +
            '<span class="brand__sub">' + (brand.subtitle || '') + '</span>' +
          '</span>' +
        '</a>' +
        '<button class="icon-btn sidebar__collapse" id="collapseBtn" type="button" title="收起 / 展开侧边栏">' + icon('panel', 17) + '</button>' +
      '</div>' +

      '<nav class="sidebar__nav">' + navHtml + '</nav>' +

      /* ▼▼ 侧边栏底部插槽：内容来自 site.config.js 的 sidebarCard ▼▼ */
      '<div class="sidebar__slots">' +
        sidebarCardHtml() +
        '<div class="sidebar__tools">' +
          '<button class="icon-btn" id="themeToggle" type="button"></button>' +
          (CFG.footer.social || []).slice(0, 3).map(function (s) {
            return '<a class="icon-btn" href="' + s.href + '" target="_blank" rel="noopener" title="' + s.label + '">' + icon(s.icon, 17) + '</a>';
          }).join('') +
        '</div>' +
      '</div>';

    const collapseBtn = document.getElementById('collapseBtn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', function () {
        if (window.matchMedia('(max-width: 900px)').matches) {
          document.body.classList.remove('drawer-open');
        } else {
          const next = !document.documentElement.classList.contains('sidebar-collapsed');
          document.documentElement.classList.toggle('sidebar-collapsed', next);
          Store.set('ui.sidebarCollapsed', next);
        }
      });
    }
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        Store.set('theme.mode', next);
        applyMode(next);
        document.dispatchEvent(new CustomEvent('themechange', { detail: { mode: next } }));
      });
    }
  }

  /* -------------------------------------------------------------- 渲染顶栏 */
  function renderTopbar() {
    const host = document.getElementById('topbar');
    if (!host) return;
    const active = CFG.nav.filter(function (n) { return n.id === currentPage(); })[0] || {};
    const title = document.body.dataset.title || active.title || CFG.brand.name;
    const desc = document.body.dataset.desc || active.desc || '';

    host.innerHTML =
      '<button class="icon-btn topbar__burger" id="burgerBtn" type="button" title="菜单">' + icon('menu', 18) + '</button>' +
      '<div class="topbar__title">' +
        '<h1 class="page-title">' + title + '</h1>' +
        '<p class="page-desc">' + desc + '</p>' +
      '</div>' +
      '<div class="topbar__right">' +
        (CFG.showSearch
          ? '<label class="search">' + icon('search', 16) +
            '<input type="search" id="globalSearch" placeholder="' + CFG.searchPlaceholder + '"></label>'
          : '') +
        (CFG.topbarActions || []).map(function (a) {
          return a.href
            ? '<a class="icon-btn" href="' + a.href + '" target="_blank" rel="noopener" title="' + a.label + '">' + icon(a.icon, 17) + '</a>'
            : '<button class="icon-btn" type="button" title="' + a.label + '">' + icon(a.icon, 17) + '</button>';
        }).join('') +
      '</div>';

    const burger = document.getElementById('burgerBtn');
    if (burger) {
      burger.addEventListener('click', function () {
        if (window.matchMedia('(max-width: 900px)').matches) {
          /* 窄屏：滑出抽屉 */
          document.body.classList.toggle('drawer-open');
        } else {
          /* 宽屏（正常情况下这个按钮是隐藏的）：直接切换侧栏展开/收起 */
          const next = !document.documentElement.classList.contains('sidebar-collapsed');
          document.documentElement.classList.toggle('sidebar-collapsed', next);
          Store.set('ui.sidebarCollapsed', next);
        }
      });
    }
    const backdrop = document.getElementById('sidebarBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function () {
        document.body.classList.remove('drawer-open');
      });
    }
    const search = document.getElementById('globalSearch');
    if (search) {
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          const q = search.value.trim();
          if (q) location.href = 'wall.html?q=' + encodeURIComponent(q);
        }
      });
    }
  }

  /* -------------------------------------------------------------- 渲染页脚 */
  function renderFooter() {
    const host = document.getElementById('footer');
    if (!host) return;
    const f = CFG.footer;
    host.innerHTML =
      '<div class="footer__left">' +
        '<span>' + (f.text || '') + '</span>' +
        (f.note ? '<span class="footer__note">· ' + f.note + '</span>' : '') +
      '</div>' +
      '<div class="footer__right">' +
        (f.social || []).map(function (s) {
          return '<a class="icon-btn icon-btn--sm" href="' + s.href + '" target="_blank" rel="noopener" title="' + s.label + '">' + icon(s.icon, 16) + '</a>';
        }).join('') +
      '</div>';
  }

  /* -------------------------------------------------------------- 启动流程 */
  function boot() {
    applyAccent();

    /* 侧边栏默认收起状态（只在本机首次访问时生效） */
    const collapsed = Store.get('ui.sidebarCollapsed', CFG.theme.defaultCollapsed);
    document.documentElement.classList.toggle('sidebar-collapsed', !!collapsed);

    renderSidebar();
    renderTopbar();

    /* 被 features 关掉的页面：盖提示面板并锁住交互 */
    if (isFeatureOff(currentPage())) lockFeaturePage(currentPage());

    renderFooter();
    applyMode();

    /* 跟随时间模式：每 10 分钟重算一次，跨过 7:00 / 19:00 会自动切换 */
    setInterval(function () {
      if ((Store.get('theme.mode', CFG.theme.defaultMode) || 'dark') === 'auto') applyMode();
    }, 10 * 60 * 1000);

    /* 全局快捷键：Ctrl/Cmd + B 收起侧栏 */
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        document.documentElement.classList.toggle('sidebar-collapsed');
      }
      if (e.key === 'Escape') document.body.classList.remove('drawer-open');
    });

    document.dispatchEvent(new CustomEvent('site:ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.SiteApp = { applyAccent, applyMode, renderSidebar, isFeatureOff, ICONS };
})();
