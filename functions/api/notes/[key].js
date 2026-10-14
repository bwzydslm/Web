/**
 * /api/notes/:key
 * ---------------------------------------------------------------------------
 * 用来存「随手记 / 公告」这类可以直接在网站上编辑的小文本。
 * 用键值的方式存，所以以后想加更多板块，只要换一个 key 就行：
 *
 *   GET    /api/notes/notice   → 读取（公开，任何人都能看）
 *   PUT    /api/notes/notice   → 保存（需要口令，由 _middleware.js 统一拦截）
 *   DELETE /api/notes/notice   → 删除（需要口令）
 *
 * 请求体（PUT）：
 *   { "title": "随手记", "body": "第一行\n第二行", "tags": ["日志", "学习"] }
 * ---------------------------------------------------------------------------
 */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const str = (v, max = 300) => String(v == null ? '' : v).slice(0, max);

function toNote(row) {
  if (!row) return null;
  return {
    key: row.note_key,
    title: row.title,
    body: row.body,
    tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
    updatedAt: row.updated_at,
  };
}

export async function onRequestGet({ env, params }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound', message: 'D1 绑定 DB 没有配置' }, 500);

  try {
    const row = await env.DB.prepare('SELECT * FROM notes WHERE note_key = ?').bind(params.key).first();
    return json({ ok: true, note: toNote(row) }); // 没有内容时 note 为 null，前端会退回默认文案
  } catch (e) {
    return json(
      {
        ok: false,
        error: 'query_failed',
        message: e && e.message ? e.message : String(e),
        hint: '如果提示 no such table: notes，说明要重新执行一次 schema.sql',
      },
      500
    );
  }
}

export async function onRequestPut({ request, env, params }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound' }, 500);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'bad_json', message: '请求体不是合法 JSON' }, 400);
  }

  const title = str(body.title, 100);
  const text = str(body.body, 10000);
  const tags = Array.isArray(body.tags) ? body.tags.join(',') : str(body.tags, 300);
  const now = Date.now();

  try {
    /* UPSERT：有就更新，没有就插入 */
    await env.DB.prepare(
      `INSERT INTO notes (note_key, title, body, tags, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(note_key) DO UPDATE SET
         title = excluded.title,
         body = excluded.body,
         tags = excluded.tags,
         updated_at = excluded.updated_at`
    )
      .bind(params.key, title, text, tags, now)
      .run();

    return json({ ok: true, note: { key: params.key, title, body: text, tags: tags ? tags.split(',') : [], updatedAt: now } });
  } catch (e) {
    return json({ ok: false, error: 'save_failed', message: e && e.message ? e.message : String(e) }, 500);
  }
}

export async function onRequestDelete({ env, params }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound' }, 500);
  try {
    await env.DB.prepare('DELETE FROM notes WHERE note_key = ?').bind(params.key).run();
    return json({ ok: true, key: params.key });
  } catch (e) {
    return json({ ok: false, error: 'delete_failed', message: e && e.message ? e.message : String(e) }, 500);
  }
}
