/* ============================================================================
 *  api.js  ——  前端访问后端（Pages Functions）的唯一出口
 *
 *  用法：
 *    Api.list({ q, sort })      列出图片
 *    Api.upload(files, meta, onProgress)   上传
 *    Api.update(id, patch)      改元数据
 *    Api.remove(id)             删除
 *    Api.fileUrl(key)           拼出图片地址
 *    Api.health() / Api.check() 体检 / 验证口令
 *
 *  配置（API 地址 + 口令）存在浏览器本地，键名 izakaya.server
 * ==========================================================================*/

window.Api = (function () {
  'use strict';

  const CONF_KEY = 'server';
  const TIMEOUT = 20000;

  function conf() {
    const c = Store.get(CONF_KEY, {}) || {};
    return {
      base: String(c.base || '').replace(/\/+$/, ''), // 留空 = 同源（推荐）
      token: String(c.token || ''),
    };
  }

  function save(patch) {
    const next = Object.assign(conf(), patch || {});
    Store.set(CONF_KEY, next);
    return next;
  }

  function url(path) {
    return conf().base + path;
  }

  function isConfigured() {
    return !!conf().token;
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(function () {
        reject(new Error('请求超时（' + ms / 1000 + ' 秒），可能是网络或 API 地址不对'));
      }, ms);
      promise.then(
        function (v) { clearTimeout(timer); resolve(v); },
        function (e) { clearTimeout(timer); reject(e); }
      );
    });
  }

  async function req(path, opts) {
    opts = opts || {};
    const c = conf();
    const headers = {};
    if (c.token) headers['Authorization'] = 'Bearer ' + c.token;

    let payload;
    if (opts.form) {
      payload = opts.form; // FormData，交给浏览器自己设 Content-Type
    } else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(opts.body);
    }

    const run = fetch(url(path), {
      method: opts.method || 'GET',
      headers: headers,
      body: payload,
    });

    const res = await withTimeout(run, opts.timeout || TIMEOUT);
    const text = await res.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = { raw: text };
    }

    if (!res.ok) {
      const err = new Error(
        (data && (data.message || data.error)) || 'HTTP ' + res.status
      );
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /* --------------------------------------------------------------- 上传 */
  function upload(files, meta, onProgress) {
    return new Promise(function (resolve, reject) {
      const fd = new FormData();
      Array.prototype.forEach.call(files, function (f) { fd.append('files', f); });
      Object.keys(meta || {}).forEach(function (k) {
        const v = meta[k];
        if (v !== undefined && v !== null && v !== '') fd.append(k, v);
      });

      const xhr = new XMLHttpRequest();
      xhr.open('POST', url('/api/upload'));
      const token = conf().token;
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = function (e) {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }

      xhr.onload = function () {
        let data = null;
        try { data = JSON.parse(xhr.responseText || 'null'); } catch (e) { data = null; }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          const err = new Error(
            (data && (data.message || data.error)) || 'HTTP ' + xhr.status
          );
          err.status = xhr.status;
          err.data = data;
          reject(err);
        }
      };
      xhr.onerror = function () { reject(new Error('网络错误，上传中断')); };
      xhr.ontimeout = function () { reject(new Error('上传超时')); };
      xhr.send(fd);
    });
  }

  return {
    conf: conf,
    save: save,
    url: url,
    isConfigured: isConfigured,

    /* 图片地址：key 里的斜杠要保留，逐段编码即可 */
    fileUrl: function (key) {
      return url('/api/file/' + String(key || '').split('/').map(encodeURIComponent).join('/'));
    },

    health: function () { return req('/api/health', { timeout: 15000 }); },
    check: function () { return req('/api/auth/check', { method: 'POST' }); },

    list: function (params) {
      const qs = new URLSearchParams(params || {}).toString();
      return req('/api/images' + (qs ? '?' + qs : ''));
    },
    create: function (body) { return req('/api/images', { method: 'POST', body: body }); },
    update: function (id, patch) {
      return req('/api/images/' + encodeURIComponent(id), { method: 'PATCH', body: patch });
    },
    remove: function (id) {
      return req('/api/images/' + encodeURIComponent(id), { method: 'DELETE' });
    },
    upload: upload,

    /* 小文本板块（随手记 / 公告）：读公开，写需要口令 */
    note: function (key) {
      return req('/api/notes/' + encodeURIComponent(key));
    },
    saveNote: function (key, data) {
      return req('/api/notes/' + encodeURIComponent(key), { method: 'PUT', body: data });
    },
    removeNote: function (key) {
      return req('/api/notes/' + encodeURIComponent(key), { method: 'DELETE' });
    },
  };
})();
