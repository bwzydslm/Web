<script setup>
/* ============================================================================
 *  MusicView.vue —— 音乐页
 *
 *  版面参考了常见的「歌单 + 播放列表 + 歌词」三块式布局；
 *  配色沿用本站的黑白 + 强调色，没有照搬参考站的深蓝紫。
 *
 *  当前音频来源：本地歌单（public/music/playlist.json）。
 *  接网易云代理时，只需让 playlist.json 的 src 指向代理地址，
 *  或者在 loadPlaylist() 里换成从代理拉。
 * ==========================================================================*/

import { computed, onMounted, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { useSetting } from '../lib/prefs'
import {
  insertAndPlay,
  loadPlaylist,
  music,
  playAt,
  fmtTime,
  currentLyricIndex,
} from '../lib/music'

const quality = useSetting('music.quality', '较高')
const QUALITIES = ['标准', '较高', '极高']

const keyword = ref('')
const searching = ref(false)
const results = ref([])

const tracks = computed(() => (music.playlist && music.playlist.tracks) || [])
const isEmpty = computed(() => !music.queue.length)

onMounted(() => {
  if (!music.ready) loadPlaylist()
})

function playAll() {
  if (!music.queue.length) return
  playAt(0)
}

function shuffle() {
  if (!music.queue.length) return
  playAt(Math.floor(Math.random() * music.queue.length))
}

function doSearch() {
  const q = keyword.value.trim().toLowerCase()
  if (!q) { results.value = []; return }
  searching.value = true
  results.value = tracks.value.filter((t) => {
    const hay = (t.name + ' ' + t.artist + ' ' + t.album).toLowerCase()
    return hay.indexOf(q) !== -1
  })
}

function clearSearch() {
  keyword.value = ''
  results.value = []
  searching.value = false
}

function pick(track) {
  insertAndPlay(track, true)
  clearSearch()
}

function isCurrent(track, i) {
  return music.queue[music.index] && music.queue[music.index].id === track.id
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

    <!-- ================= 歌单卡 ================= -->
    <section class="card mp-album">
      <div class="card__body mp-album__inner">
        <div class="mp-album__cover">
          <img v-if="music.playlist && music.playlist.cover" :src="music.playlist.cover" alt="">
          <AppIcon v-else name="music" :size="26" />
        </div>

        <div class="mp-album__info">
          <h2 class="mp-album__name">
            {{ music.playlist ? music.playlist.name : '正在载入歌单…' }}
          </h2>
          <p class="mp-album__sub">
            {{ (music.playlist && music.playlist.desc) || '这个歌单没有写简介。' }}
          </p>

          <div class="mp-album__actions">
            <button class="btn btn--primary" type="button" :disabled="isEmpty" @click="playAll">播放全部</button>
            <button class="btn" type="button" :disabled="isEmpty" @click="shuffle">随便听听</button>
            <select v-model="quality" class="select mp-quality">
              <option v-for="q in QUALITIES" :key="q" :value="q">{{ q }}音质</option>
            </select>
          </div>

          <p v-if="music.playlist && music.playlist.desc" class="mp-album__count">
            共 {{ tracks.length }} 首
          </p>
        </div>
      </div>
    </section>

    <!-- ================= 搜索 ================= -->
    <div class="mp-search">
      <input
        v-model="keyword"
        class="input mp-search__input"
        type="search"
        placeholder="搜歌名、歌手"
        @keydown.enter="doSearch"
      >
      <button class="btn" type="button" @click="doSearch">搜索</button>
      <button v-if="results.length || keyword" class="btn btn--ghost" type="button" @click="clearSearch">清除</button>
    </div>

    <div v-if="searching" class="mp-results card">
      <div class="card__body card__body--flush">
        <div v-if="!results.length" class="mp-empty">没有匹配的歌曲</div>
        <button
          v-for="t in results"
          :key="t.id"
          class="mp-row"
          type="button"
          @click="pick(t)"
        >
          <span class="mp-row__name">{{ t.name }}</span>
          <span class="mp-row__artist">{{ t.artist || '未知歌手' }}</span>
          <span class="mp-row__dur">{{ fmtTime(t.duration) }}</span>
        </button>
      </div>
    </div>

    <!-- ================= 播放列表 + 歌词 ================= -->
    <div class="mp-grid">
      <section class="card">
        <div class="card__head">
          <span class="card__title">播放列表</span>
          <span class="card__hint">{{ music.queue.length }} 首</span>
        </div>
        <div class="card__body card__body--flush">
          <div v-if="isEmpty" class="mp-empty mp-empty--tall">
            <div class="mp-empty__title">播放列表是空的</div>
          </div>

          <template v-else>
            <button
              v-for="(t, i) in music.queue"
              :key="t.id"
              class="mp-row"
              :class="{ 'is-current': i === music.index }"
              type="button"
              @click="playAt(i)"
            >
              <span class="mp-row__idx">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="mp-row__name">{{ t.name }}</span>
              <span class="mp-row__artist">{{ t.artist || '未知歌手' }}</span>
              <span class="mp-row__dur">{{ fmtTime(t.duration) }}</span>
            </button>
          </template>
        </div>
      </section>

      <section class="card mp-lyrics">
        <div class="card__head">
          <span class="card__title">歌词</span>
          <span v-if="music.lyrics.length" class="card__hint">{{ music.lyrics.length }} 行</span>
        </div>
        <div class="card__body">
          <div v-if="!music.lyrics.length" class="mp-empty">暂无歌词</div>
          <div v-else class="mp-lyrics__body">
            <p
              v-for="(line, i) in music.lyrics"
              :key="i"
              class="mp-lyrics__line"
              :class="{ 'is-active': i === currentLyricIndex }"
            >
              {{ line.text }}
            </p>
          </div>
        </div>
      </section>
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

/* ---------- 歌单卡 ---------- */
.mp-album__inner {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
.mp-album__cover {
  width: 116px;
  height: 116px;
  flex: 0 0 auto;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--line, rgba(255, 255, 255, 0.1));
  color: var(--accent, #a78bfa);
  overflow: hidden;
}
.mp-album__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mp-album__info {
  min-width: 0;
  flex: 1 1 auto;
}
.mp-album__name {
  font-size: 18px;
  font-weight: 700;
  margin: 2px 0 6px;
}
.mp-album__sub {
  margin: 0 0 14px;
  font-size: 12px;
  line-height: 1.7;
  opacity: 0.6;
}
.mp-album__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.mp-quality {
  width: auto;
}
.mp-album__count {
  margin: 10px 0 0;
  font-size: 11px;
  opacity: 0.45;
}

/* ---------- 搜索 ---------- */
.mp-search {
  display: flex;
  gap: 10px;
}
.mp-search__input {
  flex: 1 1 auto;
}
.mp-results {
  margin-top: -6px;
}

/* ---------- 列表行 ---------- */
.mp-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  border-bottom: 1px solid var(--line, rgba(255, 255, 255, 0.07));
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
  width: 24px;
  flex: 0 0 auto;
  font-size: 11px;
  opacity: 0.4;
  font-variant-numeric: tabular-nums;
}
.mp-row__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-row__artist {
  flex: 0 0 auto;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11.5px;
  opacity: 0.55;
}
.mp-row__dur {
  flex: 0 0 auto;
  font-size: 11px;
  opacity: 0.4;
  font-variant-numeric: tabular-nums;
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

/* ---------- 两栏 ---------- */
.mp-grid {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 1000px) {
  .mp-grid {
    grid-template-columns: 1fr;
  }
  .mp-album__inner {
    flex-direction: column;
  }
}

/* ---------- 歌词 ---------- */
.mp-lyrics__body {
  max-height: 420px;
  overflow-y: auto;
  padding: 4px 0;
}
.mp-lyrics__line {
  margin: 0;
  padding: 5px 16px;
  font-size: 12.5px;
  line-height: 1.6;
  opacity: 0.5;
  transition: opacity 0.2s ease, color 0.2s ease;
}
.mp-lyrics__line.is-active {
  opacity: 1;
  color: var(--accent, #a78bfa);
  font-weight: 600;
}
</style>
