/* ============================================================================
 *  page-upload.js  ——  上传页
 *
 *  两种模式自动切换：
 *    A. 后端可用（设置页填了口令）→ 真上传：文件进 R2，元数据进 D1
 *    B. 后端没配好               → 本地预览模式：只记在浏览器里，不发出请求
 *
 *  上传接口：POST /api/upload（multipart），实现见 functions/api/upload.js
 * ==========================================================================*/

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    /* 被 features 关掉时直接退出，避免请求接口和绑定事件 */
    if (document.body.dataset.pageLocked) return;

    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const queueCount = document.getElementById('queueCount');
    const queueHint = document.getElementById('queueHint');
    const startBtn = document.getElementById('startUploadBtn');
    const uploadState = document.getElementById('uploadState');
    const modeBadge = document.getElementById('uploadMode');

    /** 队列项：{ file, url, width, height, status, progress, error } */
    let queue = [];
    let uploading = false;

    /* --------------------------------------------------------- 模式提示 */
    function renderMode() {
      if (!modeBadge) return;
      modeBadge.hidden = false;
      if (Api.isConfigured()) {
        modeBadge.className = 'notice notice--ok';
        modeBadge.textContent = '已连接后端：上传会把文件存进 R2，元数据写进 D1。';
      } else {
        modeBadge.className = 'notice notice--warn';
        modeBadge.textContent =
          '未配置后端口令：现在只做本地预览，文件不会发出去。到「设置 → 服务端 / API」填入口令即可启用真上传。';
      }
    }
    renderMode();

    /* --------------------------------------------------------- 选择文件 */
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
    dropzone.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
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
        if (!/^image\//.test(f.type)) {
          UI.toast(f.name + ' 不是图片，已跳过', 'error');
          return;
        }
        const item = {
          file: f,
          url: URL.createObjectURL(f),
          origSize: f.size,
          sent: null,        // 压缩后真正要上传的 File
          sentSize: 0,       // 压缩后的大小
          width: 0, height: 0,
          status: 'ready', progress: 0, error: '',
        };
        queue.push(item);

        /* 顺便量尺寸，上传时一起写进数据库 */
        const probe = new Image();
        probe.onload = function () {
          item.width = probe.naturalWidth;
          item.height = probe.naturalHeight;
          renderQueue();
        };
        probe.src = item.url;
      });
      renderQueue();
    }

    /* --------------------------------------------------------- 浏览器端压缩
       手机照片动辄 5~8MB，直接传又慢又费流量。这里用 canvas 把最长边缩到
       MAX_EDGE、按「压缩质量」滑块转成 WebP，通常能小 5~10 倍。
       GIF（动图）和 SVG 不处理，避免压坏；压完反而更大时保留原图。 */
    const MAX_EDGE = 1600;

    const USE_WEBP = (function () {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 1;
        return c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      } catch (e) {
        return false;
      }
    })();

    function loadBitmap(file) {
      if (window.createImageBitmap) return createImageBitmap(file);
      return new Promise(function (resolve, reject) {
        const img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    }

    async function compressImage(file, quality) {
      if (/gif|svg/.test(file.type)) return null;          // 动图/矢量不压

      let bmp;
      try {
        bmp = await loadBitmap(file);
      } catch (e) {
        return null;                                        // 解不出来就传原图
      }

      const w0 = bmp.width || bmp.naturalWidth;
      const h0 = bmp.height || bmp.naturalHeight;
      if (!w0 || !h0) return null;

      const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0));

      /* 尺寸本来就小、体积也不大 → 不必重新编码（重编码还可能导致变大） */
      if (scale === 1 && file.size <= 500 * 1024) return null;

      const w = Math.round(w0 * scale);
      const h = Math.round(h0 * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, w, h);

      const type = USE_WEBP ? 'image/webp' : 'image/jpeg';
      const blob = await new Promise(function (r) { canvas.toBlob(r, type, quality); });
      if (!blob || blob.size >= file.size) return null;

      const ext = type === 'image/webp' ? '.webp' : '.jpg';
      const name = file.name.replace(/\.[^.]+$/, '') + ext;

      return {
        blob: blob,
        file: new File([blob], name, { type: type }),
        width: w,
        height: h,
      };
    }

    /* --------------------------------------------------------- 渲染队列 */
    function renderQueue() {
      queueCount.textContent = queue.length ? '已选择 ' + queue.length + ' 个文件' : '未选择文件';
      queueHint.textContent = queue.length + ' 个文件';

      if (!queue.length) {
        fileList.innerHTML =
          '<div class="fileitem"><div class="fileitem__thumb"></div>' +
          '<div class="fileitem__main"><div class="fileitem__name muted">还没有选择文件</div>' +
          '<div class="fileitem__sub">选好文件后会出现在这里，并显示每个文件的上传进度</div></div></div>';
        return;
      }

      fileList.innerHTML = queue
        .map(function (it, i) {
          const badge =
            it.status === 'done' ? '<span class="tag tag--accent">已完成</span>' :
            it.status === 'error' ? '<span class="tag">失败</span>' :
            it.status === 'compressing' ? '<span class="tag">压缩中…</span>' :
            it.status === 'uploading' ? '<span class="tag">上传中 ' + it.progress + '%</span>' :
            '<span class="tag">待上传</span>';

          const dim = it.width ? it.width + '×' + it.height + ' · ' : '';

          /* 压缩过就显示「原始大小 → 压缩后」，一眼看出省了多少 */
          const sizeText =
            it.sentSize && it.sentSize < it.origSize
              ? fmtSize(it.origSize) + ' → <b style="color:var(--accent)">' + fmtSize(it.sentSize) + '</b>'
              : fmtSize(it.file.size);

          return (
            '<div class="fileitem">' +
              '<img class="fileitem__thumb" src="' + it.url + '" alt="">' +
              '<div class="fileitem__main">' +
                '<div class="fileitem__name">' + it.file.name + '</div>' +
                '<div class="fileitem__sub">' + dim + sizeText +
                  (it.error ? ' · <span style="color:#ff8a8a">' + it.error + '</span>' : '') + '</div>' +
                (it.status === 'uploading' || it.status === 'done'
                  ? '<div class="progress"><div class="progress__bar" style="width:' + it.progress + '%"></div></div>'
                  : '') +
              '</div>' +
              badge +
              '<button class="icon-btn icon-btn--sm" type="button" data-remove="' + i + '" title="移除">' +
                window.icon('close', 15) + '</button>' +
            '</div>'
          );
        })
        .join('');
    }

    fileList.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-remove]');
      if (!btn || uploading) return;
      const i = parseInt(btn.dataset.remove, 10);
      URL.revokeObjectURL(queue[i].url);
      queue.splice(i, 1);
      renderQueue();
    });

    document.getElementById('clearQueueBtn').addEventListener('click', function () {
      if (uploading) return;
      queue.forEach(function (it) { URL.revokeObjectURL(it.url); });
      queue = [];
      renderQueue();
    });

    /* -------------------------------------------------------------- 上传 */
    function meta() {
      const visEl = document.getElementById('visibilityToggle');
      return {
        name: document.getElementById('metaTitle').value.trim(),
        tags: document.getElementById('metaTags').value.trim(),
        description: document.getElementById('metaDesc').value.trim(),
        album: document.getElementById('metaAlbum').value,
        visibility: visEl && visEl.checked ? 'public' : 'private',
        dims: JSON.stringify(queue.map(function (it) {
          return { w: it.width || 0, h: it.height || 0 };
        })),
      };
    }

    startBtn.addEventListener('click', async function () {
      if (uploading) return;
      if (!queue.length) {
        UI.toast('先选择要上传的图片吧', 'error');
        return;
      }

      if (!Api.isConfigured()) {
        UI.toast('还没配置后端口令，先做本地预览', 'info');
        localOnly();
        return;
      }

      uploading = true;
      startBtn.disabled = true;
      queue.forEach(function (it) {
        it.status = 'ready';
        it.progress = 0;
        it.error = '';
        it.sent = null;
        it.sentSize = 0;
      });
      renderQueue();

      /* ① 先逐张压缩（失败就用原图，绝不阻塞上传） */
      const quality = (parseInt(Store.get('upload.quality', 82), 10) || 82) / 100;
      for (let i = 0; i < queue.length; i++) {
        const it = queue[i];
        it.status = 'compressing';
        renderQueue();
        uploadState.textContent = '正在压缩 ' + (i + 1) + ' / ' + queue.length + '…';

        let out = null;
        try {
          out = await compressImage(it.file, quality);
        } catch (e) {
          out = null;
        }

        if (out) {
          it.sent = out.file;
          it.sentSize = out.blob.size;
          it.width = out.width;
          it.height = out.height;
        } else {
          it.sent = it.file;
          it.sentSize = it.file.size;
        }
      }
      renderQueue();
      uploadState.textContent = '开始上传…';

      try {
        const res = await Api.upload(
          queue.map(function (it) { return it.sent || it.file; }),
          meta(),
          function (pct) {
            const each = Math.min(100, Math.round(pct));
            queue.forEach(function (it) {
              if (it.status !== 'done') { it.status = 'uploading'; it.progress = each; }
            });
            renderQueue();
            uploadState.textContent = '上传中… ' + pct + '%';
          }
        );

        queue.forEach(function (it) { it.status = 'done'; it.progress = 100; });
        renderQueue();
        uploadState.textContent = '完成：' + (res.count || 0) + ' 张已入库';
        UI.toast('上传成功，共 ' + (res.count || 0) + ' 张', 'success');

        document.getElementById('metaTitle').value = '';
        document.getElementById('metaTags').value = '';
        document.getElementById('metaDesc').value = '';
      } catch (e) {
        queue.forEach(function (it) {
          if (it.status !== 'done') { it.status = 'error'; it.error = e.message; }
        });
        renderQueue();
        uploadState.textContent = '失败：' + e.message;
        UI.toast('上传失败：' + e.message, 'error');
      } finally {
        uploading = false;
        startBtn.disabled = false;
      }
    });

    /** 没配后端时的本地模式：存进 localStorage，图墙仍然看得到 */
    function localOnly() {
      const m = meta();
      const items = Store.get('wall.items', []);
      const tags = m.tags
        ? m.tags.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean)
        : [];

      queue.forEach(function (it, i) {
        it.status = 'done';
        it.progress = 100;
        items.push({
          name: m.name ? (queue.length > 1 ? m.name + ' ' + (i + 1) : m.name) : it.file.name,
          src: it.url, // 临时地址，刷新后失效
          tags: tags,
          desc: m.description,
          album: m.album,
          size: it.file.size,
          ts: Date.now(),
        });
      });
      Store.set('wall.items', items);
      renderQueue();
      uploadState.textContent = '本地预览模式：已记录 ' + queue.length + ' 张（没有上传）';
      UI.toast('已记录到本地（刷新后图片地址会失效）', 'info');
    }

    /* --------------------------------------------------------- 右侧表单 */
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
        album: albumSel ? albumSel.value : '',
        quality: range ? range.value : null,
        files: queue.map(function (it) {
          return { name: it.file.name, size: it.file.size, type: it.file.type, w: it.width, h: it.height };
        }),
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
