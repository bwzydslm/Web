<script setup>
/* ============================================================================
 *  AudioUpload.vue —— 音频上传
 *
 *  音频不压缩（压了会掉音质），直接进 R2，元数据进 D1 的 tracks 表。
 *  上传完成后重新拉一次歌单，音乐页立刻就能看到。
 * ==========================================================================*/

import { reactive, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import Api from '../lib/api'
import { loadPlaylist, music } from '../lib/music'
import { useSetting } from '../lib/prefs'
import { toast } from '../lib/toast'

const album = useSetting('upload.album', '未分类')
const ALBUMS = ['未分类', '日常', '风景', '截图', '其他', '音乐']

const queue = ref([])
const uploading = ref(false)
const state = ref('等待中…')
const progress = ref(0)

const name = ref('')
const artist = ref('')
const lyrics = ref('')
const showPublic = ref(true)

const fileInput = ref(null)
const overZone = ref(false)

const configured = ref(Api.isConfigured())

function pick() {
  fileInput.value?.click()
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

function probeDuration(file, onDone) {
  const url = URL.createObjectURL(file)
  const a = new Audio()
  a.preload = 'metadata'
  a.onloadedmetadata = () => {
    onDone(Number.isFinite(a.duration) ? a.duration : 0)
    URL.revokeObjectURL(url)
  }
  a.onerror = () => {
    onDone(0)
    URL.revokeObjectURL(url)
  }
  a.src = url
}

function addFiles(files) {
  Array.from(files || []).forEach((f) => {
    if (!/^audio\//.test(f.type) && !/\.(mp3|m4a|aac|ogg|wav|flac|webm)$/i.test(f.name)) {
      toast(f.name + ' 不是音频，已跳过', 'error')
      return
    }
    const item = reactive({ file: f, duration: 0, status: 'ready', error: '' })
    probeDuration(f, (d) => {
      item.duration = d
    })
    queue.value.push(item)
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

function removeAt(i) {
  if (uploading.value) return
  queue.value.splice(i, 1)
}

function clearQueue() {
  if (uploading.value) return
  queue.value = []
  state.value = '等待中…'
  progress.value = 0
}

function statusLabel(it) {
  if (it.status === 'done') return '已完成'
  if (it.status === 'error') return '失败'
  if (it.status === 'uploading') return '上传中'
  return '待上传'
}

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m + ':' + String(s).padStart(2, '0')
}

async function startUpload() {
  if (uploading.value) return
  if (!queue.value.length) {
    toast('先选择音频文件', 'error')
    return
  }
  if (!Api.isConfigured()) {
    toast('还没配置后端口令，先去设置里填 SITE_TOKEN', 'error')
    return
  }

  uploading.value = true
  progress.value = 0
  queue.value.forEach((it) => {
    it.status = 'ready'
    it.error = ''
  })

  const first = queue.value[0]

  try {
    const res = await Api.upload(
      queue.value.map((it) => it.file),
      {
        kind: 'audio',
        name: name.value.trim(),
        artist: artist.value.trim(),
        album: album.value,
        lyrics: lyrics.value,
        duration: first.duration || 0,
        visibility: showPublic.value ? 'public' : 'private',
      },
      (pct) => {
        progress.value = Math.min(100, Math.round(pct))
        state.value = '上传中… ' + progress.value + '%'
        queue.value.forEach((it) => {
          if (it.status !== 'done') it.status = 'uploading'
        })
      },
    )

    queue.value.forEach((it) => {
      it.status = 'done'
    })
    state.value = '完成：' + (res.count || 0) + ' 首已入库'
    toast('上传成功，共 ' + (res.count || 0) + ' 首', 'success')

    name.value = ''
    artist.value = ''
    lyrics.value = ''

    /* 重新拉歌单，音乐页 / 侧栏播放器马上能看到 */
    await loadPlaylist()
  } catch (e) {
    queue.value.forEach((it) => {
      if (it.status !== 'done') {
        it.status = 'error'
        it.error = e.message
      }
    })
    state.value = '失败：' + e.message
    toast('上传失败：' + e.message, 'error')
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="upload-layout">
    <!-- 左栏：选择 + 队列 -->
    <div>
      <section class="card">
        <div class="card__head">
          <span class="card__title">选择音频</span>
          <span class="card__hint">mp3 / m4a / flac / wav · 单个 ≤ 50MB</span>
        </div>
        <div class="card__body">
          <div
            class="dropzone"
            :class="{ 'is-over': overZone }"
            @click="pick"
            @dragenter.prevent="overZone = true"
            @dragover.prevent="overZone = true"
            @dragleave.prevent="overZone = false"
            @drop.prevent="onDrop"
          >
            <div class="dropzone__ico">♫</div>
            <div class="dropzone__title">把音频拖到这里，或点击选择文件</div>
            <div class="dropzone__hint">音频不做压缩，原样存进 R2</div>
            <input
              ref="fileInput"
              type="file"
              accept="audio/*"
              multiple
              hidden
              @change="onFileChange"
            >
          </div>

          <div class="inline" style="margin-top:14px">
            <button class="btn" type="button" @click="pick">选择文件</button>
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
          <span class="card__title">音频队列</span>
          <span class="card__hint">{{ queue.length }} 个文件</span>
        </div>
        <div class="card__body card__body--flush">
          <div class="filelist">
            <div v-if="!queue.length" class="fileitem">
              <div class="fileitem__thumb"><AppIcon name="music" :size="18" /></div>
              <div class="fileitem__main">
                <div class="fileitem__name muted">还没有选择文件</div>
                <div class="fileitem__sub">选好音频后会出现在这里</div>
              </div>
            </div>

            <div v-for="(it, i) in queue" :key="it.file.name + i" class="fileitem">
              <div class="fileitem__thumb"><AppIcon name="music" :size="18" /></div>
              <div class="fileitem__main">
                <div class="fileitem__name">{{ it.file.name }}</div>
                <div class="fileitem__sub">
                  {{ fmtTime(it.duration) }} · {{ fmtSize(it.file.size) }}
                  <span v-if="it.error" style="color:#ff8a8a"> · {{ it.error }}</span>
                </div>
                <div v-if="it.status === 'uploading' || it.status === 'done'" class="progress">
                  <div class="progress__bar" :style="{ width: progress + '%' }" />
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
          {{ uploading ? '上传中…' : '开始上传' }}
        </button>
        <span class="muted">{{ state }}</span>
      </div>
    </div>

    <!-- 右栏：曲目信息 -->
    <div>
      <section class="card">
        <div class="card__head"><span class="card__title">曲目信息</span></div>
        <div class="card__body stack">
          <label class="field">
            <span class="field__label">曲名</span>
            <input v-model="name" class="input" type="text" placeholder="留空则用文件名">
          </label>

          <label class="field">
            <span class="field__label">歌手</span>
            <input v-model="artist" class="input" type="text" placeholder="未知歌手">
          </label>

          <label class="field">
            <span class="field__label">专辑 / 分类</span>
            <select v-model="album" class="select">
              <option v-for="a in ALBUMS" :key="a" :value="a">{{ a }}</option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">歌词（LRC 或纯文本，可选）</span>
            <textarea
              v-model="lyrics"
              class="textarea"
              rows="6"
              placeholder="[00:12.00]第一句&#10;[00:16.00]第二句"
            />
          </label>
        </div>
      </section>

      <section class="card">
        <div class="card__head"><span class="card__title">发布选项</span></div>
        <div class="row">
          <div class="row__main">
            <div class="row__label">公开可听</div>
            <div class="row__desc">关闭后只有带口令才能播放</div>
          </div>
          <div class="row__ctrl">
            <label class="switch">
              <input v-model="showPublic" type="checkbox">
              <span class="switch__track" />
            </label>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
