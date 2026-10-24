<script setup>
/* ============================================================================
 *  HomeView.vue —— 首页（SPA 试点页）
 *
 *  数据来自 /api/home 一个请求：统计 + 最近 4 张 + 随手记。
 *  接口不可用时退回 config.home 的默认文案，不会白屏。
 * ==========================================================================*/

import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import config from '../config'
import AppIcon from '../components/AppIcon.vue'
import Api, { isConfigured } from '../lib/api'
import { toast } from '../lib/toast'

const home = config.home

const total = ref(0)
const bytes = ref(0)
const latest = ref(0)
const recent = ref([])
const notice = ref(null)
const loading = ref(true)
const offline = ref(false)

const editing = ref(false)
const draft = ref({ title: '', body: '', tags: '' })
const saving = ref(false)

const stats = computed(() => {
  const mb = bytes.value ? (bytes.value / 1024 / 1024).toFixed(1) : '0'
  const ts = latest.value ? new Date(latest.value) : null
  const latestText = ts
    ? `${ts.getFullYear()}/${String(ts.getMonth() + 1).padStart(2, '0')}/${String(ts.getDate()).padStart(2, '0')}`
    : '—'
  return [
    { icon: '🖼', label: '图片总数', value: String(total.value), unit: '张' },
    { icon: '▦', label: '占用空间', value: mb, unit: 'MB' },
    { icon: '↻', label: '最近更新', value: latestText, unit: '' },
  ]
})

/* 公告：云端优先 → 本机 → 配置文件默认文案 */
const noticeView = computed(() => {
  if (notice.value) {
    return {
      title: notice.value.title || home.notice.title,
      lines: String(notice.value.body || '').split('\n').filter(Boolean),
      tags: notice.value.tags || [],
    }
  }
  return {
    title: home.notice.title,
    lines: home.notice.lines || [],
    tags: home.notice.tags || [],
  }
})

const canEdit = computed(() => {
  if (home.editable === false) return false
  if (home.editable === 'owner') return isConfigured()
  return true
})

function imageUrl(item) {
  return Api.fileUrl(item.key)
}

function fmtSize(n) {
  if (!n) return ''
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

async function load() {
  loading.value = true
  try {
    const d = await Api.home()
    if (d && d.ok) {
      total.value = d.total || 0
      bytes.value = d.bytes || 0
      latest.value = d.latest || 0
      recent.value = d.recent || []
      notice.value = d.notice || null
      offline.value = false
    }
  } catch (e) {
    offline.value = true
    console.warn('[home] 接口不可用，已退回默认文案：', e && e.message)
  } finally {
    loading.value = false
  }
}

function startEdit() {
  draft.value = {
    title: noticeView.value.title,
    body: (notice.value && notice.value.body) || noticeView.value.lines.join('\n'),
    tags: ((notice.value && notice.value.tags) || noticeView.value.tags).join(','),
  }
  editing.value = true
}

async function saveEdit() {
  if (saving.value) return
  saving.value = true
  try {
    await Api.saveNote('notice', {
      title: draft.value.title,
      body: draft.value.body,
      tags: draft.value.tags.split(',').map((s) => s.trim()).filter(Boolean),
    })
    toast('已保存到云端', 'success')
    editing.value = false
    await load()
  } catch (e) {
    toast(e.message || '保存失败，检查设置页的应用口令', 'error')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <!-- ================= 主视觉 ================= -->
    <section class="hero reveal">
      <span class="hero__badge">个人空间</span>
      <h2 class="hero__title">{{ home.heroTitle }}</h2>
      <p class="hero__text">{{ home.heroText }}</p>
      <div class="hero__actions">
        <RouterLink class="btn btn--primary" to="/wall">去看图墙</RouterLink>
        <RouterLink class="btn" to="/upload">上传新图片</RouterLink>
      </div>
      <div class="hero__meta">
        <span><b>4</b>个页面</span>
        <span><b>云端 + 本地</b>双模式存储</span>
        <span>按 <kbd>Ctrl</kbd> + <kbd>B</kbd> 收起侧边栏</span>
      </div>
    </section>

    <!-- ================= 概览 ================= -->
    <h3 class="section-title reveal" style="--d:.06s">概览</h3>
    <section class="grid grid--stats reveal" style="--d:.08s">
      <div v-for="s in stats" :key="s.label" class="stat">
        <span class="stat__icon">{{ s.icon }}</span>
        <div class="stat__label">{{ s.label }}</div>
        <div class="stat__value">{{ s.value }}<span v-if="s.unit" class="stat__unit">{{ s.unit }}</span></div>
      </div>
    </section>

    <!-- ================= 快捷入口 ================= -->
    <h3 class="section-title reveal" style="--d:.1s">快捷入口</h3>
    <section class="grid grid--3 reveal" style="--d:.12s">
      <RouterLink v-for="q in home.quickLinks" :key="q.href" class="quick" :to="q.href">
        <span class="quick__ico"><AppIcon :name="q.icon" :size="18" /></span>
        <span>
          <span class="quick__label">{{ q.label }}</span><br>
          <span class="quick__sub">{{ q.sub || '' }}</span>
        </span>
      </RouterLink>
    </section>

    <!-- ================= 最近更新 ================= -->
    <h3 class="section-title reveal" style="--d:.16s">最近更新</h3>
    <div class="grid grid--2 reveal" style="--d:.18s">
      <!-- 最新图片 -->
      <article class="card">
        <div class="card__head">
          <span class="card__title">最新图片</span>
          <RouterLink class="card__hint" to="/wall">查看全部 →</RouterLink>
        </div>
        <div class="card__body">
          <div v-if="recent.length" class="recent-list">
            <RouterLink v-for="img in recent" :key="img.id" class="recent-item" to="/wall">
              <img :src="imageUrl(img)" :alt="img.name" loading="lazy" decoding="async">
              <span class="recent-item__meta">
                <span class="recent-item__name">{{ img.name }}</span>
                <span class="recent-item__size">{{ fmtSize(img.size) }}</span>
              </span>
            </RouterLink>
          </div>

          <div v-else class="empty-mini">
            <div class="empty-mini__ico">🖼</div>
            <div>{{ loading ? '正在加载…' : '还没有图片' }}</div>
            <div style="margin-top:14px">
              <RouterLink class="btn btn--primary" to="/upload">上传第一张</RouterLink>
            </div>
          </div>
        </div>
      </article>

      <!-- 随手记 / 公告 -->
      <article class="card">
        <div class="card__head">
          <span class="card__title">{{ noticeView.title }}</span>
          <button
            v-if="canEdit && !editing"
            class="btn btn--ghost btn--sm"
            type="button"
            @click="startEdit"
          >
            编辑
          </button>
          <span v-if="offline" class="card__hint" title="接口不可用，显示的是默认文案">离线</span>
        </div>

        <div class="card__body">
          <!-- 展示态 -->
          <template v-if="!editing">
            <p v-for="(line, i) in noticeView.lines" :key="i" class="muted">{{ line }}</p>
            <div v-if="noticeView.tags.length" class="notice-tags">
              <span v-for="t in noticeView.tags" :key="t" class="notice-tag">{{ t }}</span>
            </div>
          </template>

          <!-- 编辑态 -->
          <div v-else class="notice-editor">
            <input v-model="draft.title" class="notice-input" placeholder="标题">
            <textarea v-model="draft.body" class="notice-input" rows="6" placeholder="正文，一行一段" />
            <input v-model="draft.tags" class="notice-input" placeholder="标签，逗号分隔">
            <div class="notice-editor__actions">
              <button class="btn btn--primary btn--sm" type="button" :disabled="saving" @click="saveEdit">
                {{ saving ? '保存中…' : '保存' }}
              </button>
              <button class="btn btn--ghost btn--sm" type="button" @click="editing = false">取消</button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
/* 只补原 CSS 里没有的、本次迁移新增的几个类，其余样式全部沿用全局 style.css */
.recent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.recent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
  transition: background 0.15s ease-out;
}
.recent-item:hover {
  background: rgba(255, 255, 255, 0.05);
}
.recent-item img {
  width: 46px;
  height: 46px;
  object-fit: cover;
  border-radius: 8px;
  flex: 0 0 auto;
}
.recent-item__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.recent-item__name {
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-item__size {
  font-size: 11px;
  opacity: 0.55;
}
.notice-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.notice-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  opacity: 0.7;
}
.notice-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.notice-input {
  width: 100%;
  font: inherit;
  font-size: 12.5px;
  padding: 7px 9px;
  border-radius: 8px;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.14));
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
  resize: vertical;
}
.notice-editor__actions {
  display: flex;
  gap: 8px;
}
</style>
