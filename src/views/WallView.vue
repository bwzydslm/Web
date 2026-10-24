<script setup>
/* ============================================================================
 *  WallView.vue —— 图墙（从 page-wall.js 迁移）
 *
 *  数据源优先级：
 *    1) 后端 API（D1 + R2）
 *    2) 浏览器本地 localStorage → 再退回 DEMO_ITEMS
 *  后端不可用时页面不会空，只会降级并给出提示。
 * ==========================================================================*/

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import Lightbox from '../components/Lightbox.vue'
import Api, { isConfigured } from '../lib/api'
import { Store } from '../lib/store'
import { toast } from '../lib/toast'

/* 想手工挂静态图片（不用后端）：图片丢进 public/assets/img/，在这里登记。 */
const DEMO_ITEMS = [
  // { name: '夏日祭', src: '/assets/img/1.jpg', tags: ['日常'], ts: Date.parse('2026-07-01') },
]

const PAGE_SIZE = 60

const route = useRoute()
const router = useRouter()

/* ---------------- 状态 ---------------- */
const filter = ref('all')                 // all | fav | recent
const sort = ref(Store.get('wall.sort', 'new'))
const q = ref(String(route.query.q || '').trim())
const source = ref('local')               // local | server
const raw = ref([])
const offset = ref(0)
const total = ref(0)
const canWrite = ref(false)
const loading = ref(false)

const noticeText = ref('')
const noticeKind = ref('')

const showMeta = computed(() => Store.get('wall.showMeta', true))

const lb = ref({ open: false, src: '', caption: '' })

/* ---------------- 数据映射 ---------------- */
function fromLocal() {
  const stored = Store.get('wall.items', [])
  const list = stored.length ? stored : DEMO_ITEMS
  return list.map((it) => ({
    id: it.id || null,
    key: it.key || null,
    name: it.name || '未命名',
    description: it.description || it.desc || '',
    tags: it.tags || [],
    album: it.album || '',
    src: it.src,
    ts: it.ts || 0,
    fav: !!it.fav,
    visibility: it.visibility || 'public',
    size: it.size || 0,
    server: false,
  }))
}

function fromServer(items) {
  return items.map((it) => ({
    id: it.id,
    key: it.key,
    name: it.name || '未命名',
    description: it.description || '',
    tags: it.tags || [],
    album: it.album || '',
    src: Api.fileUrl(it.key),
    ts: it.ts || 0,
    fav: !!it.fav,
    visibility: it.visibility || 'public',
    size: it.size || 0,
    server: true,
  }))
}

/* ---------------- 加载 ---------------- */
function setNotice(text, kind) {
  noticeText.value = text || ''
  noticeKind.value = kind || ''
}

async function loadServer(append) {
  const res = await Api.list({
    q: q.value,
    sort: sort.value,
    limit: PAGE_SIZE,
    offset: append ? offset.value : 0,
    all: isConfigured() ? 1 : 0,
  })
  const items = fromServer(res.items || [])
  total.value = res.total || items.length
  offset.value = (append ? offset.value : 0) + items.length
  raw.value = append ? raw.value.concat(items) : items
  source.value = 'server'
  canWrite.value = isConfigured()
}

function loadLocalData() {
  raw.value = fromLocal()
  total.value = raw.value.length
  offset.value = raw.value.length
  source.value = 'local'
  canWrite.value = false
}

async function refresh(append = false) {
  if (!append) {
    loading.value = true
    setNotice('正在从云端加载…')
  }
  try {
    await loadServer(append)
    const limited = raw.value.length < total.value
    setNotice(
      '已连接后端 · 共 ' + total.value + ' 张' +
        (limited ? '（当前显示 ' + raw.value.length + ' 张）' : ''),
      'ok',
    )
  } catch (e) {
    if (append) {
      setNotice('加载更多失败：' + e.message, 'warn')
      return
    }
    loadLocalData()
    setNotice('后端未连接（' + e.message + '），当前显示浏览器本地数据', 'warn')
  } finally {
    loading.value = false
  }
}

/* ---------------- 筛选 / 排序 ---------------- */
const visibleItems = computed(() => {
  let list = raw.value.slice()

  if (filter.value === 'fav') list = list.filter((it) => it.fav)
  if (filter.value === 'recent') {
    const week = Date.now() - 7 * 24 * 3600 * 1000
    list = list.filter((it) => (it.ts || 0) >= week)
  }
  if (q.value) {
    const needle = q.value.toLowerCase()
    list = list.filter((it) => {
      const hay = [it.name, it.description, (it.tags || []).join(' '), it.album]
        .join(' ')
        .toLowerCase()
      return hay.indexOf(needle) !== -1
    })
  }

  list.sort((a, b) => {
    if (sort.value === 'name') return String(a.name).localeCompare(String(b.name), 'zh')
    if (sort.value === 'old') return (a.ts || 0) - (b.ts || 0)
    return (b.ts || 0) - (a.ts || 0)
  })
  return list
})

const hasMore = computed(
  () => source.value === 'server' && raw.value.length < total.value,
)

const emptyTitle = computed(() =>
  raw.value.length ? '没有符合条件的图片' : '图墙还是空的',
)

function subText(it) {
  const date = it.ts ? new Date(it.ts).toLocaleDateString('zh-CN') : ''
  return (
    [date, (it.tags || []).join(' · ')].filter(Boolean).join(' · ') || '未添加说明'
  )
}

/* ---------------- 操作 ---------------- */
function setFilter(next) {
  filter.value = next
}

function onSortChange() {
  Store.set('wall.sort', sort.value)
  refresh()
}

async function toggleFav(it) {
  try {
    await Api.update(it.id, { fav: !it.fav })
    toast(it.fav ? '已取消收藏' : '已收藏', 'success')
    refresh()
  } catch (e) {
    toast('操作失败：' + e.message, 'error')
  }
}

async function removeItem(it) {
  if (!confirm('确定删除「' + it.name + '」吗？\nD1 记录和 R2 里的文件都会删掉，无法撤销。')) return
  try {
    await Api.remove(it.id)
    toast('已删除', 'success')
    refresh()
  } catch (e) {
    toast('删除失败：' + e.message, 'error')
  }
}

async function loadMore() {
  await refresh(true)
}

function clearFilter() {
  filter.value = 'all'
  q.value = ''
  if (route.query.q) router.replace({ path: '/wall' })
  refresh()
}

function openLightbox(it) {
  lb.value = { open: true, src: it.src, caption: it.name }
}

/* ---------------- 列数自适应 ---------------- */
function applyColumns() {
  const pref = parseInt(Store.get('wall.columns', 4), 10) || 4
  const w = window.innerWidth
  let cols = pref
  if (w < 1400) cols = Math.min(cols, 3)
  if (w < 900) cols = 2
  if (w < 560) cols = 1
  document.documentElement.style.setProperty('--wall-cols', cols)
}

/* ---------------- 生命周期 ---------------- */
onMounted(() => {
  applyColumns()
  window.addEventListener('resize', applyColumns)
  refresh()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', applyColumns)
})

/* 顶栏搜索框会 push /wall?q=...，这里跟着刷新 */
watch(
  () => route.query.q,
  (v) => {
    const next = String(v || '').trim()
    if (next === q.value) return
    q.value = next
    refresh()
  },
)
</script>

<template>
  <div>
    <!-- 连接状态 -->
    <div v-if="noticeText" class="notice" :class="noticeKind ? 'notice--' + noticeKind : ''">
      {{ noticeText }}
    </div>

    <!-- 工具栏 -->
    <div class="wall-toolbar">
      <div class="seg">
        <button type="button" :class="{ 'is-active': filter === 'all' }" @click="setFilter('all')">全部</button>
        <button type="button" :class="{ 'is-active': filter === 'fav' }" @click="setFilter('fav')">收藏</button>
        <button type="button" :class="{ 'is-active': filter === 'recent' }" @click="setFilter('recent')">最近</button>
      </div>

      <select v-model="sort" class="select" style="width:auto" @change="onSortChange">
        <option value="new">最新上传</option>
        <option value="old">最早上传</option>
        <option value="name">按名称</option>
      </select>

      <span class="spacer" />

      <button class="btn" type="button" @click="clearFilter">清除筛选</button>
      <RouterLink class="btn btn--primary" to="/upload">＋ 上传图片</RouterLink>
    </div>

    <!-- 搜索提示 -->
    <p v-if="q" class="muted" style="margin:-4px 0 14px">
      正在搜索：<code>{{ q }}</code>（点「清除筛选」回到全部图片）
    </p>

    <!-- 图片墙 -->
    <section class="wall">
      <div
        v-for="it in visibleItems"
        :key="it.id || it.src"
        class="wall__item"
        @click="openLightbox(it)"
      >
        <div v-if="it.server && canWrite" class="wall__actions">
          <button
            class="icon-btn icon-btn--sm"
            type="button"
            title="收藏 / 取消收藏"
            @click.stop="toggleFav(it)"
          >★</button>
          <button
            class="icon-btn icon-btn--sm"
            type="button"
            title="删除这张图"
            @click.stop="removeItem(it)"
          >✕</button>
        </div>

        <img
          class="wall__thumb"
          :src="it.src"
          :alt="it.name"
          loading="lazy"
          decoding="async"
        >

        <div v-if="showMeta" class="wall__meta">
          <div class="wall__name">
            {{ it.name }}
            <span v-if="it.visibility === 'private'" class="tag">私密</span>
            <span v-if="it.fav" class="tag tag--accent">★</span>
          </div>
          <div class="wall__sub">{{ subText(it) }}</div>
        </div>
      </div>

      <!-- 末尾「添加」大按钮；空状态时不显示（下面已有上传入口） -->
      <RouterLink v-if="visibleItems.length" class="wall__add" to="/upload">
        <span style="font-size:26px">＋</span>
        <span>添加新图片</span>
      </RouterLink>
    </section>

    <!-- 加载更多 -->
    <button v-if="hasMore" class="btn btn--block" type="button" @click="loadMore">
      加载更多（还有 {{ total - raw.length }} 张）
    </button>

    <!-- 空状态 -->
    <div v-if="!visibleItems.length && !loading" class="placeholder">
      <div class="placeholder__title">{{ emptyTitle }}</div>
      <div v-if="raw.length">
        试试清除筛选条件。当前筛选：<code>{{ filter }}</code>
        <template v-if="q"> · 关键词：<code>{{ q }}</code></template>
      </div>
      <div v-else>
        去「上传」页添加图片；或把你的图片放进 <code>/assets/img/</code>，再在
        <code>WallView.vue</code> 的 <code>DEMO_ITEMS</code> 里登记。
      </div>
      <div style="margin-top:16px">
        <RouterLink class="btn btn--primary" to="/upload">开始上传</RouterLink>
      </div>
    </div>

    <Lightbox
      :open="lb.open"
      :src="lb.src"
      :caption="lb.caption"
      @close="lb.open = false"
    />
  </div>
</template>
