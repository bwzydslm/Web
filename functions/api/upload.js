/**
 * POST /api/upload
 * ---------------------------------------------------------------------------
 * 真正接收文件的地方：multipart/form-data
 *
 *   files      文件（可以多个，同一个字段名重复出现）
 *   name       标题（多张时自动加序号）
 *   tags       标签，逗号分隔
 *   album      相册
 *   description 描述
 *   visibility public | private
 *   dims       JSON 字符串，形如 [{"w":800,"h":600}, ...]，和 files 顺序对应
 *
 * 流程：写 R2 → 写 D1 → 返回每张图的记录。D1 写失败会把 R2 对象删掉，避免孤儿文件。
 * ---------------------------------------------------------------------------
 */

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 单文件 25MB；Workers 请求体上限是 100MB

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const str = (v, max = 300) => String(v == null ? '' : v).trim().slice(0, max);

/** 把文件名清理成安全的扩展名，例如 "我的 图.JPG" → .jpg */
function extOf(name, mime) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name || '');
  if (m) return '.' + m[1].toLowerCase();
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
    'image/svg+xml': '.svg',
  };
  return map[mime] || '.bin';
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.BUCKET) {
    return json(
      {
        ok: false,
        error: 'bindings_missing',
        message: 'D1(DB) 或 R2(BUCKET) 绑定没有配置，去 Pages → Settings → Bindings 添加后重新部署',
        bindings: { DB: !!env.DB, BUCKET: !!env.BUCKET },
      },
      500
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return json({ ok: false, error: 'bad_form', message: '解析表单失败：' + (e.message || e) }, 400);
  }

  const files = form.getAll('files').filter((f) => f && typeof f === 'object' && 'arrayBuffer' in f);
  if (!files.length) return json({ ok: false, error: 'no_files', message: '没有收到文件' }, 400);

  const name = str(form.get('name'), 200);
  const tags = str(form.get('tags'), 300);
  const album = str(form.get('album'), 50) || '未分类';
  const description = str(form.get('description'), 2000);
  const visibility = form.get('visibility') === 'private' ? 'private' : 'public';

  let dims = [];
  try {
    dims = JSON.parse(form.get('dims') || '[]');
  } catch (e) {
    dims = [];
  }

  const now = Date.now();
  const d = new Date(now);
  /* ★ 路径里带上可见性前缀 pub/ 或 prv/：
     这样读取图片时不用查 D1 就知道要不要口令，公开图也才能安全地进边缘缓存 */
  const scope = visibility === 'private' ? 'prv' : 'pub';
  const prefix = scope + '/' + d.getUTCFullYear() + '/' + String(d.getUTCMonth() + 1).padStart(2, '0');
  const created = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > MAX_FILE_SIZE) {
      return json(
        { ok: false, error: 'file_too_large', message: file.name + ' 超过 25MB 上限' },
        413
      );
    }

    const id = crypto.randomUUID();
    const mime = file.type || 'application/octet-stream';
    const key = prefix + '/' + id + extOf(file.name, mime);
    const buf = await file.arrayBuffer();

    await env.BUCKET.put(key, buf, {
      httpMetadata: { contentType: mime, cacheControl: 'public, max-age=31536000, immutable' },
    });

    const title = files.length > 1 && name ? name + ' ' + (i + 1) : name || file.name || '';
    const dim = dims[i] || {};

    try {
      await env.DB.prepare(
        `INSERT INTO images (id, r2_key, name, description, tags, album, mime, size, width, height, visibility, fav, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
        .bind(
          id, key, title, description, tags, album, mime, file.size,
          parseInt(dim.w, 10) || 0, parseInt(dim.h, 10) || 0,
          visibility, now, now
        )
        .run();
    } catch (e) {
      /* 数据库失败就把刚存进去的文件删掉，别留孤儿 */
      try {
        await env.BUCKET.delete(key);
      } catch (_) {}
      return json(
        { ok: false, error: 'db_insert_failed', message: e && e.message ? e.message : String(e) },
        500
      );
    }

    created.push({ id, key, name: title, size: file.size, mime, visibility });
  }

  return json({ ok: true, count: created.length, items: created });
}
