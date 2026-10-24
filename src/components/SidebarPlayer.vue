<script setup>
/* ============================================================================
 *  SidebarPlayer.vue —— 侧边栏底部的播放控制器
 *
 *  复用 .mini-card 的外壳（含展开/收起两套行为），只把内容换成播放控制。
 *  收起态（html.sidebar-collapsed）下退化成一颗圆形播放键。
 * ==========================================================================*/

import { computed, onMounted } from 'vue'
import AppIcon from './AppIcon.vue'
import {
  currentTrack,
  fmtTime,
  hasTrack,
  loadPlaylist,
  music,
  next,
  prev,
  progress,
  seek,
  toggle,
} from '../lib/music'

onMounted(() => {
  if (!music.ready) loadPlaylist()
})

const title = computed(() => (hasTrack.value ? currentTrack.value.name : '未在播放'))

const sub = computed(() => {
  if (!hasTrack.value) return music.loading ? '载入中…' : '点播放开始'
  return currentTrack.value.artist || '未知歌手'
})

const pct = computed(() => progress.value * 100)

function onSeek(e) {
  seek(Number(e.target.value))
}
</script>

<template>
  <div class="mini-card sp" :class="{ 'sp--idle': !hasTrack }">
    <!-- 收起态只显示这一颗键 -->
    <button class="sp__mini" type="button" :title="music.playing ? '暂停' : '播放'" @click="toggle">
      <span>{{ music.playing ? '❚❚' : '▶' }}</span>
    </button>

    <!-- 展开态 -->
    <div class="sp__row">
      <div class="mini-card__cover sp__cover">
        <img v-if="music.playlist && music.playlist.cover" :src="music.playlist.cover" alt="">
        <AppIcon v-else name="music" :size="18" />
      </div>

      <div class="mini-card__meta sp__meta">
        <div class="mini-card__title">{{ title }}</div>
        <div class="mini-card__sub">{{ sub }}</div>
      </div>
    </div>

    <div class="sp__ctrl">
      <button class="sp__btn" type="button" title="上一首" @click="prev">⏮</button>
      <button class="sp__btn sp__btn--main" type="button" :title="music.playing ? '暂停' : '播放'" @click="toggle">
        {{ music.playing ? '❚❚' : '▶' }}
      </button>
      <button class="sp__btn" type="button" title="下一首" @click="next">⏭</button>
      <span class="sp__time">{{ fmtTime(music.currentTime) }}</span>
    </div>

    <input
      class="sp__bar"
      type="range"
      min="0"
      :max="music.duration || 0"
      step="0.1"
      :value="music.currentTime"
      :style="{ '--pct': pct + '%' }"
      :disabled="!hasTrack"
      @input="onSeek"
    >
  </div>
</template>

<style scoped>
.sp {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding: 10px;
}

.sp__mini {
  display: none;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--accent-line, rgba(167, 139, 250, 0.38));
  background: var(--accent-soft, rgba(167, 139, 250, 0.16));
  color: var(--accent, #a78bfa);
  font-size: 11px;
  cursor: pointer;
}

.sp__row {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.sp__cover {
  width: 36px;
  height: 36px;
  font-size: 15px;
  overflow: hidden;
}
.sp__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sp__meta {
  min-width: 0;
}

.sp__ctrl {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sp__btn {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--line, rgba(255, 255, 255, 0.14));
  background: transparent;
  color: inherit;
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.sp__btn:hover {
  border-color: var(--accent, #a78bfa);
  color: var(--accent, #a78bfa);
}
.sp__btn--main {
  width: 30px;
  height: 30px;
  border-color: var(--accent, #a78bfa);
  color: var(--accent, #a78bfa);
  background: var(--accent-soft, rgba(167, 139, 250, 0.16));
}
.sp__time {
  margin-left: auto;
  font-size: 10px;
  opacity: 0.45;
  font-variant-numeric: tabular-nums;
}

/* 细进度条 */
.sp__bar {
  width: 100%;
  appearance: none;
  height: 3px;
  border-radius: 999px;
  cursor: pointer;
  background: linear-gradient(
    to right,
    var(--accent, #a78bfa) 0%,
    var(--accent, #a78bfa) var(--pct, 0%),
    rgba(255, 255, 255, 0.16) var(--pct, 0%),
    rgba(255, 255, 255, 0.16) 100%
  );
}
.sp__bar:disabled {
  opacity: 0.35;
  cursor: default;
}
.sp__bar::-webkit-slider-thumb {
  appearance: none;
  width: 0;
  height: 0;
}
.sp__bar::-moz-range-thumb {
  width: 0;
  height: 0;
  border: none;
}

/* ---------- 收起态：只剩一颗圆键 ---------- */
html.sidebar-collapsed .sp {
  align-items: center;
  padding: 6px;
  gap: 0;
}
html.sidebar-collapsed .sp__row,
html.sidebar-collapsed .sp__ctrl,
html.sidebar-collapsed .sp__bar {
  display: none;
}
html.sidebar-collapsed .sp__mini {
  display: grid;
}
</style>
