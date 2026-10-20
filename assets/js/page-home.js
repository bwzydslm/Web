/* ============================================================================
 *  page-home.js  ——  首页
 *
 *  只发 1 个 API 请求：/api/home 一次返回「统计 + 最近图片 + 随手记」。
 *  （以前是 2 个：/api/images 拿统计 + /api/notes/notice 拿公告。
 *    跨境线路上每多一个请求就多一个 200~300ms 的往返。）
 *
 *  后端不可用时自动降级：浏览器本地数据 → site.config.js 里的默认文案。
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
    const NOTICE_KEY = 'notice';

    /* editable：true = 谁都能看到编辑键；'owner' = 只有配了口令的浏览器；false = 不显示 */
    const editable = home ? home.editable : true;

    const els = {
      stats: document.getElementById('statsGrid'),
      recent: document.getElementById('recentPlaceholder'),
      noticeTitle: document.getElementById('noticeTitle'),
      noticeBody: document.getElementById('noticeBody'),
      noticeEditBtn: document.getElementById('noticeEditBtn'),
    };

    /** 当前正在显示的公告内容（点「取消」时用它还原） */
    let currentNote = null;

    /* --------------------------------------------------------------- 工具 */
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    /* ---------------------------------------------------------- ① 主视觉 */
    if (home.heroTitle) document.getElementById('heroTitle').textContent = home.heroTitle;
    if (home.heroText) document.getElementById('heroText').textContent = home.heroText;

    /* ------------------------------------------------------ ② 统计卡片 */
    function renderStats(s) {
      if (!els.stats) return;
      const cards = [
        { label: '图片总数', value: s.total || 0, unit: '张', icon: 'image' },
        { label: '占用空间', value: ((s.bytes || 0) / 1024 / 1024).toFixed(1), unit: 'MB', icon: 'grid' },
        { label: '最近更新', value: s.latest ? new Date(s.latest).toLocaleDateString('zh-CN') : '暂无', unit: '', icon: 'refresh' },
      ];
      els.stats.innerHTML = cards
        .map(function (c) {
          return '<div class="stat">' +
                 '<span class="stat__icon">' + window.icon(c.icon, 17) + '</span>' +
                 '<div class="stat__label">' + c.label + '</div>' +
                 '<div class="stat__value">' + c.value +
                 '<span class="stat__unit">' + (c.unit || '') + '</span></div></div>';
        })
        .join('');
    }

    function renderStatsLocal(items) {
      const bytes = items.reduce(function (sum, it) { return sum + (it.size || 0); }, 0);
      const latest = items.length
        ? Math.max.apply(null, items.map(function (i) { return i.ts || 0; }))
        : 0;
      renderStats({ total: items.length, bytes: bytes, latest: latest });
    }

    /* ------------------------------------------------------ ③ 最近更新 */
    function renderRecent(list) {
      if (!els.recent || !list || !list.length) return;
      els.recent.outerHTML =
        '<div class="grid grid--2" style="gap:12px">' +
        list
          .map(function (it) {
            return '<a class="quick" href="wall.html">' +
                   '<img src="' + esc(it.src) + '" alt="' + esc(it.name) + '" loading="lazy" decoding="async" ' +
                   'style="width:52px;height:52px;border-radius:11px;object-fit:cover;flex:none">' +
                   '<span><span class="quick__label">' + esc(it.name || '未命名') + '</span><br>' +
                   '<span class="quick__sub">' + new Date(it.ts || Date.now()).toLocaleString('zh-CN') + '</span></span></a>';
          })
          .join('') +
        '</div>';
      els.recent = null; /* 占位块已经被替换，之后不用再找它 */
    }

    /* ------------------------------------------------------ ④ 快捷入口 */
    function isOff(href) {
      const nav = (CFG.nav || []).filter(function (n) { return n.href === href; })[0];
      return !!(nav && window.SiteApp && SiteApp.isFeatureOff(nav.id));
    }

    const quick = document.getElementById('quickLinks');
    if (quick && home.quickLinks && home.quickLinks.length) {
      quick.innerHTML = home.quickLinks
        .map(function (q) {
          const off = isOff(q.href);
          return '<a class="quick' + (off ? ' is-disabled' : '') + '" href="' + q.href + '">' +
                 '<span class="quick__ico">' + window.icon(q.icon, 18) + '</span>' +
                 '<span><span class="quick__label">' + q.label + '</span>' +
                 (off ? ' <span class="quick__lock">开发中</span>' : '') + '</span></a>';
        })
        .join('');
    }

    /* ------------------------------------------------------ ⑤ 随手记 */
    function renderNotice(note) {
      if (!els.noticeBody) return;
      currentNote = note || null;

      if (els.noticeTitle) els.noticeTitle.textContent = (note && note.title) || '随手记 / 公告';

      if (!note) {
        els.noticeBody.innerHTML = '<p class="muted">还没有内容，点右上角「编辑」写点什么吧。</p>';
        return;
      }

      const paragraphs = String(note.body || '')
        .split('\n')
        .map(function (l) { return l.trim(); })
        .filter(Boolean)
        .map(function (l) { return '<p class="muted">' + esc(l) + '</p>'; })
        .join('');

      const tags = (note.tags || [])
        .map(function (t, i) {
          return '<span class="tag' + (i === 0 ? ' tag--accent' : '') + '">' + esc(t) + '</span>';
        })
        .join('');

      els.noticeBody.innerHTML =
        (paragraphs || '<p class="muted">（正文是空的）</p>') +
        (tags ? '<div class="inline" style="margin-top:14px">' + tags + '</div>' : '');
    }

    function noticeFromConfig() {
      const n = home.notice;
      if (!n) return null;
      return { title: n.title, body: (n.lines || []).join('\n'), tags: n.tags || [] };
    }

    function noticeFromLocal() {
      const n = Store.get('notice', null);
      return n ? { title: n.title, body: n.body, tags: n.tags || [] } : null;
    }

    function setEditButton(note) {
      if (!els.noticeEditBtn) return;
      const show = editable === 'owner' ? !!(window.Api && Api.isConfigured()) : !!editable;
      els.noticeEditBtn.hidden = !show;
      els.noticeEditBtn.onclick = function () { openEditor(note); };
    }

    /* ------------------------------------------------------ ⑥ 公告编辑器 */
    function openEditor(note) {
      note = note || {};
      if (!els.noticeBody) return;
      const canCloud = window.Api && Api.isConfigured();

      els.noticeBody.innerHTML =
        '<div class="stack">' +
          '<label class="field"><span class="field__label">标题</span>' +
            '<input class="input" id="noticeInputTitle" type="text" maxlength="50"></label>' +
          '<label class="field"><span class="field__label">正文（一行一段）</span>' +
            '<textarea class="textarea" id="noticeInputBody" style="min-height:150px"></textarea></label>' +
          '<label class="field"><span class="field__label">标签（英文逗号分隔）</span>' +
            '<input class="input" id="noticeInputTags" type="text"></label>' +
        '</div>' +
        '<div class="inline" style="margin-top:14px">' +
          '<button class="btn btn--primary" type="button" id="noticeSaveBtn">保存</button>' +
          '<button class="btn" type="button" id="noticeCancelBtn">取消</button>' +
          '<span class="muted" id="noticeStatus"></span>' +
        '</div>';

      document.getElementById('noticeInputTitle').value = note.title || '';
      document.getElementById('noticeInputBody').value = note.body || '';
      document.getElementById('noticeInputTags').value = (note.tags || []).join(', ');

      const status = document.getElementById('noticeStatus');
      status.textContent = canCloud
        ? '保存后会写进云端，所有访客都能看到'
        : '未配置后端口令，只能先存在本机浏览器';

      /* 取消：直接用内存里那份还原，不用再请求一次 */
      document.getElementById('noticeCancelBtn').addEventListener('click', function () {
        renderNotice(currentNote);
        setEditButton(currentNote);
      });

      const saveBtn = document.getElementById('noticeSaveBtn');
      saveBtn.addEventListener('click', async function () {
        const data = {
          title: document.getElementById('noticeInputTitle').value.trim(),
          body: document.getElementById('noticeInputBody').value.replace(/\r\n/g, '\n'),
          tags: document.getElementById('noticeInputTags').value
            .split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean),
        };

        saveBtn.disabled = true;
        status.textContent = '保存中…';

        if (canCloud) {
          try {
            await Api.saveNote(NOTICE_KEY, data);
            UI.toast('已保存到云端', 'success');
            /* 直接用刚保存的内容重绘，避免再请求一次（也避免命中缓存拿到旧数据） */
            renderNotice(data);
            setEditButton(data);
            return;
          } catch (e) {
            status.textContent = '❌ 保存失败：' + e.message;
            saveBtn.disabled = false;
            return;
          }
        }

        Store.set('notice', data);
        UI.toast('已保存在本机浏览器', 'info');
        renderNotice(data);
        setEditButton(data);
      });
    }

    /* -------------------------------------------- ⑦ 数据加载（唯一入口） */
    function fallback() {
      const items = Store.get('wall.items', []);
      renderStatsLocal(items);
      renderRecent(
        items
          .slice()
          .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); })
          .slice(0, 4)
          .map(function (it) { return { name: it.name, ts: it.ts, src: it.src }; })
      );
      const note = noticeFromLocal() || noticeFromConfig();
      renderNotice(note);
      setEditButton(note);
    }

    async function loadHome() {
      /* 先用本地数据把统计画出来，避免空着（网络回来再覆盖） */
      renderStatsLocal(Store.get('wall.items', []));

      if (!window.Api) {
        fallback();
        return;
      }

      try {
        const data = await Api.home();
        renderStats({ total: data.total, bytes: data.bytes, latest: data.latest });

        if (data.recent && data.recent.length) {
          renderRecent(
            data.recent.map(function (it) {
              return { name: it.name, ts: it.ts, src: Api.fileUrl(it.key) };
            })
          );
        }

        const note = data.notice || noticeFromLocal() || noticeFromConfig();
        renderNotice(note);
        setEditButton(note);
      } catch (e) {
        /* 后端没配好 / 网络不通 → 全部走本地 */
        fallback();
      }
    }

    loadHome();

    /* ------------------------------------------------ ⑧ 滚动位置记忆 */
    if (Store.get('ui.rememberScroll', false)) {
      const y = Store.get('ui.scrollY', 0);
      if (y) window.scrollTo(0, y);
      window.addEventListener('beforeunload', function () {
        Store.set('ui.scrollY', window.scrollY);
      });
    }
  });
})();
