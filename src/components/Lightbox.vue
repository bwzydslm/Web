<script setup>
/* ============================================================================
 *  Lightbox.vue —— 图片灯箱（从 page-wall.js 后半段搬过来）
 *
 *  交互：
 *    滚轮 / 双指捏合 → 以指针为中心缩放
 *    放大后拖动      → 平移
 *    双击            → 2.5 倍 / 还原
 *    底部 − 100% +   → 按钮缩放，点百分比还原
 *    键盘 + - 0 Esc  → 放大 / 缩小 / 还原 / 关闭
 * ==========================================================================*/

import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { Store } from '../lib/store'

const props = defineProps({
  open: { type: Boolean, default: false },
  src: { type: String, default: '' },
  caption: { type: String, default: '' },
})
const emit = defineEmits(['close'])

const MIN_SCALE = 0.5
const MAX_SCALE = 6

const stage = ref(null)
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const dragging = ref(false)

let startX = 0
let startY = 0
let baseX = 0
let baseY = 0
let pinchStart = 0

function reset() {
  scale.value = 1
  tx.value = 0
  ty.value = 0
}

/** 围绕 (cx,cy) 缩放；不传则以中心为锚点 */
function zoomTo(next, cx, cy) {
  next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
  if (Math.abs(next - scale.value) < 0.0001) return

  if (cx === undefined) { cx = 0; cy = 0 }
  const k = next / scale.value
  tx.value = cx - (cx - tx.value) * k
  ty.value = cy - (cy - ty.value) * k
  scale.value = next

  /* 缩回 100% 以内时复位，避免图被推到看不见的地方 */
  if (scale.value <= 1) {
    tx.value = 0
    ty.value = 0
  }
}

function centerOf(e) {
  const rect = stage.value.getBoundingClientRect()
  return {
    cx: e.clientX - rect.left - rect.width / 2,
    cy: e.clientY - rect.top - rect.height / 2,
  }
}

function onWheel(e) {
  const { cx, cy } = centerOf(e)
  zoomTo(scale.value * Math.exp(-e.deltaY * 0.0015), cx, cy)
}

function onPointerDown(e) {
  if (scale.value <= 1 || !e.isPrimary) return
  dragging.value = true
  startX = e.clientX
  startY = e.clientY
  baseX = tx.value
  baseY = ty.value
  try { stage.value.setPointerCapture(e.pointerId) } catch { /* ignore */ }
}

function onPointerMove(e) {
  if (!dragging.value) return
  tx.value = baseX + (e.clientX - startX)
  ty.value = baseY + (e.clientY - startY)
}

function endDrag() {
  dragging.value = false
}

function onDblClick(e) {
  if (scale.value > 1.01) { reset(); return }
  const { cx, cy } = centerOf(e)
  zoomTo(2.5, cx, cy)
}

function onTouchStart(e) {
  if (e.touches.length === 2) {
    dragging.value = false
    pinchStart = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    )
  }
}

function onTouchMove(e) {
  if (e.touches.length !== 2 || !pinchStart) return
  e.preventDefault()
  const d = Math.hypot(
    e.touches[0].clientX - e.touches[1].clientX,
    e.touches[0].clientY - e.touches[1].clientY,
  )
  zoomTo(scale.value * (d / pinchStart))
  pinchStart = d
}

function onTouchEnd() {
  pinchStart = 0
}

function close() {
  emit('close')
}

function onKeydown(e) {
  if (!props.open) return
  if (e.key === 'Escape') { close(); return }
  if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(scale.value * 1.5) }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomTo(scale.value / 1.5) }
  else if (e.key === '0') { e.preventDefault(); reset() }
}

/* 打开时复位并挂键盘监听；关闭时摘掉 */
watch(
  () => props.open,
  async (v) => {
    if (v) {
      reset()
      await nextTick()
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

/* 该用户的设置里关掉灯箱时，直接不渲染 */
const enabled = () => Store.get('wall.lightbox', true)
</script>

<template>
  <div v-if="enabled()" class="lightbox" :class="{ 'is-open': open }" @click.self="close">
    <button class="icon-btn lightbox__close" type="button" @click="close">✕</button>

    <div
      ref="stage"
      class="lightbox__stage"
      :class="{ 'is-zoomed': scale > 1.01, 'is-dragging': dragging }"
      @wheel.prevent="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @pointerleave="endDrag"
      @dblclick.prevent="onDblClick"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend.passive="onTouchEnd"
    >
      <img
        class="lightbox__img"
        :src="src"
        alt=""
        draggable="false"
        :style="{ transform: `translate(${tx}px,${ty}px) scale(${scale})` }"
      >
    </div>

    <div class="lightbox__bar">
      <span>{{ caption || '—' }}</span>
      <span class="lightbox__zoom">
        <button class="icon-btn icon-btn--sm" type="button" title="缩小（或按 -）" @click="zoomTo(scale / 1.5)">−</button>
        <button class="lightbox__pct" type="button" title="点击还原（或按 0）" @click="reset">{{ Math.round(scale * 100) }}%</button>
        <button class="icon-btn icon-btn--sm" type="button" title="放大（或按 +）" @click="zoomTo(scale * 1.5)">+</button>
      </span>
    </div>
  </div>
</template>
