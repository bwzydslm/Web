/**
 * GET /api/home
 * ---------------------------------------------------------------------------
 * 首页的「一次性数据接口」：统计 + 最近 4 张图 + 随手记，一个请求全拿到。
 *
 * 【为什么要合并】
 *   原来是两个请求（/api/images 拿统计、/api/notes/notice 拿公告）。
 *   在跨境线路上（比如 colo=LAX），每多一个请求就多一个 200~300ms 的往返。
 *   现在两个查询用 D1 的 batch 一次往返完成，前端也只发一个请求。
 *
 * 响应：
 *   {
 *     ok, total, bytes, latest,
 *     recent: [{ id, key, name, tags, size, ts }, ...],
 *     notice: { title, body, tags, updatedAt } | null
 *   }
 * ---------------------------------------------------------------------------
 */

const json = (data, status = 200, cache) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      /* 首页数据可以短缓存：换页回来不用再请求（最多旧 20 秒） */
      'Cache-Control': cache || 'public, max-age=20, stale-while-revalidate=120',
    },
  });

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound', message: 'D1 绑定 DB 没有配置' }, 500, 'no-store');

  try {
    /* 三个查询一次往返（D1 batch） */
    const [statRes, recentRes, noteRes] = await env.DB.batch([
      env.DB.prepare(
        "SELECT COUNT(*) AS total, COALESCE(SUM(size), 0) AS bytes, COALESCE(MAX(created_at), 0) AS latest FROM images WHERE visibility = 'public'"
      ),
      env.DB.prepare(
        "SELECT id, r2_key, name, tags, size, width, height, created_at FROM images WHERE visibility = 'public' ORDER BY created_at DESC LIMIT 4"
      ),
      env.DB.prepare("SELECT * FROM notes WHERE note_key = 'notice'"),
    ]);

    const stat = (statRes && statRes.results && statRes.results[0]) || { total: 0, bytes: 0, latest: 0 };
    const rows = (recentRes && recentRes.results) || [];
    const noteRow = noteRes && noteRes.results && noteRes.results[0];

    return json({
      ok: true,
      total: stat.total || 0,
      bytes: stat.bytes || 0,
      latest: stat.latest || 0,
      recent: rows.map(function (r) {
        return {
          id: r.id,
          key: r.r2_key,
          name: r.name,
          tags: r.tags ? r.tags.split(',').filter(Boolean) : [],
          size: r.size,
          ts: r.created_at,
        };
      }),
      notice: noteRow
        ? {
            title: noteRow.title,
            body: noteRow.body,
            tags: noteRow.tags ? noteRow.tags.split(',').filter(Boolean) : [],
            updatedAt: noteRow.updated_at,
          }
        : null,
    });
  } catch (e) {
    return json(
      {
        ok: false,
        error: 'query_failed',
        message: e && e.message ? e.message : String(e),
        hint: '如果提示 no such table，说明要重新执行一次 schema.sql',
      },
      500,
      'no-store'
    );
  }
}
