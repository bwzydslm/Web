/* ============================================================================
 *  page-settings.js  ——  设置页
 *  所有带 data-setting="xxx.yyy" 的控件都会自动：
 *    读取本地存储 → 写入界面 → 变更时保存 → 立即生效
 *  想加新设置？在 settings.html 里加一个带 data-setting 的控件即可（推荐），
 *  如果它需要特殊效果，再到下面 APPLIERS 里加一条。
 * ==========================================================================*/

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* 每条设置的「立即生效」逻辑 */
  const APPLIERS = {
    'theme.mode': function (v) {
      const actual = SiteApp.applyMode(v);
      const tag = document.getElementById('curTheme');
      if (tag) {
        tag.textContent =
          v === 'auto'
            ? '跟随时间 · 当前' + (actual === 'dark' ? '深色' : '浅色')
            : v === 'dark' ? '深色' : '浅色';
      }
    },
    'theme.accent': function (v) {
      SiteApp.applyAccent();
      const picker = document.querySelector('[data-setting="theme.accent"]');
      if (picker) picker.value = v;
    },
    'ui.sidebarCollapsed': function (v) {
      document.documentElement.classList.toggle('sidebar-collapsed', !!v);
    },
    'ui.glow': function (v) {
      document.querySelectorAll('.card, .stat, .hero').forEach(function (n) {
        n.style.boxShadow = v ? '' : 'none';
      });
    },
    'ui.showFooter': function (v) {
      const f = document.getElementById('footer');
      if (f) f.style.display = v ? '' : 'none';
    },
    'api.uploadEndpoint': function (v) {
      if (v) UI.toast('已记录接口地址（需在 page-upload.js 里接上 fetch）');
    },
  };

  ready(function () {
    const controls = document.querySelectorAll('[data-setting]');

    /* ---------------------------------------------------- 1. 读取并应用 */
    controls.forEach(function (el) {
      const key = el.dataset.setting;
      const type = el.dataset.type || 'auto';
      const val = Store.get(key, undefined);

      if (type === 'seg') {
        const cur = val !== undefined ? val : (el.querySelector('button.is-active') || el.querySelector('button')).dataset.value;
        el.querySelectorAll('button').forEach(function (b) {
          b.classList.toggle('is-active', b.dataset.value === String(cur));
        });
      } else if (type === 'bool') {
        const on = val !== undefined ? !!val : el.checked;
        el.checked = on;
        if (APPLIERS[key]) APPLIERS[key](on);
      } else if (val !== undefined) {
        el.value = val;
        if (APPLIERS[key]) APPLIERS[key](val);
      }
    });

    /* 主题标签初始化（上面应用 data-setting 时已经写过一次，这里只兜底） */
    const tag = document.getElementById('curTheme');
    if (tag && !tag.textContent.trim()) {
      tag.textContent = document.documentElement.dataset.theme === 'dark' ? '深色' : '浅色';
    }
    const resetIco = document.getElementById('resetIco');
    if (resetIco) resetIco.innerHTML = window.icon('refresh', 16);

    /* ---------------------------------------------------- 2. 监听变更 */
    controls.forEach(function (el) {
      const key = el.dataset.setting;
      const type = el.dataset.type || 'auto';

      if (type === 'seg') {
        el.addEventListener('click', function (e) {
          const btn = e.target.closest('button');
          if (!btn) return;
          el.querySelectorAll('button').forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
          commit(key, btn.dataset.value);
        });
      } else if (type === 'bool') {
        el.addEventListener('change', function () { commit(key, el.checked); });
      } else {
        el.addEventListener('change', function () { commit(key, el.value); });
        if (el.type === 'color') el.addEventListener('input', function () { commit(key, el.value); });
        if (el.type === 'range') el.addEventListener('input', function () { commit(key, el.value); });
      }
    });

    function commit(key, value) {
      Store.set(key, value);
      if (APPLIERS[key]) APPLIERS[key](value);
      UI.toast('已保存：' + key);
    }

    /* ------------------------------------------- 2.5 服务端 / API 配置 */
    /* 这三项不走 data-setting，因为要写进 Api 自己的配置里 */
    const apiBase = document.getElementById('apiBase');
    const apiToken = document.getElementById('apiToken');
    const apiStatus = document.getElementById('apiStatusDesc');

    function paintApiStatus() {
      if (!apiBase || !apiToken) return;
      const c = Api.conf();
      apiBase.value = c.base;
      apiToken.value = c.token;
      if (apiStatus) {
        apiStatus.textContent = c.token
          ? '已填写口令，点「测试连接」确认是否可用'
          : '还没配置口令：上传、删除等写操作不会生效';
      }
    }
    paintApiStatus();

    const saveBtn = document.getElementById('apiSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        Api.save({ base: apiBase.value.trim(), token: apiToken.value.trim() });
        UI.toast('已保存服务端配置', 'success');
        paintApiStatus();
      });
    }

    const testBtn = document.getElementById('apiTestBtn');
    if (testBtn) {
      testBtn.addEventListener('click', async function () {
        /* 先按输入框里的当前值试，避免用户忘了点保存 */
        Api.save({ base: apiBase.value.trim(), token: apiToken.value.trim() });
        if (apiStatus) apiStatus.textContent = '正在检测…';
        try {
          const health = await Api.health();
          const check = await Api.check();
          if (apiStatus) {
            const dbOk = health.db === 'ok';
            const r2Ok = health.bucket === 'ok';
            apiStatus.innerHTML =
              '✅ 后端可达 —— D1：' + (dbOk ? '正常' : '⚠ ' + health.db) +
              ' · R2：' + (r2Ok ? '正常' : '未配置（随手记等文本板块不需要它）') +
              ' · 口令：' + (check.ok ? '正确' : '异常');
          }
          UI.toast('连接成功', 'success');
        } catch (e) {
          if (apiStatus) apiStatus.textContent = '❌ ' + e.message;
          UI.toast('连接失败：' + e.message, 'error');
        }
      });
    }

    /* ----------------------------------------- 2.7 「？？？」口令门 -----
     * 把「服务端 / API」和「数据管理」两块藏起来，输入口令验证通过才显示。
     * 验证走的是**真的后端接口**（POST /api/auth/check），不是前端硬编码一个密码 ——
     * 前端隐藏只挡得住"随手点开"，挡不住会开 DevTools 的人。
     * ------------------------------------------------------------------ */
    const gatePanel = document.getElementById('gatePanel');
    const privatePanels = document.getElementById('privatePanels');
    const gateInput = document.getElementById('gateInput');
    const gateBtn = document.getElementById('gateBtn');
    const gateStatus = document.getElementById('gateStatus');
    const lockBtn = document.getElementById('lockBtn');
    const UNLOCK_KEY = 'izakaya.unlocked';

    function isUnlocked() {
      try { return sessionStorage.getItem(UNLOCK_KEY) === '1'; } catch (e) { return false; }
    }

    function setUnlocked(on) {
      try {
        if (on) sessionStorage.setItem(UNLOCK_KEY, '1');
        else sessionStorage.removeItem(UNLOCK_KEY);
      } catch (e) {}
    }

    function showPrivate(on) {
      if (privatePanels) privatePanels.hidden = !on;
      if (gatePanel) gatePanel.hidden = on;
    }

    async function tryUnlock() {
      const value = ((gateInput && gateInput.value) || '').trim();
      if (!value) {
        if (gateStatus) gateStatus.textContent = '请输入口令';
        return;
      }

      if (gateBtn) gateBtn.disabled = true;
      if (gateStatus) gateStatus.textContent = '验证中…';

      try {
        /* 拿输入的这串口令直接去敲后端：401 = 不对，200 = 通过 */
        const res = await fetch(Api.url('/api/auth/check'), {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + value },
        });

        if (res.ok) {
          Api.save({ token: value });   /* 顺便存到本机，后面的上传 / 编辑公告就能用 */
          setUnlocked(true);
          showPrivate(true);
          if (gateInput) gateInput.value = '';
          if (gateStatus) gateStatus.textContent = '';
          paintApiStatus();
          UI.toast('已验证', 'success');
        } else if (res.status === 401) {
          if (gateStatus) gateStatus.textContent = '口令不正确';
        } else {
          if (gateStatus) gateStatus.textContent = '验证失败（HTTP ' + res.status + '）';
        }
      } catch (e) {
        if (gateStatus) gateStatus.textContent = '网络错误：' + e.message;
      } finally {
        if (gateBtn) gateBtn.disabled = false;
      }
    }

    if (gateBtn) gateBtn.addEventListener('click', tryUnlock);
    if (gateInput) {
      gateInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') tryUnlock();
      });
    }
    if (lockBtn) {
      lockBtn.addEventListener('click', function () {
        setUnlocked(false);
        showPrivate(false);
        if (gateInput) gateInput.focus();
        UI.toast('已锁定', 'info');
      });
    }

    showPrivate(isUnlocked());

    /* ---------------------------------------------------- 3. 颜色预设 */
    document.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const c = btn.dataset.preset;
        Store.set('theme.accent', c);
        const picker = document.querySelector('[data-setting="theme.accent"]');
        if (picker) picker.value = c;
        SiteApp.applyAccent();
        UI.toast('强调色已更新', 'success');
      });
    });

    /* ---------------------------------------------------- 4. 数据管理 */
    /** 本地存储快照，但把口令打码 —— 导出的文件、弹窗里都不该出现明文口令 */
    function safeStoreAll() {
      const data = Store.all();
      if (data.server && typeof data.server === 'object') {
        data.server = Object.assign({}, data.server, {
          token: data.server.token ? '***' : '',
        });
      }
      return data;
    }

    document.getElementById('viewDataBtn').addEventListener('click', function () {
      const data = safeStoreAll();
      const keys = Object.keys(data);
      if (!keys.length) { UI.toast('本地还没有任何设置', 'info'); return; }
      const lines = keys.map(function (k) { return k + ' = ' + JSON.stringify(data[k]); }).join('\n');
      alert('本地存储的设置（' + keys.length + ' 项）：\n\n' + lines);
    });

    document.getElementById('resetBtn').addEventListener('click', function () {
      if (!confirm('确定恢复默认设置吗？图片记录不会被删除。')) return;
      Store.clear();
      UI.toast('已恢复默认，正在刷新…', 'success');
      setTimeout(function () { location.reload(); }, 600);
    });

    document.getElementById('exportBtn').addEventListener('click', function () {
      const blob = new Blob([JSON.stringify(safeStoreAll(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'site-settings.json';
      a.click();
      URL.revokeObjectURL(a.href);
      UI.toast('设置已导出', 'success');
    });

    const importInput = document.getElementById('importInput');
    document.getElementById('importBtn').addEventListener('click', function () { importInput.click(); });
    importInput.addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const data = JSON.parse(reader.result);
          Object.keys(data).forEach(function (k) { Store.set(k, data[k]); });
          UI.toast('导入成功，正在刷新…', 'success');
          setTimeout(function () { location.reload(); }, 600);
        } catch (e) {
          UI.toast('文件不是合法 JSON', 'error');
        }
      };
      reader.readAsText(file);
    });
  });
})();
