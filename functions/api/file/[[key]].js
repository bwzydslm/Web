/**
 * GET /api/file/:key...
 * ---------------------------------------------------------------------------
 * 从 R2 把图片吐给浏览器。key 里带斜杠，所以用 [[key]] 匹配多段路径。
 *
 * 【为什么现在更快】三件事：
 *   1) 新上传的文件路径自带可见性前缀（pub/ 或 prv/），读取时**完全不查 D1**
 *   2) 公开图放进 Cloudflare 边缘缓存（Cache API）：同一节点第二次访问直接返回，
 *      连 R2 都不用读，也省掉一次函数到存储的往返
 *   3) 响应带 immutable 强缓存，浏览器端也不会重复下载
 *
 * 【访问规则】
 *   prv/...          → 必须带口令，且绝不进公共缓存
 *   pub/...          → 任何人可看，可被边缘缓存
 *   旧数据（无前缀） → 查一次 D1 判断（兼容老图片），之后按结果处理
 *
 * key 里带 UUID，内容永不改变，所以可以放心用一年强缓存。
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

/** 从 R2 取对象并组装响应（含 304 与 HEAD 处理） */
async function fromBucket(env, key, request) {
  const obj = await env.BUCKET.get(key);
  if (obj === null) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  /* 浏览器条件请求命中就回 304，省流量 */
  if (request.headers.get('if-none-match') === obj.httpEtag) {
    return new Response(null, { status: 304, headers });
  }
  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers });
  }
  return new Response(obj.body, { headers });
}

export async function onRequestGet(context) {
  const { request, env, params } = context;

  if (!env.BUCKET) return new Response('R2 绑定 BUCKET 未配置', { status: 500 });

  const key = Array.isArray(params.key) ? params.key.join('/') : params.key;
  if (!key) return new Response('缺少 key', { status: 400 });

  const url = new URL(request.url);

  /* ① 判断可见性：优先看路径前缀，零查询 */
  let isPrivate = key.startsWith('prv/');

  if (!key.startsWith('pub/') && !isPrivate) {
    /* 旧数据（没前缀）才需要查库；查不到记录按私密处理，防止猜路径扫桶 */
    if (env.DB) {
      try {
        const row = await env.DB.prepare('SELECT visibility FROM images WHERE r2_key = ?')
          .bind(key)
          .first();
        isPrivate = !row || row.visibility !== 'public';
      } catch (e) {
        isPrivate = true;
      }
    } else {
      isPrivate = true;
    }
  }

  /* ② 私密图：口令校验 + 不缓存 */
  if (isPrivate) {
    if (!isAuthorized(request, env, url)) return new Response('Not found', { status: 404 });
    return fromBucket(env, key, request);
  }

  /* ③ 公开图：先看边缘缓存 */
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const cacheKey = cache ? new Request(url.origin + '/__img/' + key) : null;

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const res = await fromBucket(env, key, request);

  /* 只缓存完整的 GET 200，别把 304/404 写进缓存 */
  if (cache && request.method === 'GET' && res.status === 200) {
    try {
      const put = cache.put(cacheKey, res.clone());
      if (typeof context.waitUntil === 'function') context.waitUntil(put);
      else await put.catch(function () {});
    } catch (e) {
      /* 缓存失败不影响正常返回 */
    }
  }

  return res;
}

/** 允许 HEAD 请求（有些浏览器/工具会先探一下） */
export const onRequestHead = onRequestGet;
