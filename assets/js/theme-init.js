/* ============================================================================
 *  theme-init.js  ——  在首屏渲染前就把明暗模式定下来
 *
 *  为什么要单独一个文件：
 *    CSS 是靠 <html data-theme="..."> 决定配色的。如果等 app.js（页面底部）
 *    才设置，浏览器会先按默认值画一帧再切换，白底主题就会出现「先黑一下再变白」
 *    的闪烁。这个脚本放在 <head> 里，第一帧之前就把属性写好。
 *
 *  ★ 这里的判断逻辑必须和 app.js 的 effectiveMode() 保持一致。
 * ==========================================================================*/

(function () {
  'use strict';
  try {
    const saved = JSON.parse(localStorage.getItem('izakaya.theme.mode') || 'null');
    const cfg = (window.SITE_CONFIG && window.SITE_CONFIG.theme) || {};
    const pref = saved || cfg.defaultMode || 'dark';

    let mode = pref;
    if (pref === 'auto') {
      /* 早 7 点到晚 7 点算白天 */
      const h = new Date().getHours();
      mode = h >= 7 && h < 19 ? 'light' : 'dark';
    }

    document.documentElement.dataset.theme = mode === 'light' ? 'light' : 'dark';
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }

  /* 侧边栏的收起状态也要在第一帧之前恢复。
     如果等页面底部的 app.js 才加这个类，每次跳页都会先用展开的样子画一帧，
     再播一遍收起动画 —— 就是你看到的那种「跳一下」的抖动。 */
  try {
    const collapsed = JSON.parse(localStorage.getItem('izakaya.ui.sidebarCollapsed') || 'null');
    const cfgCollapsed = (window.SITE_CONFIG && window.SITE_CONFIG.theme && window.SITE_CONFIG.theme.defaultCollapsed) || false;
    if ((collapsed === null ? cfgCollapsed : collapsed) === true) {
      document.documentElement.classList.add('sidebar-collapsed');
    }
  } catch (e) {}
})();
