/* ============================================================================
 *  prefs.js —— 全局偏好（响应式 + 自动持久化）
 *
 *  原来靠 data-setting 属性扫描 DOM，改完只有当前页面知道。
 *  SPA 里换个页面就重建了，所以改成共享的 ref：
 *  任何组件读到的都是同一份，谁改了所有人都能感知。
 *
 *  用法：
 *    const showFooter = useSetting('ui.showFooter', true)
 *    showFooter.value = false        // 自动写回 localStorage
 * ==========================================================================*/

import { ref, watch } from 'vue'
import { Store } from './store'

/** 同一个 key 只创建一次 ref，保证跨组件共享 */
const registry = new Map()

export function useSetting(key, fallback) {
  if (registry.has(key)) return registry.get(key)

  const v = ref(Store.get(key, fallback))
  watch(v, (next) => Store.set(key, next))
  registry.set(key, v)
  return v
}

/** 恢复默认时把所有已注册的 ref 同步回新值（避免页面还显示旧值） */
export function resetSettings() {
  Store.clear()
  registry.forEach((v, key) => {
    v.value = undefined
  })
  registry.clear()
}
