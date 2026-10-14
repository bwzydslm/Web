# 把图片放这里

- 直接拖进本文件夹即可，例如 `assets/img/1.jpg`
- 然后在 `assets/js/page-wall.js` 顶部的 `DEMO_ITEMS` 里登记：

```js
const DEMO_ITEMS = [
  { name: '夏日祭', src: 'assets/img/1.jpg', tags: ['日常'], ts: Date.parse('2026-07-01') },
  { name: '海边的傍晚', src: 'assets/img/2.jpg', tags: ['风景'], ts: Date.parse('2026-08-12') },
];
```

保存后刷新 `wall.html`，图墙就有内容了，Cloudflare Pages 也会自动部署。

> 建议：单张图片压缩到 300KB 以内，几十张图也不会拖慢加载。
