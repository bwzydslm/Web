/* ============================================================================
 *  music.js —— 播放器状态与音频控制
 *
 *  单例：整个应用共享同一份状态和同一个 <audio>，所以切页不会中断播放。
 *
 *  音频来源目前是**本地歌单**：public/music/playlist.json + 音频文件。
 *  以后再接网易云代理，只需要改 loadPlaylist() 和 track.src 的拼法。
 *
 *  播放模式（state.mode）：
 *    'list'    列表循环 —— 播完最后一首回到第一首
 *    'one'     单曲循环 —— 播完重放当前这首
 *    'shuffle' 随机播放 —— 随机跳，且带历史记录，所以「上一首」是能回退的
 * ==========================================================================*/

import { computed, reactive } from 'vue'
import Api from './api'
import Store from './store'

const MODES = ['list', 'one', 'shuffle']

export const MODE_META = {
  list: { label: '列表循环', icon: 'repeat' },
  one: { label: '单曲循环', icon: 'repeat-one' },
  shuffle: { label: '随机播放', icon: 'shuffle' },
}

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
  buffered: 0,           // 已缓冲到第几秒（画进度条上的浅色段）
  volume: 1,
  muted: false,
  mode: 'list',

  lyrics: [],            // [{ t: 秒, text }]
})

let audio = null

/** 随机播放的历史栈：记「播过的下标」，让上一首能退回去 */
let shuffleHistory = []

/* ---------------- audio 单例 ---------------- */

/** 懒创建 audio，保证只有一个实例 */
function el() {
  if (audio) return audio
  audio = new Audio()
  audio.preload = 'metadata'

  audio.addEventListener('timeupdate', () => {
    state.currentTime = audio.currentTime
    syncBuffered()
  })
  audio.addEventListener('progress', syncBuffered)
  audio.addEventListener('loadedmetadata', () => {
    state.duration = Number.isFinite(audio.duration) ? audio.duration : 0
    syncBuffered()
  })
  audio.addEventListener('durationchange', () => {
    state.duration = Number.isFinite(audio.duration) ? audio.duration : 0
    syncBuffered()
  })
  audio.addEventListener('play', () => { state.playing = true })
  audio.addEventListener('pause', () => { state.playing = false })
  audio.addEventListener('ended', () => {
    /* 单曲循环：不打乱队列，原地重放 */
    if (state.mode === 'one') {
      const a = el()
      try {
        a.currentTime = 0
        state.currentTime = 0
        a.play().catch(() => {})
      } catch {
        /* 极少数浏览器在 ended 里改 currentTime 会抛，忽略即可 */
      }
      return
    }
    const i = stepIndex(1)
    if (i >= 0) playAt(i)
  })
  audio.addEventListener('error', () => {
    state.playing = false
    if (state.index >= 0) state.error = '这首音频加载失败（文件缺失或格式不支持）'
  })

  audio.volume = state.volume
  audio.muted = state.muted
  return audio
}

/** 缓冲段：取最后一个有效 range 的末尾 */
function syncBuffered() {
  const a = audio
  if (!a) return
  const d = Number.isFinite(a.duration) ? a.duration : 0
  if (!d || !a.buffered || !a.buffered.length) {
    state.buffered = 0
    return
  }
  let end = 0
  for (let i = 0; i < a.buffered.length; i++) {
    if (a.buffered.start(i) <= a.currentTime + 0.25) {
      end = Math.max(end, a.buffered.end(i))
    }
  }
  state.buffered = Math.min(d, end)
}

/* ---------------- 歌词 ---------------- */

/** 解析 LRC。支持一行多个时间戳：[00:12.00][00:40.00]同一句 */
function parseLrc(raw) {
  if (!raw) return []
  const out = []
  String(raw)
    .split('\n')
    .forEach((line) => {
      /* 先把行首所有 [mm:ss(.xx)] 抠出来，剩下的才是正文 */
      const stamps = []
      let rest = line.trim()
      let m
      const re = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/
      while ((m = rest.match(re))) {
        const frac = m[3] ? parseInt(m[3], 10) / Math.pow(10, m[3].length) : 0
        stamps.push(parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac)
        rest = rest.slice(m[0].length)
      }
      const text = rest.trim()
      if (!text || !stamps.length) return
      stamps.forEach((t) => out.push({ t, text }))
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

/** 当前这首有没有歌词（没有就由界面显示「纯音乐，请欣赏」） */
const hasLyrics = computed(() => state.lyrics.length > 0)

/* ---------------- 歌单 ---------------- */

/** 云端歌单（/api/tracks）优先；拿不到再退回本地 playlist.json */
export async function loadPlaylist() {
  if (state.loading) return

  state.loading = true
  state.error = ''

  let cloudTracks = []
  try {
    const res = await Api.tracks()
    if (res && res.ok && Array.isArray(res.items)) {
      cloudTracks = res.items.map((t) => ({
        id: t.id,
        name: t.name || '未命名',
        artist: t.artist || '',
        album: t.album || '',
        duration: t.duration || 0,
        src: Api.fileUrl(t.key),
        lyrics: t.lyrics || '',
      }))
    }
  } catch (e) {
    /* 后端不可用就走本地，不打扰用户 */
  }

  if (cloudTracks.length) {
    state.playlist = { name: '云端歌单', desc: '', cover: '', tracks: cloudTracks }
    if (!state.queue.length) state.queue = cloudTracks.slice()
    state.ready = true
    state.loading = false
    return
  }

  state.loading = false
  return loadStaticPlaylist()
}

/** 本地歌单：public/music/playlist.json */
function loadStaticPlaylist() {
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

  /* 换歌前先把当前下标记进随机历史，方便「上一首」回退 */
  if (state.mode === 'shuffle' && state.index >= 0 && state.index !== i) {
    shuffleHistory.push(state.index)
    if (shuffleHistory.length > 60) shuffleHistory.shift()
  }

  state.error = ''
  state.index = i
  state.lyrics = parseLrc(track.lyrics)
  state.currentTime = 0
  state.duration = track.duration > 0 ? track.duration : 0
  state.buffered = 0

  const a = el()
  a.src = track.src
  a.volume = state.volume
  a.muted = state.muted
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

/**
 * 往 dir 方向找下一首的下标。
 * dir = 1 下一首，dir = -1 上一首。
 * 返回 -1 表示没有可播的。
 */
function stepIndex(dir) {
  const n = state.queue.length
  if (!n) return -1

  if (state.mode === 'shuffle' && n > 1) {
    if (dir < 0 && shuffleHistory.length) {
      const back = shuffleHistory.pop()
      if (back >= 0 && back < n) return back
    }
    /* 随机挑一首，别和当前这首重复 */
    let i = state.index
    let guard = 0
    while (i === state.index && guard++ < 24) {
      i = Math.floor(Math.random() * n)
    }
    return i < 0 ? 0 : i
  }

  if (state.index < 0) return dir > 0 ? 0 : n - 1
  const i = state.index + dir
  /* 首尾环回。注意：单曲循环只影响「播完自动续播」（在 ended 里单独处理），
     手动点上一首 / 下一首仍然要真的换歌，所以这里不再对 'one' 特判 */
  if (i >= n) return 0
  if (i < 0) return n - 1
  return i
}

export function next() {
  const i = stepIndex(1)
  if (i >= 0) playAt(i)
}

export function prev() {
  const i = stepIndex(-1)
  if (i >= 0) playAt(i)
}

export function seek(sec) {
  const a = el()
  const d = Number.isFinite(a.duration) && a.duration ? a.duration : state.duration
  if (!d) return
  const t = Math.max(0, Math.min(d, sec))
  try {
    a.currentTime = t
  } catch {
    return
  }
  state.currentTime = t
}

export function setVolume(v) {
  state.volume = Math.max(0, Math.min(1, v))
  if (state.volume > 0) state.muted = false
  const a = el()
  a.volume = state.volume
  a.muted = state.muted
  Store.set('music.volume', state.volume)
}

export function toggleMute() {
  state.muted = !state.muted
  el().muted = state.muted
  Store.set('music.muted', state.muted)
}

/** 设置播放模式；传 'cycle' 就按 列表→单曲→随机 轮转 */
export function setMode(m) {
  if (m === 'cycle') {
    const i = MODES.indexOf(state.mode)
    m = MODES[(i + 1) % MODES.length]
  }
  if (!MODES.includes(m)) return
  state.mode = m
  if (m === 'shuffle') shuffleHistory = []
  Store.set('music.mode', m)
}

/** 启动时把上次的音量 / 模式读回来 */
export function restorePrefs() {
  const v = Store.get('music.volume', 1)
  if (typeof v === 'number' && v >= 0 && v <= 1) state.volume = v
  const mu = Store.get('music.muted', false)
  if (typeof mu === 'boolean') state.muted = mu
  const md = Store.get('music.mode', 'list')
  if (MODES.includes(md)) state.mode = md
}
restorePrefs()

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

export const bufferedRatio = computed(() => {
  if (!state.duration) return 0
  return Math.min(1, state.buffered / state.duration)
})

export const volumeIcon = computed(() => (state.muted || state.volume === 0 ? 'volume-mute' : 'volume'))

export function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m + ':' + String(s).padStart(2, '0')
}

export { currentLyric, currentLyricIndex, hasLyrics, parseLrc, MODES }
