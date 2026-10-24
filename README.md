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
```

---

## 说明

- 设置存在浏览器 `localStorage`，设置页可导出 / 导入 / 恢复默认
- 后端不可用时页面自动回退到本地数据，不会白屏
- 写操作由 `SITE_TOKEN` 保护，没配置时一律拒绝
- `Ctrl + B` 收起侧栏；灯箱支持滚轮缩放和拖动
