/**
 * DELETE /api/messages/:id
 * ---------------------------------------------------------------------------
 * 管理员删留言。口令由 functions/_middleware.js 校验
 * （匿名写入的例外只开了 POST /api/messages，DELETE 不在此列）。
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
    const row = await env.DB.prepare('SELECT id FROM messages WHERE id = ?').bind(id).first();
    if (!row) return json({ ok: false, error: 'not_found' }, 404);

    await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(id).run();
    return json({ ok: true, id });
  } catch (e) {
    return json(
      { ok: false, error: 'delete_failed', message: e && e.message ? e.message : String(e) },
      500
    );
  }
}
