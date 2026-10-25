<script setup>
/* ============================================================================
 *  NowPlaying.vue —— 「正在播放」面板
 *
 *  版面（左封面 / 右信息+歌词，底部一条控制条）参考了常见音乐客户端的信息层级，
 *  但只保留本站真有的能力：没有 MV / 评论 / 收藏 / 相似推荐，就一个都不放。
 *
 *  控制条三段式：
 *    左  播放模式（列表循环 / 单曲循环 / 随机播放）
 *    中  上一首 · 播放暂停 · 下一首
 *    右  音量（喇叭键静音 + 可拖细条 + 滚轮微调）
 *
 *  音量为什么是「常驻细条」而不是悬浮气泡：
 *  外层 .card 带 overflow:hidden，任何伸出卡片边界的浮层都会被裁掉。
 *  把滑条直接摆进控制条、宽度留够，就不存在被挡的问题。
 * ==========================================================================*/

import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import PlayerSlider from './PlayerSlider.vue'
import LyricScroller from './LyricScroller.vue'
import {
  currentTrack,
  fmtTime,
  hasTrack,
  music,
  next,
  prev,
  seek,
  setMode,
  setVolume,
  toggle,
  toggleMute,
  MODE_META,
} from '../lib/music'

const cover = computed(() => {
  const t = currentTrack.value
  if (t && t.cover) return t.cover
  const p = music.playlist
  return (p && p.cover) || ''
})

const modeMeta = computed(() => MODE_META[music.mode] || MODE_META.list)

/** 静音时滑条显示 0，取消静音后回到原音量 */
const volPct = computed(() => Math.round((music.muted ? 0 : music.volume) * 100))
const volDisabled = computed(() => !hasTrack.value)

function onSeek(sec) {
  seek(sec)
}

function onVolume(v) {
  setVolume(v / 100)
}

/** 在音量区滚轮也能调音量（很常见的操作习惯） */
function onWheel(e) {
  if (volDisabled.value) return
  const d = e.deltaY > 0 ? -5 : 5
  setVolume(Math.max(0, Math.min(100, volPct.value + d)) / 100)
}
</script>

<template>
  <section class="np">
    <!-- ================= 上半：封面 + 信息 + 歌词 ================= -->
    <div class="np__hero">
      <!-- 左：黑胶唱片 -->
      <div class="np__art">
        <div class="np__disc" :class="{ 'is-spinning': music.playing }">
          <div class="np__disc-art">
            <img v-if="cover" :src="cover" alt="">
            <AppIcon v-else name="music" :size="32" />
          </div>
          <span class="np__disc-hole" />
        </div>
        <span class="np__arm" :class="{ 'is-on': music.playing }" aria-hidden="true" />
      </div>

      <!-- 右：曲目信息 + 歌词 -->
      <div class="np__side">
        <header class="np__head">
          <h2 class="np__name" :title="hasTrack ? currentTrack.name : ''">
            {{ hasTrack ? currentTrack.name : '未在播放' }}
          </h2>

          <p class="np__meta">
            <template v-if="hasTrack">
              <span class="np__artist">{{ currentTrack.artist || '未知歌手' }}</span>
              <span v-if="currentTrack.album" class="np__album">
                <span class="np__dot">·</span>{{ currentTrack.album }}
              </span>
            </template>
            <template v-else>从右侧播放列表挑一首开始</template>
          </p>

          <div class="np__tags">
            <span v-if="hasTrack && music.lyrics.length" class="tag tag--accent">
              <AppIcon name="lyric" :size="12" />
              歌词
            </span>
            <span v-else-if="hasTrack" class="tag">纯音乐</span>
          </div>
        </header>

        <div class="np__lyric">
          <LyricScroller @seek="onSeek" />
        </div>
      </div>
    </div>

    <!-- ================= 进度 ================= -->
    <div class="np__progress">
      <span class="np__time">{{ fmtTime(music.currentTime) }}</span>
      <PlayerSlider
        :model-value="music.currentTime"
        :max="music.duration"
        :buffered="music.buffered"
        :disabled="!hasTrack || !music.duration"
        :format="fmtTime"
        :step="5"
        label="播放进度"
        @seek="onSeek"
      />
      <span class="np__time">{{ fmtTime(music.duration) }}</span>
    </div>

    <!-- ================= 控制条 ================= -->
    <div class="np__bar">
      <!-- 左：播放模式 -->
      <div class="np__bar-cell">
        <button
          class="np__mode"
          type="button"
          :title="modeMeta.label + '（点击切换）'"
          :aria-label="'播放模式：' + modeMeta.label"
          @click="setMode('cycle')"
        >
          <AppIcon :name="modeMeta.icon" :size="15" />
          <span class="np__mode-label">{{ modeMeta.label }}</span>
        </button>
      </div>

      <!-- 中：上一首 / 播放 / 下一首 -->
      <div class="np__bar-cell np__bar-cell--main">
        <button class="np__icon np__icon--nav" type="button" title="上一首" aria-label="上一首" @click="prev">
          <AppIcon name="prev" :size="18" />
        </button>
        <button
          class="np__play"
          type="button"
          :title="music.playing ? '暂停' : '播放'"
          :aria-label="music.playing ? '暂停' : '播放'"
          :disabled="!hasTrack"
          @click="toggle"
        >
          <AppIcon :name="music.playing ? 'pause' : 'play'" :size="21" />
        </button>
        <button class="np__icon np__icon--nav" type="button" title="下一首" aria-label="下一首" @click="next">
          <AppIcon name="next" :size="18" />
        </button>
      </div>

      <!-- 右：音量 -->
      <div class="np__bar-cell np__bar-cell--right">
        <div class="np__vol" :class="{ 'is-off': volDisabled }" @wheel.prevent="onWheel">
          <button
            class="np__icon np__icon--vol"
            type="button"
            :title="music.muted ? '取消静音' : '静音'"
            :aria-label="music.muted ? '取消静音' : '静音'"
            @click="toggleMute"
          >
            <AppIcon
              :name="music.muted || music.volume === 0 ? 'volume-mute' : 'volume'"
              :size="17"
            />
          </button>
          <PlayerSlider
            compact
            :model-value="volPct"
            :max="100"
            :format="(v) => Math.round(v) + '%'"
            :disabled="volDisabled"
            :step="5"
            label="音量"
            @seek="onVolume"
          />
        </div>
      </div>
    </div>

    <p v-if="music.error" class="np__error">{{ music.error }}</p>
  </section>
</template>

<style scoped>
.np {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ---------------- 上半区 ---------------- */
.np__hero {
  display: grid;
  grid-template-columns: 208px minmax(0, 1fr);
  gap: 30px;
  align-items: stretch;
  min-height: 292px;
}

/* ---------------- 黑胶 ---------------- */
.np__art {
  position: relative;
  align-self: center;
  width: 208px;
  height: 208px;
}

.np__disc {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background:
    repeating-radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 5px),
    radial-gradient(circle at 50% 50%, #232329 0 62%, #101014 62% 72%, #1a1a20 72% 100%);
  box-shadow:
    0 18px 40px rgba(0, 0, 0, 0.5),
    inset 0 0 0 1px rgba(255, 255, 255, 0.07);
  animation: np-spin 22s linear infinite;
  animation-play-state: paused;
}
.np__disc.is-spinning {
  animation-play-state: running;
}

.np__disc-art {
  width: 60%;
  height: 60%;
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.03));
  color: var(--accent, #a78bfa);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
}
.np__disc-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.np__disc-hole {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #0b0b0e;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.14);
}

/* 唱臂：装饰件，播放时落针 */
.np__arm {
  position: absolute;
  top: 2px;
  left: 4px;
  width: 108px;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, #ececf4, #a9a9bb);
  transform-origin: 3px 50%;
  transform: rotate(26deg);
  transition: transform 0.6s cubic-bezier(0.34, 1.2, 0.64, 1);
  pointer-events: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
}
.np__arm::before,
.np__arm::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background: #e7e7f0;
}
.np__arm::before {
  left: -5px;
  top: -4px;
  width: 12px;
  height: 12px;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25);
}
.np__arm::after {
  right: -3px;
  top: -2px;
  width: 8px;
  height: 8px;
}
.np__arm.is-on {
  transform: rotate(50deg);
}

@keyframes np-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .np__disc { animation: none; }
  .np__arm { transition: none; }
}

/* ---------------- 右侧信息 ---------------- */
.np__side {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.np__head {
  flex: 0 0 auto;
  padding-top: 4px;
}

.np__name {
  margin: 0 0 7px;
  font-size: 21px;
  font-weight: 750;
  line-height: 1.35;
  letter-spacing: 0.2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np__meta {
  margin: 0;
  font-size: 12.5px;
  color: var(--muted, #8c8c97);
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  line-height: 1.6;
}
.np__artist {
  color: var(--text-2, #b9b9c4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}
.np__album {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.np__dot {
  margin-right: 6px;
  opacity: 0.5;
}

.np__tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
  min-height: 20px;
}

/* 歌词区：吃掉剩余高度 */
.np__lyric {
  flex: 1 1 auto;
  min-height: 168px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--line-soft, #26262c);
}

/* ---------------- 进度 ---------------- */
.np__progress {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 2px 0;
}
.np__time {
  flex: 0 0 auto;
  min-width: 42px;
  font-size: 11.5px;
  color: var(--muted, #8c8c97);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

/* ---------------- 控制条 ---------------- */
.np__bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 2px 0;
  margin-top: 2px;
}
.np__bar-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.np__bar-cell--main {
  justify-content: center;
  gap: 18px;
}
.np__bar-cell--right {
  justify-content: flex-end;
  gap: 10px;
}

/* 模式键 */
.np__mode {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted, #8c8c97);
  font: inherit;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}
.np__mode:hover {
  color: var(--text, #f5f5f7);
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--line, #35353d);
}
.np__mode-label {
  font-size: 11.5px;
  white-space: nowrap;
}

.np__icon {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted, #8c8c97);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease, transform 0.15s var(--ease, ease);
}
.np__icon:hover {
  color: var(--text, #f5f5f7);
  background: rgba(255, 255, 255, 0.06);
}
.np__icon:active {
  transform: scale(0.92);
  color: var(--accent, #a78bfa);
}
.np__icon--nav {
  width: 38px;
  height: 38px;
  color: var(--text-2, #b9b9c4);
}
.np__icon--vol {
  width: 28px;
  height: 28px;
}

/* 主播放键 */
.np__play {
  width: 50px;
  height: 50px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, var(--accent, #a78bfa), var(--accent-2, #8b5cf6));
  color: #150e22;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(124, 92, 240, 0.34);
  transition: transform 0.15s var(--ease, ease), filter 0.15s ease;
}
.np__play:hover {
  filter: brightness(1.08);
  transform: scale(1.05);
}
.np__play:active {
  transform: scale(0.95);
}
.np__play[disabled] {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}
.np__play[disabled]:hover {
  transform: none;
  filter: none;
}

/* 音量：常驻细条，摆在控制条里，天然不会被卡片裁掉 */
.np__vol {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  width: 118px;
}
.np__vol :deep(.ps) {
  flex: 1 1 auto;
}
.np__vol.is-off {
  opacity: 0.45;
}

.np__error {
  margin: 6px 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 120, 120, 0.09);
  border: 1px solid rgba(255, 120, 120, 0.24);
  color: #ff9a9a;
  font-size: 12px;
  line-height: 1.6;
}

/* ---------------- 窄屏 ---------------- */
@media (max-width: 900px) {
  .np__hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    min-height: 0;
  }
  .np__art {
    width: 160px;
    height: 160px;
    justify-self: center;
  }
  .np__side {
    align-items: center;
    text-align: center;
  }
  .np__head {
    width: 100%;
  }
  .np__meta {
    justify-content: center;
  }
  .np__tags {
    justify-content: center;
  }
  .np__lyric {
    width: 100%;
    max-height: 200px;
  }
  .np__mode-label {
    display: none;
  }
}

@media (max-width: 640px) {
  /* 窄屏没横向空间放滑条，只留喇叭键（点它静音） */
  .np__vol {
    width: auto;
  }
  .np__vol :deep(.ps) {
    display: none;
  }
  .np__bar-cell--main {
    gap: 12px;
  }
}
</style>
