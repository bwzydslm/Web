/**
 * /api/images
 * ---------------------------------------------------------------------------
 *  GET  → 列出图片（公开，任何人可读）
 *         参数：q 关键词 / tag 标签 / album 相册 / sort=new|old|name
 *               limit(≤100) / offset / all=1（含私密图，需要口令）
 *  POST → 登记一条图片记录（需要口令）
 *         适合「图片已经躺在 R2 里，只想补一条元数据」的场景
 * ---------------------------------------------------------------------------
 */

const MAX_LIMIT = 100;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const str = (v, max = 300) => String(v == null ? '' : v).trim().slice(0, max);
const int = (v, def = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

/** 数据库行 → 前端认识的形状 */
export function toItem(row) {
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

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound', message: 'D1 绑定 DB 没有配置' }, 500);

  const p = new URL(request.url).searchParams;
  const q = str(p.get('q'), 100);
  const tag = str(p.get('tag'), 50);
  const album = str(p.get('album'), 50);
  const sort = p.get('sort') || 'new';
  const limit = Math.min(MAX_LIMIT, Math.max(1, int(p.get('limit'), 60)));
  const offset = Math.max(0, int(p.get('offset'), 0));

  /* 私密图片只有在带正确口令（all=1）时才一起返回 */
  let includePrivate = false;
  if (p.get('all') === '1') {
    const expected = env.SITE_TOKEN || '';
    const auth = request.headers.get('authorization') || '';
    const got = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    includePrivate = !!expected && got === expected;
  }

  const where = [];
  const binds = [];
  if (q) {
    where.push('(name LIKE ? OR description LIKE ? OR tags LIKE ?)');
    binds.push('%' + q + '%', '%' + q + '%', '%' + q + '%');
  }
  if (tag) {
    /* 用「,标签,」包裹后再匹配，避免 "风景" 命中 "风景照" */
    where.push("(',' || tags || ',') LIKE ?");
    binds.push('%,' + tag + ',%');
  }
  if (album) {
    where.push('album = ?');
    binds.push(album);
  }
  if (!includePrivate) where.push("visibility = 'public'");

  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const orderBy =
    sort === 'old' ? 'created_at ASC' : sort === 'name' ? 'name ASC' : 'created_at DESC';

  try {
    const [listRes, statRes] = await env.DB.batch([
      env.DB.prepare(
        'SELECT * FROM images' + whereSql + ' ORDER BY ' + orderBy + ' LIMIT ? OFFSET ?'
      ).bind(...binds, limit, offset),
      env.DB.prepare(
        'SELECT COUNT(*) AS total, COALESCE(SUM(size), 0) AS bytes FROM images' + whereSql
      ).bind(...binds),
    ]);

    const rows = (listRes && listRes.results) || [];
    const stat = (statRes && statRes.results && statRes.results[0]) || { total: 0, bytes: 0 };

    return json({
      ok: true,
      items: rows.map(toItem),
      total: stat.total || 0,
      bytes: stat.bytes || 0,
      limit,
      offset,
    });
  } catch (e) {
    return json(
      {
        ok: false,
        error: 'query_failed',
        message: e && e.message ? e.message : String(e),
        hint: '如果提示 no such table: images，说明还没执行 schema.sql',
      },
      500
    );
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound', message: 'D1 绑定 DB 没有配置' }, 500);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'bad_json', message: '请求体不是合法 JSON' }, 400);
  }

  const key = str(body.key, 500);
  if (!key) return json({ ok: false, error: 'missing_key', message: '必须提供 key（R2 对象路径）' }, 400);

  const now = Date.now();
  const id = str(body.id, 64) || crypto.randomUUID();
  const tags = Array.isArray(body.tags) ? body.tags.join(',') : str(body.tags, 300);

  try {
    await env.DB.prepare(
      `INSERT INTO images (id, r2_key, name, description, tags, album, mime, size, width, height, visibility, fav, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        key,
        str(body.name, 200),
        str(body.description, 2000),
        tags,
        str(body.album, 50) || '未分类',
        str(body.mime, 100),
        int(body.size, 0),
        int(body.width, 0),
        int(body.height, 0),
        body.visibility === 'private' ? 'private' : 'public',
        body.fav ? 1 : 0,
        int(body.ts, now) || now,
        now
      )
      .run();

    return json({ ok: true, id, key });
  } catch (e) {
    return json(
      { ok: false, error: 'insert_failed', message: e && e.message ? e.message : String(e) },
      500
    );
  }
}
