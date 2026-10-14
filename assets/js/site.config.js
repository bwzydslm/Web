/* ============================================================================
 *  site.config.js  ——  全站唯一需要经常改的文件
 *  站点名称、导航、页脚、社交链接、接口地址……都在这里配置。
 *  改完保存刷新页面即可，不需要重新构建。
 * ==========================================================================*/

window.SITE_CONFIG = {
  /* ---------- 品牌 / 标题 ---------- */
  brand: {
    name: 'Amoyba的小屋',          // 主标题
    subtitle: '(╹ڡ╹ )',  // 副标题（会转成大写小字间距）
    logo: '🍟',                  // 想用图片就把下面 logoImage 填上，会覆盖这里
    logoImage: '',               // 例如 'assets/img/logo.svg'
    homeUrl: 'index.html',       // 点 logo 去哪
  },

  /* ---------- 侧边栏底部那张小卡片 ---------- */
  sidebarCard: {
    emoji: '✦',
    title: '关于本站',
    subtitle: '记录与收藏',
    href: 'index.html',          // 留空 '' 就变成不可点击的纯展示卡片
  },

  /* ---------- 左侧导航 ---------- */
  /* icon 名字见 assets/js/app.js 里的 ICONS；也可以直接写 emoji，例如 icon: '🖼' */
  nav: [
    { id: 'home',     label: '首页',   en: 'HOME',     icon: 'home',     href: 'index.html',    title: '首页',   desc: '欢迎回来' },
    { id: 'wall',     label: '图墙',   en: 'GALLERY',  icon: 'image',    href: 'wall.html',     title: '图墙',   desc: '所有图片都在这里' },
    { id: 'upload',   label: '上传',   en: 'UPLOAD',   icon: 'upload',   href: 'upload.html',   title: '上传',   desc: '把新图片放进图墙' },
    { id: 'settings', label: '设置',   en: 'SETTINGS', icon: 'settings', href: 'settings.html', title: '设置',   desc: '按你的习惯调整一切' },
    /* 想加页面？复制一行，再复制 index.html 改名即可，例如：
     * { id: 'music', label: '音乐', en: 'MUSIC', icon: 'music', href: 'music.html', title: '音乐', desc: '我的歌单' },
     */
  ],

  /* ---------- 顶栏右侧按钮（href 留空则只是装饰） ---------- */
  topbarActions: [
    { label: 'GitHub', icon: 'github', href: 'https://github.com/' },
    { label: '邮箱',   icon: 'mail',   href: 'mailto:you@example.com' },
  ],
  /* 顶栏搜索框：不想显示就设为 false */
  showSearch: true,
  searchPlaceholder: '搜索图墙 / 标签 / 描述…',

  /* ---------- 底部工具条 / 页脚 ---------- */
  footer: {
    text: '© 2026 Amoyba的小屋',
    note: '奇思妙想，天马行空的产物',
    social: [
      { label: 'GitHub',   icon: 'github',   href: 'https://github.com/bwzydslm' },
      { label: 'Instagram', icon: 'instagram', href: '#' },
      { label: 'Bilibili', icon: 'bilibili', href: 'https://space.bilibili.com/1155182580?spm_id_from=333.1007.0.0' },
      { label: '邮箱',     icon: 'mail',     href: 'mailto:you@example.com' },
    ],
  },

  /* ---------- 主题 ---------- */
  theme: {
    accent: '#a78bfa',   // 主强调色（按钮、开关、选中态）
    accent2: '#7c5cf0',  // 渐变副色
    defaultMode: 'auto', // 'dark' | 'light' | 'auto'（auto = 白天浅色、夜晚深色）
    defaultCollapsed: false, // 侧边栏默认是否收起
  },

  /* ---------- 接口地址（可选） ----------
   * Cloudflare Pages 是纯静态托管，不能直接接收文件上传。
   * 以后想真的能上传，可以把文件传到 R2 / 图床 / 自己的 API，再在这里填地址。
   */
  api: {
    uploadEndpoint: '',   // 例如 'https://api.example.com/upload'
    galleryEndpoint: '',  // 例如 'https://api.example.com/images'
    headers: {},          // 例如 { Authorization: 'Bearer xxx' }
  },

  /* ---------- 首页可编辑的小文案 ---------- */
  home: {
    heroTitle: '这里是Bw_slime的个人空间',
    heroText: '你好 陌生人 很高兴你能访问我的web 你可以看看图片，听听音乐，希望你能在我的小世界玩得开心',
    stats: [
      { label: '图片总数', value: '0', unit: '张' },
      { label: '占用空间', value: '0', unit: 'MB' },
      { label: '最近更新', value: '—', unit: '' },
    ],
    quickLinks: [
      { label: '去看图墙', href: 'wall.html', icon: 'image' },
      { label: '上传新图片', href: 'upload.html', icon: 'upload' },
      { label: '调整设置', href: 'settings.html', icon: 'settings' },
    ],

    /* ---------- 随手记 / 公告 ----------
     * 这里只是「默认文案」：一旦你在网站上点「编辑」保存过，
     * 内容就会存到 D1 数据库，以云端那份为准（本机没配口令时存浏览器本地）。
     */
    editable: true,          // true = 谁都能看到编辑键（方便你现在就试）；'owner' = 只有配了口令的浏览器能看到；false = 不显示
    notice: {
      title: '随手记 / 公告',
      lines: [
        '这是一个留白的卡片。你可以把它改成「关于我」「近况」「正在做的事」……',
        '配好 D1 之后，直接点右上角「编辑」就能在线改这段文字。',
      ],
      tags: ['标签示例', '相册', '日常'],
    },
  },
};
