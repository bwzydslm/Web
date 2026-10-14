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

  return new Response(JSON.stringify(out, null, 2), {
    status: out.ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
