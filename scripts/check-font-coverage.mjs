/**
 * 检查站点里用到的字符是否被 MiSans 的 unicode-range 覆盖。
 * 用法：node scripts/check-font-coverage.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const css = readFileSync(join(root, 'src/fonts/misans-vf.css'), 'utf8')

/* 解析所有 unicode-range，展开成 [start, end] 区间 */
const ranges = []
for (const m of css.matchAll(/unicode-range:([^}]+)\}/g)) {
  for (const part of m[1].split(',')) {
    const t = part.trim().replace(/^U\+/i, '')
    if (!t) continue
    const [a, b] = t.split('-')
    ranges.push([parseInt(a, 16), parseInt(b || a, 16)])
  }
}
ranges.sort((x, y) => x[0] - y[0])
const covered = (cp) => ranges.some(([a, b]) => cp >= a && cp <= b)

/* 收集源码里出现的所有字符（只看中文与常见标点，忽略 ASCII 之外的生僻符号） */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(vue|js|css)$/.test(name)) out.push(p)
  }
  return out
}

const files = [...walk(join(root, 'src')), join(root, 'index.html')]
const seen = new Map()

for (const file of files) {
  if (file.includes('misans-vf.css')) continue
  if (file.includes('boot-theme')) continue
  const text = readFileSync(file, 'utf8')
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp < 0x2e80) continue // 跳过 ASCII / 拉丁，MiSans 基本都有，不必逐个验
    if (!seen.has(ch)) seen.set(ch, file.replace(root, ''))
  }
}

const missing = [...seen.entries()].filter(([ch]) => !covered(ch.codePointAt(0)))

console.log(`切片数: ${ranges.length}`)
console.log(`源码中出现的非 ASCII 字符: ${seen.size}`)
if (missing.length === 0) {
  console.log('✅ 全部被 MiSans 覆盖')
} else {
  console.log(`⚠ ${missing.length} 个字符未被覆盖（会回退到系统字体）:`)
  console.log('  ' + missing.map(([ch]) => ch).join(' '))
}
