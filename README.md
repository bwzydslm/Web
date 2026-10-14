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
├── .gitignore
└── assets/
    ├── css/style.css     # 全部样式，配色变量在最上面
    ├── js/
    │   ├── site.config.js   ★ 你主要改这个文件：站名、导航、页脚、接口
    │   ├── app.js           公共逻辑：侧边栏 / 顶栏 / 页脚渲染、主题、存储
    │   ├── page-home.js     首页逻辑
    │   ├── page-wall.js     图墙逻辑（DEMO_ITEMS 在这里登记图片）
    │   ├── page-upload.js   上传逻辑
    │   └── page-settings.js 设置逻辑
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

## 五、让「上传」真正生效

Cloudflare Pages 只能托管静态文件，**没有后端，接不了上传**。三种做法：

1. **最简单（推荐给学生）**：本地把图片放进 `assets/img/`，`git push`，站点自动更新。上传页就当预览工具用。
2. **对象存储 / 图床**：图片传到 Cloudflare R2、S3、SM.MS 等，拿到外链；把地址填进 `site.config.js` 的 `api.uploadEndpoint`，再在 `assets/js/page-upload.js` 里把 `TODO` 那段换成真正的 `fetch`。
3. **Pages Functions + R2**：在仓库根目录建 `functions/upload.js`，写一个服务端函数接收文件并写进 R2（Pages 会自动把它当 API 路由 `/upload`），前端再把文件 POST 过去。需要开 R2 并配置密钥。

## 六、常用小技巧

- `Ctrl + B` 收起 / 展开侧边栏（手机端点左上角菜单按钮）
- 图片墙支持 `wall.html?q=关键词` 直接搜索
- 所有设置存在浏览器 `localStorage`，设置页可以导出 / 导入 / 恢复默认
- 想换浅色主题：设置页第一项，或者改 `site.config.js` 的 `theme.defaultMode`
- 推送后页面没变化：先 `Ctrl + F5` 强刷。`_headers` 已把 html/css/js 设为不缓存、图片长缓存，正常情况下刷新即是新版

## 七、自检脚本（可选）

改完代码想确认没写坏，在项目根目录跑一次（需要电脑上有 Python）：

```bash
python _check.py
```

它会检查：JS 括号是否闭合、HTML 里的元素 id 有没有被 JS 引用错、页面引用的本地文件是否存在、HTML 标签是否闭合。
纯静态站点不需要它也能跑，删掉这个文件也不影响部署。

## 八、接下来可以加的东西

- 关于我 / 友链 / 音乐 / 日记页面：复制 `index.html` 改名，在 `site.config.js` 的 `nav` 里加一项就能出现在侧边栏
- 评论、访问统计：Cloudflare Web Analytics（免费、无 Cookie）或 Umami
- 自动生成图墙：用 GitHub Actions 扫描 `assets/img/` 生成 JSON，前端读取
