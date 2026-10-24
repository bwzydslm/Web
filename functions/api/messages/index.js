/**
 * /api/messages
 * ---------------------------------------------------------------------------
 * 访客留言板。这是全站唯一允许**匿名写入**的接口，所以防滥用都在这里：
 *
 *   GET  ?limit=&offset=   读取（公开）
 *   POST { name, content, contact, website }
 *        · website 是隐藏的蜜罐字段，正常用户永远填不到；填了就静默丢弃
 *        · 同一 IP 30 秒内只能发一条，每小时最多 10 条
 *        · 昵称 ≤ 24 字，内容 ≤ 500 字
 *        · IP 只存 SHA-256(IP + 盐) 的前 32 位，不存原始 IP
 *
 * DELETE 走 [id].js，仍然需要口令（中间件拦住）。
 * ---------------------------------------------------------------------------
 */

const MAX_NAME = 24;
const MAX_CONTENT = 500;
const MAX_CONTACT = 80;
const COOLDOWN_MS = 30 * 1000;
const HOURLY_LIMIT = 10;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const str = (v, max) => String(v == null ? '' : v).replace(/\r\n/g, '\n').trim().slice(0, max);

/** 只暴露给前端的字段。contact 默认不返回 —— 那是留给管理员看的。 */
function toItem(row, withContact) {
  const item = {
    id: row.id,
    name: row.name,
    content: row.content,
    ts: row.created_at,
  }
  if (withContact) item.contact = row.contact
  return item
}

/** 判断请求是否带了对的口令（只有管理员才看得到 contact） */
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

/** IP → 哈希；盐用 SITE_TOKEN，换个口令所有哈希都会变 */
async function hashIp(request, env) {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    '';
  if (!ip) return '';
  const salt = env.SITE_TOKEN || 'guestbook';
  const data = new TextEncoder().encode(ip.split(',')[0].trim() + '|' + salt);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound', message: 'D1 绑定 DB 没有配置' }, 500);

  const p = new URL(request.url).searchParams;
  const limit = Math.min(50, Math.max(1, parseInt(p.get('limit'), 10) || 20));
  const offset = Math.max(0, parseInt(p.get('offset'), 10) || 0);
  const withContact = isAuthorized(request, env, new URL(request.url));

  try {
    const [listRes, cntRes] = await env.DB.batch([
      env.DB.prepare(
        'SELECT id, name, content, contact, created_at FROM messages ORDER BY created_at DESC LIMIT ? OFFSET ?'
      ).bind(limit, offset),
      env.DB.prepare('SELECT COUNT(*) AS total FROM messages'),
    ]);

    const items = ((listRes && listRes.results) || []).map((r) => toItem(r, withContact));
    const total = (cntRes && cntRes.results && cntRes.results[0] && cntRes.results[0].total) || 0;

    return json({ ok: true, items, total, limit, offset });
  } catch (e) {
    return json(
      {
        ok: false,
        error: 'query_failed',
        message: e && e.message ? e.message : String(e),
        hint: '如果提示 no such table: messages，去 D1 控制台执行一次 schema.sql 里的 messages 建表语句',
      },
      500
    );
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound', message: 'D1 绑定 DB 没有配置' }, 500);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'bad_json', message: '请求体不是合法 JSON' }, 400);
  }

  /* 蜜罐：正常用户的这个字段是空的。机器人通常会把所有 input 都填上。
     这里故意返回成功，不告诉它被识破了。 */
  if (str(body.website, 200)) {
    return json({ ok: true, item: null, ignored: true });
  }

  const name = str(body.name, MAX_NAME) || '匿名访客';
  const content = str(body.content, MAX_CONTENT);
  const contact = str(body.contact, MAX_CONTACT);

  if (!content) {
    return json({ ok: false, error: 'empty', message: '留言内容不能为空' }, 400);
  }

  /* 简单的内容闸门：纯链接刷屏直接拒 */
  const links = (content.match(/https?:\/\//gi) || []).length;
  if (links > 2) {
    return json({ ok: false, error: 'too_many_links', message: '链接太多了，请精简后再发' }, 400);
  }

  const now = Date.now();
  const ipHash = await hashIp(request, env);

  try {
    if (ipHash) {
      /* ① 冷却：30 秒内不能连发 */
      const last = await env.DB.prepare(
        'SELECT created_at FROM messages WHERE ip_hash = ? ORDER BY created_at DESC LIMIT 1'
      )
        .bind(ipHash)
        .first();

      if (last && now - last.created_at < COOLDOWN_MS) {
        const wait = Math.ceil((COOLDOWN_MS - (now - last.created_at)) / 1000);
        return json(
          { ok: false, error: 'too_fast', message: '发得太快了，' + wait + ' 秒后再试' },
          429
        );
      }

      /* ② 每小时上限 */
      const hourAgo = now - 3600 * 1000;
      const recent = await env.DB.prepare(
        'SELECT COUNT(*) AS c FROM messages WHERE ip_hash = ? AND created_at > ?'
      )
        .bind(ipHash, hourAgo)
        .first();

      if (recent && recent.c > HOURLY_LIMIT) {
        return json(
          { ok: false, error: 'rate_limited', message: '一小时内留言太多了，休息一下再来' },
          429
        );
      }
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO messages (id, name, content, contact, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(id, name, content, contact, ipHash, now)
      .run();

    return json({ ok: true, item: { id, name, content, contact, ts: now } });
  } catch (e) {
    return json(
      {
        ok: false,
        error: 'insert_failed',
        message: e && e.message ? e.message : String(e),
        hint: '如果提示 no such table: messages，去 D1 控制台执行一次建表语句',
      },
      500
    );
  }
}
