/* ============================================================================
 *  config.js —— 全站配置（原 site.config.js 的对象部分）
 *
 *  改站名 / 导航 / 页脚 / 主题，基本只动这个文件。
 *  ⚠ 首帧初始化（防闪烁）不在这里，在 public/assets/js/boot-theme.js。
 *    如果你把 theme.defaultMode 改成固定值，记得同步改那边。
 * ==========================================================================*/

export default {
  /* ---------- 品牌 / 标题 ---------- */
  brand: {
    name: 'Amoyba的小屋',
    subtitle: '(╹ڡ╹ )',
    logo: '🍟',
    logoImage: '',
    homeUrl: '/',
  },

  /* ---------- 功能开关 ----------
   * false = 该页进入「开发中」：导航显示标记，进入后内容锁定且脚本不初始化。
   */
  features: {
    wall: true,
    upload: true,
  },

  /* ---------- 左侧导航 ---------- */
  nav: [
    { id: 'home',     label: '首页',   en: 'HOME',     icon: 'home',     to: '/',         title: '首页',   desc: '欢迎回来' },
    { id: 'wall',     label: '图墙',   en: 'GALLERY',  icon: 'image',    to: '/wall',     title: '图墙',   desc: '所有图片都在这里' },
    { id: 'music',    label: '音乐',   en: 'MUSIC',    icon: 'music',    to: '/music',    title: '音乐',   desc: '我的歌单' },
    { id: 'guestbook', label: '留言板', en: 'GUESTBOOK', icon: 'message', to: '/guestbook', title: '留言板', desc: '留下点什么' },
    { id: 'upload',   label: '上传',   en: 'UPLOAD',   icon: 'upload',   to: '/upload',   title: '上传',   desc: '把新图片放进图墙' },
    { id: 'settings', label: '设置',   en: 'SETTINGS', icon: 'settings', to: '/settings', title: '设置',   desc: '按你的习惯调整一切' },
  ],

  /* ---------- 顶栏右侧按钮 ---------- */
  topbarActions: [
    { label: 'GitHub', icon: 'github', href: 'https://github.com/' },
    { label: '邮箱',   icon: 'mail',   href: 'mailto:you@example.com' },
  ],
  showSearch: true,
  searchPlaceholder: '搜索图墙 / 标签 / 描述…',

  /* ---------- 页脚 ---------- */
  footer: {
    text: ' Amoyba的小屋',
    note: 'D老师独家赞助',
    social: [
      { label: 'GitHub',    icon: 'github',    href: 'https://github.com/bwzydslm' },
      { label: 'Instagram', icon: 'instagram', href: '#' },
      { label: 'Bilibili',  icon: 'bilibili',  href: 'https://space.bilibili.com/1155182580' },
      { label: '邮箱',      icon: 'mail',      href: 'mailto:you@example.com' },
    ],
  },

  /* ---------- 主题 ---------- */
  theme: {
    accent: '#a78bfa',
    accent2: '#7c5cf0',
    defaultMode: 'auto',      // 'dark' | 'light' | 'auto'
    defaultCollapsed: false,
  },

  /* ---------- 首页文案 ---------- */
  home: {
    heroTitle: 'o((>ω< ))o',
    heroText:
      '泥嚎 ( •̀ ω •́ )y 祝你今天生活愉快',
    stats: [
      { label: '图片总数', value: '0', unit: '张' },
      { label: '占用空间', value: '0', unit: 'MB' },
      { label: '最近更新', value: '—', unit: '' },
    ],
    quickLinks: [
      { label: '去看图墙', href: '/wall', icon: 'image' },
      { label: '上传新图片', href: '/upload', icon: 'upload' },
      { label: '调整设置', href: '/settings', icon: 'settings' },
    ],
    editable: true,       // true | 'owner' | false
    notice: {
      title: '随手记 / 公告',
      lines: [
        '这是一个留白的卡片。你可以把它改成「关于我」「近况」「正在做的事」……',
        '配好 D1 之后，直接点右上角「编辑」就能在线改这段文字。',
      ],
      tags: ['标签示例', '相册', '日常'],
    },
  },
}
