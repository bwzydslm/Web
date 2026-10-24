# 把它变成动态站点：Cloudflare D1 + R2 完整部署手册

这份手册对应仓库里的 `functions/` 目录（Pages Functions）。

前端是 **Vite + Vue 的单页应用**，部署时 Cloudflare 会先跑 `npm run build` 生成 `dist/`，
再把 `functions/` 挂上去当 API。所以流程是「改本地 → git push → Cloudflare 自动构建部署」。

---

## 0. 改造后的架构

```
浏览器（Vue 单页应用，Vite 构建）
   │  fetch('/api/...')            ← 同源，不用处理 CORS
   ▼
Pages Functions（functions/ 目录，部署后自动变成 API）
   ├─ D1（DB）  ：图片元数据：标题、标签、相册、尺寸、可见性、收藏
   └─ R2（BUCKET）：图片原文件
```

| 请求 | 谁处理 |
| --- | --- |
| `/`、`/wall`、`/upload`、`/settings`、`/assets/...` | 静态托管（不消耗 Functions 额度） |
| `/api/*` | Pages Functions |

> `/wall` 这类地址在磁盘上没有对应文件，靠 `_redirects` 重写成 `index.html` 交给前端路由。
> `_routes.json` 则负责只把 `/api/*` 交给 Functions——没有它的话，**每个静态请求都会调用一次 Function**，
> 白白消耗免费额度。
>
> 这两个文件现在放在 `public/` 里，构建后会自动落到 `dist/` 根目录，Cloudflare 从产物根目录读取它们。

---

## 1. 在面板上做的准备（只有你能点）

### 1.0 确认构建设置

SPA 需要构建，Pages 项目必须是「有构建」的配置：

| 面板项 | 值 |
| --- | --- |
| Framework preset | `None`（或 `Vite`） |
| Build command | `npm run build` |
| Build output directory | `dist` |

> 如果项目之前是「无构建、输出目录 `/`」的老配置，改完必须重新部署一次才生效。

### 1.1 启用 R2
Cloudflare 面板 → 左侧 **Storage & Databases（存储与数据库）** → **R2** → 按提示开通。
免费额度 10GB 存储，**没有流量费**。开通时 Cloudflare 通常要求先绑定一种支付方式（不会自动扣费）。

### 1.2 建一个 D1 数据库
同一个菜单 → **D1 SQL Database** → **Create** → 名字随意但要和 `wrangler.toml` 里一致。
建好后**复制它的 Database ID**（一串 UUID）。

### 1.3 建一个 R2 桶
**R2** → **Create bucket** → 名字随意。桶保持**私有**即可，我们用 Function 转发图片。

### 1.4 给 Pages 项目加绑定和口令
打开 Pages 项目：

1. **Settings → Bindings** → **Add**：
   - 选 **D1 database**，Variable name 填 **`DB`**，选中刚建的库
   - 再 **Add** 一次，选 **R2 bucket**，Variable name 填 **`BUCKET`**
2. **Settings → Variables and Secrets** → **Add**：
   - 类型选 **Secret**（加密），名字 **`SITE_TOKEN`**，值自己定一串足够长的随机字符串
   - 这个值就是你的「上传口令」，等会儿要填到网站设置页里
3. ⚠️ **绑定和变量只在「新的部署」里生效** → **Deployments** → 最新一条右侧 `⋯` → **Retry deployment**

> 绑定变量名必须严格是 `DB` 和 `BUCKET`——代码里写的是 `env.DB` / `env.BUCKET`。

### 1.5 初始化数据表
D1 页面 → 选中数据库 → **Console** → 把 `schema.sql` 的内容整个粘进去 → **Execute**。

> ⚠️ D1 控制台一次只执行一条语句。多条 SQL 一起粘只会生效第一条。

执行 `SELECT name FROM sqlite_master WHERE type='table';` 应能看到 `images` 和 `notes` 两张表。

---

## 2. 验收：按顺序点一遍

| # | 做什么 | 期望结果 |
| --- | --- | --- |
| 1 | 浏览器打开 `你的域名/api/health` | JSON 里 `db: "ok"`、`bucket: "ok"`、口令已配置 |
| 2 | 打开网站 → 设置 → **？？？** | 粘贴 `SITE_TOKEN` → 验证通过，展开私密板块 |
| 3 | 服务端 / API → **测试连接** | 提示「连接成功」 |
| 4 | 图墙页 | 顶部提示「已连接后端 · 共 0 张」 |
| 5 | 上传页选一张图 → 填标题标签 → 开始上传 | 进度条走完，提示「上传成功」 |
| 6 | 回到图墙 | 图片出现；悬停有 ★（收藏）和 ✕（删除） |
| 7 | 点 ★ | 提示已收藏，「收藏」筛选里能看到它 |
| 8 | 面板 → R2 → 桶 | 能看到 `pub/2026/xx/xxxx.webp` 这样的对象 |
| 9 | D1 → Console → `SELECT COUNT(*) FROM images;` | 数量对得上 |

---

## 3. API 一览

| 方法 | 路径 | 说明 | 需要口令 |
| --- | --- | --- | --- |
| GET | `/api/health` | 体检：绑定/口令/D1/R2 状态 | 否 |
| GET | `/api/home` | 首页一次性数据（统计 + 最近 4 张 + 公告） | 否 |
| GET | `/api/images` | 列表。参数 `q` `tag` `album` `sort=new\|old\|name` `limit` `offset` `all=1` | 否（`all=1` 需口令） |
| POST | `/api/images` | 手工登记一条元数据（文件需已在 R2） | 是 |
| GET | `/api/images/:id` | 取单条 | 私密图需要 |
| PATCH | `/api/images/:id` | 改标题/标签/相册/描述/收藏 | 是 |
| DELETE | `/api/images/:id` | 删除记录 + R2 文件 | 是 |
| POST | `/api/upload` | multipart 上传（字段 `files`，可多张） | 是 |
| GET | `/api/notes/:key` | 小文本板块（随手记 / 公告） | 读否，写是 |
| PUT | `/api/notes/:key` | 保存文本板块 | 是 |
| GET | `/api/file/*` | 从 R2 读图（公开图任何人可看） | 私密图需要 |

口令以 `Authorization: Bearer <SITE_TOKEN>` 传递。
写操作全部由 `functions/_middleware.js` 统一拦截，**没配 `SITE_TOKEN` 时一律拒绝**（安全默认值）。

> ⚠️ 图片的**可见性不可修改**：路径前缀 `pub/` / `prv/` 决定权限，改数据库字段不会动 R2 对象，
> 所以 PATCH 改 `visibility` 会返回 400。

---

## 4. 本地开发

需要 **Node.js 20+**。两种方式，按需要选。

### 4.1 只调前端（最简单）

```bash
npm run dev        # → http://127.0.0.1:5173/
```

`vite.config.js` 里已经把 `/api` 代理到了线上（`https://amoyba.pages.dev`），
所以**接口是真的通的**，能正常上传、看图、改公告。想指向别的后端就改 `server.proxy.target`。

### 4.2 连本地 Functions（要改后端时）

```bash
# 1) 把 wrangler.toml 里的 database_id 换成你自己的
# 2) 本地建表（本地 D1 是独立的模拟库）
npx wrangler d1 execute <库名> --local --file=./schema.sql

# 3) 起开发服务器（同时提供静态文件和 Functions）
npx wrangler pages dev dist --port 8788
```

> 注意 `wrangler pages dev` 现在要指向 **`dist`**（构建产物），不是项目根目录。
> 改后端前先 `npm run build`，或者在另一个终端跑 `npm run dev` 边改边建。

得到 `http://127.0.0.1:8788` 后，在设置页把 **API 地址**填成这个地址，
口令填 `wrangler.toml` 里的 `local-dev-token`，就能本地调试了。

---

## 5. 排错对照表

| 现象 | 原因 / 处理 |
| --- | --- |
| 直接访问 `/wall` 显示 404 | `_redirects` 没生效，或构建产物里缺这个文件（检查 `public/_redirects`） |
| 页面白屏、控制台 404 某个 js | `Build output directory` 没填 `dist`，或 CSS/JS 路径被 `_redirects` 全量兜底规则吞了 |
| 设置页测试连接 401 `token_not_configured` | 云端没加 `SITE_TOKEN`，或加了没重新部署 |
| 设置页测试连接 401 `unauthorized` | 口令打错；注意别带多余空格 |
| `/api/health` 里 `db: "missing_binding"` | Bindings 里没加 `DB`，或加完没 Retry deployment |
| 500 / `no such table: images` | 没执行 `schema.sql` |
| 上传 413 | 单文件超过 25MB（`functions/api/upload.js` 的 `MAX_FILE_SIZE`） |
| 图片 404 | 该图 `visibility=private` 但没带口令；或 R2 里对象已被删 |
| 图墙提示「后端未连接」 | 部署还没完成，或设置页的 API 地址填错了 |
| 上传成功但图墙没有 | 看 D1 里有没有记录；再看 `visibility` 是不是被设成了私密 |

---

## 6. 费用与限制（免费额度足够个人站）

| 资源 | 免费额度 |
| --- | --- |
| D1 | 每天 500 万行读 / 10 万行写；5GB 存储 |
| R2 | 10GB 存储；**上传下载都不收流量费** |
| Pages Functions | 每天 10 万次请求 |

注意：图片通过 `/api/file/*` 返回会消耗一次 Functions 请求。图墙一页 60 张图大约消耗 61 次请求，
所以免费额度每天大约能支撑一千多次图墙浏览 —— 个人使用完全够。
将来访问量大了，可以给 R2 绑自定义域名直连（更快、不消耗 Functions）。

---

## 7. 安全提醒

- `SITE_TOKEN` 是**唯一一把钥匙**：能上传、能删除。别提交到仓库（`wrangler.toml` 里那个只是本地占位值）。
- 口令存在浏览器 `localStorage` 里，只在 HTTPS 上传输（Cloudflare 默认开启 HTTPS）。
- 对外发布的网站建议定期更换口令：改云端环境变量 → 重新部署 → 在设置页更新。
- 想更安全可以换成 **Cloudflare Access**（邮箱/Google 登录），那是另一套配置。
- 私密图片的**文件本身**不会公开：`/api/file/*` 会检查路径前缀，不带口令一律 404。

---

## 8. 接下来还能做什么

- **音乐播放**：SPA 下 `<audio>` 挂在外壳上，切页不会中断（比多页架构省事很多）
- **相册 / 标签管理页**：`/api/images?album=` 已支持
- **D1 备份**：`npx wrangler d1 export <库名> --remote --output backup.sql`
- **访问统计**：Cloudflare Web Analytics（免费、无 Cookie）
- **R2 自定义域名**：图片直连，不再消耗 Functions 请求数
