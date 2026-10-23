# 个人网站 · Cloudflare Pages + GitHub

一个纯静态（零构建、零依赖）的个人站点骨架：左侧可折叠侧边栏 + 首页 / 图墙 / 上传 / 设置四个页面。
深紫暗色调，配色与结构参考了你给的截图。

```
.
├── index.html            # 首页：主视觉、统计、最近更新、自由内容区
├── wall.html             # 图墙：瀑布流 + 筛选排序 + 灯箱
├── upload.html           # 上传：拖拽区 + 队列 + 图片信息表单
├── settings.html         # 设置：外观 / 图墙 / 上传 / 其他 / 数据管理
├── 404.html              # 找不到页面时的兜底页
├── _headers              # Cloudflare Pages 响应头（缓存、安全头）
├── _redirects            # Cloudflare Pages 重定向规则
├── robots.txt            # 爬虫规则（私人站点可改成全禁）
├── _check.py             # 可选自检脚本：python _check.py
├── _routes.json          # 只让 /api/* 走 Functions，静态请求不消耗额度
├── schema.sql            # D1 建表语句（在 D1 控制台执行一次）
├── wrangler.toml         # 本地开发用的绑定配置（不影响线上）
├── .gitignore
├── functions/            # ★ 后端 API（Pages Functions，部署后自动生效）
│   ├── _middleware.js          口令校验 + 统一响应头
│   └── api/
│       ├── health.js           体检接口 /api/health
│       ├── upload.js           上传：文件进 R2、元数据进 D1
│       ├── images/index.js     列表 / 登记
│       ├── images/[id].js      单条查询 / 修改 / 删除
│       ├── file/[[key]].js     从 R2 读图
│       └── auth/check.js       口令校验
├── docs/cloudflare-d1-r2.md   # ★ D1 + R2 部署手册
└── assets/
    ├── css/style.css     # 全部样式，配色变量在最上面
    ├── js/
    │   ├── site.config.js   ★ 你主要改这个文件：站名、导航、页脚（末尾还有首帧初始化）
    │   ├── app.js           公共逻辑：侧边栏 / 顶栏 / 页脚渲染、主题、存储
    │   ├── api.js           前端访问后端 API 的唯一出口
    │   ├── page-home.js     首页逻辑
    │   ├── page-wall.js     图墙逻辑（DEMO_ITEMS 在这里登记图片）
    │   ├── page-upload.js   上传逻辑
    │   └── page-settings.js 设置逻辑
    ├── fonts/            # 像素字体放这里（下载方式见该目录 README.md）
    └── img/              # 把你的图片放这里
```

## 一、本地预览

不需要任何构建工具，直接双击 `index.html` 就能看。

**Windows 用户最省事：双击 `preview.bat`**，它会自动切到项目根目录并起一个本地服务器，浏览器打开 `http://127.0.0.1:5173/`。
（用编辑器自带的预览面板有时会报 `Forbidden`，那是预览工具把目录/路径解析错了，跟本站代码无关。）

更推荐起一个小服务（避免某些浏览器对 `file://` 的限制）：

```bash
# 任选一种
python -m http.server 5173        # 然后打开 http://localhost:5173
npx serve .                       # 或者
```

## 二、推送到 GitHub

```bash
cd 这个文件夹
git init
git add .
git commit -m "init: personal site"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

## 三、接到 Cloudflare Pages

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → 左侧 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 授权 GitHub，选中刚才的仓库
3. 构建设置照这个填（纯静态，不需要构建）：

   | 项目 | 值 |
   | --- | --- |
   | Framework preset | `None` |
   | Build command | 留空 |
   | Build output directory | `/`（或留空） |

4. **Save and Deploy**，一两分钟后会给你一个 `xxx.pages.dev` 的地址
5. 以后每次 `git push`，Cloudflare 都会自动重新部署

### 绑自己的域名（可选）
Pages 项目 → **Custom domains** → **Set up a custom domain** → 输入域名 → 按提示在 DNS 里加记录即可。域名在 Cloudflare 托管的话会自动配好，HTTPS 也免费。

## 四、日常怎么填内容

| 想改什么 | 改哪里 |
| --- | --- |
| 站点名、副标题、Logo、导航项、页脚、社交链接 | `assets/js/site.config.js` |
| 图片墙上挂图片 | 图片丢进 `assets/img/`，在 `assets/js/page-wall.js` 的 `DEMO_ITEMS` 里加一行 |
| 首页文案、统计、快捷入口 | `index.html` 的文字，或 `site.config.js` 的 `home` 段 |
| 配色、圆角、间距 | `assets/css/style.css` 顶部的 `:root` 变量（也可以直接在设置页改强调色） |
| 设置页加一条新选项 | 在 `settings.html` 复制一个 `.row`，控件加上 `data-setting="你的键名"` 即可自动存读 |

## 五、让它变成动态站点（D1 + R2）

本仓库已经内置了基于 **Pages Functions + D1 + R2** 的后端：

- **上传**：文件存 R2，元数据（标题 / 标签 / 相册 / 尺寸 / 可见性）存 D1
- **图墙**：数据来自 `/api/images`，支持搜索、排序、收藏、删除
- **权限**：写操作靠一个 `SITE_TOKEN` 口令保护，**没配置时一律拒绝**（安全默认值）
- **兜底**：后端不可用时页面自动回退到浏览器本地数据，不会白屏

部署步骤（面板怎么点、怎么验收、怎么排错）见 → [`docs/cloudflare-d1-r2.md`](docs/cloudflare-d1-r2.md)

不想用后端也完全可以：图片放进 `assets/img/`，在 `assets/js/page-wall.js` 的 `DEMO_ITEMS` 里登记，就是原来的纯静态用法。

## 六、常用小技巧

- `Ctrl + B` 收起 / 展开侧边栏（手机端点左上角菜单按钮）
- 图片墙支持 `wall.html?q=关键词` 直接搜索
- 所有设置存在浏览器 `localStorage`，设置页可以导出 / 导入 / 恢复默认
- 想换浅色主题：设置页第一项，或者改 `site.config.js` 的 `theme.defaultMode`
- 推送后页面没变化：先 `Ctrl + F5` 强刷。`_headers` 已把 html/css/js 设为不缓存、图片长缓存，正常情况下刷新即是新版
- 想临时关掉某个页面（功能还没做完时很实用）：在 `site.config.js` 的 `features` 里把它设为 `false`，例如 `features: { wall: false }` —— 该页会变成「开发中」：内容模糊锁定、鼠标和键盘都操作不了、接口也不会被请求。改回 `true` 立刻恢复
- 上传会自动压缩：浏览器端用 canvas 把最长边缩到 1600px、转成 WebP（GIF/SVG 跳过，压完更大则保留原图），质量由上传页的「压缩质量」滑块控制，通常能小 5～10 倍
- 图片路径带可见性前缀：新图是 `pub/…` 或 `prv/…`，读取时**不查数据库**；公开图还会进 Cloudflare 边缘缓存，同一节点第二次打开几乎瞬时

## 七、安全与隐私

**已经做到的**

- **口令校验在后端**：上传、删除、改公告等所有写操作都由 `functions/_middleware.js` 校验 `SITE_TOKEN`，**没配口令时一律拒绝**（fail closed）
- **CSP + 安全头**：`_headers` 里设了 `Content-Security-Policy`（只允许加载本站脚本，禁掉内联脚本和外部脚本）、`nosniff`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`
- **设置页的敏感板块要验证才显示**：「服务端 / API」和「数据管理」藏在一个「？？？」卡片后面，输入 `SITE_TOKEN` 并通过**后端**验证才展开；解锁状态只存在 `sessionStorage`，关掉标签页就失效
- **口令不会外泄到导出文件**：设置页的「导出设置」和「数据统计」会把 token 打码成 `***`
- **`/api/health` 对外只给粗粒度状态**（正常 / 异常 / 未配置），详细错误要带口令请求才看得到
- **私密图片走服务端把关**：`prv/` 开头的文件必须带口令，其他人一律 404

**你需要知道的**

- ⚠️ **前端隐藏 ≠ 权限控制**。设置页那道口令门只是"藏起来"，真正拦住越权的是后端校验。会开 DevTools 的人能看到页面结构，但**看不到你的口令** —— 它只存在你自己的浏览器里，不会随网页发出去。
- ⚠️ **仓库里的一切都能通过网址直接下载**：`README.md`、`docs/`、`schema.sql`、`_check.py`、`preview.bat`。里面没有任何密码，但会暴露站点架构。介意的话把这些开发文件挪到私有分支/仓库，线上只留 `*.html` + `assets/` + `functions/`。目前给它们加了 `X-Robots-Tag: noindex`，至少不会被搜索引擎收录。
- ⚠️ **别把真实邮箱写进 `site.config.js`**：那是公开文件，会被爬虫抓走。页脚的 `mailto:you@example.com` 是占位符，记得别换成真邮箱（或换成表单/图片）。
- ⚠️ **口令别写进 `wrangler.toml`**：仓库是公开的。本地开发用 `.dev.vars`（已被 `.gitignore` 忽略），线上用 Cloudflare 面板的 Secret。
- ℹ️ `wrangler.toml` 里的 `database_id` **不是凭证**，公开它不能访问你的数据库，留着没事。

## 八、自检脚本（可选）

改完代码想确认没写坏，在项目根目录跑一次（需要电脑上有 Python）：

```bash
python _check.py
```

它会检查：JS 括号是否闭合、HTML 里的元素 id 有没有被 JS 引用错、页面引用的本地文件是否存在、HTML 标签是否闭合。
纯静态站点不需要它也能跑，删掉这个文件也不影响部署。

## 九、接下来可以加的东西

- 关于我 / 友链 / 音乐 / 日记页面：复制 `index.html` 改名，在 `site.config.js` 的 `nav` 里加一项就能出现在侧边栏
- 评论、访问统计：Cloudflare Web Analytics（免费、无 Cookie）或 Umami
- 自动生成图墙：用 GitHub Actions 扫描 `assets/img/` 生成 JSON，前端读取
