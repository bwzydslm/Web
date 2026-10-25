/**
 * GET /api/tracks
 * ---------------------------------------------------------------------------
 * 音乐页的歌单来源。只返回公开音频；带口令 + all=1 时才包含私密音频。
 *
 * 响应：
 *   { ok, items: [{ id, key, name, artist, album, duration, size, mime, lyrics, ts }] }
 *
 * 音频文件本身走 /api/file/<key>，那里支持 Range，所以进度条能拖动。
 * ---------------------------------------------------------------------------
 */

import { isAuthorized, errorBody } from '../../_lib/auth.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

function toTrack(row) {
  return {
    id: row.id,
    key: row.r2_key,
    name: row.name,
    artist: row.artist,
    album: row.album,
    duration: row.duration,
    size: row.size,
    mime: row.mime,
    lyrics: row.lyrics,
    visibility: row.visibility,
    ts: row.created_at,
  };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return json(
      { ok: false, error: 'db_not_bound', message: 'D1 绑定 DB 没有配置' },
      500
    );
  }

  const url = new URL(request.url);
  const includePrivate = url.searchParams.get('all') === '1' && isAuthorized(request, env, url);

  try {
    const sql =
      'SELECT * FROM tracks' +
      (includePrivate ? '' : " WHERE visibility = 'public'") +
      ' ORDER BY created_at DESC';

    const res = await env.DB.prepare(sql).all();
    return json({ ok: true, items: (res.results || []).map(toTrack) });
  } catch (e) {
    /* 匿名访客只看到笼统提示，别把 D1 原始报错漏出去 */
    const authed = isAuthorized(request, env, url);
    return json(
      errorBody(authed, 'query_failed', e, '如果提示 no such table: tracks，去 D1 控制台重新执行一次 schema.sql'),
      500
    );
  }
}
