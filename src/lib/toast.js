/* ============================================================================
 *  toast.js —— 轻提示
 *
 *  复用原来的 .toast-host / .toast--success 等类名，样式不用改。
 *  用普通 DOM 操作而不是 Vue 组件，是因为它要在任何组件之外也能调用。
 * ==========================================================================*/

import { ICONS } from './icons'

let host = null

function ensureHost() {
  if (!host) {
    host = document.createElement('div')
    host.className = 'toast-host'
    document.body.appendChild(host)
  }
  return host
}

function iconSvg(name) {
  const path = ICONS[name]
  if (!path) return ''
  return `<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
}

export function toast(msg, type, ms) {
  const el = document.createElement('div')
  el.className = 'toast toast--' + (type || 'info')
  el.innerHTML = iconSvg(type === 'error' ? 'close' : type === 'success' ? 'check' : 'link') + '<span></span>'
  el.lastChild.textContent = msg
  ensureHost().appendChild(el)

  requestAnimationFrame(() => el.classList.add('is-in'))
  setTimeout(() => {
    el.classList.remove('is-in')
    setTimeout(() => el.remove(), 260)
  }, ms || 2400)
}

export default toast
