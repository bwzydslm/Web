/* ============================================================================
 *  music.js —— 播放器状态与音频控制
 *
 *  单例：整个应用共享同一份状态和同一个 <audio>，所以切页不会中断播放。
 *
 *  音频来源目前是**本地歌单**：public/music/playlist.json + 音频文件。
 *  以后再接网易云代理，只需要改 loadPlaylist() 和 track.src 的拼法。
 * ==========================================================================*/

import { computed, reactive } from 'vue'

const state = reactive({
  ready: false,          // 歌单是否已加载
  loading: false,
  error: '',

  playlist: null,        // { name, desc, cover, tracks: [] }
  queue: [],             // 当前播放列表（搜索插入会改它）
  index: -1,             // 当前在 queue 里的下标，-1 = 没在播

  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 1,

  lyrics: [],            // [{ t: 秒, text }]
})

let audio = null

/** 懒创建 audio，保证只有一个实例 */
function el() {
  if (audio) return audio
  audio = new Audio()
  audio.preload = 'metadata'

  audio.addEventListener('timeupdate', () => {
    state.currentTime = audio.currentTime
  })
  audio.addEventListener('durationchange', () => {
    state.duration = Number.isFinite(audio.duration) ? audio.duration : 0
  })
  audio.addEventListener('play', () => { state.playing = true })
  audio.addEventListener('pause', () => { state.playing = false })
  audio.addEventListener('ended', () => next())
  audio.addEventListener('error', () => {
    state.playing = false
    if (state.index >= 0) state.error = '这首音频加载失败（文件缺失或格式不支持）'
  })
  return audio
}

/* ---------------- 歌词 ---------------- */

/** 解析 LRC：[00:12.34]歌词 */
function parseLrc(raw) {
  if (!raw) return []
  const out = []
  String(raw).split('\n').forEach((line) => {
    const m = line.match(/^\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\](.*)$/)
    if (!m) return
    const t = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) / 100 : 0)
    const text = m[4].trim()
    if (text) out.push({ t, text })
  })
  return out.sort((a, b) => a.t - b.t)
}

const currentLyricIndex = computed(() => {
  if (!state.lyrics.length) return -1
  const t = state.currentTime
  let idx = -1
  for (let i = 0; i < state.lyrics.length; i++) {
    if (state.lyrics[i].t <= t) idx = i
    else break
  }
  return idx
})

const currentLyric = computed(() =>
  currentLyricIndex.value >= 0 ? state.lyrics[currentLyricIndex.value].text : '',
)

/* ---------------- 歌单 ---------------- */

export function loadPlaylist() {
  if (state.loading) return Promise.resolve()
  state.loading = true
  state.error = ''

  return fetch('/music/playlist.json', { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    })
    .then((data) => {
      const tracks = (data.tracks || []).map((t, i) => ({
        id: t.id || 'local-' + i,
        name: t.name || '未命名',
        artist: t.artist || '',
        album: t.album || '',
        duration: t.duration || 0,
        src: t.src || '',
        lyrics: t.lyrics || '',
      }))

      state.playlist = {
        name: data.name || '本地歌单',
        desc: data.desc || '',
        cover: data.cover || '',
        tracks,
      }
      /* 首次加载才灌进播放队列，避免把用户搜索插入的歌冲掉 */
      if (!state.queue.length) state.queue = tracks.slice()
      state.ready = true
    })
    .catch((e) => {
      state.error = '歌单加载失败：' + e.message
      state.ready = true
      state.playlist = state.playlist || { name: '本地歌单', desc: '', cover: '', tracks: [] }
    })
    .finally(() => {
      state.loading = false
    })
}

/* ---------------- 播放控制 ---------------- */

export function playAt(i) {
  const track = state.queue[i]
  if (!track) return
  if (!track.src) {
    state.error = '这首没有音频地址（playlist.json 里 src 为空）'
    return
  }

  state.error = ''
  state.index = i
  state.lyrics = parseLrc(track.lyrics)
  state.currentTime = 0
  state.duration = 0

  const a = el()
  a.src = track.src
  a.volume = state.volume
  a.play().catch((e) => {
    state.playing = false
    state.error = '播放失败：' + (e && e.message ? e.message : e)
  })
}

export function toggle() {
  if (state.index < 0) {
    if (state.queue.length) playAt(0)
    return
  }
  const a = el()
  if (a.paused) a.play().catch(() => {})
  else a.pause()
}

export function next() {
  if (!state.queue.length) return
  const i = state.index < 0 ? 0 : (state.index + 1) % state.queue.length
  playAt(i)
}

export function prev() {
  if (!state.queue.length) return
  const i = state.index <= 0 ? state.queue.length - 1 : state.index - 1
  playAt(i)
}

export function seek(sec) {
  const a = el()
  if (!Number.isFinite(a.duration) || !a.duration) return
  a.currentTime = Math.max(0, Math.min(a.duration, sec))
  state.currentTime = a.currentTime
}

export function setVolume(v) {
  state.volume = Math.max(0, Math.min(1, v))
  el().volume = state.volume
}

/** 搜索到一首歌：插到当前播放列表并立刻播放 */
export function insertAndPlay(track, play = true) {
  const t = { ...track }
  const exist = state.queue.findIndex((x) => x.id === t.id)
  let i = exist
  if (exist < 0) {
    state.queue.push(t)
    i = state.queue.length - 1
  }
  if (play) playAt(i)
  return i
}

/* ---------------- 导出 ---------------- */

export const music = state

export const currentTrack = computed(() =>
  state.index >= 0 ? state.queue[state.index] || null : null,
)

export const hasTrack = computed(() => !!currentTrack.value)

export const progress = computed(() => {
  if (!state.duration) return 0
  return Math.min(1, state.currentTime / state.duration)
})

export function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m + ':' + String(s).padStart(2, '0')
}

export { currentLyric, currentLyricIndex }
