<script setup>
/* ============================================================================
 *  LyricScroller.vue —— 滚动歌词
 *
 *  行为对齐主流播放器：
 *   · 当前行居中，整行高亮
 *   · 用户手动滚动后暂停自动跟随，静置 2.8 秒再恢复（否则会「抢滚动条」）
 *   · 点任意一行跳到那句
 *   · 没歌词就显示「纯音乐，请欣赏」
 * ==========================================================================*/

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { currentLyricIndex, music } from '../lib/music'

const emit = defineEmits(['seek'])

const boxRef = ref(null)
const userScrolling = ref(false)
let resumeTimer = null
/** 程序滚动期间的时间戳门槛：这段时间内收到的 scroll 事件不算「人滚的」 */
let suppressUntil = 0

const lines = computed(() => music.lyrics)
const active = computed(() => currentLyricIndex.value)
const hasTrack = computed(() => music.index >= 0)

/** 当前行相对容器顶部的偏移，用来把它滚到中间 */
function scrollToActive(smooth = true) {
  const box = boxRef.value
  if (!box || userScrolling.value) return
  const el = box.querySelector('.ls__line.is-active')
  if (!el) return
  const top = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2
  const max = box.scrollHeight - box.clientHeight
  if (smooth) suppressUntil = Date.now() + 700
  box.scrollTo({ top: Math.max(0, Math.min(max, top)), behavior: smooth ? 'smooth' : 'auto' })
}

/** 换行时跟随；换歌时直接跳（smooth 会滚很久） */
watch(active, () => nextTick(() => scrollToActive(true)))
watch(
  () => music.index,
  () => {
    /* 切歌时重置手动滚动状态，否则新歌的歌词不会自动居中 */
    userScrolling.value = false
    clearTimeout(resumeTimer)
    nextTick(() => scrollToActive(false))
  },
)

function onScroll() {
  /* 程序自己滚出来的事件忽略掉 */
  if (Date.now() < suppressUntil) return
  if (!userScrolling.value) return
  clearTimeout(resumeTimer)
  resumeTimer = setTimeout(() => {
    userScrolling.value = false
    scrollToActive(true)
  }, 2800)
}

/** 任何「用户主动滚」的迹象：暂停自动跟随，静置 2.8 秒后恢复 */
function onUserIntent() {
  suppressUntil = 0
  userScrolling.value = true
  clearTimeout(resumeTimer)
  resumeTimer = setTimeout(() => {
    userScrolling.value = false
    scrollToActive(true)
  }, 2800)
}

/** 拖滚动条：按住滚动条本身时开始暂停跟随 */
function onPointerDown(e) {
  if (e.target === boxRef.value) onUserIntent()
}

function onLineClick(line) {
  if (typeof line.t === 'number') emit('seek', line.t)
}

/* 进场时如果已经在播（比如从别的页面切回来），直接定位到当前句 */
onMounted(() => nextTick(() => scrollToActive(false)))

onBeforeUnmount(() => clearTimeout(resumeTimer))
</script>

<template>
  <div class="ls">
    <!-- 没有在播任何歌 -->
    <div v-if="!hasTrack" class="ls__empty">
      <div class="ls__empty-title">还没有开始播放</div>
      <div class="ls__empty-sub">从右边播放列表里挑一首</div>
    </div>

    <!-- 有歌但没歌词 -->
    <div v-else-if="!lines.length" class="ls__empty ls__empty--instrumental">
      <div class="ls__note">♫</div>
      <div class="ls__empty-title">纯音乐，请欣赏</div>
      <div class="ls__empty-sub">{{ music.queue[music.index] ? music.queue[music.index].name : '' }}</div>
    </div>

    <!-- 有歌词 -->
    <div
      v-else
      ref="boxRef"
      class="ls__box"
      @scroll.passive="onScroll"
      @pointerdown="onPointerDown"
      @wheel="onUserIntent"
      @touchstart.passive="onUserIntent"
    >
      <!-- 上下留白，让第一句和最后一句也能滚到中间 -->
      <div class="ls__pad" />
      <p
        v-for="(line, i) in lines"
        :key="i"
        class="ls__line"
        :class="{ 'is-active': i === active, 'is-past': i < active }"
        @click="onLineClick(line)"
      >
        {{ line.text }}
      </p>
      <div class="ls__pad" />
    </div>
  </div>
</template>

<style scoped>
.ls {
  height: 100%;
  /* 高度交给外层容器控制（NowPlaying 里是 flex 剩下的空间），这里只兜个下限 */
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ---------- 无歌词 ---------- */
.ls__empty {
  flex: 1 1 auto;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px;
  text-align: center;
}
.ls__note {
  font-size: 30px;
  line-height: 1;
  color: var(--accent, #a78bfa);
  opacity: 0.5;
  margin-bottom: 4px;
}
.ls__empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text, #f5f5f7);
}
.ls__empty-sub {
  font-size: 12px;
  color: var(--muted, #8c8c97);
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ls__empty--instrumental .ls__empty-title {
  letter-spacing: 0.06em;
}

/* ---------- 歌词滚动区 ---------- */
.ls__box {
  position: relative;
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 4px;
  /* 上下渐隐，让滚出视野的行自然消失，而不是被硬切 */
  mask-image: linear-gradient(180deg, transparent 0, #000 14%, #000 86%, transparent 100%);
  -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 14%, #000 86%, transparent 100%);
  scrollbar-width: thin;
  scrollbar-color: var(--line, #35353d) transparent;
  overscroll-behavior: contain;
}
.ls__box::-webkit-scrollbar {
  width: 6px;
}
.ls__box::-webkit-scrollbar-thumb {
  background: var(--line, #35353d);
  border-radius: 999px;
}
.ls__box::-webkit-scrollbar-track {
  background: transparent;
}

.ls__pad {
  height: 46%;
  flex: 0 0 auto;
}

.ls__line {
  margin: 0;
  padding: 7px 14px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--muted, #8c8c97);
  text-align: center;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.24s var(--ease, ease), transform 0.24s var(--ease, ease),
    opacity 0.24s var(--ease, ease);
  opacity: 0.55;
}
.ls__line:hover {
  opacity: 0.9;
  color: var(--text, #f5f5f7);
}
.ls__line.is-past {
  opacity: 0.34;
}
.ls__line.is-active {
  color: var(--accent, #a78bfa);
  font-weight: 650;
  font-size: 14.5px;
  opacity: 1;
  transform: scale(1.03);
  text-shadow: 0 0 18px var(--accent-soft, rgba(167, 139, 250, 0.16));
}
</style>
