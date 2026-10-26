<script setup>
/* ============================================================================
 *  SidebarPlayer.vue —— 侧边栏底部的播放控制器
 *
 *  复用 .mini-card 的外壳（含展开/收起两套行为），只把内容换成播放控制。
 *  收起态（html.sidebar-collapsed）下退化成一颗圆形播放键。
 *
 *  与音乐页的 NowPlaying 共用 lib/music.js 的同一份状态：
 *  在任意一处改音量 / 播放模式，另一边立刻同步。
 * ==========================================================================*/

import { computed, onMounted } from 'vue'
import AppIcon from './AppIcon.vue'
import PlayerSlider from './PlayerSlider.vue'
import {
  currentTrack,
  fmtTime,
  hasTrack,
  loadPlaylist,
  music,
  next,
  prev,
  seek,
  setMode,
  toggle,
  MODE_META,
} from '../lib/music'

onMounted(() => {
  if (!music.ready) loadPlaylist()
})

const title = computed(() => (hasTrack.value ? currentTrack.value.name : '未在播放'))

/* 侧栏封面跟着当前曲目走，没有曲目封面才退回歌单封面 */
const cover = computed(() => {
  const t = currentTrack.value
  if (t && t.cover) return t.cover
  const p = music.playlist
  return (p && p.cover) || ''
})

const sub = computed(() => {
  if (!hasTrack.value) return music.loading ? '载入中…' : '点播放开始'
  return currentTrack.value.artist || '未知歌手'
})

const modeMeta = computed(() => MODE_META[music.mode] || MODE_META.list)

function onSeek(sec) {
  seek(sec)
}
</script>

<template>
  <div class="mini-card sp" :class="{ 'sp--idle': !hasTrack }">
    <!-- 收起态只显示这一颗键 -->
    <button class="sp__mini" type="button" :title="music.playing ? '暂停' : '播放'" @click="toggle">
      <AppIcon :name="music.playing ? 'pause' : 'play'" :size="14" />
    </button>

    <!-- 展开态 -->
    <div class="sp__row">
      <div class="mini-card__cover sp__cover">
        <img v-if="cover" :src="cover" alt="">
        <AppIcon v-else name="music" :size="18" />
      </div>

      <div class="mini-card__meta sp__meta">
        <div class="mini-card__title">{{ title }}</div>
        <div class="mini-card__sub">{{ sub }}</div>
      </div>
    </div>

    <div class="sp__ctrl">
      <button class="sp__btn" type="button" title="上一首" @click="prev">
        <AppIcon name="prev" :size="12" />
      </button>
      <button class="sp__btn sp__btn--main" type="button" :title="music.playing ? '暂停' : '播放'" @click="toggle">
        <AppIcon :name="music.playing ? 'pause' : 'play'" :size="13" />
      </button>
      <button class="sp__btn" type="button" title="下一首" @click="next">
        <AppIcon name="next" :size="12" />
      </button>
      <button
        class="sp__btn sp__btn--mode"
        type="button"
        :title="modeMeta.label + '（点击切换）'"
        @click="setMode('cycle')"
      >
        <AppIcon :name="modeMeta.icon" :size="12" />
      </button>
      <span class="sp__time">{{ fmtTime(music.currentTime) }}</span>
    </div>

    <!-- 包一层，方便收起态整体隐藏（子组件根节点不便用 :deep 选择） -->
    <div class="sp__seek">
      <PlayerSlider
        compact
        :model-value="music.currentTime"
        :max="music.duration"
        :buffered="music.buffered"
        :disabled="!hasTrack || !music.duration"
        :format="fmtTime"
        :step="5"
        label="播放进度"
        @seek="onSeek"
      />
    </div>
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
  gap: 5px;
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
/* 模式键：无边框，弱化处理，避免和下排三个主控抢注意力 */
.sp__btn--mode {
  border-color: transparent;
  color: var(--muted, #8c8c97);
  margin-left: auto;
}
.sp__btn--mode:hover {
  background: rgba(255, 255, 255, 0.07);
}
.sp__time {
  font-size: 10px;
  opacity: 0.45;
  font-variant-numeric: tabular-nums;
}

/* ---------- 收起态：只剩一颗圆键 ---------- */
html.sidebar-collapsed .sp {
  align-items: center;
  padding: 6px;
  gap: 0;
}
html.sidebar-collapsed .sp__row,
html.sidebar-collapsed .sp__ctrl,
html.sidebar-collapsed .sp__seek {
  display: none;
}
html.sidebar-collapsed .sp__mini {
  display: grid;
}
</style>
