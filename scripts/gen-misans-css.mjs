/**
 * scripts/gen-misans-css.mjs
 * ---------------------------------------------------------------------------
 * 从本机抓取一次 MiSans 可变字体的 @font-face 切片表，生成精简版 CSS。
 *
 * 为什么要这一步：
 *   · 小米官方 font 服务（font.sec.miui.com/font/css）只给**静态字重**，
 *     多档 CSS 体积成倍（4 档就 407KB），而且没有 VF；
 *   · 本站的字重值大量使用 550/560/620/650/680 这类中间档，
 *     本质是按**可变字体**设计的，静态档会把它们压平；
 *   · 小米官网自己在用的 VF 切片表（56 片，font-weight: 1 999）指向的
 *     正是官方字体 CDN `cdn-file.hyperos.mi.com`，且带 Access-Control-Allow-Origin: *。
 *
 * 因此：这里只做「取切片清单 + 删掉 woff/ttf/eot 冗余格式」，
 * 字体文件本身仍从小米官方 CDN 加载，不复制、不修改、不再分发字体软件。
 *
 * 用法：node scripts/gen-misans-css.mjs
 * 何时重跑：小米换了字体版本（哈希文件名变了）导致字体 404、页面回退系统字体时。
 * ---------------------------------------------------------------------------
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const SOURCE = 'https://hr.xiaomi.com/website/assets/fonts/global.css'
const OUT = fileURLToPath(new URL('../src/fonts/misans-vf.css', import.meta.url))

const res = await fetch(SOURCE, { headers: { 'user-agent': 'Mozilla/5.0 Chrome/120' } })
if (!res.ok) throw new Error(`抓取失败：${res.status}`)
const css = await res.text()

const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1])
if (!faces.length) throw new Error('没解析到任何 @font-face，源可能改版了')

const out = []
for (const body of faces) {
  /* 源 CSS 里的 font-family 自带引号（'MiSans VF'），先剥掉再统一加，避免套成 ''MiSans VF'' */
  const family = ((body.match(/font-family:\s*([^;]+);/) || [])[1] || '').trim().replace(/^['"]|['"]$/g, '')
  const weight = (body.match(/font-weight:\s*([^;]+);/) || [])[1]?.trim()
  const display = (body.match(/font-display:\s*([^;]+);/) || [])[1]?.trim() || 'swap'
  /* 源里的 unicode-range 是折行的，压成一行既省体积也更好比对 */
  const range = ((body.match(/unicode-range:\s*([^;]+);/) || [])[1] || '').replace(/\s+/g, ' ').trim()
  const woff2 = (body.match(/url\(['"]?([^)'"]+\.woff2)['"]?\)/) || [])[1]

  if (!family || !weight || !range || !woff2) {
    console.warn('跳过一条不完整的 @font-face')
    continue
  }
  if (!woff2.startsWith('https://cdn-file.hyperos.mi.com/')) {
    throw new Error(`意外的字体域名：${woff2}（不再从官方 CDN 取，需重新评估）`)
  }

  out.push(
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:${display};` +
      `src:url('${woff2}') format('woff2');unicode-range:${range}}`
  )
}

const header = `/* ============================================================================
 *  MiSans VF —— 小米发布的可变字体，免费商用（《MiSans 字体知识产权许可协议》）
 *
 *  ⚠ 本文件由 scripts/gen-misans-css.mjs 生成，不要手改。
 *  只包含切片清单（URL + unicode-range），字体文件本身从小米官方 CDN 加载：
 *    https://cdn-file.hyperos.mi.com/mi-font-service/misans_vf/VF/
 *  因此不涉及复制、修改或再分发字体软件。
 *
 *  协议要求：在软件中特别注明使用了 MiSans 字体 —— 见 config.js 的 footer.credit。
 *  共 ${out.length} 个切片；浏览器按 unicode-range 只下载页面实际用到的那些。
 * ==========================================================================*/
`

mkdirSync(fileURLToPath(new URL('../src/fonts/', import.meta.url)), { recursive: true })
writeFileSync(OUT, header + out.join('\n') + '\n', 'utf8')

const bytes = (header + out.join('\n')).length
console.log(`已写入 ${OUT}`)
console.log(`切片数：${out.length}，CSS 体积：${(bytes / 1024).toFixed(1)} KB`)
