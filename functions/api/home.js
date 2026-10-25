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

import { isAuthorized, errorBody } from '../_lib/auth.js';

const json = (data, status = 200, cache) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      /* max-age=20    → 浏览器最多用 20 秒内的旧数据（换页回来不发请求）
         s-maxage=60   → Cloudflare 边缘最多缓存 60 秒（缓存未命中时不用再打 LAX 查 D1）
         swr=240       → 过期后先回旧值，后台悄悄刷新
         代价：后台管理上传新图后，首页统计最多晚 60 秒更新（浏览器侧仍是 20 秒）。 */
      'Cache-Control': cache || 'public, max-age=20, s-maxage=60, stale-while-revalidate=240',
    },
  });

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DB) return json({ ok: false, error: 'db_not_bound', message: 'D1 绑定 DB 没有配置' }, 500, 'no-store');

  /* 边缘缓存：首页数据对所有人相同，命中后直接从该colo出，不再跨洋查 D1。
     写法与 file/[[key]].js 一致；Range 不涉及，key 固定为 /__home。 */
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const cacheKey = cache ? new Request(new URL(request.url).origin + '/__home') : null;

  if (cache && cacheKey) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    } catch (e) {
      /* 缓存读取失败不影响正常流程 */
    }
  }

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

    const res = json({
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

    /* 回填边缘缓存：只缓存成功的 200 */
    if (cache && cacheKey) {
      try {
        const put = cache.put(cacheKey, res.clone());
        if (typeof context.waitUntil === 'function') context.waitUntil(put);
        else await put.catch(function () {});
      } catch (e) {
        /* 缓存失败不影响正常返回 */
      }
    }

    return res;
  } catch (e) {
    /* 匿名访客只看到笼统提示 */
    const authed = isAuthorized(context.request, env, new URL(context.request.url));
    return json(errorBody(authed, 'query_failed', e, '如果提示 no such table，说明要重新执行一次 schema.sql'), 500, 'no-store');
  }
}
