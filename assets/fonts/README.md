# 像素字体放这里

## 需要什么

一个**中文像素字体**文件，命名成：

```
assets/fonts/pixel-12px.woff2      ← 首选（体积最小，浏览器都支持）
assets/fonts/pixel-12px.ttf        ← 备选，只有在没有 woff2 时才需要
```

CSS 已经写好了（`assets/css/style.css` 末尾的「像素字体层」），**文件一放进去就自动生效**。
没放之前页面会静默退回等宽字体，只是控制台会有两条 404，不影响显示。

> 只需要其中一个文件：如果放了 `.woff2`，浏览器不会再请求 `.ttf`。

## 推荐字体（都是开源 OFL 1.1，可自由使用和自托管）

### 首选：缝合像素字体 Fusion Pixel Font
- 仓库：https://github.com/TakWolf/fusion-pixel-font
- 下载：仓库右侧 **Releases**，下载 `fusion-pixel-font-12px-proportional-zh_hans-*.zip` 之类的包
- 选哪个：
  - **12px**（不是 8px / 10px —— 8px 太小，中文糊）
  - **proportional 比例模式**（等宽模式 monospaced 的字形更僵硬，比例模式排版更好看）
  - **zh_hans**（简体中文字形）
- 字符覆盖最全，方舟像素字体作者也推荐 12px 场景先用它

### 备选：方舟像素字体 Ark Pixel Font
- 仓库：https://github.com/TakWolf/ark-pixel-font
- 下载：**Releases** → 选 `12px` + `proportional` + `zh_hans`
- 注意：作者标注「仍在积极开发，仍缺少大量字符」，可能会有个别字回退到系统字体

### 只要英文/数字的话
想省体积可以只用拉丁像素字体（几十 KB），比如 Google Fonts 的 **Silkscreen**、**Press Start 2P**、**VT323**。
但中文会全部回退成系统字体，中英混排会有割裂感，不太推荐。

## 操作步骤

1. 到 Releases 页面下载压缩包并解压
2. 在解压出来的文件里找 `.woff2` 文件（名字里通常带 `12px`、`proportional`、`zh_hans`）
3. 把它**重命名**为 `pixel-12px.woff2`，放进这个文件夹
4. 建议把字体附带的 `LICENSE-OFL` 也一起放进来（OFL 许可要求随字体分发许可证）
5. 本地刷新页面看效果 → `git add . && git commit -m "add pixel font" && git push`

## 两个必须知道的细节

**① 像素字体只清晰在 12 的整数倍尺寸上**
12px / 24px / 36px 清晰，14px、17px 会出现像素格子对不齐的糊边。
所以 `style.css` 里已经把所有字号吸附到了这几个值：
- 页面标题 24px、hero 标题 36px、统计数字 24px
- 其余界面文字统一 12px
- **正文段落**（说明文字、公告内容）故意保持系统字体，保证长文可读性

想全站都像素化：把 `style.css` 顶部 `:root` 里的 `--font-text` 改成 `var(--pixel)`（可读性会下降，自己权衡）。

**② 浏览器仍会做抗锯齿**
即使尺寸对齐，浏览器（尤其 Windows/Chrome）还是会给像素字边缘做轻微平滑，看起来不如原生点阵那么"硬"。
这是浏览器渲染机制决定的，网页端无解 —— 除非用 `<canvas>` 自己画字（不值得）。

## 体积参考

| 格式 | 大致体积 | 说明 |
| --- | --- | --- |
| `.woff2` | 1～2 MB | 推荐，gzip/brotli 后更小，Cloudflare 会自动压缩 |
| `.ttf` | 3～6 MB | 不推荐，只在拿不到 woff2 时用 |

字体文件会随仓库部署到 Cloudflare，走**同源 + 长缓存**（`_headers` 里对 `/assets/img/*` 设了长缓存，
字体不在其内；如果想给字体也加长缓存，可以在 `_headers` 里补一条 `/*.woff2`）。
