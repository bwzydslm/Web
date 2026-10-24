/**
 * GET /api/file/:key...
 * ---------------------------------------------------------------------------
 * 从 R2 把文件吐给浏览器。key 里带斜杠，所以用 [[key]] 匹配多段路径。
 * 图片和音频共用这个路由。
 *
 * 【支持 Range —— 音频拖动进度条的前提】
 *   浏览器播放 <audio> 时会用 Range 请求分段取数据；
 *   服务端不返回 206 + Content-Range 的话，进度条拖不动、有的浏览器干脆不出声。
 *   这里把 Range 头直接交给 R2，由它做切片，再拼出 206 响应。
 *
 * 【访问规则】
 *   prv/...          → 必须带口令，且绝不进公共缓存
 *   pub/...          → 任何人可看，可被边缘缓存
 *   旧数据（无前缀） → 查一次 D1 判断（兼容老图片）
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

/** 从 R2 取对象并组装响应（含 Range / 304 / HEAD） */
async function fromBucket(env, key, request) {
  let rangeHeader = request.headers.get('range');
  let obj;

  try {
    obj = await env.BUCKET.get(key, rangeHeader ? { range: request.headers } : undefined);
  } catch (e) {
    /* Range 格式非法（"bytes=abc-xyz"）时 R2 会抛错，退回完整对象 */
    rangeHeader = null;
    obj = await env.BUCKET.get(key);
  }

  if (obj === null) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  /* 206 Partial Content */
  if (rangeHeader && obj.range) {
    const { offset, length } = obj.range;
    headers.set('Content-Range', 'bytes ' + offset + '-' + (offset + length - 1) + '/' + obj.size);
    headers.set('Content-Length', String(length));
    return new Response(obj.body, { status: 206, headers });
  }

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

  /* ② 私密：口令校验 + 不缓存 */
  if (isPrivate) {
    if (!isAuthorized(request, env, url)) return new Response('Not found', { status: 404 });
    return fromBucket(env, key, request);
  }

  /* ③ 公开：先看边缘缓存（Range 请求不进缓存，切片是定制的） */
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const cacheKey = cache && !request.headers.get('range')
    ? new Request(url.origin + '/__file/' + key)
    : null;

  if (cache && cacheKey) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const res = await fromBucket(env, key, request);

  /* 只缓存完整的 GET 200，别把 304/404/206 写进缓存 */
  if (cache && cacheKey && request.method === 'GET' && res.status === 200) {
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
