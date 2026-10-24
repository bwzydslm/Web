<script setup>
/* ============================================================================
 *  UploadView.vue —— 上传页（从 page-upload.js 迁移）
 *
 *  两种模式自动切换：
 *    A. 后端已配口令 → 真上传：文件进 R2，元数据进 D1
 *    B. 没配口令     → 本地预览：只记在浏览器里，不发请求
 *
 *  上传前会在浏览器端压缩（最长边 1600、转 WebP），手机照片通常能小 5~10 倍。
 * ==========================================================================*/

import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import Api from '../lib/api'
import { Store } from '../lib/store'
import { useSetting } from '../lib/prefs'
import { toast } from '../lib/toast'

/* ---------------- 常量 ---------------- */
const MAX_EDGE = 1600

const USE_WEBP = (() => {
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 1
    return c.toDataURL('image/webp').indexOf('data:image/webp') === 0
  } catch {
    return false
  }
})()

/* ---------------- 状态 ---------------- */
/** 队列项：{ file, url, origSize, sent, sentSize, width, height, status, progress, error } */
const queue = ref([])
const uploading = ref(false)
const uploadState = ref('等待中…')

const quality = useSetting('upload.quality', 82)
const album = useSetting('upload.album', '未分类')

const metaTitle = ref('')
const metaTags = ref('')
const metaDesc = ref('')
const showPublic = ref(true)

const fileInput = ref(null)
const dropzone = ref(null)
const overZone = ref(false)

const ALBUMS = ['未分类', '日常', '风景', '截图', '其他']

const configured = computed(() => Api.isConfigured())

/* ---------------- 文件选择 ---------------- */
function pickFiles() {
  fileInput.value?.click()
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

function addFiles(files) {
  Array.from(files || []).forEach((f) => {
    if (!/^image\//.test(f.type)) {
      toast(f.name + ' 不是图片，已跳过', 'error')
      return
    }
    const item = reactive({
      file: f,
      url: URL.createObjectURL(f),
      origSize: f.size,
      sent: null,
      sentSize: 0,
      width: 0,
      height: 0,
      status: 'ready',
      progress: 0,
      error: '',
    })
    queue.value.push(item)

    /* 顺便量尺寸，上传时一起写进数据库 */
    const probe = new Image()
    probe.onload = () => {
      item.width = probe.naturalWidth
      item.height = probe.naturalHeight
    }
    probe.src = item.url
  })
}

function onFileChange(e) {
  addFiles(e.target.files)
  e.target.value = ''
}

function onDrop(e) {
  overZone.value = false
  addFiles(e.dataTransfer?.files)
}

/* ---------------- 浏览器端压缩 ---------------- */
function loadBitmap(file) {
  if (window.createImageBitmap) return createImageBitmap(file)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

async function compressImage(file, q) {
  if (/gif|svg/.test(file.type)) return null // 动图/矢量不压

  let bmp
  try {
    bmp = await loadBitmap(file)
  } catch {
    return null // 解不出来就传原图
  }

  const w0 = bmp.width || bmp.naturalWidth
  const h0 = bmp.height || bmp.naturalHeight
  if (!w0 || !h0) return null

  const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0))

  /* 尺寸本来就小、体积也不大 → 不必重编码（重编码可能反而变大） */
  if (scale === 1 && file.size <= 500 * 1024) return null

  const w = Math.round(w0 * scale)
  const h = Math.round(h0 * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, w, h)

  const type = USE_WEBP ? 'image/webp' : 'image/jpeg'
  const blob = await new Promise((r) => canvas.toBlob(r, type, q))
  if (!blob || blob.size >= file.size) return null

  const ext = type === 'image/webp' ? '.webp' : '.jpg'
  const name = file.name.replace(/\.[^.]+$/, '') + ext

  return { blob, file: new File([blob], name, { type }), width: w, height: h }
}

/* ---------------- 队列操作 ---------------- */
function removeAt(i) {
  if (uploading.value) return
  const it = queue.value[i]
  if (it) URL.revokeObjectURL(it.url)
  queue.value.splice(i, 1)
}

function clearQueue() {
  if (uploading.value) return
  queue.value.forEach((it) => URL.revokeObjectURL(it.url))
  queue.value = []
  uploadState.value = '等待中…'
}

function statusLabel(it) {
  if (it.status === 'done') return '已完成'
  if (it.status === 'error') return '失败'
  if (it.status === 'compressing') return '压缩中…'
  if (it.status === 'uploading') return '上传中 ' + it.progress + '%'
  return '待上传'
}

function sizeText(it) {
  if (it.sentSize && it.sentSize < it.origSize) {
    return fmtSize(it.origSize) + ' → ' + fmtSize(it.sentSize)
  }
  return fmtSize(it.file.size)
}

function dimText(it) {
  return it.width ? it.width + '×' + it.height + ' · ' : ''
}

/* ---------------- 上传 ---------------- */
function buildMeta() {
  return {
    name: metaTitle.value.trim(),
    tags: metaTags.value.trim(),
    description: metaDesc.value.trim(),
    album: album.value,
    visibility: showPublic.value ? 'public' : 'private',
    dims: JSON.stringify(queue.value.map((it) => ({ w: it.width || 0, h: it.height || 0 }))),
  }
}

async function startUpload() {
  if (uploading.value) return
  if (!queue.value.length) {
    toast('先选择要上传的图片吧', 'error')
    return
  }

  if (!configured.value) {
    toast('还没配置后端口令，先做本地预览', 'info')
    localOnly()
    return
  }

  uploading.value = true
  queue.value.forEach((it) => {
    it.status = 'ready'
    it.progress = 0
    it.error = ''
    it.sent = null
    it.sentSize = 0
  })

  const q = (parseInt(quality.value, 10) || 82) / 100

  /* ① 逐张压缩（失败就用原图，绝不阻塞上传） */
  for (let i = 0; i < queue.value.length; i++) {
    const it = queue.value[i]
    it.status = 'compressing'
    uploadState.value = '正在压缩 ' + (i + 1) + ' / ' + queue.value.length + '…'

    let out = null
    try {
      out = await compressImage(it.file, q)
    } catch {
      out = null
    }

    if (out) {
      it.sent = out.file
      it.sentSize = out.blob.size
      it.width = out.width
      it.height = out.height
    } else {
      it.sent = it.file
      it.sentSize = it.file.size
    }
  }
  uploadState.value = '开始上传…'

  try {
    const res = await Api.upload(
      queue.value.map((it) => it.sent || it.file),
      buildMeta(),
      (pct) => {
        const each = Math.min(100, Math.round(pct))
        queue.value.forEach((it) => {
          if (it.status !== 'done') {
            it.status = 'uploading'
            it.progress = each
          }
        })
        uploadState.value = '上传中… ' + pct + '%'
      },
    )

    queue.value.forEach((it) => {
      it.status = 'done'
      it.progress = 100
    })
    uploadState.value = '完成：' + (res.count || 0) + ' 张已入库'
    toast('上传成功，共 ' + (res.count || 0) + ' 张', 'success')

    metaTitle.value = ''
    metaTags.value = ''
    metaDesc.value = ''
  } catch (e) {
    queue.value.forEach((it) => {
      if (it.status !== 'done') {
        it.status = 'error'
        it.error = e.message
      }
    })
    uploadState.value = '失败：' + e.message
    toast('上传失败：' + e.message, 'error')
  } finally {
    uploading.value = false
  }
}

/** 没配后端时的本地模式：存进 localStorage，图墙仍然看得到（刷新后地址失效） */
function localOnly() {
  const m = buildMeta()
  const items = Store.get('wall.items', [])
  const tags = m.tags
    ? m.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    : []

  queue.value.forEach((it, i) => {
    it.status = 'done'
    it.progress = 100
    items.push({
      name: m.name
        ? queue.value.length > 1 ? m.name + ' ' + (i + 1) : m.name
        : it.file.name,
      src: it.url, // 临时地址，刷新后失效
      tags,
      desc: m.description,
      album: m.album,
      size: it.file.size,
      ts: Date.now(),
    })
  })
  Store.set('wall.items', items)
  uploadState.value = '本地预览模式：已记录 ' + queue.value.length + ' 张（没有上传）'
  toast('已记录到本地（刷新后图片地址会失效）', 'info')
}

/* ---------------- 导出 ---------------- */
function exportForm() {
  const data = {
    title: metaTitle.value,
    tags: metaTags.value,
    desc: metaDesc.value,
    album: album.value,
    quality: quality.value,
    files: queue.value.map((it) => ({
      name: it.file.name,
      size: it.file.size,
      type: it.file.type,
      w: it.width,
      h: it.height,
    })),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'upload-meta.json'
  a.click()
  URL.revokeObjectURL(a.href)
  toast('已导出 JSON', 'success')
}

/* ---------------- 清理 ---------------- */
onBeforeUnmount(() => {
  queue.value.forEach((it) => URL.revokeObjectURL(it.url))
})
</script>

<template>
  <div>
    <!-- 模式提示 -->
    <div class="notice" :class="configured ? 'notice--ok' : 'notice--warn'">
      <template v-if="configured">
        已连接后端：上传会把文件存进 R2，元数据写进 D1。
      </template>
      <template v-else>
        未配置后端口令：现在只做本地预览，文件不会发出去。到「设置 → 服务端 / API」填入口令即可启用真上传。
      </template>
    </div>

    <div class="upload-layout">
      <!-- ============ 左栏 ============ -->
      <div>
        <section class="card">
          <div class="card__head">
            <span class="card__title">选择图片</span>
            <span class="card__hint">支持拖拽 · 可多选</span>
          </div>
          <div class="card__body">
            <div
              ref="dropzone"
              class="dropzone"
              :class="{ 'is-over': overZone }"
              @click="pickFiles"
              @dragenter.prevent="overZone = true"
              @dragover.prevent="overZone = true"
              @dragleave.prevent="overZone = false"
              @drop.prevent="onDrop"
            >
              <div class="dropzone__ico">⬆</div>
              <div class="dropzone__title">把图片拖到这里，或点击选择文件</div>
              <div class="dropzone__hint">PNG / JPG / WebP / GIF，建议单张不超过 5MB</div>
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                multiple
                hidden
                @change="onFileChange"
              >
            </div>

            <div class="inline" style="margin-top:14px">
              <button class="btn" type="button" @click="pickFiles">选择文件</button>
              <button class="btn btn--ghost" type="button" :disabled="uploading" @click="clearQueue">
                清空列表
              </button>
              <span class="muted">
                {{ queue.length ? '已选择 ' + queue.length + ' 个文件' : '未选择文件' }}
              </span>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card__head">
            <span class="card__title">上传队列</span>
            <span class="card__hint">{{ queue.length }} 个文件</span>
          </div>
          <div class="card__body card__body--flush">
            <div class="filelist">
              <div v-if="!queue.length" class="fileitem">
                <div class="fileitem__thumb" />
                <div class="fileitem__main">
                  <div class="fileitem__name muted">还没有选择文件</div>
                  <div class="fileitem__sub">选好文件后会出现在这里，并显示每个文件的上传进度条</div>
                </div>
              </div>

              <div v-for="(it, i) in queue" :key="it.url" class="fileitem">
                <img class="fileitem__thumb" :src="it.url" alt="">
                <div class="fileitem__main">
                  <div class="fileitem__name">{{ it.file.name }}</div>
                  <div class="fileitem__sub">
                    {{ dimText(it) }}{{ sizeText(it) }}
                    <span v-if="it.error" style="color:#ff8a8a"> · {{ it.error }}</span>
                  </div>
                  <div
                    v-if="it.status === 'uploading' || it.status === 'done'"
                    class="progress"
                  >
                    <div class="progress__bar" :style="{ width: it.progress + '%' }" />
                  </div>
                </div>

                <span class="tag" :class="{ 'tag--accent': it.status === 'done' }">
                  {{ statusLabel(it) }}
                </span>

                <button
                  class="icon-btn icon-btn--sm"
                  type="button"
                  title="移除"
                  :disabled="uploading"
                  @click="removeAt(i)"
                >
                  <AppIcon name="close" :size="15" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <div class="inline" style="margin-top:16px">
          <button class="btn btn--primary" type="button" :disabled="uploading" @click="startUpload">
            {{ uploading ? '处理中…' : '开始上传' }}
          </button>
          <span class="muted">{{ uploadState }}</span>
        </div>

        <p class="muted" style="margin-top:12px;font-size:12px">
          提示：要先在「设置 → 服务端 / API」填入与云端一致的 <code>SITE_TOKEN</code>，
          这里的上传才会真正写进 R2 和 D1。部署步骤见 <code>docs/cloudflare-d1-r2.md</code>。
        </p>
      </div>

      <!-- ============ 右栏 ============ -->
      <div>
        <section class="card">
          <div class="card__head"><span class="card__title">图片信息</span></div>
          <div class="card__body stack">
            <label class="field">
              <span class="field__label">标题</span>
              <input v-model="metaTitle" class="input" type="text" placeholder="给这组图片起个名字">
            </label>

            <label class="field">
              <span class="field__label">标签（用英文逗号分隔）</span>
              <input v-model="metaTags" class="input" type="text" placeholder="日常, 风景, 2026">
            </label>

            <label class="field">
              <span class="field__label">描述</span>
              <textarea v-model="metaDesc" class="textarea" placeholder="想说的话、拍摄地点、心情……" />
            </label>

            <label class="field">
              <span class="field__label">相册 / 分类</span>
              <select v-model="album" class="select">
                <option v-for="a in ALBUMS" :key="a" :value="a">{{ a }}</option>
              </select>
            </label>
          </div>
        </section>

        <section class="card">
          <div class="card__head"><span class="card__title">发布选项</span></div>

          <div class="row">
            <div class="row__main">
              <div class="row__label">公开可见</div>
              <div class="row__desc">关闭后只在「设置 → 私密」里能看到</div>
            </div>
            <div class="row__ctrl">
              <label class="switch">
                <input v-model="showPublic" type="checkbox">
                <span class="switch__track" />
              </label>
            </div>
          </div>

          <div class="row">
            <div class="row__main">
              <div class="row__label">加入「最近更新」</div>
              <div class="row__desc">上传后是否出现在首页</div>
            </div>
            <div class="row__ctrl">
              <label class="switch">
                <input type="checkbox" checked>
                <span class="switch__track" />
              </label>
            </div>
          </div>

          <div class="row">
            <div class="row__main">
              <div class="row__label">压缩质量</div>
              <div class="row__desc">越高越清晰，文件也越大</div>
            </div>
            <div class="row__ctrl">
              <input v-model.number="quality" type="range" min="1" max="100">
              <span class="muted">{{ quality }}</span>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card__head"><span class="card__title">快捷操作</span></div>
          <div class="card__body stack">
            <button class="btn btn--block" type="button" @click="exportForm">导出这份信息（JSON）</button>
            <RouterLink class="btn btn--block" to="/wall">前往图墙查看</RouterLink>
            <RouterLink class="btn btn--block" to="/settings">调整站点设置</RouterLink>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
