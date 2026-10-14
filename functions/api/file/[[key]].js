/**
 * GET /api/file/:key...
 * ---------------------------------------------------------------------------
 * 从 R2 把图片吐给浏览器。key 里带斜杠（2026/05/xxx.jpg），
 * 所以文件名用双方括号 [[key]] 来匹配多段路径。
 *
 * 访问规则：
 *   - visibility = 'public'  → 任何人可看
 *   - visibility = 'private' → 必须带口令（Authorization 头或 ?token=）
 *   - 数据库里查不到的 key   → 当作私密，404（防止有人猜路径扫桶）
 *
 * 因为 key 里带 UUID，内容永不改变，所以可以放心用一年强缓存。
 * ---------------------------------------------------------------------------
 */

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

export async function onRequestGet({ request, env, params }) {
  if (!env.BUCKET) return new Response('R2 绑定 BUCKET 未配置', { status: 500 });

  const key = Array.isArray(params.key) ? params.key.join('/') : params.key;
  if (!key) return new Response('缺少 key', { status: 400 });

  const url = new URL(request.url);
  const authed = isAuthorized(request, env, url);

  /* 查可见性；查不到记录就按私密处理 */
  let visibility = 'private';
  if (env.DB) {
    try {
      const row = await env.DB.prepare('SELECT visibility FROM images WHERE r2_key = ?')
        .bind(key)
        .first();
      if (row) visibility = row.visibility;
    } catch (e) {
      /* 数据库异常时不要放行私密图 */
    }
  }

  if (visibility !== 'public' && !authed) {
    return new Response('Not found', { status: 404 });
  }

  const obj = await env.BUCKET.get(key);
  if (obj === null) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  /* 支持浏览器条件请求，命中就回 304，省流量 */
  if (request.headers.get('if-none-match') === obj.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(obj.body, { headers });
}

/** 允许 HEAD 请求（有些浏览器/工具会先探一下） */
export const onRequestHead = onRequestGet;
