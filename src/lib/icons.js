/* ============================================================================
 *  icons.js —— 内联 SVG 图标库
 *
 *  都是 24×24 viewBox 的描边图标，颜色跟随 currentColor。
 *  用法：<AppIcon name="home" :size="18" />
 *  也支持直接写 emoji：<AppIcon name="🖼" />（找不到就原样渲染成文字）
 * ==========================================================================*/

export const ICONS = {
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
  message: '<path d="M20.5 11.5c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.43L4.5 20.5l1.3-3.5c-1.4-1.3-2.3-3.1-2.3-5.5 0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2Z"/>',
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

  /* ---- 播放器 ---- */
  play: '<path d="M7.5 4.8 19 12 7.5 19.2Z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="7" y="4.8" width="3.4" height="14.4" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.6" y="4.8" width="3.4" height="14.4" rx="1.2" fill="currentColor" stroke="none"/>',
  prev: '<path d="M18.5 5.2 9 12l9.5 6.8Z" fill="currentColor" stroke="none"/><rect x="4" y="5" width="2.4" height="14" rx="1.1" fill="currentColor" stroke="none"/>',
  next: '<path d="M5.5 5.2 15 12l-9.5 6.8Z" fill="currentColor" stroke="none"/><rect x="17.6" y="5" width="2.4" height="14" rx="1.1" fill="currentColor" stroke="none"/>',
  repeat: '<path d="M7 7.5h9.5A3.5 3.5 0 0 1 20 11v1"/><path d="m8.5 5 -2 2.5 2 2.5"/><path d="M17 16.5H7.5A3.5 3.5 0 0 1 4 13v-1"/><path d="m15.5 19 2-2.5-2-2.5"/>',
  'repeat-one': '<path d="M7 7.5h9.5A3.5 3.5 0 0 1 20 11v1"/><path d="m8.5 5 -2 2.5 2 2.5"/><path d="M17 16.5H7.5A3.5 3.5 0 0 1 4 13v-1"/><path d="m15.5 19 2-2.5-2-2.5"/><path d="M12.4 9.6v4.8M11 10.6l1.4-1"/>',
  shuffle: '<path d="M4 7h3.2a4 4 0 0 1 3.3 1.8l3 4.4A4 4 0 0 0 16.8 15H20"/><path d="M4 17h3.2a4 4 0 0 0 3.3-1.8l.6-.9"/><path d="M14.4 9.9l.5-.8A4 4 0 0 1 16.8 9H20"/><path d="m17.6 6.5 2.4 2.5-2.4 2.5"/><path d="m17.6 12.5 2.4 2.5-2.4 2.5"/>',
  volume: '<path d="M4 9.5h3l4.2-3.4v11.8L7 14.5H4Z"/><path d="M15 9.2a4 4 0 0 1 0 5.6"/><path d="M17.6 6.8a7.2 7.2 0 0 1 0 10.4"/>',
  'volume-mute': '<path d="M4 9.5h3l4.2-3.4v11.8L7 14.5H4Z"/><path d="m15.5 9.5 4.5 5M20 9.5l-4.5 5"/>',
  'volume-low': '<path d="M4 9.5h3l4.2-3.4v11.8L7 14.5H4Z"/><path d="M15 9.2a4 4 0 0 1 0 5.6"/>',
  lyric: '<path d="M4 6.5h9M4 11h13M4 15.5h7"/><circle cx="18" cy="17" r="2.2"/><path d="M20.2 17v-4.4"/>',
  heart: '<path d="M12 20.2S3.8 15 3.8 9.6A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 8.2 2.4c0 5.4-8.2 10.6-8.2 10.6Z"/>',
}

export default ICONS
