<script setup>
/* 页脚。结构与原 renderFooter() 一致。 */
import config from '../config'
import AppIcon from './AppIcon.vue'

const f = config.footer
</script>

<template>
  <footer class="footer" id="footer">
    <div class="footer__left">
      <span>{{ f.text || '' }}</span>
      <span v-if="f.note" class="footer__note">· {{ f.note }}</span>
    </div>
    <div class="footer__right">
      <a
        v-for="s in f.social || []"
        :key="s.label"
        class="icon-btn icon-btn--sm"
        :href="s.href"
        target="_blank"
        rel="noopener"
        :title="s.label"
      >
        <AppIcon :name="s.icon" :size="16" />
      </a>
    </div>
  </footer>
</template>
