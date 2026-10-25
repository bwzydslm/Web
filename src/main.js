/* ============================================================================
 *  main.js —— 应用入口
 *
 *  style.css 通过 import 引入，Vite 会把它抽成 /assets/index-<hash>.css：
 *  文件名随内容变化，所以可以永久缓存，也**永远不会读到旧样式**。
 *  （之前它放在 public/ 里、文件名固定，靠 max-age 缓存，刷新时会先画旧的。）
 * ==========================================================================*/

import './style.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')

/* ----------------------------------------------------------------------------
 *  MiSans 字体切片表（56 条 @font-face，gzip 约 29KB）
 *
 *  刻意不并进主样式：它全是 @font-face 声明，不参与首屏布局计算，
 *  放进去只会让关键 CSS 白白变大一截、拖慢首帧。
 *  这里改为挂载后按空闲时间异步加载 —— 字体晚到，文字只是从系统字体
 *  换成 MiSans（@font-face 里是 font-display: swap），不会出现空白期。
 *  加载失败就静默保持系统字体，用户感知不到异常。
 * -------------------------------------------------------------------------- */
const loadFonts = () => import('./fonts/misans-vf.css').catch(() => {})
if ('requestIdleCallback' in window) requestIdleCallback(loadFonts, { timeout: 2000 })
else setTimeout(loadFonts, 200)
