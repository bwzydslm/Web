/**
 * functions/_middleware.js
 * ---------------------------------------------------------------------------
 * 根级中间件，因为 _routes.json 只让 /api/* 触发 Functions，
 * 所以这里实际只服务于 API 请求。
 *
 * 干两件事：
 *   1) 写操作（POST / PATCH / DELETE）必须带对口令，否则 401
 *   2) 给所有 API 响应加上 Cache-Control: no-store，避免浏览器缓存接口结果
 * ---------------------------------------------------------------------------
 */

/** 从请求里取口令：优先 Authorization: Bearer，其次 X-Site-Token 头 */
function tokenFrom(request, url) {
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return request.headers.get('x-site-token') || url.searchParams.get('token') || '';
}

/** 定长比较，避免通过响应时间猜口令 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * ★ 重要：SITE_TOKEN 没配置时，一律拒绝写操作（fail closed）。
 *   这样即使你忘了配，也不会出现「谁都能上传」的裸奔状态。
 */
export function isAuthorized(request, env, url) {
  const expected = env.SITE_TOKEN || '';
  if (!expected) return false;
  return safeEqual(tokenFrom(request, url), expected);
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  /* 只有写操作需要口令；GET 是公开的读取 */
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  if (isWrite && !isAuthorized(request, env, url)) {
    const configured = !!env.SITE_TOKEN;
    return new Response(
      JSON.stringify({
        ok: false,
        error: configured ? 'unauthorized' : 'token_not_configured',
        message: configured
          ? '口令不正确：请在「设置 → 服务端 / API」里填写与云端 SITE_TOKEN 一致的口令。'
          : '云端还没有配置 SITE_TOKEN 环境变量，写操作已被拒绝（这是安全默认值）。',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }
    );
  }

  const res = await next();

  /* 默认给 API 响应关掉缓存；但图片路由自己设了长缓存，别覆盖它 */
  const headers = new Headers(res.headers);
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
