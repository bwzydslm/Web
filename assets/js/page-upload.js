/* ============================================================================
 *  page-upload.js  ——  上传页
 *
 *  说明：Cloudflare Pages 是纯静态托管，没有后端，所以「上传」默认只做：
 *    选文件 → 生成预览 → 记录元数据 → 存进浏览器本地
 *  想真正把图片存起来，见 README.md 的「让上传真正生效」。
 *
 *  如果以后你有了上传接口（R2 / 自建 API），把 CFG.api.uploadEndpoint 填上，
 *  再把 startUpload() 里标注了 TODO 的那几行换成真实的 fetch 即可。
 * ==========================================================================*/

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    const CFG = (window.UI && window.UI.config) || {};
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const queueCount = document.getElementById('queueCount');
    const queueHint = document.getElementById('queueHint');
    const startBtn = document.getElementById('startUploadBtn');
    const uploadState = document.getElementById('uploadState');

    /** 待上传队列：[{ file, url, status }] */
    let queue = [];

    /* ------------------------------------------------------- 选择文件 */
    document.getElementById('pickBtn').addEventListener('click', function () { fileInput.click(); });
    dropzone.addEventListener('click', function () { fileInput.click(); });

    ['dragenter', 'dragover'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) {
        e.preventDefault();
        dropzone.classList.add('is-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) {
        e.preventDefault();
        dropzone.classList.remove('is-over');
      });
    });
    dropzone.addEventListener('drop', function (e) {
      addFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', function () {
      addFiles(this.files);
      this.value = '';
    });

    function fmtSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }

    function addFiles(files) {
      Array.prototype.forEach.call(files, function (f) {
        if (!/^image\//.test(f.type)) return;
        queue.push({ file: f, url: URL.createObjectURL(f), status: 'ready', progress: 0 });
      });
      renderQueue();
    }

    /* ------------------------------------------------------- 渲染队列 */
    function renderQueue() {
      queueCount.textContent = queue.length ? '已选择 ' + queue.length + ' 个文件' : '未选择文件';
      queueHint.textContent = queue.length + ' 个文件';
      uploadState.textContent = queue.length ? '等待上传…' : '等待中…';

      if (!queue.length) {
        fileList.innerHTML =
          '<div class="fileitem"><div class="fileitem__thumb"></div>' +
          '<div class="fileitem__main"><div class="fileitem__name muted">还没有选择文件</div>' +
          '<div class="fileitem__sub">选好文件后会出现在这里，并显示每个文件的上传进度条</div></div></div>';
        return;
      }

      fileList.innerHTML = queue
        .map(function (it, i) {
          const badge =
            it.status === 'done' ? '<span class="tag tag--accent">已完成</span>' :
            it.status === 'uploading' ? '<span class="tag">上传中 ' + it.progress + '%</span>' :
            '<span class="tag">待上传</span>';
          return (
            '<div class="fileitem">' +
              '<img class="fileitem__thumb" src="' + it.url + '" alt="">' +
              '<div class="fileitem__main">' +
                '<div class="fileitem__name">' + it.file.name + '</div>' +
                '<div class="fileitem__sub">' + fmtSize(it.file.size) + ' · ' + (it.file.type || '未知类型') + '</div>' +
                (it.status === 'ready' ? '' : '<div class="progress"><div class="progress__bar" style="width:' + it.progress + '%"></div></div>') +
              '</div>' +
              badge +
              '<button class="icon-btn icon-btn--sm" type="button" data-remove="' + i + '" title="移除">' + window.icon('close', 15) + '</button>' +
            '</div>'
          );
        })
        .join('');
    }

    fileList.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-remove]');
      if (!btn) return;
      const i = parseInt(btn.dataset.remove, 10);
      URL.revokeObjectURL(queue[i].url);
      queue.splice(i, 1);
      renderQueue();
    });

    document.getElementById('clearQueueBtn').addEventListener('click', function () {
      queue.forEach(function (it) { URL.revokeObjectURL(it.url); });
      queue = [];
      renderQueue();
    });

    /* --------------------------------------------------------- 上传流程 */
    startBtn.addEventListener('click', function () {
      if (!queue.length) {
        UI.toast('先选择要上传的图片吧', 'error');
        return;
      }
      const endpoint = (CFG.api && CFG.api.uploadEndpoint) || '';

      if (!endpoint) {
        /* 没有接口：模拟一遍进度，然后把元数据存到本地 */
        uploadState.textContent = '本地预览模式（未配置上传接口）…';
        simulate();
        return;
      }

      /* TODO: 有接口时改成真实上传，例如：
       * queue.forEach(it => {
       *   const fd = new FormData();
       *   fd.append('file', it.file);
       *   fd.append('title', document.getElementById('metaTitle').value);
       *   fetch(endpoint, { method: 'POST', body: fd, headers: CFG.api.headers })
       *     .then(r => r.json()).then(...)
       * });
       */
      UI.toast('接口地址已配置，请按 README 补全 fetch 逻辑', 'info');
      simulate();
    });

    function simulate() {
      let done = 0;
      queue.forEach(function (it, idx) {
        if (it.status === 'done') { done++; return; }
        it.status = 'uploading';
        const timer = setInterval(function () {
          it.progress = Math.min(100, it.progress + 8 + Math.random() * 14);
          if (it.progress >= 100) {
            clearInterval(timer);
            it.status = 'done';
            done++;
            if (done === queue.length) {
              saveLocal();
              uploadState.textContent = '完成（本地记录 ' + done + ' 张）';
              UI.toast('已记录 ' + done + ' 张图片的元数据', 'success');
            }
          }
          renderQueue();
        }, 220);
      });
    }

    /** 把本页信息写进本地存储，图墙会读这份数据 */
    function saveLocal() {
      const items = Store.get('wall.items', []);
      const title = document.getElementById('metaTitle').value.trim();
      const tags = document.getElementById('metaTags').value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
      const desc = document.getElementById('metaDesc').value.trim();
      const album = document.getElementById('metaAlbum').value;

      queue.forEach(function (it, i) {
        items.push({
          name: title ? (queue.length > 1 ? title + ' ' + (i + 1) : title) : it.file.name,
          src: it.url,           // 本地临时地址，刷新后会失效；换成真实图片路径即可长期使用
          tags: tags,
          desc: desc,
          album: album,
          size: it.file.size,
          ts: Date.now(),
        });
      });
      Store.set('wall.items', items);
    }

    /* ------------------------------------------------------- 右侧表单 */
    const range = document.getElementById('qualityRange');
    const rangeVal = document.getElementById('qualityValue');
    if (range) {
      range.value = Store.get('upload.quality', 82);
      rangeVal.textContent = range.value;
      range.addEventListener('input', function () {
        rangeVal.textContent = this.value;
        Store.set('upload.quality', parseInt(this.value, 10));
      });
    }

    const albumSel = document.getElementById('metaAlbum');
    if (albumSel) {
      const saved = Store.get('upload.album', '未分类');
      Array.prototype.forEach.call(albumSel.options, function (o) { if (o.text === saved) albumSel.value = o.value; });
      albumSel.addEventListener('change', function () { Store.set('upload.album', this.value); });
    }

    document.getElementById('exportFormBtn').addEventListener('click', function () {
      const data = {
        title: document.getElementById('metaTitle').value,
        tags: document.getElementById('metaTags').value,
        desc: document.getElementById('metaDesc').value,
        album: document.getElementById('metaAlbum').value,
        quality: range ? range.value : null,
        files: queue.map(function (it) { return { name: it.file.name, size: it.file.size, type: it.file.type }; }),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'upload-meta.json';
      a.click();
      URL.revokeObjectURL(a.href);
      UI.toast('已导出 JSON', 'success');
    });

    renderQueue();
  });
})();
