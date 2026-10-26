/* ============================================================================
 *  online.js —— 网易云在线曲库
 *
 *  为什么要有这一层：
 *  1. 网易云的接口不允许浏览器跨域直连，且直链带 20 分钟时效，不能写死；
 *  2. 中转没起来时（比如忘了开本地中转、或者线上还没部署），
 *     整个音乐页必须能安静地退回本地曲库，不能报错糊一屏。
 *
 *  所以这里的每个函数都是「错了就返回 null」，由调用方决定降级行为。
 *
 *  ── 两个地址来源 ──────────────────────────────────────────────────
 *  · 本地开发：同源 /ne，由 vite.config.js 代理到 127.0.0.1:8787
 *    （server/netease-proxy.mjs，跑 `npm run relay` 或直接开 preview.bat）
 *  · 线上：构建时注入 VITE_RELAY_BASE，指向已部署的 ne-relay Pages 项目，
 *    接口路径是 <base>/api/xxx。
 *
 *  两者的路径差一个 /api，所以在 BASE 里就把前缀拼好，下面的函数只写
 *  '/ping' 这种相对路径，不用再关心自己跑在哪种环境里。
 * ==========================================================================*/

/* 地址来源顺序：
 *   1) VITE_RELAY_BASE（构建时注入）—— 换了项目名或绑了自定义域时用它
 *   2) 生产构建的兜底：Pages 项目的默认域名
 *   3) 本地开发：/ne（vite 代理到 127.0.0.1:8787）
 *
 * 为什么第 2 条要有：漏配环境变量时，若是直接回落成 /ne，线上会去请求
 * https://amoyba.pages.dev/ne/ping —— 那是个 404，而 404 的表现是
 * 「在线搜索不显示」，排查起来极难。默认值指向真域名，漏配时至少能用。
 */
const ENV_BASE = import.meta.env.VITE_RELAY_BASE || ''
const FALLBACK = import.meta.env.PROD ? 'https://wyydl.pages.dev' : ''
const RELAY_ORIGIN = String(ENV_BASE || FALLBACK).replace(/\/+$/, '')
const BASE = RELAY_ORIGIN ? RELAY_ORIGIN + '/api' : '/ne'

const TIMEOUT = 12000

/* ── 兜底的第三方 Meting 镜像 ────────────────────────────────────────────
 * 中转的 /api/url 在线上会走「官方接口 → Meting 镜像」两级。但中转跑在
 * Cloudflare，它去请求国内镜像也可能被掐（这点没法在本地验证）。而用户
 * 浏览器本身在国内，几乎必然能连上这些镜像。
 *
 * 所以再加一层：中转返回失败时，直接把镜像地址塞给 <audio>。
 * 镜像对 type=url 是 302 到网易云 CDN，媒体元素会自己跟随跳转 ——
 * 不需要 CORS，也不需要先拿 JSON，是最省事的一条路。
 *
 * 代价：这一层拿不到 br/expi（所以直链缓存按保守的 10 分钟算）。
 * 它的定位是「中转彻底不可用时的最后一条命」，不是主路径。
 */
const METING_FALLBACKS = [
  'https://api.qijieya.cn/meting/',
  'https://api.injahow.cn/meting/',
]

function metingUrl(base, relayId) {
  return base + '?server=netease&type=url&id=' + encodeURIComponent(relayId)
}

/** 中转是否可用。-1 = 还没探测，0 = 不可用，1 = 可用 */
let relayState = -1
let relayProbe = null

/* 直链缓存：key = relayId + level，value = { url, expires } */
const urlCache = new Map()

function timeoutSignal(ms = TIMEOUT) {
  try {
    return AbortSignal.timeout(ms)
  } catch {
    return undefined
  }
}

async function getJSON(path) {
  const res = await fetch(BASE + path, {
    headers: { Accept: 'application/json' },
    signal: timeoutSignal(),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

/**
 * 探测中转是否在跑。带缓存，只探一次。
 * 返回 boolean。
 */
export async function ensureRelay() {
  if (relayState !== -1) return relayState === 1
  if (relayProbe) return relayProbe
  relayProbe = getJSON('/ping')
    .then((d) => {
      relayState = d && d.ok ? 1 : 0
      return relayState === 1
    })
    .catch(() => {
      relayState = 0
      return false
    })
    .finally(() => {
      relayProbe = null
    })
  return relayProbe
}

/** 同步读上次探测结果，给模板做条件渲染用（避免闪烁） */
export function relayKnown() {
  return relayState
}

/**
 * 在线搜索。
 * 返回 { items: [{ relayId, name, artist, album, duration, cover }], total }，
 * 不可用时返回 null。
 */
export async function searchOnline(q, limit = 24, offset = 0) {
  if (!(await ensureRelay())) return null
  try {
    const d = await getJSON(
      '/search?q=' + encodeURIComponent(q) + '&limit=' + limit + '&offset=' + offset,
    )
    if (!d || !d.ok) return null
    return { items: d.items || [], total: d.total || 0 }
  } catch {
    return null
  }
}

/** 取歌词（LRC 原文）。拿不到返回空串。 */
export async function fetchLyric(relayId) {
  try {
    const d = await getJSON('/lyric?id=' + encodeURIComponent(relayId))
    return (d && d.ok && d.lrc) || ''
  } catch {
    return ''
  }
}

/**
 * 取可播放直链。
 *
 * level: standard(128k) / higher(192k) / exhigh(320k) / lossless
 * 返回 { ok, url, br } 或 { ok:false, message }
 *
 * mirrorTry：中转失败时用第几个镜像兜底（0 = 第一个）。
 * 由调用方在「音频加载报错后重试」时递增，这样第一个镜像挂了还能换下一个 ——
 * 浏览器没法探测镜像是否有效（302 的 Location 读不到），只能靠播放失败来试。
 */
export async function fetchStreamUrl(relayId, level = 'exhigh', force = false, mirrorTry = 0) {
  const key = relayId + '@' + level
  if (!force) {
    const hit = urlCache.get(key)
    if (hit && hit.expires > Date.now()) return { ok: true, url: hit.url, br: hit.br }
  }

  let relayMessage = ''

  try {
    const d = await getJSON('/url?id=' + encodeURIComponent(relayId) + '&level=' + level)
    if (d && d.ok && d.url) {
      /* 网易云给的是 http 直链，页面是 https 的话必须换协议，否则被混合内容拦掉 */
      let url = d.url
      if (location.protocol === 'https:' && url.startsWith('http:')) {
        url = 'https://' + url.slice(7)
      }
      /* 提前 60 秒过期，避免播到一半 403 */
      const ttl = Math.max(30, (d.expi || 1200) - 60) * 1000
      urlCache.set(key, { url, br: d.br || 0, expires: Date.now() + ttl })
      return { ok: true, url, br: d.br || 0 }
    }
    relayMessage = (d && d.message) || '没有取到播放地址'
  } catch (e) {
    relayMessage = '中转连接失败：' + (e && e.message ? e.message : e)
  }

  /* 中转说不行 → 直接给镜像地址，让 <audio> 自己跟随 302。
     这时候 br 是未知的（给 0），缓存按保守的 10 分钟算 —— 镜像动不动就
     重新解析一次，缓存久了反而拿到过期地址。 */
  if (METING_FALLBACKS.length) {
    const base = METING_FALLBACKS[mirrorTry % METING_FALLBACKS.length]
    const url = metingUrl(base, relayId)
    urlCache.set(key, { url, br: 0, expires: Date.now() + 10 * 60 * 1000 })
    return { ok: true, url, br: 0, via: 'meting', reason: relayMessage }
  }

  return { ok: false, message: relayMessage }
}

/** 把中转返回的一条结果转成播放器认识的 track 结构 */
export function toTrack(item) {
  return {
    id: 'ne-' + item.relayId,
    relayId: String(item.relayId),
    online: true,
    source: 'netease',
    name: item.name || '未命名',
    artist: item.artist || '',
    album: item.album || '',
    duration: item.duration || 0,
    cover: item.cover || '',
    src: '',
    lyrics: '',
  }
}

/** 清空直链缓存（换音质时用不到，但调试方便） */
export function clearUrlCache() {
  urlCache.clear()
}
