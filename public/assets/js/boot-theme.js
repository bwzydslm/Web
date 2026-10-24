/* ============================================================================
 *  boot-theme.js —— 首帧初始化（防闪烁）
 *
 *  在 <head> 里同步执行，赶在浏览器画第一帧之前决定四件事：
 *    · 明暗模式   → 否则浅色主题会「先黑一下再变白」
 *    · 侧栏收起态 → 否则每次进入都会「先展开、再收起」
 *    · 强调色     → 否则会先闪一下 CSS 里写死的默认紫色
 *    · 透明/无
 *
 *  ⚠ 必须是普通外链脚本：CSP 的 script-src 'self' 会拦截内联脚本。
 *  ⚠ 默认值和 src/config.js 保持一致：
 *    theme.defaultMode ↔ DEFAULT_MODE，theme.defaultCollapsed ↔ DEFAULT_COLLAPSED
 * ==========================================================================*/
(function () {
  'use strict'

  var DEFAULT_MODE = 'auto'
  var DEFAULT_COLLAPSED = false

  var root = document.documentElement

  /* ---------------- 1. 明暗模式 ---------------- */
  try {
    var saved = JSON.parse(localStorage.getItem('izakaya.theme.mode') || 'null')
    var pref = saved || DEFAULT_MODE
    var mode = pref
    if (pref === 'auto') {
      var h = new Date().getHours()
      mode = h >= 7 && h < 19 ? 'light' : 'dark'
    }
    root.dataset.theme = mode === 'light' ? 'light' : 'dark'
  } catch (e) {
    root.dataset.theme = 'dark'
  }

  /* ---------------- 2. 侧栏收起态 ---------------- */
  try {
    var c = JSON.parse(localStorage.getItem('izakaya.ui.sidebarCollapsed') || 'null')
    if ((c === null ? DEFAULT_COLLAPSED : c) === true) {
      root.classList.add('sidebar-collapsed')
    }
  } catch (e) {}

  /* ---------------- 3. 强调色 ----------------
   * CSS 的 :root 里 --accent 是写死的默认值（紫色）。
   * 用户改过色的话，必须在这里就换掉，否则首帧会闪一下紫色，
   * 等 Vue 挂载后 applyAccent() 再改回来 —— 那就是「闪回第一版」的来源。
   * 逻辑必须和 src/lib/theme.js 的 applyAccent() 完全一致。
   * ------------------------------------------------------------------ */
  function hexToRgba(hex, a) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '').trim())
    if (!m) return 'rgba(167,139,250,' + a + ')'
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')'
  }

  try {
    var accent = JSON.parse(localStorage.getItem('izakaya.theme.accent') || 'null')
    var accent2 = JSON.parse(localStorage.getItem('izakaya.theme.accent2') || 'null')
    if (accent) {
      var s = root.style
      s.setProperty('--accent', accent)
      s.setProperty('--accent-soft', hexToRgba(accent, 0.16))
      s.setProperty('--accent-line', hexToRgba(accent, 0.38))
      if (accent2) s.setProperty('--accent-2', accent2)
    }
  } catch (e) {}
})()
