/**
 * functions/_lib/auth.js
 * ---------------------------------------------------------------------------
 * 全站共用的口令校验与错误组装工具。
 *
 * 为什么抽出来：isAuthorized / safeEqual 原来在 6 个端点里各贴了一份，
 * 其中 images 列表那一份还是普通的 ===（不是定长比较），实现已经分叉。
 * 口令逻辑只能有一份，改一处全站生效。
 *
 * 说明：以下划线开头的文件不会被 Pages 当成路由（且 _routes.json 只放行 /api/*），
 * 这里只是被各端点 import 的普通模块。
 * ---------------------------------------------------------------------------
 */

/** 从请求里取口令：优先 Authorization: Bearer，其次 X-Site-Token 头，最后 ?token= 参数。
 *  ?token= 一律从 request.url 解析 —— 不信任调用方传入的 URL，
 *  免得传了个不带 query 的 URL 就让这条通道静默失效。第二参数仅为兼容旧签名保留。
 *
 *  ⚠ 这里会顺手去掉一个「多余的 Bearer 前缀」：
 *  设置页是让人粘贴裸口令，但很多人会把 "Bearer xxx" 整段粘进去，
 *  于是发出去变成 "Bearer Bearer xxx"，而报错只会说「口令不正确」，
 *  肉眼根本看不出问题。与其让人对着两串几乎一样的字符串发懵，不如在这兼容掉。 */
export function tokenFrom(request, url) {
  const auth = request.headers.get('authorization') || '';
  const raw = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7)
    : request.headers.get('x-site-token') || new URL(request.url).searchParams.get('token') || '';
  return String(raw).trim().replace(/^bearer\s+/i, '');
}

/** 云端 Secret 的归一化：只去首尾空白。
 *  从 Cloudflare 面板或密码管理器粘贴时，末尾多一个换行是极常见的事，
 *  而它会让「看起来一模一样」的两个口令永远对不上。
 *  注意只 trim，不去 Bearer —— 云端存的值原样对待，不做更多猜测。 */
export function expectedToken(env) {
  return String(env.SITE_TOKEN == null ? '' : env.SITE_TOKEN).trim();
}

/** 定长比较，避免通过响应时间猜口令 */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * ★ SITE_TOKEN 没配置时一律返回 false（fail closed）：
 *   即使忘了配，也不会出现「谁都能上传」的裸奔状态。
 */
export function isAuthorized(request, env, url) {
  const expected = expectedToken(env);
  if (!expected) return false;
  return safeEqual(tokenFrom(request, url), expected);
}

/**
 * 组装 500 类错误的响应体。
 * 公开接口原来会把 D1 的原始报错（可能含表名、SQL 片段）直接吐给匿名访客，
 * 现在匿名只看到笼统提示；带正确口令的请求才返回原始细节和排查 hint。
 * （health.js 一直是这个做法，这里把同样的策略铺到其余端点。）
 */
export function errorBody(authed, error, e, hint) {
  if (authed) {
    const body = { ok: false, error, message: e && e.message ? e.message : String(e) };
    if (hint) body.hint = hint;
    return body;
  }
  return { ok: false, error, message: '服务器开小差了，请稍后再试。' };
}
