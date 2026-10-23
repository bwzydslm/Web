/**
 * GET /api/health
 * ---------------------------------------------------------------------------
 * 体检接口：告诉你绑定到底配好了没有。部署完先打开看一眼，能省掉大量猜谜时间。
 *
 * 【隐私】默认只返回「正常 / 异常 / 未配置」这种粗粒度状态，
 * 不把数据库的原始错误信息吐给所有人（那可能包含表名、SQL 片段等内部细节）。
 * 带上正确的 SITE_TOKEN 请求，才会附带详细错误和解法提示。
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

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const detailed = isAuthorized(request, env, url);

  const out = {
    ok: true,
    tokenConfigured: !!env.SITE_TOKEN,
    bindings: { DB: !!env.DB, BUCKET: !!env.BUCKET },
    db: 'not_checked',
    bucket: 'not_checked',
  };

  if (env.DB) {
    try {
      await env.DB.prepare('SELECT COUNT(*) AS n FROM images').first();
      out.db = 'ok';
    } catch (e) {
      out.db = detailed ? 'error: ' + (e && e.message ? e.message : String(e)) : 'error';
      out.ok = false;
    }
  } else {
    out.db = 'missing_binding';
    out.ok = false;
  }

  if (env.BUCKET) {
    try {
      await env.BUCKET.list({ limit: 1 });
      out.bucket = 'ok';
    } catch (e) {
      out.bucket = detailed ? 'error: ' + (e && e.message ? e.message : String(e)) : 'error';
      out.ok = false;
    }
  } else {
    out.bucket = 'missing_binding';
    out.ok = false;
  }

  if (!out.tokenConfigured) out.ok = false;

  /* ★ 始终返回 200：200 表示「接口本身能访问到」，具体哪一块不正常看 body。
     返回 500 的话前端 fetch 会直接抛错，反而看不到 db / bucket 的细节。
     没配 R2 不算故障（随手记这类文本板块只依赖 D1）。 */
  out.summary = [
    'D1: ' + (out.db === 'ok' ? '正常' : out.db),
    'R2: ' + (out.bucket === 'ok' ? '正常' : out.bucket + '（不影响随手记）'),
    '口令: ' + (out.tokenConfigured ? '已配置' : '未配置（写操作会被拒绝）'),
  ].join(' · ');

  /* 没带口令时，把 db.sql / images 表这类线索也去掉，只留下"能用/不能用" */
  if (!detailed) delete out.bindings;

  return new Response(JSON.stringify(out, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
