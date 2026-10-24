<script setup>
/* 顶栏。标题/副标题取自当前路由的 meta，结构与原 renderTopbar() 一致。 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import config from '../config'
import AppIcon from './AppIcon.vue'
import { Store } from '../lib/store'

const route = useRoute()
const router = useRouter()
const keyword = ref('')

const title = computed(() => route.meta.title || config.brand.name)
const desc = computed(() => route.meta.desc || '')

function toggleSidebar() {
  if (window.matchMedia('(max-width: 900px)').matches) {
    document.body.classList.toggle('drawer-open')
    return
  }
  const next = !document.documentElement.classList.contains('sidebar-collapsed')
  document.documentElement.classList.toggle('sidebar-collapsed', next)
  Store.set('ui.sidebarCollapsed', next)
}

function onSearch() {
  const q = keyword.value.trim()
  if (!q) return
  router.push({ path: '/wall', query: { q } })
}
</script>

<template>
  <header class="topbar" id="topbar">
    <button class="icon-btn topbar__burger" type="button" title="菜单" @click="toggleSidebar">
      <AppIcon name="menu" :size="18" />
    </button>

    <div class="topbar__title">
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-desc">{{ desc }}</p>
    </div>

    <div class="topbar__right">
      <label v-if="config.showSearch" class="search">
        <AppIcon name="search" :size="16" />
        <input
          v-model="keyword"
          type="search"
          :placeholder="config.searchPlaceholder"
          @keydown.enter="onSearch"
        >
      </label>

      <template v-for="a in config.topbarActions" :key="a.label">
        <a
          v-if="a.href"
          class="icon-btn"
          :href="a.href"
          target="_blank"
          rel="noopener"
          :title="a.label"
        >
          <AppIcon :name="a.icon" :size="17" />
        </a>
        <button v-else class="icon-btn" type="button" :title="a.label">
          <AppIcon :name="a.icon" :size="17" />
        </button>
      </template>
    </div>
  </header>
</template>
