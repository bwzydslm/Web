# 把它变成动态站点：Cloudflare D1 + R2 完整部署手册

这份手册对应本仓库新增的 `functions/` 目录（Pages Functions）。**前端仍然是静态页，只是多了一层 API**，
所以你现在「改本地 → git push → Cloudflare 自动部署」的流程完全不用变。

---

## 0. 改造后的架构

```
浏览器（index/wall/upload/settings 这些静态页）
   │  fetch('/api/...')            ← 同源，不用处理 CORS
   ▼
Pages Functions（functions/ 目录，部署后自动变成 API）
   ├─ D1（DB）  ：图片元数据：标题、标签、相册、尺寸、可见性、收藏
   └─ R2（BUCKET）：图片原文件
```

| 请求 | 谁处理 |
| --- | --- |
| `/`、`/wall.html`、`/assets/...` | 静态托管（不消耗 Functions 额度） |
| `/api/*` | Pages Functions |

> 这一点靠仓库根目录的 `_routes.json` 实现（只把 `/api/*` 交给 Functions）。
> 没有它的话，**每一个静态请求都会调用一次 Function**，白白消耗免费额度。

---

## 1. 在面板上做的准备（只有你能点）

### 1.1 启用 R2
Cloudflare 面板 → 左侧 **Storage & Databases（存储与数据库）** → **R2** → 按提示开通。
免费额度 10GB 存储，**没有流量费**。开通时 Cloudflare 通常要求先绑定一种支付方式（不会自动扣费）。

### 1.2 建一个 D1 数据库
同一个菜单 → **D1 SQL Database** → **Create** → 名字填 `izakaya-db`（随便，但要和后面 wrangler.toml 里一致）。
建好后**复制它的 Database ID**（一串 UUID），后面可能要用。

### 1.3 建一个 R2 桶
**R2** → **Create bucket** → 名字填 `izakaya-images`。桶保持**私有**即可，我们会用 Function 转发图片。

### 1.4 给 Pages 项目加绑定和口令
打开你的 Pages 项目（`Workers & Pages` → 你的项目）：

1. **Settings → Bindings** → **Add**：
   - 选 **D1 database**，Variable name 填 **`DB`**，选中 `izakaya-db`
   - 再 **Add** 一次，选 **R2 bucket**，Variable name 填 **`BUCKET`**，选中 `izakaya-images`
2. **Settings → Variables and Secrets**（有的界面叫 Environment variables）→ **Add**：
   - 类型选 **Secret**（加密），名字 **`SITE_TOKEN`**，值自己定一串足够长的随机字符串
   - 这个值就是你的「上传口令」，等会儿要填到网站设置页里
3. ⚠️ **绑定和变量只在「新的部署」里生效** → 去 **Deployments** → 最新一条右侧 `⋯` → **Retry deployment**

> 也可以顺手把 `SITE_TOKEN` 的**预览环境**也加上，这样分支预览部署同样能上传。

### 1.5 初始化数据表
D1 页面 → 选中 `izakaya-db` → **Console** 标签 → 把仓库根目录 `schema.sql` 的内容整个粘进去 → **Execute**。

执行 `SELECT name FROM sqlite_master WHERE type='table';` 应该能看到 `images` 表。

---

## 2. 验收：按顺序点一遍

| # | 做什么 | 期望结果 |
| --- | --- | --- |
| 1 | 浏览器打开 `你的域名/api/health` | JSON 里 `db: "ok"`、`bucket: "ok"`、`tokenConfigured: true` |
| 2 | 打开网站 → 设置 → **服务端 / API** | 粘贴 `SITE_TOKEN` → 保存 → **测试连接** → 提示「后端可用」 |
| 3 | 图墙页 | 顶部提示「已连接后端 · 共 0 张」 |
| 4 | 上传页选一张图 → 填标题标签 → 开始上传 | 进度条走完，提示「上传成功」 |
| 5 | 回到图墙 | 图片出现；鼠标悬停有 ★（收藏）和 ✕（删除） |
| 6 | 点 ★ | 提示已收藏，「收藏」筛选里能看到它 |
| 7 | Cloudflare 面板 → R2 → 桶 | 能看到 `2026/05/xxxx.jpg` 这样的对象 |
| 8 | D1 → Console → `SELECT COUNT(*) FROM images;` | 数量对得上 |

---

## 3. API 一览

| 方法 | 路径 | 说明 | 需要口令 |
| --- | --- | --- | --- |
| GET | `/api/health` | 体检：绑定/口令/D1/R2 状态 | 否 |
| GET | `/api/images` | 列表。参数 `q` `tag` `album` `sort=new\|old\|name` `limit` `offset` `all=1` | 否（`all=1` 需口令） |
| POST | `/api/images` | 手工登记一条元数据（文件需已在 R2） | 是 |
| GET | `/api/images/:id` | 取单条 | 私密图需要 |
| PATCH | `/api/images/:id` | 改标题/标签/相册/描述/可见性/收藏 | 是 |
| DELETE | `/api/images/:id` | 删除记录 + R2 文件 | 是 |
| POST | `/api/upload` | multipart 上传（字段 `files`，可多张） | 是 |
| GET | `/api/file/*` | 从 R2 读图（公开图任何人可看） | 私密图需要 |

口令以 `Authorization: Bearer <SITE_TOKEN>` 传递，也支持 `X-Site-Token` 头。
写操作全部由 `functions/_middleware.js` 统一拦截，**没配 `SITE_TOKEN` 时一律拒绝**（安全默认值）。

---

## 4. 本地开发（可选，需要 Node.js）

> 你这台电脑目前**没有装 Node**。不装也能开发：直接 push 到分支，用 Cloudflare 的预览部署测试。
> 想本地跑 API 再装 Node（20+）即可。

```bash
# 1) 把 wrangler.toml 里的 database_id 换成你自己的
# 2) 本地建表（本地 D1 是独立的模拟库）
npx wrangler d1 execute izakaya-db --local --file=./schema.sql

# 3) 起开发服务器（会同时提供静态文件和 Functions）
npx wrangler pages dev .
```

得到 `http://127.0.0.1:8788` 后，在网站设置页把 **API 地址**填成这个地址（口令填 wrangler.toml 里的 `local-dev-token`），就能本地调试了。

---

## 5. 排错对照表

| 现象 | 原因 / 处理 |
| --- | --- |
| 设置页测试连接 401 `token_not_configured` | 云端没加 `SITE_TOKEN` 环境变量，或加了没重新部署 |
| 设置页测试连接 401 `unauthorized` | 口令打错了；注意不要带多余空格 |
| `/api/health` 里 `db: "missing_binding"` | Bindings 里没加 `DB`，或加完没 Retry deployment |
| 500 / `no such table: images` | 没执行 `schema.sql` |
| 上传 413 | 单文件超过 25MB（`functions/api/upload.js` 里的 `MAX_FILE_SIZE`） |
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
- 想更安全可以把口令换成 **Cloudflare Access**（邮箱/Google 登录），那属于另一套配置，需要时再说。
- 私密图片的**文件本身**不会公开：`/api/file/*` 会检查 D1 里的 `visibility`，不带口令一律 404。

---

## 8. 接下来还能做什么

- **图片压缩**：上传前用浏览器 canvas 压一道（上传页已有「压缩质量」滑块的位置，接上即可）
- **相册 / 标签管理页**：`/api/images?album=` 已支持，加个页面就能按相册浏览
- **D1 备份**：`npx wrangler d1 export izakaya-db --remote --output backup.sql`
- **访问统计**：Cloudflare Web Analytics（免费、无 Cookie）
- **换成 Workers**：Cloudflare 现在主推 Workers + 静态资源，将来想迁移再说，目前 Pages 完全够用
