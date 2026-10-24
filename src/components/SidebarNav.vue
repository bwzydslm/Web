<script setup>
/* 左侧导航。DOM 结构与原 app.js 的 renderSidebar() 逐类名对齐，CSS 不用改。 */
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import config from '../config'
import AppIcon from './AppIcon.vue'
import SidebarPlayer from './SidebarPlayer.vue'
import { Store } from '../lib/store'
import { activeTheme, toggleTheme } from '../lib/theme'

const route = useRoute()

const brand = config.brand
const socials = (config.footer.social || []).slice(0, 3)

const activeNav = computed(() => route.meta.nav || 'home')

function isFeatureOff(id) {
  const f = config.features || {}
  return Object.prototype.hasOwnProperty.call(f, id) && f[id] === false
}

function collapse() {
  if (window.matchMedia('(max-width: 900px)').matches) {
    document.body.classList.remove('drawer-open')
    return
  }
  const next = !document.documentElement.classList.contains('sidebar-collapsed')
  document.documentElement.classList.toggle('sidebar-collapsed', next)
  Store.set('ui.sidebarCollapsed', next)
}
</script>

<template>
  <aside class="sidebar" id="sidebar">
    <div class="sidebar__head">
      <RouterLink class="brand" :to="brand.homeUrl">
        <img v-if="brand.logoImage" class="brand__img" :src="brand.logoImage" alt="logo">
        <span v-else class="brand__logo">{{ brand.logo || '◆' }}</span>
        <span class="brand__text">
          <span class="brand__name">{{ brand.name }}</span>
          <span class="brand__sub">{{ brand.subtitle || '' }}</span>
        </span>
      </RouterLink>

      <button
        class="icon-btn sidebar__collapse"
        type="button"
        title="收起 / 展开侧边栏"
        @click="collapse"
      >
        <AppIcon name="panel" :size="17" />
      </button>
    </div>

    <nav class="sidebar__nav">
      <RouterLink
        v-for="item in config.nav"
        :key="item.id"
        class="nav-item"
        :class="{ 'is-active': item.id === activeNav, 'is-disabled': isFeatureOff(item.id) }"
        :to="item.to"
        :title="item.label + (isFeatureOff(item.id) ? '（开发中）' : '')"
        :data-nav="item.id"
      >
        <span class="nav-item__ico"><AppIcon :name="item.icon" :size="18" /></span>
        <span class="nav-item__text">{{ item.label }}</span>
        <span class="nav-item__en">{{ item.en || '' }}</span>
        <span v-if="isFeatureOff(item.id)" class="nav-item__lock">开发中</span>
      </RouterLink>
    </nav>

    <div class="sidebar__slots">
      <SidebarPlayer />

      <div class="sidebar__tools">
        <button
          class="icon-btn"
          type="button"
          :title="activeTheme === 'dark' ? '当前深色，点击切换到浅色' : '当前浅色，点击切换到深色'"
          @click="toggleTheme"
        >
          <AppIcon :name="activeTheme === 'dark' ? 'sun' : 'moon'" :size="17" />
        </button>
        <a
          v-for="s in socials"
          :key="s.label"
          class="icon-btn"
          :href="s.href"
          target="_blank"
          rel="noopener"
          :title="s.label"
        >
          <AppIcon :name="s.icon" :size="17" />
        </a>
      </div>
    </div>
  </aside>
</template>
