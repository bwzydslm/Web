<script setup>
/* ============================================================================
 *  MusicView.vue —— 音乐页
 *
 *  版面（网易云式的「主面板 + 侧栏」）：
 *    ┌───────────────────────────────┬──────────────┐
 *    │ 正在播放细则                    │ 播放列表      │
 *    │  歌单条（名称/简介/播放全部）    │  搜索        │
 *    │  封面 + 曲目信息 │ 滚动歌词      │  歌曲行 ×N   │
 *    │  进度条                        │              │
 *    │  模式 / 上一首 播放 下一首 / 音量  │              │
 *    └───────────────────────────────┴──────────────┘
 *
 *  播放细则全在 NowPlaying.vue，列表与搜索留在本页；两边共用 lib/music.js
 *  的同一份状态，所以和侧栏播放器永远同步。
 * ==========================================================================*/

import { computed, onMounted, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import NowPlaying from '../components/NowPlaying.vue'
import {
  insertAndPlay,
  loadPlaylist,
  music,
  playAt,
  fmtTime,
  setMode,
} from '../lib/music'
import { ensureRelay, searchOnline, toTrack } from '../lib/online'

const keyword = ref('')
const results = ref([])
/** 在线搜索状态：'idle' | 'loading' | 'off' */
const onlineState = ref('idle')
/** 中转到底在不在跑（决定搜索走在线还是本地过滤） */
const relayOn = ref(false)

const tracks = computed(() => (music.playlist && music.playlist.tracks) || [])
const isEmpty = computed(() => !music.queue.length)
/** 有搜索词就一直显示搜索结果，清空就回到完整列表 */
const showing = computed(() => (keyword.value.trim() ? results.value : music.queue))
const isSearching = computed(() => !!keyword.value.trim())

onMounted(async () => {
  if (!music.ready) loadPlaylist()
  relayOn.value = await ensureRelay()
  onlineState.value = relayOn.value ? 'idle' : 'off'
})

function playAll() {
  if (!music.queue.length) return
  playAt(0)
}

/** 随便听听：切到随机模式并随机起一首 */
function shufflePlay() {
  if (!music.queue.length) return
  setMode('shuffle')
  playAt(Math.floor(Math.random() * music.queue.length))
}

/* ---------------- 搜索 ---------------- */

let searchToken = 0
let searchTimer = 0

/** 本地过滤：中转不可用时的兜底（数据量小，不做防抖也够快） */
function localSearch(q) {
  const low = q.toLowerCase()
  return tracks.value.filter((t) => {
    const hay = (t.name + ' ' + t.artist + ' ' + t.album).toLowerCase()
    return hay.indexOf(low) !== -1
  })
}

function doSearch() {
  const q = keyword.value.trim()
  clearTimeout(searchTimer)
  if (!q) {
    results.value = []
    return
  }

  if (!relayOn.value) {
    results.value = localSearch(q)
    return
  }

  /* 在线搜索要打网络，防抖 350ms，别每敲一个字就发一次 */
  onlineState.value = 'loading'
  searchTimer = setTimeout(() => runOnlineSearch(q), 350)
}

async function runOnlineSearch(q) {
  const token = ++searchToken
  const res = await searchOnline(q, 30, 0)
  if (token !== searchToken) return

  if (!res) {
    /* 中转中途挂了：降级成本地过滤，别让用户对着空列表 */
    relayOn.value = false
    onlineState.value = 'off'
    results.value = localSearch(q)
    return
  }

  onlineState.value = 'idle'
  results.value = res.items.map(toTrack)
}

function clearSearch() {
  keyword.value = ''
  results.value = []
  searchToken++
}

/** 搜索结果里点一首：插入队列并立刻播 */
function pick(track) {
  const i = insertAndPlay(track, true)
  clearSearch()
  return i
}

/** 列表里的一行：搜索结果走插入逻辑，播放队列里走 playAt */
function onRow(i) {
  if (isSearching.value) pick(showing.value[i])
  else playAt(i)
}

/** 判断这一行是不是当前在播（搜索结果也要能高亮） */
function isCurrent(t, i) {
  if (isSearching.value) return music.index >= 0 && music.queue[music.index] && music.queue[music.index].id === t.id
  return i === music.index
}
</script>

<template>
  <div class="music-page">
    <!-- ================= 页头 ================= -->
    <header class="mp-head">
      <div class="mp-crumb">
        <span class="mp-crumb__badge"><AppIcon name="music" :size="13" /></span>
        <span class="mp-crumb__path">/music</span>
      </div>
      <h1 class="mp-title">音乐</h1>
    </header>

    <div class="mp-stage">
      <!-- ================= 主面板：播放细则 ================= -->
      <section class="card mp-now">
        <div class="card__head">
          <span class="card__title">
            <AppIcon name="music" :size="14" />
            正在播放
          </span>
          <span class="card__hint">
            {{ music.playing ? '播放中' : '已暂停' }}
          </span>
        </div>

        <div class="card__body mp-now__body">
          <!-- 歌单条：原来独立成卡的歌单信息，压成一条横带嵌进主板 -->
          <div class="mp-strip">
            <div class="mp-strip__cover">
              <img v-if="music.playlist && music.playlist.cover" :src="music.playlist.cover" alt="">
              <AppIcon v-else name="music" :size="15" />
            </div>
            <div class="mp-strip__info">
              <div class="mp-strip__name">
                {{ music.playlist ? music.playlist.name : '正在载入歌单…' }}
              </div>
              <div class="mp-strip__sub">
                {{ (music.playlist && music.playlist.desc) || '共 ' + tracks.length + ' 首曲目' }}
              </div>
            </div>
            <div class="mp-strip__actions">
              <button class="btn btn--sm btn--primary" type="button" :disabled="isEmpty" @click="playAll">
                播放全部
              </button>
              <button class="btn btn--sm" type="button" :disabled="isEmpty" @click="shufflePlay">
                随便听听
              </button>
            </div>
          </div>

          <NowPlaying />
        </div>
      </section>

      <!-- ================= 侧栏：播放列表 ================= -->
      <aside class="card mp-side">
        <div class="card__head">
          <span class="card__title">{{ isSearching ? '搜索结果' : '播放列表' }}</span>
          <span class="card__hint">
            <template v-if="onlineState === 'loading'">搜索中…</template>
            <template v-else>{{ showing.length }} 首{{ isSearching && relayOn ? ' · 网易云' : '' }}</template>
          </span>
        </div>

        <div class="mp-side__search">
          <div class="mp-search">
            <AppIcon name="search" :size="13" class="mp-search__icon" />
            <input
              v-model="keyword"
              class="input mp-search__input"
              type="search"
              :placeholder="relayOn ? '搜网易云曲库，或本地歌名' : '搜歌名、歌手、专辑'"
              @input="doSearch"
            >
            <button
              v-if="keyword"
              class="mp-search__clear"
              type="button"
              title="清除"
              @click="clearSearch"
            >×</button>
          </div>
        </div>

        <div class="card__body card__body--flush mp-side__list">
          <div v-if="isEmpty && !isSearching" class="mp-empty mp-empty--tall">
            <div class="mp-empty__title">播放列表是空的</div>
            <div>去上传页传一首，或直接用上面的搜索找网易云的歌</div>
          </div>
          <div v-else-if="onlineState === 'loading' && !showing.length" class="mp-empty">
            正在网易云里找…
          </div>
          <div v-else-if="isSearching && !showing.length" class="mp-empty">
            没有匹配的歌曲
          </div>

          <template v-else>
            <button
              v-for="(t, i) in showing"
              :key="t.id + '-' + i"
              class="mp-row"
              :class="{ 'is-current': isCurrent(t, i) }"
              type="button"
              @click="onRow(i)"
            >
              <span class="mp-row__idx">
                <!-- 正在播的那行，序号换成跳动的音柱 -->
                <span v-if="isCurrent(t, i) && music.playing" class="mp-bars">
                  <i /><i /><i />
                </span>
                <template v-else>{{ String(i + 1).padStart(2, '0') }}</template>
              </span>
              <span v-if="t.cover" class="mp-row__cover">
                <img :src="t.cover" alt="" loading="lazy">
              </span>
              <span class="mp-row__main">
                <span class="mp-row__name">{{ t.name }}</span>
                <span class="mp-row__artist">{{ t.artist || '未知歌手' }}</span>
              </span>
              <span class="mp-row__dur">{{ fmtTime(t.duration) }}</span>
            </button>
          </template>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.music-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------- 页头 ---------- */
.mp-crumb {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
}
.mp-crumb__badge {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  background: var(--accent, #a78bfa);
  color: #14121c;
}
.mp-crumb__path {
  font-size: 12px;
  opacity: 0.6;
}
.mp-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.5px;
  margin: 0 0 6px;
}

/* ---------- 主面板 + 侧栏 ---------- */
.mp-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}

.mp-now .card__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.mp-now__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ---------- 歌单条 ---------- */
.mp-strip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid var(--line-soft, rgba(255, 255, 255, 0.07));
}
.mp-strip__cover {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 8px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--line, rgba(255, 255, 255, 0.1));
  color: var(--accent, #a78bfa);
}
.mp-strip__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mp-strip__info {
  min-width: 0;
  flex: 1 1 auto;
}
.mp-strip__name {
  font-size: 13px;
  font-weight: 650;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-strip__sub {
  font-size: 11px;
  line-height: 1.6;
  opacity: 0.55;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-strip__actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ---------- 侧栏列表 ---------- */
.mp-side {
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 120px);
}
.mp-side__search {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line-soft, rgba(255, 255, 255, 0.07));
}
.mp-side__list {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--line, #35353d) transparent;
  min-height: 160px;
}
.mp-side__list::-webkit-scrollbar {
  width: 6px;
}
.mp-side__list::-webkit-scrollbar-thumb {
  background: var(--line, #35353d);
  border-radius: 999px;
}

/* 搜索框 */
.mp-search {
  position: relative;
  display: flex;
  align-items: center;
}
.mp-search__icon {
  position: absolute;
  left: 10px;
  opacity: 0.45;
  pointer-events: none;
}
.mp-search__input {
  width: 100%;
  padding-left: 30px;
  padding-right: 28px;
  height: 30px;
  font-size: 12px;
}
/* 去掉 type=search 自带的那个叉，用自己的 */
.mp-search__input::-webkit-search-cancel-button {
  display: none;
}
.mp-search__clear {
  position: absolute;
  right: 6px;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.09);
  color: var(--muted, #8c8c97);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}
.mp-search__clear:hover {
  color: var(--text, #f5f5f7);
  background: rgba(255, 255, 255, 0.16);
}

/* ---------- 列表行 ---------- */
.mp-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  border-bottom: 1px solid var(--line-soft, rgba(255, 255, 255, 0.07));
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background 0.14s ease;
}
.mp-row:last-child {
  border-bottom: none;
}
.mp-row:hover {
  background: rgba(255, 255, 255, 0.045);
}
.mp-row.is-current {
  background: var(--accent-soft, rgba(167, 139, 250, 0.16));
}
.mp-row.is-current .mp-row__name {
  color: var(--accent, #a78bfa);
  font-weight: 600;
}
.mp-row__idx {
  width: 20px;
  flex: 0 0 auto;
  font-size: 11px;
  opacity: 0.4;
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
}
.mp-row.is-current .mp-row__idx {
  opacity: 1;
}
.mp-row__main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mp-row__cover {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
}
.mp-row__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.mp-row__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-row__artist {
  font-size: 11px;
  opacity: 0.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-row__dur {
  flex: 0 0 auto;
  font-size: 11px;
  opacity: 0.4;
  font-variant-numeric: tabular-nums;
}

/* 播放中的音柱：三根轮流伸缩 */
.mp-bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 11px;
}
.mp-bars i {
  width: 2px;
  border-radius: 1px;
  background: var(--accent, #a78bfa);
  animation: mp-bounce 0.9s ease-in-out infinite;
}
.mp-bars i:nth-child(1) { height: 60%; animation-delay: -0.2s; }
.mp-bars i:nth-child(2) { height: 100%; animation-delay: -0.5s; }
.mp-bars i:nth-child(3) { height: 40%; animation-delay: 0s; }

@keyframes mp-bounce {
  0%, 100% { transform: scaleY(0.45); }
  50% { transform: scaleY(1); }
}
@media (prefers-reduced-motion: reduce) {
  .mp-bars i { animation: none; }
}

/* ---------- 空状态 ---------- */
.mp-empty {
  padding: 22px 16px;
  font-size: 12px;
  line-height: 1.8;
  opacity: 0.55;
}
.mp-empty--tall {
  padding: 44px 16px;
}
.mp-empty__title {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.9;
  margin-bottom: 6px;
}

/* ---------- 窄屏：侧栏落到下面 ---------- */
@media (max-width: 1000px) {
  .mp-stage {
    grid-template-columns: minmax(0, 1fr);
  }
  .mp-side {
    position: static;
    max-height: none;
  }
  .mp-side__list {
    max-height: 420px;
  }
}

@media (max-width: 700px) {
  .mp-strip {
    flex-wrap: wrap;
  }
  .mp-strip__actions {
    width: 100%;
  }
}
</style>
