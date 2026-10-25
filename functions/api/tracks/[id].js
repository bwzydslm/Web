/**
 * /api/tracks/:id
 * ---------------------------------------------------------------------------
 *  PATCH  → 改元数据（曲名 / 歌手 / 专辑 / 歌词 / 时长），不动 R2 文件（需要口令）
 *  DELETE → 先删 R2 对象，再删 D1 记录（需要口令，由 _middleware.js 统一校验）
 * ---------------------------------------------------------------------------
 */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const str = (v, max = 300) => String(v == null ? '' : v).trim().slice(0, max);

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

export async function onRequestPatch({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound' }, 500);

  const row = await env.DB.prepare('SELECT * FROM tracks WHERE id = ?').bind(params.id).first();
  if (!row) return json({ ok: false, error: 'not_found' }, 404);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'bad_json', message: '请求体不是合法 JSON' }, 400);
  }

  /* ★ 可见性不能在这里改：文件路径按 pub/ prv/ 前缀分区（和 images 一个道理），
     改数据库字段不会移动 R2 里的对象，会出现「标成私密但公开还能访问」。 */
  if (body.visibility !== undefined && body.visibility !== row.visibility) {
    return json(
      {
        ok: false,
        error: 'visibility_locked',
        message: '暂不支持修改可见性（文件路径已按 pub/ 或 prv/ 分区），请重新上传这首音频。',
      },
      400
    );
  }

  const next = {
    name: body.name === undefined ? row.name : str(body.name, 200) || row.name,
    artist: body.artist === undefined ? row.artist : str(body.artist, 120),
    album: body.album === undefined ? row.album : str(body.album, 50) || '未分类',
    lyrics: body.lyrics === undefined ? row.lyrics : str(body.lyrics, 20000),
  };

  /* 时长：必须是有限非负数才接受，否则保持原值 */
  if (body.duration !== undefined) {
    const d = parseFloat(body.duration);
    if (Number.isFinite(d) && d >= 0) next.duration = d;
  }

  try {
    await env.DB.prepare(
      `UPDATE tracks SET name = ?, artist = ?, album = ?, lyrics = ?, duration = ?, updated_at = ?
       WHERE id = ?`
    )
      .bind(
        next.name,
        next.artist,
        next.album,
        next.lyrics,
        next.duration === undefined ? row.duration : next.duration,
        Date.now(),
        params.id
      )
      .run();

    const merged = Object.assign({}, row, next, {
      duration: next.duration === undefined ? row.duration : next.duration,
    });
    return json({ ok: true, item: toTrack(merged) });
  } catch (e) {
    return json({ ok: false, error: 'update_failed', message: e && e.message ? e.message : String(e) }, 500);
  }
}

export async function onRequestDelete({ env, params }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound' }, 500);

  const id = params.id;
  if (!id) return json({ ok: false, error: 'missing_id' }, 400);

  try {
    const row = await env.DB.prepare('SELECT r2_key FROM tracks WHERE id = ?').bind(id).first();
    if (!row) return json({ ok: false, error: 'not_found' }, 404);

    /* 先删对象、再删记录，理由同 images/[id].js：
       让失败停在「记录还在」这一步 —— 前端会报错，重试即可收敛。
       这里不能吞掉 R2 的错误：吞掉再删记录，对象就成了再也找不回的孤儿。 */
    if (env.BUCKET && row.r2_key) {
      await env.BUCKET.delete(row.r2_key);
    }

    await env.DB.prepare('DELETE FROM tracks WHERE id = ?').bind(id).run();
    return json({ ok: true, id });
  } catch (e) {
    return json(
      { ok: false, error: 'delete_failed', message: e && e.message ? e.message : String(e) },
      500
    );
  }
}
