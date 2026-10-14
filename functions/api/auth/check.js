/**
 * POST /api/auth/check
 * ---------------------------------------------------------------------------
 * 只用来验证口令对不对：能走到这里说明 _middleware.js 已经校验通过，
 * 所以直接返回 ok 即可。前端「设置 → 服务端」的「测试连接」按钮用它。
 * ---------------------------------------------------------------------------
 */
export async function onRequestPost({ env }) {
  return new Response(
    JSON.stringify({
      ok: true,
      message: '口令正确',
      bindings: { DB: !!env.DB, BUCKET: !!env.BUCKET },
    }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
}
