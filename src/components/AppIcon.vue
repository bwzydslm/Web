<script setup>
/* 内联 SVG 图标。name 命中 ICONS 就画矢量图，否则把 name 原样渲染成 emoji 文字。 */
import { computed } from 'vue'
import { ICONS } from '../lib/icons'

const props = defineProps({
  name: { type: String, default: '' },
  size: { type: Number, default: 18 },
})

const path = computed(() => ICONS[props.name])
</script>

<template>
  <svg
    v-if="path"
    class="ico"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="path"
  />
  <span v-else class="ico-emoji" :style="{ fontSize: size + 'px' }">{{ name || '•' }}</span>
</template>
