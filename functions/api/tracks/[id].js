/**
 * DELETE /api/tracks/:id
 * ---------------------------------------------------------------------------
 * 删除一条音频：先删 R2 对象，再删 D1 记录（顺序反了会留下无主的文件）。
 * 口令由 functions/_middleware.js 统一校验。
 * ---------------------------------------------------------------------------
 */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function onRequestDelete({ env, params }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound' }, 500);

  const id = params.id;
  if (!id) return json({ ok: false, error: 'missing_id' }, 400);

  try {
    const row = await env.DB.prepare('SELECT r2_key FROM tracks WHERE id = ?').bind(id).first();
    if (!row) return json({ ok: false, error: 'not_found' }, 404);

    if (env.BUCKET && row.r2_key) {
      try {
        await env.BUCKET.delete(row.r2_key);
      } catch (e) {
        /* 文件删不掉也别挡住记录删除，否则会卡住一个永远删不掉的条目 */
      }
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
