/* ============================================================================
 *  router.js —— 路由表
 *
 *  用 history 模式（URL 没有 #）。线上依赖 _redirects 里的 SPA 兜底规则，
 *  否则直接访问 /wall 会 404。
 *
 *  每个路由都动态 import，Vite 会自动切成独立 chunk —— 首屏只拉首页那份。
 * ==========================================================================*/

import { ref } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('./views/HomeView.vue'),
    meta: { title: '首页', desc: '欢迎回来', nav: 'home' },
  },
  {
    path: '/wall',
    name: 'wall',
    component: () => import('./views/WallView.vue'),
    meta: { title: '图墙', desc: '所有图片都在这里', nav: 'wall' },
  },
  {
    path: '/music',
    name: 'music',
    component: () => import('./views/MusicView.vue'),
    meta: { title: '音乐', desc: '我的歌单', nav: 'music' },
  },
  {
    path: '/upload',
    name: 'upload',
    component: () => import('./views/UploadView.vue'),
    meta: { title: '上传', desc: '把新图片放进图墙', nav: 'upload' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('./views/SettingsView.vue'),
    meta: { title: '设置', desc: '按你的习惯调整一切', nav: 'settings' },
  },

  /* ---- 老地址兼容：以前是 wall.html 这种，别让旧书签 404 ---- */
  { path: '/index.html', redirect: '/' },
  { path: '/wall.html', redirect: (to) => ({ path: '/wall', query: to.query }) },
  { path: '/upload.html', redirect: '/upload' },
  { path: '/settings.html', redirect: '/settings' },

  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, saved) {
    if (saved) return saved
    return { top: 0 }
  },
})

/* 懒加载的 chunk 在这条线路上要等好几秒，给用户一个「正在切换」的反馈，
   否则点了没反应会以为卡死。 */
export const navigating = ref(false)

router.beforeEach(() => {
  navigating.value = true
})
router.afterEach(() => {
  navigating.value = false
})
router.onError(() => {
  navigating.value = false
})

export default router

/* ============================================================================
 *  prefetchRoutes —— 空闲时把各路由的 chunk 提前拉下来
 *
 *  为什么要这个：这台部署的线路延迟很高（实测单个 10KB chunk 要 8 秒），
 *  第一次点「图墙」会卡住，因为那次才现拉 chunk。
 *  首屏渲染完就空闲加载，等用户真去点时多半已在缓存里。
 * ==========================================================================*/

export function prefetchRoutes() {
  const run = () => {
    routes.forEach((r) => {
      if (typeof r.component === 'function') {
        Promise.resolve()
          .then(() => r.component())
          .catch(() => {
            /* 预取失败无所谓，真去点时还会再拉一次 */
          })
      }
    })
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 3000 })
  } else {
    setTimeout(run, 1500)
  }
}
