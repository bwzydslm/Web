/* ============================================================================
 *  theme.js —— 主题与强调色
 *
 *  ⚠ 和 public/assets/js/boot-theme.js 里的判定逻辑必须保持一致，
 *    否则会出现「首帧深色 → 挂载后变浅色」的闪烁。
 * ==========================================================================*/

import { ref } from 'vue'
import { Store } from './store'
import config from '../config'

const root = document.documentElement

/** 'dark' | 'light' | 'auto' */
export const themePref = ref(Store.get('theme.mode', config.theme.defaultMode) || 'dark')

/** 实际生效的 'dark' | 'light' */
export const activeTheme = ref('dark')

export function hexToRgba(hex, a) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '').trim())
  if (!m) return `rgba(167,139,250,${a})`
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`
}

/** 'auto' = 早 7 点到晚 7 点浅色，其余深色 */
export function effectiveMode(mode) {
  if (mode !== 'auto') return mode === 'light' ? 'light' : 'dark'
  const h = new Date().getHours()
  return h >= 7 && h < 19 ? 'light' : 'dark'
}

export function applyAccent() {
  const accent = Store.get('theme.accent', config.theme.accent)
  const accent2 = Store.get('theme.accent2', config.theme.accent2)
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--accent-2', accent2)
  root.style.setProperty('--accent-soft', hexToRgba(accent, 0.16))
  root.style.setProperty('--accent-line', hexToRgba(accent, 0.38))
}

export function applyMode(pref) {
  const p = pref || themePref.value
  const m = effectiveMode(p)
  root.dataset.theme = m
  activeTheme.value = m
  return m
}

export function setThemePref(next) {
  themePref.value = next
  Store.set('theme.mode', next)
  applyMode(next)
}

/** 在浅色/深色之间切换（'auto' 时按当前实际值反向切） */
export function toggleTheme() {
  setThemePref(activeTheme.value === 'dark' ? 'light' : 'dark')
}

export default { themePref, activeTheme, applyAccent, applyMode, setThemePref, toggleTheme, hexToRgba }
