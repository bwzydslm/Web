import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

/* ============================================================================
 * inlineBootTheme —— 把首帧脚本内联进 HTML（构建期完成）
 *
 * 为什么：这个脚本必须同步执行在首帧之前（否则会闪主题）。
 *   以前它是 <script src="/assets/js/boot-theme.js">，浏览器得再向服务器
 *   要一次这个 2.8KB 的小文件才能继续往下解析。服务器在 LAX，
 *   跨境一个往返 250ms 起步、丢包时更糟，而 <body> 里的入口 JS/CSS
 *   本来可以更早开始下载。内联后 HTML 一个往返就装齐首帧所需的一切。
 *
 * 安全：CSP 不妥协。仍然没有 'unsafe-inline'，
 *   而是把这份脚本的 sha256 精确写进 script-src。
 *   hash 构建时算出，public/_headers 里留 __BOOT_THEME_HASH__ 占位，
 *   构建结束前替换；占位缺失会直接让构建失败，
 *   避免上线一份「CSP 把首帧脚本拦掉」的产物。
 * ==========================================================================*/
function inlineBootTheme() {
  const bootPath = fileURLToPath(new URL('./src/boot-theme.js', import.meta.url))
  const PLACEHOLDER = '__BOOT_THEME_HASH__'
  let integrity = ''

  return {
    name: 'inline-boot-theme',
    enforce: 'pre',

    /* dev 与 build 都会走这里：把外链标签换成内联内容 */
    transformIndexHtml(html) {
      const code = readFileSync(bootPath, 'utf8')
      integrity = 'sha256-' + createHash('sha256').update(code).digest('base64')
      const tag = /<script src="\/assets\/js\/boot-theme\.js"><\/script>/
      if (!tag.test(html)) {
        throw new Error('[inline-boot-theme] index.html 里找不到 boot-theme 外链标签，内联失败')
      }
      return html.replace(tag, `<script>${code}</script>`)
    },

    /* 产物落盘后，把真实 hash 写进 _headers 的 CSP，并回头校验一遍 */
    writeBundle(options) {
      const outDir = options.dir || 'dist'
      const headersPath = `${outDir}/_headers`
      const htmlPath = `${outDir}/index.html`

      if (!existsSync(headersPath)) {
        throw new Error(`[inline-boot-theme] 没找到 ${headersPath}，无法写入 CSP hash`)
      }
      const raw = readFileSync(headersPath, 'utf8')
      if (!raw.includes(PLACEHOLDER)) {
        throw new Error(`[inline-boot-theme] _headers 缺少 ${PLACEHOLDER} 占位，CSP 会拦掉内联脚本`)
      }
      writeFileSync(headersPath, raw.replaceAll(PLACEHOLDER, integrity), 'utf8')

      /* ★ 自校验：从最终产物里把内联脚本抠出来重算 hash。
         只要后续构建步骤动过这段内容（哪怕一个空格），这里就会失败，
         不会让站点带着一份对不上的 CSP 上线 —— 那种故障表现是
         「主题闪一下 + 控制台 CSP 报错」，很难一眼定位。 */
      const html = readFileSync(htmlPath, 'utf8')
      const m = html.match(/<script>([\s\S]*?)<\/script>/)
      if (!m) throw new Error('[inline-boot-theme] 产物 index.html 里没有内联脚本，内联没生效')
      const actual = 'sha256-' + createHash('sha256').update(m[1]).digest('base64')
      if (actual !== integrity) {
        throw new Error(
          `[inline-boot-theme] 产物中的内联脚本与 CSP hash 不一致\n` +
          `  期望 ${integrity}\n  实际 ${actual}\n` +
          `  多半是某个构建步骤改写了 <script> 的内容`
        )
      }

      console.log(`[inline-boot-theme] 内联完成，CSP script-src 已写入并校验通过：${integrity}`)
    },
  }
}

export default defineConfig({
  plugins: [inlineBootTheme(), vue()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 图墙/上传/设置的逻辑都不算大，但拆开能让首屏只加载首页那份
    chunkSizeWarningLimit: 700,
  },

  server: {
    port: 5173,
    host: '127.0.0.1',
    // 编辑器/工具的原子写入会在项目里留下 .xxx.tmpdir/ 之类的临时目录，
    // Windows 上对它们建 watcher 会 EBUSY 直接把 dev server 干掉。
    watch: {
      ignored: ['**/.*.tmpdir/**', '**/*.tmp', '**/dist/**', '**/node_modules/**'],
    },
    // 本地 dev 时把 /api 透给线上，省得 Functions 跑不起来就完全没法调
    proxy: {
      '/api': {
        target: 'https://amoyba.pages.dev',
        changeOrigin: true,
        secure: true,
      },
      /* 网易云本地中转（server/netease-proxy.mjs）。
         前端一律按 /ne/xxx 调，这样开发和线上是同一套代码路径；
         线上没有中转时会直接 502，前端会优雅地退回本地曲库。 */
      '/ne': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ne/, ''),
      },
    },
  },
})
