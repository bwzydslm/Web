/**
 * GET /api/health
 * ---------------------------------------------------------------------------
 * 公开的体检接口：告诉你绑定到底配好了没有。
 * 部署完先打开 /api/health 看一眼，能省掉大量猜谜时间。
 * ---------------------------------------------------------------------------
 */
export async function onRequestGet({ env }) {
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
      out.db = 'error: ' + (e && e.message ? e.message : String(e));
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
      out.bucket = 'error: ' + (e && e.message ? e.message : String(e));
      out.ok = false;
    }
  } else {
    out.bucket = 'missing_binding';
    out.ok = false;
  }

  if (!out.tokenConfigured) out.ok = false;

  /* ★ 这里始终返回 200：200 表示「接口本身能访问到」，具体哪一块不正常看 body。
     如果返回 500，前端 fetch 会直接抛错，反而看不到 db / bucket 的详细信息。
     没配 R2 不算故障（随手记这类文本板块只依赖 D1）。 */
  out.summary = [
    'D1: ' + (out.db === 'ok' ? '正常' : out.db),
    'R2: ' + (out.bucket === 'ok' ? '正常' : out.bucket + '（不影响随手记）'),
    '口令: ' + (out.tokenConfigured ? '已配置' : '未配置（写操作会被拒绝）'),
  ].join(' · ');

  return new Response(JSON.stringify(out, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
