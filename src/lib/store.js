/* ============================================================================
 *  store.js —— localStorage 封装
 *
 *  行为和原来的 window.Store 完全一致，键名仍带 `izakaya.` 前缀，
 *  所以老用户的本地设置不会丢。
 * ==========================================================================*/

const NS = 'izakaya.'

export const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(NS + key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch {
      return fallback
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value))
    } catch {
      /* 隐私模式或配额满，静默失败 */
    }
    return value
  },

  remove(key) {
    try {
      localStorage.removeItem(NS + key)
    } catch {
      /* ignore */
    }
  },

  all() {
    const out = {}
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(NS)) out[k.slice(NS.length)] = JSON.parse(localStorage.getItem(k))
      }
    } catch {
      /* ignore */
    }
    return out
  },

  clear() {
    Object.keys(Store.all()).forEach(Store.remove)
  },
}

export default Store
