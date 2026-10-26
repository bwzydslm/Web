/* ============================================================================
 *  netease-proxy.mjs —— 网易云中转（本地开发用）
 *
 *  为什么需要它：
 *  NetEase 的接口对 UA / Referer / Cookie 有要求，浏览器直接 fetch 会被 CORS 拦，
 *  而且播放地址是「带时效的直链」（20 分钟过期），不能写死。所以用一个本地小服务
 *  代取 JSON、代解析地址，浏览器只跟它说话。
 *
 *  只依赖 Node 内置模块（node:http + 全局 fetch），不需要 npm install。
 *
 *  只有一种启动方式：node server/netease-proxy.mjs（或 npm run relay）
 *
 *  ⚠ 线上不用它。线上走 ne-relay/（Cloudflare Pages 项目），
 *    同一套接口的另一份实现，跑在边缘节点上，不用开着电脑。
 *
 *  默认端口 8787，可用 RELAY_PORT 覆盖。
 *
 *  接口（Vite dev 会把 /ne/* 转发到这里）：
 *    GET /ping                     存活探测
 *    GET /search?q=&limit=&offset= 搜索，返回归一化后的曲目
 *    GET /lyric?id=                歌词（LRC）
 *    GET /url?id=&level=           取播放直链
 *    GET /stream?id=&level=        302 跳到直链（给 <audio> 用）
 *
 *  ⚠ 别用本站做版权内容的再分发。中转只给「自己听」用。
 * ==========================================================================*/

import http from 'node:http'
import { URL } from 'node:url'
import { pathToFileURL } from 'node:url'

const PORT = Number(process.env.RELAY_PORT || 8787)

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const REFERER = 'https://music.163.com/'

/* 游客 cookie。不带 MUSIC_U（没有登录态），但 os/appver 这几个字段能让接口
   按「PC 客户端」返回 320k 的地址，而不是 128k 的试听流。 */
const GUEST_COOKIE = 'os=pc; appver=8.9.70; channel=netease; __csrf='

/* 取直链的接口会做地域判断，境外 IP 一律返回 url=null（详见 ne-relay/README.md）。
   本机在国内其实用不到这个头，但两份实现保持完全一致，
   免得「本地能播、线上不能播」这类问题再花一晚去查。 */
const CN_IP = '114.114.114.114'

/* 简易内存缓存：搜索/歌词 10 分钟，直链按接口给的 expi 打折 */
const cache = new Map()
function cacheGet(key) {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expire) {
    cache.delete(key)
    return null
  }
  return hit.value
}
function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expire: Date.now() + ttlMs })
  if (cache.size > 400) {
    // 粗粒度淘汰：删掉最早插入的 100 条
    let i = 0
    for (const k of cache.keys()) {
      cache.delete(k)
      if (++i >= 100) break
    }
  }
}

/* ------------------------------------------------------------------ 抓取 */
async function ne(path, { cookie = GUEST_COOKIE, timeout = 15000 } = {}) {
  const url = path.startsWith('http') ? path : 'https://music.163.com' + path
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Referer: REFERER,
      Cookie: cookie,
      Accept: 'application/json, text/plain, */*',
      'X-Real-IP': CN_IP,
    },
    signal: AbortSignal.timeout(timeout),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* 非 JSON 由调用方处理 */
  }
  return { status: res.status, json, text }
}

/* -------------------------------------------------------------- 归一化 */
function toTrack(s) {
  const ar = (s.ar || s.artists || []).map((a) => a.name).filter(Boolean)
  const al = s.al || s.album || {}
  let cover = al.picUrl || al.picUrl_str || ''
  if (cover) {
    cover = cover.replace(/^http:/, 'https:')
    if (!/\?/.test(cover)) cover += '?param=240y240'
  }
  return {
    relayId: String(s.id),
    name: s.name || '未命名',
    artist: ar.join(' / ') || '未知歌手',
    album: al.name || '',
    // dt 是毫秒
    duration: Math.round(((s.dt || s.duration || 0) / 1000) * 10) / 10,
    cover,
    fee: s.fee,
  }
}

/* ---------------------------------------------------------------- 处理 */
async function handleSearch(q, limit, offset) {
  const key = `s:${q}:${limit}:${offset}`
  const hit = cacheGet(key)
  if (hit) return hit

  const r = await ne(
    `/api/cloudsearch/pc?s=${encodeURIComponent(q)}&type=1&limit=${limit}&offset=${offset}`
  )
  const songs = (r.json && r.json.result && r.json.result.songs) || []
  const total = (r.json && r.json.result && r.json.result.songCount) || songs.length

  const out = { ok: true, items: songs.map(toTrack), total }
  cacheSet(key, out, 10 * 60 * 1000)
  return out
}

async function handleLyric(id) {
  const key = `l:${id}`
  const hit = cacheGet(key)
  if (hit) return hit

  const r = await ne(`/api/song/lyric?id=${encodeURIComponent(id)}&lv=1&kv=1&tv=-1`)
  const lrc = (r.json && r.json.lrc && r.json.lrc.lyric) || ''
  const tlyric = (r.json && r.json.tlyric && r.json.tlyric.lyric) || ''
  const out = { ok: true, lrc, tlyric }
  cacheSet(key, out, 30 * 60 * 1000)
  return out
}

async function handleUrl(id, level) {
  const key = `u:${id}:${level}`
  const hit = cacheGet(key)
  if (hit) return hit

  /* v1 接口带 level，能拿高品质；失败再退回老接口 */
  let data = null
  try {
    const r = await ne(
      `/api/song/enhance/player/url/v1?ids=[${id}]&level=${level}&encodeType=mp3`
    )
    data = (r.json && r.json.data && r.json.data[0]) || null
  } catch {
    data = null
  }

  if (!data || !data.url) {
    try {
      const r2 = await ne(`/api/song/enhance/player/url?ids=[${id}]&br=320000`)
      data = (r2.json && r2.json.data && r2.json.data[0]) || data
    } catch {
      /* 保持原样 */
    }
  }

  if (!data || !data.url) {
    const code = data && data.code
    const msg =
      code === -110
        ? '这首歌需要登录或付费（尝试切换更低音质，或换一首）'
        : code === 404
          ? '这首歌没有可播放的地址（可能已下架）'
          : '没有取到播放地址'
    const out = { ok: false, code, message: msg }
    cacheSet(key, out, 30 * 1000)
    return out
  }

  const out = {
    ok: true,
    url: data.url,
    br: data.br || 0,
    size: data.size || 0,
    type: data.type || '',
    expi: data.expi || 1200,
  }
  /* 直链 20 分钟过期，缓存按七折，留出余量 */
  cacheSet(key, out, Math.max(60, (out.expi * 0.7) | 0) * 1000)
  return out
}

/* ---------------------------------------------------------------- HTTP */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
}

function send(res, status, body, extra = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type':
      typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...CORS,
    ...extra,
  })
  res.end(payload)
}

/**
 * 建一个中转 HTTP 服务（不 listen）。
 * @param {{ log?: (msg: string) => void }} opts
 */
export function createRelay(opts = {}) {
  const log = opts.log || ((m) => console.log(m))
  const stats = { count: 0, startedAt: Date.now() }

  const server = http.createServer(async (req, res) => {
    stats.count++
    const u = new URL(req.url, `http://127.0.0.1:${PORT}`)
    const p = u.pathname.replace(/\/+$/, '') || '/'

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS)
      res.end()
      return
    }
    if (req.method !== 'GET') {
      send(res, 405, { ok: false, error: 'method_not_allowed' })
      return
    }

    try {
      if (p === '/ping') {
        send(res, 200, { ok: true, service: 'netease-relay', port: PORT })
        return
      }

      if (p === '/search') {
        const q = (u.searchParams.get('q') || '').trim()
        if (!q) {
          send(res, 400, { ok: false, error: 'empty_query' })
          return
        }
        const limit = Math.min(50, Math.max(1, parseInt(u.searchParams.get('limit'), 10) || 20))
        const offset = Math.max(0, parseInt(u.searchParams.get('offset'), 10) || 0)
        send(res, 200, await handleSearch(q, limit, offset))
        return
      }

      if (p === '/lyric') {
        const id = u.searchParams.get('id')
        if (!id) {
          send(res, 400, { ok: false, error: 'missing_id' })
          return
        }
        send(res, 200, await handleLyric(id))
        return
      }

      if (p === '/url') {
        const id = u.searchParams.get('id')
        if (!id) {
          send(res, 400, { ok: false, error: 'missing_id' })
          return
        }
        const level = u.searchParams.get('level') || 'exhigh'
        send(res, 200, await handleUrl(id, level))
        return
      }

      if (p === '/stream') {
        const id = u.searchParams.get('id')
        if (!id) {
          send(res, 400, { ok: false, error: 'missing_id' })
          return
        }
        const level = u.searchParams.get('level') || 'exhigh'
        const got = await handleUrl(id, level)
        if (!got.ok) {
          send(res, 404, got)
          return
        }
        /* 跳转到直链，让浏览器自己取流（这样 Range 由 CDN 处理，最稳） */
        res.writeHead(302, { Location: got.url, 'Cache-Control': 'no-store', ...CORS })
        res.end()
        return
      }

      send(res, 404, { ok: false, error: 'not_found', path: p })
    } catch (e) {
      const msg = String(e && e.message ? e.message : e)
      log('[relay] 上游失败: ' + msg)
      send(res, 502, { ok: false, error: 'upstream_failed', message: msg })
    }
  })

  return { server, stats, port: PORT }
}

/* ------------------------------------------------- 直接运行时才自动监听 */
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const { server } = createRelay()
  server.listen(PORT, '127.0.0.1', () => {
    console.log('')
    console.log('  网易云本地中转已启动')
    console.log('  http://127.0.0.1:' + PORT)
    console.log('')
    console.log('  配合 vite dev 使用（/ne/* 会被转发到这里）')
    console.log('  按 Ctrl+C 停止')
    console.log('')
  })
}
