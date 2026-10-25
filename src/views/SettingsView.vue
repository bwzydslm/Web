<script setup>
/* ============================================================================
 *  SettingsView.vue —— 设置页（从 page-settings.js 迁移）
 *
 *  三类内容：
 *    1. 外观 / 图片墙 / 上传 / 其他 —— 纯本地偏好，改完立即生效并持久化
 *    2. 「？？？」口令门 —— 走真后端校验（POST /api/auth/check）
 *    3. 服务端/API + 数据管理 —— 验证通过后才显示
 * ==========================================================================*/

import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import Api from '../lib/api'
import { Store } from '../lib/store'
import { useSetting } from '../lib/prefs'
import { activeTheme, applyAccent, setThemePref, themePref } from '../lib/theme'
import { toast } from '../lib/toast'

/* ---------------- 外观 ---------------- */
const accent = useSetting('theme.accent', '#a78bfa')
const collapsed = useSetting('ui.sidebarCollapsed', false)
const glow = useSetting('ui.glow', true)

watch(accent, () => applyAccent())
watch(
  collapsed,
  (v) => document.documentElement.classList.toggle('sidebar-collapsed', !!v),
  { immediate: true },
)

const PRESETS = [
  { label: '默认紫', value: '#a78bfa' },
  { label: '冰蓝', value: '#7dd3fc' },
  { label: '樱粉', value: '#f9a8d4' },
]

function pickPreset(c) {
  accent.value = c
  applyAccent()
  toast('强调色已更新', 'success')
}

const themeMode = computed({
  get: () => themePref.value,
  set: (v) => setThemePref(v),
})

const themeLabel = computed(() => {
  const v = themePref.value
  if (v === 'auto') return '跟随时间 · 当前' + (activeTheme.value === 'dark' ? '深色' : '浅色')
  return v === 'dark' ? '深色' : '浅色'
})

/* ---------------- 图片墙 ---------------- */
const columns = useSetting('wall.columns', '4')
const showMeta = useSetting('wall.showMeta', true)
const wallLightbox = useSetting('wall.lightbox', true)
const wallSort = useSetting('wall.sort', 'new')

const COLUMN_OPTIONS = ['2', '3', '4', '5']

/* ---------------- 上传 ---------------- */
const autoMeta = useSetting('upload.autoMeta', true)
const uploadAlbum = useSetting('upload.album', '未分类')

const ALBUMS = ['未分类', '日常', '风景', '截图']

/* ---------------- 其他 ---------------- */
const rememberScroll = useSetting('ui.rememberScroll', false)
const showFooter = useSetting('ui.showFooter', true)

/* ---------------- 服务端 / API ---------------- */
const apiBase = ref('')
const apiToken = ref('')
const apiStatus = ref('')

/* 粘贴口令时的隐形陷阱，这两个肉眼几乎看不出来：
   · 从别处复制常把 "Bearer " 前缀一起带进来 → 发出去成了 "Bearer Bearer xxx"
   · 密码管理器/面板可能带首尾空格或换行
   统一在这里清掉，服务端那边也做了同样的兜底。 */
function normalizeToken(raw) {
  return String(raw == null ? '' : raw).trim().replace(/^bearer\s+/i, '').trim()
}

/* 仍然可能有问题的输入：全角字符（中文输入法打的）、中间夹空格 */
const tokenWarning = computed(() => {
  const v = String(apiToken.value || '')
  if (!v) return ''
  if (/[\u3000-\u303f\uff01-\uff60]/.test(v)) return '⚠ 口令里有全角字符，可能是中文输入法打出来的'
  if (/\s/.test(v.trim())) return '⚠ 口令中间有空格'
  return ''
})

function paintApiStatus() {
  const c = Api.conf()
  apiBase.value = c.base
  apiToken.value = c.token
  apiStatus.value = c.token
    ? '已填写口令，点「测试连接」确认是否可用'
    : '还没配置口令：上传、删除等写操作不会生效'
}

const testing = ref(false)

async function testConnection() {
  Api.save({ base: apiBase.value.trim(), token: normalizeToken(apiToken.value) })
  testing.value = true
  apiStatus.value = '正在检测…'
  try {
    const health = await Api.health()
    const check = await Api.check()
    const dbOk = health.db === 'ok'
    const r2Ok = health.bucket === 'ok'
    apiStatus.value =
      '✅ 后端可达 —— D1：' + (dbOk ? '正常' : '⚠ ' + health.db) +
      ' · R2：' + (r2Ok ? '正常' : '未配置（随手记等文本板块不需要它）') +
      ' · 口令：' + (check.ok ? '正确' : '异常')
    toast('连接成功', 'success')
  } catch (e) {
    apiStatus.value = '❌ ' + e.message
    toast('连接失败：' + e.message, 'error')
  } finally {
    testing.value = false
  }
}

function saveApi() {
  const token = normalizeToken(apiToken.value)
  Api.save({ base: apiBase.value.trim(), token })
  apiToken.value = token
  toast('已保存服务端配置', 'success')
  paintApiStatus()
}

/* ---------------- 口令门 ---------------- */
const UNLOCK_KEY = 'izakaya.unlocked'
const unlocked = ref(false)
const gateInput = ref('')
const gateStatus = ref('')
const verifying = ref(false)

function isUnlocked() {
  try { return sessionStorage.getItem(UNLOCK_KEY) === '1' } catch { return false }
}

function setUnlocked(on) {
  try {
    if (on) sessionStorage.setItem(UNLOCK_KEY, '1')
    else sessionStorage.removeItem(UNLOCK_KEY)
  } catch { /* ignore */ }
}

async function tryUnlock() {
  const value = normalizeToken(gateInput.value)
  if (!value) { gateStatus.value = '请输入口令'; return }

  verifying.value = true
  gateStatus.value = '验证中…'
  try {
    const res = await fetch(Api.url('/api/auth/check'), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + value },
    })

    if (res.ok) {
      Api.save({ token: value })
      setUnlocked(true)
      unlocked.value = true
      gateInput.value = ''
      gateStatus.value = ''
      paintApiStatus()
      toast('已验证', 'success')
    } else if (res.status === 401) {
      gateStatus.value = '口令不正确'
    } else {
      gateStatus.value = '验证失败（HTTP ' + res.status + '）'
    }
  } catch (e) {
    gateStatus.value = '网络错误：' + e.message
  } finally {
    verifying.value = false
  }
}

function lock() {
  setUnlocked(false)
  unlocked.value = false
  toast('已锁定', 'info')
}

/* ---------------- 数据管理 ---------------- */
/** 导出/展示前把口令打码 —— 明文不该出现在文件里 */
function safeStoreAll() {
  const data = Store.all()
  if (data.server && typeof data.server === 'object') {
    data.server = Object.assign({}, data.server, {
      token: data.server.token ? '***' : '',
    })
  }
  return data
}

function viewData() {
  const data = safeStoreAll()
  const keys = Object.keys(data)
  if (!keys.length) { toast('本地还没有任何设置', 'info'); return }
  const lines = keys.map((k) => k + ' = ' + JSON.stringify(data[k])).join('\n')
  alert('本地存储的设置（' + keys.length + ' 项）：\n\n' + lines)
}

function resetAll() {
  if (!confirm('确定恢复默认设置吗？图片记录不会被删除。')) return
  Store.clear()
  toast('已恢复默认，正在刷新…', 'success')
  setTimeout(() => location.reload(), 600)
}

function exportSettings() {
  const blob = new Blob([JSON.stringify(safeStoreAll(), null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'site-settings.json'
  a.click()
  URL.revokeObjectURL(a.href)
  toast('设置已导出', 'success')
}

const importInput = ref(null)

function pickImport() {
  importInput.value?.click()
}

function onImportChange(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result)
      Object.keys(data).forEach((k) => Store.set(k, data[k]))
      toast('导入成功，正在刷新…', 'success')
      setTimeout(() => location.reload(), 600)
    } catch {
      toast('文件不是合法 JSON', 'error')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

/* ---------------- 生命周期 ---------------- */
onMounted(() => {
  unlocked.value = isUnlocked()
  paintApiStatus()
})
</script>

<template>
  <div>
    <!-- ================= 外观 ================= -->
    <section class="card">
      <div class="card__head"><span class="card__title">外观</span></div>

      <div class="row">
        <div class="row__main">
          <div class="row__label">明暗模式</div>
          <div class="row__desc">深色 = 纯黑底；浅色 = 纯白底；跟随时间会在早 7 点自动转浅色、晚 7 点转深色</div>
        </div>
        <div class="row__ctrl">
          <div class="seg">
            <button type="button" :class="{ 'is-active': themeMode === 'dark' }" @click="themeMode = 'dark'">深色</button>
            <button type="button" :class="{ 'is-active': themeMode === 'light' }" @click="themeMode = 'light'">浅色</button>
            <button type="button" :class="{ 'is-active': themeMode === 'auto' }" @click="themeMode = 'auto'">跟随时间</button>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="row__main">
          <div class="row__label">强调色</div>
          <div class="row__desc">按钮、开关、选中态都会用它</div>
        </div>
        <div class="row__ctrl">
          <input v-model="accent" type="color">
          <button v-for="p in PRESETS" :key="p.value" class="btn" type="button" @click="pickPreset(p.value)">
            {{ p.label }}
          </button>
        </div>
      </div>

      <div class="row">
        <div class="row__main">
          <div class="row__label">默认收起侧边栏</div>
          <div class="row__desc">下次打开站点时左侧自动折叠（也可按 Ctrl+B）</div>
        </div>
        <div class="row__ctrl">
          <label class="switch">
            <input v-model="collapsed" type="checkbox">
            <span class="switch__track" />
          </label>
        </div>
      </div>

      <div class="row">
        <div class="row__main">
          <div class="row__label">卡片背景微光</div>
          <div class="row__desc">关闭后页面更素净</div>
        </div>
        <div class="row__ctrl">
          <label class="switch">
            <input v-model="glow" type="checkbox">
            <span class="switch__track" />
          </label>
        </div>
      </div>
    </section>

    <!-- ================= 图片墙 ================= -->
    <section class="card">
      <div class="card__head"><span class="card__title">图片墙</span></div>

      <div class="row">
        <div class="row__main">
          <div class="row__label">每行列数</div>
          <div class="row__desc">屏幕够宽时最多显示几列</div>
        </div>
        <div class="row__ctrl">
          <div class="seg">
            <button
              v-for="n in COLUMN_OPTIONS"
              :key="n"
              type="button"
              :class="{ 'is-active': String(columns) === n }"
              @click="columns = n"
            >{{ n }}</button>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="row__main">
          <div class="row__label">显示图片说明</div>
          <div class="row__desc">关掉就只留纯图片，更干净</div>
        </div>
        <div class="row__ctrl">
          <label class="switch">
            <input v-model="showMeta" type="checkbox">
            <span class="switch__track" />
          </label>
        </div>
      </div>

      <div class="row">
        <div class="row__main">
          <div class="row__label">点击打开灯箱</div>
          <div class="row__desc">关闭后点击图片不再放大</div>
        </div>
        <div class="row__ctrl">
          <label class="switch">
            <input v-model="wallLightbox" type="checkbox">
            <span class="switch__track" />
          </label>
        </div>
      </div>

      <div class="row">
        <div class="row__main">
          <div class="row__label">图片排序</div>
          <div class="row__desc">图墙默认的排列方式</div>
        </div>
        <div class="row__ctrl">
          <select v-model="wallSort" class="select" style="width:auto">
            <option value="new">最新上传</option>
            <option value="old">最早上传</option>
            <option value="name">按名称</option>
          </select>
        </div>
      </div>
    </section>

    <!-- ================= 上传 ================= -->
    <section class="card">
      <div class="card__head"><span class="card__title">上传</span></div>

      <div class="row">
        <div class="row__main">
          <div class="row__label">自动写入元数据</div>
          <div class="row__desc">为上传的图片记录文件名、尺寸、时间</div>
        </div>
        <div class="row__ctrl">
          <label class="switch">
            <input v-model="autoMeta" type="checkbox">
            <span class="switch__track" />
          </label>
        </div>
      </div>

      <div class="row">
        <div class="row__main">
          <div class="row__label">默认相册</div>
          <div class="row__desc">新图片默认归到哪一类</div>
        </div>
        <div class="row__ctrl">
          <select v-model="uploadAlbum" class="select" style="width:auto">
            <option v-for="a in ALBUMS" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>
      </div>
    </section>

    <!-- ================= 其他 ================= -->
    <section class="card">
      <div class="card__head"><span class="card__title">其他</span></div>

      <div class="row">
        <div class="row__main">
          <div class="row__label">记住滚动位置</div>
          <div class="row__desc">回到站点时恢复上次看到的位置</div>
        </div>
        <div class="row__ctrl">
          <label class="switch">
            <input v-model="rememberScroll" type="checkbox">
            <span class="switch__track" />
          </label>
        </div>
      </div>

      <div class="row">
        <div class="row__main">
          <div class="row__label">显示页脚</div>
          <div class="row__desc">底部版权与社交图标</div>
        </div>
        <div class="row__ctrl">
          <label class="switch">
            <input v-model="showFooter" type="checkbox">
            <span class="switch__track" />
          </label>
        </div>
      </div>

      <div class="row">
        <div class="row__main">
          <div class="row__label">数据统计</div>
          <div class="row__desc">查看本站本地存储了哪些设置</div>
        </div>
        <div class="row__ctrl">
          <button class="btn" type="button" @click="viewData">查看统计</button>
        </div>
      </div>
    </section>

    <!-- ================= ？？？ 口令门 ================= -->
    <section v-if="!unlocked" class="card">
      <div class="card__head">
        <span class="card__title">？？？</span>
        <span class="card__hint">需要验证</span>
      </div>
      <div class="card__body">
        <div class="inline">
          <input
            v-model="gateInput"
            class="input"
            type="password"
            autocomplete="off"
            placeholder="输入口令"
            style="max-width:260px"
            @keydown.enter="tryUnlock"
          >
          <button class="btn btn--primary" type="button" :disabled="verifying" @click="tryUnlock">
            {{ verifying ? '验证中…' : '验证' }}
          </button>
          <span class="muted">{{ gateStatus }}</span>
        </div>
        <p class="muted" style="margin-top:12px;font-size:12px">
          这一块的内容需要身份验证后才会显示。
        </p>
      </div>
    </section>

    <!-- ================= 验证通过后 ================= -->
    <template v-if="unlocked">
      <section class="card">
        <div class="card__head">
          <span class="card__title">服务端 / API</span>
          <button class="btn btn--sm btn--ghost" type="button" @click="lock">锁定</button>
        </div>

        <div class="row">
          <div class="row__main">
            <div class="row__label">API 地址</div>
            <div class="row__desc">留空表示与本站同源（推荐）。只有本地调试时才需要填</div>
          </div>
          <div class="row__ctrl" style="min-width:280px">
            <input v-model="apiBase" class="input" type="text" placeholder="（留空 = 同源）">
          </div>
        </div>

        <div class="row">
          <div class="row__main">
            <div class="row__label">站点口令</div>
            <div class="row__desc">对应云端环境变量 SITE_TOKEN；只保存在这台电脑的浏览器里，不会上传</div>
          </div>
          <div class="row__ctrl" style="min-width:280px">
            <input v-model="apiToken" class="input" type="password" placeholder="粘贴你的 SITE_TOKEN">
            <div v-if="tokenWarning" class="row__desc" style="color:var(--danger,#e24b4a);margin-top:6px">{{ tokenWarning }}</div>
          </div>
        </div>

        <div class="row">
          <div class="row__main">
            <div class="row__label">连接状态</div>
            <div class="row__desc">{{ apiStatus }}</div>
          </div>
          <div class="row__ctrl">
            <button class="btn" type="button" :disabled="testing" @click="testConnection">
              {{ testing ? '检测中…' : '测试连接' }}
            </button>
            <button class="btn btn--primary" type="button" @click="saveApi">保存</button>
          </div>
        </div>

        <div class="row">
          <div class="row__main">
            <div class="row__label">后端体检</div>
            <div class="row__desc">直接打开 <code>/api/health</code> 可以看到 D1、R2、口令的配置情况</div>
          </div>
          <div class="row__ctrl">
            <a class="btn" href="/api/health" target="_blank" rel="noopener">打开 /api/health</a>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card__head"><span class="card__title">数据管理</span></div>
        <div class="card__body">
          <div class="inline">
            <button class="btn btn--ghost" type="button" @click="resetAll">
              <AppIcon name="refresh" :size="16" /> 恢复默认设置
            </button>
            <button class="btn" type="button" @click="exportSettings">导出设置</button>
            <button class="btn" type="button" @click="pickImport">导入设置</button>
            <input ref="importInput" type="file" accept="application/json" hidden @change="onImportChange">
          </div>
          <p class="muted" style="margin-top:12px;font-size:12px">
            设置保存在浏览器本地（localStorage），不会上传到服务器。
            当前主题：<span class="tag tag--accent">{{ themeLabel }}</span>
          </p>
        </div>
      </section>
    </template>
  </div>
</template>
