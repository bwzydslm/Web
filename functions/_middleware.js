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

import { isAuthorized } from './_lib/auth.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  /* 只有写操作需要口令；GET 是公开的读取 */
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  /* ★ 留言板是唯一允许匿名写入的接口。
     这里的例外必须收得足够窄：只放行 POST /api/messages，
     DELETE /api/messages/:id 仍然要口令。
     防刷逻辑写在端点自己里面（见 functions/api/messages/index.js）。 */
  const path = url.pathname.replace(/\/+$/, '');
  const isPublicWrite = method === 'POST' && path === '/api/messages';

  if (isWrite && !isPublicWrite && !isAuthorized(request, env, url)) {
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
