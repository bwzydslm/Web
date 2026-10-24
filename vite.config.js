import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],

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
    },
  },
})
