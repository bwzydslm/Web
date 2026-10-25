<script setup>
/* ============================================================================
 *  PlayerSlider.vue —— 可拖拽的进度条 / 音量条
 *
 *  为什么不用 <input type="range">：
 *  原生进度条没法画「已缓冲段」，也做不了悬停时间气泡，拖动时的视觉反馈很弱。
 *  这里改成 div + Pointer Events 自己实现，进度条和音量条共用一套逻辑。
 *
 *  拖动策略：按下/移动只改本地显示，**松手才真正 seek**，
 *  避免拖动过程中不停改 audio.currentTime 造成的卡顿与杂音。
 * ==========================================================================*/

import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  max: { type: Number, default: 0 },
  buffered: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false },
  /** 悬停气泡与当前值的格式化函数，如 fmtTime */
  format: { type: Function, default: null },
  /** 紧凑模式：音量条用，更细更小 */
  compact: { type: Boolean, default: false },
  label: { type: String, default: '' },
  /** 方向键的步长（秒），0 表示按百分比走 */
  step: { type: Number, default: 5 },
})

const emit = defineEmits(['seek'])

const trackRef = ref(null)
const dragging = ref(false)
const dragValue = ref(0)
const hoverRatio = ref(-1)

const safeMax = computed(() => (props.max > 0 ? props.max : 0))

const ratio = computed(() => {
  if (!safeMax.value) return 0
  const v = dragging.value ? dragValue.value : props.modelValue
  return clamp01(v / safeMax.value)
})

const bufferRatio = computed(() => {
  if (!safeMax.value) return 0
  return clamp01(props.buffered / safeMax.value)
})

/** 拖动时显示拖动位置，否则显示实际播放位置 */
const shownValue = computed(() => (dragging.value ? dragValue.value : props.modelValue))

const shownText = computed(() => (props.format ? props.format(shownValue.value) : ''))

const hoverText = computed(() => {
  if (!props.format || hoverRatio.value < 0 || !safeMax.value) return ''
  return props.format(hoverRatio.value * safeMax.value)
})

function clamp01(n) {
  if (!Number.isFinite(n)) return 0
  return n < 0 ? 0 : n > 1 ? 1 : n
}

function ratioFromEvent(e) {
  const el = trackRef.value
  if (!el) return 0
  const r = el.getBoundingClientRect()
  if (!r.width) return 0
  return clamp01((e.clientX - r.left) / r.width)
}

function onPointerDown(e) {
  if (props.disabled || !safeMax.value) return
  e.preventDefault()
  dragging.value = true
  dragValue.value = ratioFromEvent(e) * safeMax.value
  try {
    trackRef.value.setPointerCapture(e.pointerId)
  } catch {
    /* 某些浏览器对已释放的指针会抛，忽略 */
  }
}

function onPointerMove(e) {
  if (!safeMax.value) return
  hoverRatio.value = ratioFromEvent(e)
  if (!dragging.value) return
  dragValue.value = ratioFromEvent(e) * safeMax.value
}

function onPointerUp(e) {
  if (!dragging.value) return
  const v = dragValue.value
  dragging.value = false
  try {
    trackRef.value.releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  if (safeMax.value) emit('seek', v)
}

function onPointerLeave() {
  hoverRatio.value = -1
}

function onPointerCancel() {
  dragging.value = false
  hoverRatio.value = -1
}

function onKey(e) {
  if (props.disabled || !safeMax.value) return
  let delta = 0
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = props.step || safeMax.value * 0.05
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -(props.step || safeMax.value * 0.05)
  else if (e.key === 'Home') {
    e.preventDefault()
    emit('seek', 0)
    return
  } else if (e.key === 'End') {
    e.preventDefault()
    emit('seek', safeMax.value)
    return
  } else return
  e.preventDefault()
  emit('seek', Math.max(0, Math.min(safeMax.value, props.modelValue + delta)))
}

defineExpose({ dragging })
</script>

<template>
  <div
    class="ps"
    :class="{ 'ps--compact': compact, 'ps--disabled': disabled, 'ps--dragging': dragging }"
    :role="'slider'"
    :aria-label="label"
    :aria-valuemin="0"
    :aria-valuemax="safeMax"
    :aria-valuenow="shownValue"
    :aria-valuetext="shownText"
    :tabindex="disabled ? -1 : 0"
    @keydown="onKey"
  >
    <div
      ref="trackRef"
      class="ps__track"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerLeave"
      @pointercancel="onPointerCancel"
    >
      <!-- 已缓冲 -->
      <span class="ps__buffer" :style="{ width: bufferRatio * 100 + '%' }" />
      <!-- 已播放 -->
      <span class="ps__fill" :style="{ width: ratio * 100 + '%' }" />
      <!-- 悬停位置提示线 -->
      <span
        v-if="hoverRatio >= 0 && !disabled"
        class="ps__hover"
        :style="{ left: hoverRatio * 100 + '%' }"
      />
      <!-- 拖拽把手 -->
      <span class="ps__thumb" :style="{ left: ratio * 100 + '%' }" />

      <!-- 悬停时间气泡（紧凑模式不要，会被父容器的 overflow 裁掉） -->
      <span
        v-if="hoverText && !compact"
        class="ps__tip"
        :style="{ left: hoverRatio * 100 + '%' }"
      >{{ hoverText }}</span>
    </div>
  </div>
</template>

<style scoped>
.ps {
  flex: 1 1 auto;
  min-width: 0;
  outline: none;
  padding: 6px 0; /* 加大热区，细条本身只有 4px */
  touch-action: none;
}
.ps:focus-visible .ps__track {
  box-shadow: 0 0 0 3px var(--accent-soft, rgba(167, 139, 250, 0.16));
}

.ps__track {
  position: relative;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  cursor: pointer;
  transition: height 0.14s var(--ease, ease);
}
.ps--compact .ps__track {
  height: 3px;
}
.ps:hover .ps__track,
.ps--dragging .ps__track {
  height: 6px;
}
.ps--compact:hover .ps__track,
.ps--compact.ps--dragging .ps__track {
  height: 5px;
}

.ps__buffer {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
}

.ps__fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent, #a78bfa), var(--accent-2, #8b5cf6));
}

.ps__hover {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 1px;
  background: rgba(255, 255, 255, 0.5);
  pointer-events: none;
}

.ps__thumb {
  position: absolute;
  top: 50%;
  width: 11px;
  height: 11px;
  margin: -5.5px 0 0 -5.5px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.45);
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 0.14s ease, transform 0.14s var(--ease, ease);
  pointer-events: none;
}
.ps:hover .ps__thumb,
.ps--dragging .ps__thumb,
.ps:focus-visible .ps__thumb {
  opacity: 1;
  transform: scale(1);
}

.ps__tip {
  position: absolute;
  bottom: 16px;
  transform: translateX(-50%);
  padding: 3px 8px;
  border-radius: 7px;
  background: var(--card, #131317);
  border: 1px solid var(--line, #35353d);
  color: var(--text, #f5f5f7);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  z-index: 6;
}

.ps--disabled .ps__track {
  cursor: default;
  opacity: 0.45;
}
.ps--disabled .ps__hover,
.ps--disabled .ps__thumb {
  display: none;
}
</style>
