# Amoyba的小屋

个人网站：首页、图墙、音乐、上传、设置。

技术栈：**Vite + Vue 3**（单页应用）+ **Cloudflare Pages Functions + D1 + R2**。

---

## 本地开发

需要 Node.js 20+。

```bash
npm install
npm run dev        # → http://127.0.0.1:5173/
```

Windows 上也可以双击 `preview.bat`。

`vite.config.js` 把 `/api` 代理到了线上，本地接口是通的。

```bash
npm run build      # → dist/
npm run preview    # 预览构建产物
```

---

## 部署

Cloudflare Pages：

| 项 | 值 |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |

`git push` 后自动构建部署。D1 / R2 的绑定和建表步骤见 [docs/cloudflare-d1-r2.md](docs/cloudflare-d1-r2.md)。

---

## 改内容

| 想改什么 | 改哪里 |
| --- | --- |
| 站名、导航、页脚、主题、首页文案 | `src/config.js` |
| 页面 | `src/views/*.vue` |
| 侧栏、顶栏、页脚 | `src/components/` |
| 配色、圆角、间距 | `src/style.css` 顶部的 `:root` 变量 |
| 音乐歌单 | `public/music/playlist.json` |
| 网易云在线曲库 | 本地 `server/netease-proxy.mjs`；线上 `ne-relay/`（独立 Pages 项目，见下方） |

加页面：建 `src/views/Xxx.vue` → `src/router.js` 加一条路由 → `src/config.js` 的 `nav` 加一项。

---

## 目录

```
src/
├─ main.js / router.js / config.js
├─ App.vue              外壳：侧栏 + 顶栏 + 路由出口 + 页脚
├─ components/          导航、搜索条、侧栏播放器、灯箱…
├─ lib/                 api / store / theme / music / prefs
├─ views/               首页、图墙、音乐、上传、设置
└─ style.css

public/                 _headers、_redirects、_routes.json、assets、music
functions/              后端 API（Pages Functions）
server/                 本地开发用：网易云中转（仅本机跑，不部署）
ne-relay/               线上用的网易云中转（独立 Pages 项目，不进本仓库）
```

---

## 网易云在线曲库

音乐页的搜索框可以直接搜网易云曲库。网易云的接口不允许浏览器跨域，播放地址又是
20 分钟就过期的临时直链，必须每次现取，所以要有一层中转。中转有两份实现，接口完全一致：

| 场景 | 跑在哪 | 地址 | 怎么起 |
| --- | --- | --- | --- |
| 本地开发 | 本机 Node 进程 | `/ne/*`（vite 代理到 `127.0.0.1:8787`） | `npm run relay` |
| 线上 | Cloudflare 边缘（Pages Functions） | `https://wyydl.pages.dev/api/*` | 见 `ne-relay/README.md` |

`preview.bat` 已经把「起中转 + 起 dev server」一起做了。

线上地址由构建时的 `VITE_RELAY_BASE` 决定，没配就回落到 `https://wyydl.pages.dev`：

```bash
VITE_RELAY_BASE=https://wyydl.pages.dev npm run build
```

几个要点：

- **中转不可用也不影响用**。前端会先 `ping` 一次，探不到就把搜索退回成本地歌单过滤，
  在线曲目一律不出现，不会报错也不会卡住。
- **地址时效**：直链按接口给的 `expi` 打七折缓存；万一播到一半 403，会自动换一条重试，
  最多两次。
- **线上取不到直链怎么办**：网易云取直链的接口会按出口 IP 判地域，Cloudflare 边缘
  全在境外，所以线上这条必然失败。中转里做了三级兜底（官方 v1 → 官方老接口 →
  第三方 Meting 镜像），前端还有最后一层：中转彻底不可用就把 `<audio src>` 直接指向
  镜像地址，由镜像 302 到网易云 CDN。镜像地址列表见 `src/lib/online.js` 的
  `METING_FALLBACKS`，中转侧在 `ne-relay/functions/_lib/meting.js`。
- **CSP**：`public/_headers` 里 `connect-src` 放行了中转域名，`media-src` / `img-src`
  放行了 `*.music.126.net` 和两个 meting 镜像（音频和封面都从网易云 CDN 直接取，
  不经过中转）。**改了镜像域名要同步改这里**，否则表现为「歌能搜到、点了没声音」。
- `ne-relay/` 在 `.gitignore` 里，是独立项目，不并进本仓库。
- 仅供个人自用，别把中转当成公开 API 分发。

---

## 说明

- 设置存在浏览器 `localStorage`，设置页可导出 / 导入 / 恢复默认
- 后端不可用时页面自动回退到本地数据，不会白屏
- 写操作由 `SITE_TOKEN` 保护，没配置时一律拒绝
- `Ctrl + B` 收起侧栏；灯箱支持滚轮缩放和拖动
