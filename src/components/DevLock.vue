<script setup>
/* 「开发中」锁定面板。feature 被关掉时替代页面内容渲染。 */
import { RouterLink } from 'vue-router'

defineProps({
  label: { type: String, default: '这个功能' },
})
</script>

<template>
  <div class="dev-lock">
    <div class="dev-lock__box">
      <span class="dev-lock__badge">开发中</span>
      <h2 class="dev-lock__title">{{ label }}还没做好</h2>
      <p class="dev-lock__text">这个功能正在开发，暂时不能使用。先去首页或设置页看看吧。</p>
      <div class="dev-lock__actions">
        <RouterLink class="btn btn--primary" to="/">回到首页</RouterLink>
        <RouterLink class="btn" to="/settings">打开设置</RouterLink>
      </div>
    </div>
  </div>
</template>
