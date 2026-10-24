/* ============================================================================
 *  api.js —— 前端访问后端的唯一出口（原 assets/js/api.js 的模块化版本）
 *
 *  行为与原来保持一致：
 *    · 配置存在 localStorage 的 izakaya.server，base 留空 = 同源
 *    · 自动带 Authorization: Bearer <token>
 *    · 20 秒超时，错误统一成 err.status / err.data
 *    · 上传走 XHR（要 upload.onprogress 报进度）
 * ==========================================================================*/

import { Store } from './store'

const CONF_KEY = 'server'
const TIMEOUT = 20000

export function conf() {
  const c = Store.get(CONF_KEY, {}) || {}
  return {
    base: String(c.base || '').replace(/\/+$/, ''),
    token: String(c.token || ''),
  }
}

export function saveConf(patch) {
  const next = Object.assign(conf(), patch || {})
  Store.set(CONF_KEY, next)
  return next
}

export function isConfigured() {
  return !!conf().token
}

function url(path) {
  return conf().base + path
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`请求超时（${ms / 1000} 秒），可能是网络或 API 地址不对`))
    }, ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

async function req(path, opts = {}) {
  const c = conf()
  const headers = {}
  if (c.token) headers['Authorization'] = 'Bearer ' + c.token

  let payload
  if (opts.form) {
    payload = opts.form
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(opts.body)
  }

  const run = fetch(url(path), {
    method: opts.method || 'GET',
    headers,
    body: payload,
  })

  const res = await withTimeout(run, opts.timeout || TIMEOUT)
  const text = await res.text()

  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    const err = new Error((data && (data.message || data.error)) || 'HTTP ' + res.status)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export function upload(files, meta, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData()
    Array.from(files).forEach((f) => fd.append('files', f))
    Object.keys(meta || {}).forEach((k) => {
      const v = meta[k]
      if (v !== undefined && v !== null && v !== '') fd.append(k, v)
    })

    const xhr = new XMLHttpRequest()
    xhr.open('POST', url('/api/upload'))
    const token = conf().token
    if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token)

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      let data = null
      try { data = JSON.parse(xhr.responseText || 'null') } catch { data = null }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data)
      } else {
        const err = new Error((data && (data.message || data.error)) || 'HTTP ' + xhr.status)
        err.status = xhr.status
        err.data = data
        reject(err)
      }
    }
    xhr.onerror = () => reject(new Error('网络错误，上传中断'))
    xhr.ontimeout = () => reject(new Error('上传超时'))
    xhr.send(fd)
  })
}

export function fileUrl(key) {
  return url('/api/file/' + String(key || '').split('/').map(encodeURIComponent).join('/'))
}

export const Api = {
  conf,
  save: saveConf,
  url,
  isConfigured,

  fileUrl,
  health: () => req('/api/health', { timeout: 15000 }),
  check: () => req('/api/auth/check', { method: 'POST' }),

  list: (params) => {
    const qs = new URLSearchParams(params || {}).toString()
    return req('/api/images' + (qs ? '?' + qs : ''))
  },
  create: (body) => req('/api/images', { method: 'POST', body }),
  update: (id, patch) => req('/api/images/' + encodeURIComponent(id), { method: 'PATCH', body: patch }),
  remove: (id) => req('/api/images/' + encodeURIComponent(id), { method: 'DELETE' }),
  upload,

  home: () => req('/api/home'),

  note: (key) => req('/api/notes/' + encodeURIComponent(key)),
  saveNote: (key, data) => req('/api/notes/' + encodeURIComponent(key), { method: 'PUT', body: data }),
  removeNote: (key) => req('/api/notes/' + encodeURIComponent(key), { method: 'DELETE' }),
}

export default Api
