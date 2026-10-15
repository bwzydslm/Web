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
            { label: home.stats[0].label, value: items.length, unit: home.stats[0].unit, icon: 'image' },
            { label: home.stats[1].label, value: mb, unit: home.stats[1].unit, icon: 'grid' },
            { label: home.stats[2].label, value: items.length ? latest : '暂无', unit: '', icon: 'refresh' },
          ]
        : [
            { label: '图片总数', value: items.length, unit: '张', icon: 'image' },
            { label: '占用空间', value: mb, unit: 'MB', icon: 'grid' },
            { label: '最近更新', value: items.length ? latest : '暂无', unit: '', icon: 'refresh' },
          ];

      grid.innerHTML = stats
        .map(function (s) {
          return '<div class="stat">' +
                 '<span class="stat__icon">' + window.icon(s.icon, 17) + '</span>' +
                 '<div class="stat__label">' + s.label + '</div>' +
                 '<div class="stat__value">' + s.value +
                 '<span class="stat__unit">' + (s.unit || '') + '</span></div></div>';
        })
        .join('');
    }

    /* ---------- 3.5 后端可用时，用云端统计覆盖上面的本地统计 ---------- */
    (async function () {
      if (!window.Api) return;
      const grid2 = document.getElementById('statsGrid');
      if (!grid2) return;
      try {
        const res = await Api.list({ limit: 1, sort: 'new' });
        const mb = ((res.bytes || 0) / 1024 / 1024).toFixed(1);
        const latest =
          res.items && res.items.length
            ? new Date(res.items[0].ts).toLocaleDateString('zh-CN')
            : '—';
        grid2.innerHTML =
          '<div class="stat"><span class="stat__icon">' + window.icon('image', 17) + '</span>' +
          '<div class="stat__label">图片总数</div>' +
          '<div class="stat__value">' + (res.total || 0) + '<span class="stat__unit">张</span></div></div>' +
          '<div class="stat"><span class="stat__icon">' + window.icon('grid', 17) + '</span>' +
          '<div class="stat__label">占用空间</div>' +
          '<div class="stat__value">' + mb + '<span class="stat__unit">MB</span></div></div>' +
          '<div class="stat"><span class="stat__icon">' + window.icon('refresh', 17) + '</span>' +
          '<div class="stat__label">最近更新</div>' +
          '<div class="stat__value">' + latest + '</div></div>';
      } catch (e) {
        /* 后端没配好就保持本地统计，不打扰用户 */
      }
    })();

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

    /* ---------- 6. 随手记 / 公告：可以直接在网站上编辑 ------------------
     * 读取优先级：云端 D1 → 本机浏览器 → site.config.js 的 home.notice
     * 保存：配了后端口令就写进 D1（所有访客都能看到），否则存本机浏览器。
     * ------------------------------------------------------------------ */
    (function noticeBoard() {
      const KEY = 'notice';
      const titleEl = document.getElementById('noticeTitle');
      const bodyEl = document.getElementById('noticeBody');
      const editBtn = document.getElementById('noticeEditBtn');
      if (!bodyEl) return;

      /* editable 三种取值：true 谁都能看到编辑键 / 'owner' 只有配了口令的浏览器能看到 / false 不显示 */
      const editable = home ? home.editable : true;

      function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }

      function fromConfig() {
        const n = home && home.notice;
        if (!n) return null;
        return { title: n.title, body: (n.lines || []).join('\n'), tags: n.tags || [] };
      }

      function fromLocal() {
        const n = Store.get('notice', null);
        if (!n) return null;
        return { title: n.title, body: n.body, tags: n.tags || [] };
      }

      function render(note, source) {
        if (titleEl) titleEl.textContent = (note && note.title) || '随手记 / 公告';

        if (!note) {
          bodyEl.innerHTML = '<p class="muted">还没有内容，点右上角「编辑」写点什么吧。</p>';
          return;
        }

        const paragraphs = String(note.body || '')
          .split('\n')
          .map(function (line) { return line.trim(); })
          .filter(Boolean)
          .map(function (line) { return '<p class="muted">' + esc(line) + '</p>'; })
          .join('');

        const tags = (note.tags || [])
          .map(function (t, i) {
            return '<span class="tag' + (i === 0 ? ' tag--accent' : '') + '">' + esc(t) + '</span>';
          })
          .join('');

        const srcText =
          source === 'cloud' ? '内容来自云端数据库'
          : source === 'local' ? '内容只存在这台电脑的浏览器里'
          : '内容来自 site.config.js';

        bodyEl.innerHTML =
          (paragraphs || '<p class="muted">（正文是空的）</p>') +
          (tags ? '<div class="inline" style="margin-top:14px">' + tags + '</div>' : '') +
          '<p class="muted" style="margin-top:14px;font-size:11.5px">' + srcText + '</p>';
      }

      function load() {
        const cloud = window.Api
          ? Api.note(KEY).then(function (res) {
              /* 只要云端有这条记录就以它为准 —— 哪怕正文是空的
                 （原来要求 body 非空，会导致「在网页上清空内容后，默认文案又冒出来」） */
              if (res && res.note) return { note: res.note, source: 'cloud' };
              return null;
            }).catch(function () { return null; })
          : Promise.resolve(null);

        return cloud.then(function (hit) {
          if (hit) return hit;
          const local = fromLocal();
          if (local) return { note: local, source: 'local' };
          const cfg = fromConfig();
          if (cfg) return { note: cfg, source: 'config' };
          return { note: null, source: 'none' };
        });
      }

      function openEditor(note) {
        note = note || {};
        const canCloud = window.Api && Api.isConfigured();

        bodyEl.innerHTML =
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

        document.getElementById('noticeCancelBtn').addEventListener('click', refresh);

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
              await Api.saveNote(KEY, data);
              UI.toast('已保存到云端', 'success');
              refresh();
              return;
            } catch (e) {
              status.textContent = '❌ 保存失败：' + e.message;
              saveBtn.disabled = false;
              return;
            }
          }

          Store.set('notice', data);
          UI.toast('已保存在本机浏览器', 'info');
          refresh();
        });
      }

      function refresh() {
        return load().then(function (res) {
          render(res.note, res.source);
          if (editBtn) {
            const show = editable === 'owner' ? !!(window.Api && Api.isConfigured()) : !!editable;
            editBtn.hidden = !show;
            editBtn.onclick = function () { openEditor(res.note); };
          }
        });
      }

      refresh();
    })();

    /* ---------- 7. 滚动位置记忆（可在设置里关闭） ---------- */
    if (Store.get('ui.rememberScroll', false)) {
      const y = Store.get('ui.scrollY', 0);
      if (y) window.scrollTo(0, y);
      window.addEventListener('beforeunload', function () {
        Store.set('ui.scrollY', window.scrollY);
      });
    }
  });
})();
