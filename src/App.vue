<script setup>
/* ============================================================================
 *  App.vue —— 应用外壳
 *
 *  布局与原来的 HTML 一致：aside.sidebar + .main（topbar + router-view + footer）。
 *  SPA 的关键收益就体现在这里：切页只换 router-view，侧栏/顶栏不重建。
 * ==========================================================================*/

import { computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import SidebarNav from './components/SidebarNav.vue'
import TopBar from './components/TopBar.vue'
import SiteFooter from './components/SiteFooter.vue'
import DevLock from './components/DevLock.vue'
import config from './config'
import { applyAccent, applyMode, themePref } from './lib/theme'
import { useSetting } from './lib/prefs'
import { loadPlaylist } from './lib/music'
import { navigating, prefetchRoutes } from './router'

const route = useRoute()

/* 页脚显隐与卡片微光由设置页控制，这里消费同一份共享 ref */
const showFooter = useSetting('ui.showFooter', true)
const glow = useSetting('ui.glow', true)
watch(glow, (v) => document.documentElement.classList.toggle('no-glow', !v), { immediate: true })

/** 当前路由对应的功能是否被 features 关掉 */
const locked = computed(() => {
  const id = route.meta.nav
  const f = config.features || {}
  return !!id && Object.prototype.hasOwnProperty.call(f, id) && f[id] === false
})

const lockedLabel = computed(() => {
  const item = (config.nav || []).find((n) => n.id === route.meta.nav)
  return item ? item.label : '这个功能'
})

function closeDrawer() {
  document.body.classList.remove('drawer-open')
}

function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault()
    document.documentElement.classList.toggle('sidebar-collapsed')
  }
  if (e.key === 'Escape') closeDrawer()
}

function backToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

let autoTimer = null

onMounted(() => {
  applyAccent()
  applyMode(themePref.value)

  /* 侧栏播放器在任何页面都要有数据，所以在壳层就把歌单拉起来 */
  loadPlaylist()

  /* 首屏渲染完之后空闲预取其它路由的 chunk，减少第一次切页的等待 */
  prefetchRoutes()

  document.addEventListener('keydown', onKeydown)

  /* 「跟随时间」模式下每 10 分钟重算一次，跨过 7:00 / 19:00 会自动切换 */
  autoTimer = setInterval(() => {
    if (themePref.value === 'auto') applyMode('auto')
  }, 10 * 60 * 1000)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  if (autoTimer) clearInterval(autoTimer)
})

/* 主题偏好变了立即应用 */
watch(themePref, (v) => applyMode(v))
</script>

<template>
  <!-- 切页时的顶部进度条：懒加载 chunk 慢的时候给个反馈 -->
  <div v-if="navigating" class="nav-bar" />

  <div class="layout">
    <SidebarNav />
    <div class="sidebar-backdrop" id="sidebarBackdrop" @click="closeDrawer" />

    <div class="main">
      <TopBar />
      <main class="content">
        <RouterView v-slot="{ Component }">
          <component :is="Component" v-if="!locked" />
          <DevLock v-else :label="lockedLabel" />
        </RouterView>
      </main>
      <SiteFooter v-if="showFooter" />
    </div>
  </div>

  <button class="fab" type="button" title="回到顶部" @click="backToTop">↑</button>
</template>

<style scoped>
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 9999;
  background: var(--accent, #a78bfa);
  transform-origin: left center;
  animation: navbar 1.1s ease-in-out infinite;
  pointer-events: none;
}

@keyframes navbar {
  0%   { transform: scaleX(0);    opacity: 0.9; }
  55%  { transform: scaleX(0.65); opacity: 1; }
  100% { transform: scaleX(1);    opacity: 0.3; }
}
</style>
