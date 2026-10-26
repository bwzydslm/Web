/* ============================================================================
 *  check-meting.mjs —— 探活两个 Meting 镜像
 *
 *  为什么需要它：
 *  线上取网易云直链唯一能走通的路就是这两个镜像（原因见 ne-relay/README.md）。
 *  它们是别人搭的公共服务，随时可能挂。挂了的表现是「歌能搜到、点了没声音」，
 *  而这个现象跟 CSP 没放行、跟中转挂了长得一模一样，很难一眼分清。
 *
 *  所以先跑一遍这个，把「镜像活不活」这一项排除掉，再去怀疑别的地方。
 *
 *  用法：
 *    node server/check-meting.mjs
 *    npm run check:meting
 *
 *  判定标准：镜像对 type=url 会 302 到网易云 CDN。拿得到 Location 就算活。
 *  拿不到时它返回的是 200 且没有 Location（不是 4xx），所以不能按状态码判。
 * ==========================================================================*/

const MIRRORS = ['https://api.qijieya.cn/meting/', 'https://api.injahow.cn/meting/']

/* 探针曲目：挑两首尽量不会下架的（Beyond / 陈奕迅）。
   单首失败不代表镜像挂了 —— 有些歌本来就没地址，所以两首看整体。 */
const PROBES = [
  { id: '347230', name: '海阔天空' },
  { id: '299936', name: '富士山下' },
]

const TIMEOUT = 9000

async function probe(base, song) {
  const url = base + '?server=netease&type=url&id=' + encodeURIComponent(song.id)
  const t0 = Date.now()
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT) })
    const loc = res.headers.get('location') || ''
    const ms = Date.now() - t0
    if (!loc) return { ok: false, ms, status: res.status, why: `HTTP ${res.status} 但没有 Location` }
    if (!/^https?:\/\//i.test(loc)) return { ok: false, ms, status: res.status, why: 'Location 不是 http(s) 地址' }
    return { ok: true, ms, status: res.status, host: new URL(loc).host }
  } catch (e) {
    /* 连不上 / 超时：e.cause.code 比 e.message 有用得多（UND_ERR_CONNECT_TIMEOUT 之类） */
    return { ok: false, ms: Date.now() - t0, why: (e && e.cause && e.cause.code) || (e && e.name) || String(e) }
  }
}

const results = []

for (const base of MIRRORS) {
  const host = new URL(base).host
  console.log(`\n${host}`)
  let pass = 0
  for (const song of PROBES) {
    const r = await probe(base, song)
    if (r.ok) {
      pass++
      console.log(`  ✓ ${song.name.padEnd(6)} ${String(r.ms).padStart(5)}ms  → ${r.host}`)
    } else {
      console.log(`  ✗ ${song.name.padEnd(6)} ${String(r.ms).padStart(5)}ms  ${r.why}`)
    }
  }
  results.push({ host, pass, total: PROBES.length })
}

console.log('\n' + '-'.repeat(52))

const alive = results.filter((r) => r.pass > 0)
for (const r of results) {
  console.log(`${r.pass === r.total ? '正常' : r.pass > 0 ? '部分可用' : '不可用'}  ${r.host}  ${r.pass}/${r.total}`)
}

if (!alive.length) {
  console.log('\n两个镜像都挂了 → 在线播放必然失败（搜得到、点不出声）。')
  console.log('要么换镜像（记得同步改 src/lib/online.js 的 METING_FALLBACKS')
  console.log('和 public/_headers 的 CSP），要么先只用本地曲库。')
  process.exit(1)
}

if (alive.length < results.length) {
  console.log('\n有镜像挂了但还有活的 → 前端会自动跳过失败的换下一个，不用改代码。')
}

console.log('')
