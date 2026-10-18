/**
 * /api/images/:id
 * ---------------------------------------------------------------------------
 *  GET    → 取单条（私密图片需要口令）
 *  PATCH  → 改名字 / 标签 / 相册 / 描述 / 可见性 / 收藏（需要口令）
 *  DELETE → 同时删掉 D1 记录和 R2 里的文件（需要口令）
 * ---------------------------------------------------------------------------
 */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const str = (v, max = 300) => String(v == null ? '' : v).trim().slice(0, max);

function isAuthorized(request, env, url) {
  const expected = env.SITE_TOKEN || '';
  if (!expected) return false;
  const auth = request.headers.get('authorization') || '';
  const got = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : request.headers.get('x-site-token') || url.searchParams.get('token') || '';
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function toItem(row) {
  return {
    id: row.id,
    key: row.r2_key,
    name: row.name,
    description: row.description,
    tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
    album: row.album,
    mime: row.mime,
    size: row.size,
    width: row.width,
    height: row.height,
    visibility: row.visibility,
    fav: !!row.fav,
    ts: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadRow(env, id) {
  return env.DB.prepare('SELECT * FROM images WHERE id = ?').bind(id).first();
}

export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound' }, 500);
  const row = await loadRow(env, params.id);
  if (!row) return json({ ok: false, error: 'not_found' }, 404);

  if (row.visibility !== 'public' && !isAuthorized(request, env, new URL(request.url))) {
    return json({ ok: false, error: 'not_found' }, 404); // 私密图对外一律装成不存在
  }
  return json({ ok: true, item: toItem(row) });
}

export async function onRequestPatch({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound' }, 500);

  const row = await loadRow(env, params.id);
  if (!row) return json({ ok: false, error: 'not_found' }, 404);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  /* ★ 可见性不能在这里改：文件路径按可见性分了 pub/ 和 prv/ 前缀，
     改数据库字段不会移动 R2 里的对象，会导致「标成私密但实际还能被公开访问」。
     要改可见性，请重新上传（或在 R2 + D1 里手动搬对象）。 */
  if (body.visibility !== undefined && body.visibility !== row.visibility) {
    return json(
      {
        ok: false,
        error: 'visibility_locked',
        message: '暂不支持修改可见性（文件路径已按 pub/ 或 prv/ 分区），请重新上传这张图。',
      },
      400
    );
  }

  const next = {
    name: body.name === undefined ? row.name : str(body.name, 200),
    description: body.description === undefined ? row.description : str(body.description, 2000),
    tags: body.tags === undefined ? row.tags : (Array.isArray(body.tags) ? body.tags.join(',') : str(body.tags, 300)),
    album: body.album === undefined ? row.album : str(body.album, 50) || '未分类',
    visibility: row.visibility,
    fav: body.fav === undefined ? row.fav : body.fav ? 1 : 0,
  };

  try {
    await env.DB.prepare(
      `UPDATE images SET name = ?, description = ?, tags = ?, album = ?, visibility = ?, fav = ?, updated_at = ?
       WHERE id = ?`
    )
      .bind(next.name, next.description, next.tags, next.album, next.visibility, next.fav, Date.now(), params.id)
      .run();

    return json({ ok: true, item: toItem(Object.assign({}, row, next, { updated_at: Date.now() })) });
  } catch (e) {
    return json({ ok: false, error: 'update_failed', message: e && e.message ? e.message : String(e) }, 500);
  }
}

export async function onRequestDelete({ env, params }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound' }, 500);

  const row = await loadRow(env, params.id);
  if (!row) return json({ ok: false, error: 'not_found' }, 404);

  try {
    /* 先删数据库记录，再删对象；对象删失败不影响用户看到的结果 */
    await env.DB.prepare('DELETE FROM images WHERE id = ?').bind(params.id).run();
    if (env.BUCKET && row.r2_key) {
      try {
        await env.BUCKET.delete(row.r2_key);
      } catch (e) {
        return json({ ok: true, warning: 'record_deleted_but_object_failed: ' + (e.message || e) });
      }
    }
    return json({ ok: true, id: params.id, key: row.r2_key });
  } catch (e) {
    return json({ ok: false, error: 'delete_failed', message: e && e.message ? e.message : String(e) }, 500);
  }
}
