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
