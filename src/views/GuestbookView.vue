<script setup>
/* ============================================================================
 *  GuestbookView.vue —— 访客留言板
 *
 *  全站唯一允许匿名写入的地方。防刷在后端（30 秒冷却 + 每小时 10 条 + 蜜罐），
 *  前端只做字数限制和即时反馈。
 * ==========================================================================*/

import { computed, onMounted, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import Api from '../lib/api'
import { toast } from '../lib/toast'

const PAGE = 20
const MAX_NAME = 24
const MAX_CONTENT = 500

const items = ref([])
const total = ref(0)
const loading = ref(false)
const sending = ref(false)
const error = ref('')

const name = ref('')
const content = ref('')
const contact = ref('')
/** 蜜罐：正常用户看不见也填不到 */
const website = ref('')

const canDelete = computed(() => Api.isConfigured())
const hasMore = computed(() => items.value.length < total.value)
const left = computed(() => MAX_CONTENT - content.value.length)

async function load(more = false) {
  loading.value = true
  error.value = ''
  try {
    const res = await Api.messages({
      limit: PAGE,
      offset: more ? items.value.length : 0,
    })
    if (res && res.ok) {
      items.value = more ? items.value.concat(res.items || []) : res.items || []
      total.value = res.total || 0
    }
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (sending.value) return
  if (!content.value.trim()) {
    toast('写点什么再发吧', 'error')
    return
  }

  sending.value = true
  try {
    const res = await Api.postMessage({
      name: name.value.trim(),
      content: content.value.trim(),
      contact: contact.value.trim(),
      website: website.value,
    })

    if (res && res.ok) {
      content.value = ''
      contact.value = ''
      toast('留言已发布', 'success')
      await load()
    }
  } catch (e) {
    toast(e.message || '发送失败', 'error')
  } finally {
    sending.value = false
  }
}

async function remove(item) {
  if (!confirm('删除这条留言？')) return
  try {
    await Api.removeMessage(item.id)
    toast('已删除', 'success')
    await load()
  } catch (e) {
    toast('删除失败：' + e.message, 'error')
  }
}

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' 分钟前'
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + ' 小时前'
  return (
    d.getFullYear() + '/' +
    String(d.getMonth() + 1).padStart(2, '0') + '/' +
    String(d.getDate()).padStart(2, '0')
  )
}

onMounted(() => load())
</script>

<template>
  <div class="gb">
    <header class="gb-head">
      <div class="gb-crumb">
        <span class="gb-crumb__badge"><AppIcon name="message" :size="13" /></span>
        <span class="gb-crumb__path">/guestbook</span>
      </div>
      <h1 class="gb-title">留言板</h1>
    </header>

    <!-- 发布 -->
    <section class="card">
      <div class="card__head">
        <span class="card__title">写留言</span>
        <span class="card__hint">{{ items.length }} / {{ total }}</span>
      </div>
      <div class="card__body stack">
        <div class="gb-row">
          <input
            v-model="name"
            class="input"
            type="text"
            :maxlength="MAX_NAME"
            placeholder="昵称（留空显示匿名访客）"
          >
          <input
            v-model="contact"
            class="input"
            type="text"
            placeholder="联系方式（可选，不会公开显示）"
          >
        </div>

        <textarea
          v-model="content"
          class="textarea"
          rows="4"
          :maxlength="MAX_CONTENT"
          placeholder="说点什么…"
        />

        <!-- 蜜罐：靠 CSS 移出视口，正常用户看不到 -->
        <input
          v-model="website"
          class="gb-hp"
          type="text"
          tabindex="-1"
          autocomplete="off"
          aria-hidden="true"
        >

        <div class="gb-actions">
          <button class="btn btn--primary" type="button" :disabled="sending" @click="submit">
            {{ sending ? '发送中…' : '发布留言' }}
          </button>
          <span class="gb-count" :class="{ 'is-warn': left < 40 }">{{ left }}</span>
        </div>
      </div>
    </section>

    <!-- 列表 -->
    <section class="card">
      <div class="card__head">
        <span class="card__title">全部留言</span>
      </div>
      <div class="card__body card__body--flush">
        <div v-if="error" class="gb-empty">{{ error }}</div>

        <div v-else-if="!items.length" class="gb-empty">
          {{ loading ? '正在加载…' : '还没有人留言' }}
        </div>

        <article v-for="m in items" :key="m.id" class="gb-item">
          <div class="gb-item__head">
            <span class="gb-item__name">{{ m.name || '匿名访客' }}</span>
            <span class="gb-item__time">{{ fmtTime(m.ts) }}</span>
            <button
              v-if="canDelete"
              class="icon-btn icon-btn--sm gb-item__del"
              type="button"
              title="删除"
              @click="remove(m)"
            >
              <AppIcon name="close" :size="13" />
            </button>
          </div>
          <p class="gb-item__text">{{ m.content }}</p>
        </article>
      </div>
    </section>

    <div v-if="hasMore" class="gb-more">
      <button class="btn btn--block" type="button" :disabled="loading" @click="load(true)">
        {{ loading ? '加载中…' : '加载更多' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.gb {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.gb-crumb {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
}
.gb-crumb__badge {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  background: var(--accent, #a78bfa);
  color: #14121c;
}
.gb-crumb__path {
  font-size: 12px;
  opacity: 0.6;
}
.gb-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.5px;
  margin: 0;
}

.gb-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
@media (max-width: 720px) {
  .gb-row {
    grid-template-columns: 1fr;
  }
}

.gb-hp {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.gb-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.gb-count {
  font-size: 11px;
  opacity: 0.4;
  font-variant-numeric: tabular-nums;
}
.gb-count.is-warn {
  color: #ff8a8a;
  opacity: 0.9;
}

.gb-empty {
  padding: 44px 16px;
  text-align: center;
  font-size: 12.5px;
  opacity: 0.55;
}

.gb-item {
  padding: 14px 16px;
  border-bottom: 1px solid var(--line, rgba(255, 255, 255, 0.07));
}
.gb-item:last-child {
  border-bottom: none;
}
.gb-item__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.gb-item__name {
  font-size: 12.5px;
  font-weight: 600;
}
.gb-item__time {
  font-size: 11px;
  opacity: 0.4;
}
.gb-item__del {
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.gb-item:hover .gb-item__del {
  opacity: 1;
}
.gb-item__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
  opacity: 0.85;
}

.gb-more {
  display: flex;
}
</style>
