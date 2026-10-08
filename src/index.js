const TZ_OFFSET_HOURS = 7;
const STATUSES = ['working', 'patched', 'outdated'];
const ID_RE = /^[a-z0-9-]{2,40}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/admin/')) return await admin(request, env, url);
      if (url.pathname === '/api/login' && request.method === 'POST') return await login(request, env, url);
      if (url.pathname === '/api/logout' && request.method === 'POST') return logout(request, url);
      return env.ASSETS.fetch(request);
    } catch (e) {
      console.error(e);
      return json({ error: 'Server error' }, 500);
    }
  },
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      ...extra,
    },
  });
}

function today(offsetDays = 0) {
  const t = Date.now() + TZ_OFFSET_HOURS * 3600e3 + offsetDays * 86400e3;
  return new Date(t).toISOString().slice(0, 10);
}

// ---------- đăng nhập bằng mật khẩu + cookie phiên ----------
const COOKIE = 'noir_session';
const SESSION_DAYS = 30;
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60e3;
const enc = new TextEncoder();

const b64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uDecode = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};

async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// Chưa đặt đủ secret thì đóng hoàn toàn
const configured = (env) =>
  typeof env.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length >= 12 &&
  typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 32;

async function sign(env, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

async function makeSession(env) {
  const payload = b64u(enc.encode(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 86400e3 })));
  return `${payload}.${await sign(env, payload)}`;
}

function getCookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

// Trả về định danh admin, hoặc null nếu KHÔNG hợp lệ (đóng mặc định)
async function authenticate(request, env) {
  if (env.DEV_ADMIN_BYPASS === '1') return 'dev@local';
  if (!configured(env)) return null;
  const raw = getCookie(request, COOKIE);
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  try {
    if (!(await safeEqual(sig, await sign(env, payload)))) return null;
    const { exp } = JSON.parse(new TextDecoder().decode(b64uDecode(payload)));
    return exp > Date.now() ? 'admin' : null;
  } catch { return null; }
}

async function loginAllowed(env, ip) {
  const row = await env.DB.prepare('SELECT fails, first_at FROM login_attempts WHERE ip = ?').bind(ip).first();
  return !(row && Date.now() - row.first_at < WINDOW_MS && row.fails >= MAX_FAILS);
}
async function recordFail(env, ip) {
  await env.DB.prepare(
    `INSERT INTO login_attempts (ip, fails, first_at) VALUES (?1, 1, ?2)
     ON CONFLICT(ip) DO UPDATE SET
       fails = CASE WHEN ?2 - first_at > ?3 THEN 1 ELSE fails + 1 END,
       first_at = CASE WHEN ?2 - first_at > ?3 THEN ?2 ELSE first_at END`
  ).bind(ip, Date.now(), WINDOW_MS).run();
}

async function login(request, env, url) {
  if (request.headers.get('Origin') !== url.origin) return json({ error: 'Bad origin' }, 403);
  if (!configured(env)) return json({ error: 'Admin chưa cấu hình (thiếu ADMIN_PASSWORD hoặc SESSION_SECRET)' }, 503);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await loginAllowed(env, ip))) return json({ error: 'Sai quá nhiều lần, đợi 15 phút rồi thử lại' }, 429);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON không hợp lệ' }, 400); }
  const ok = typeof body.password === 'string' && (await safeEqual(body.password, env.ADMIN_PASSWORD));
  if (!ok) { await recordFail(env, ip); return json({ error: 'Sai mật khẩu' }, 401); }
  await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
  const cookie = `${COOKIE}=${await makeSession(env)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
  return json({ ok: true }, 200, { 'Set-Cookie': cookie });
}

function logout(request, url) {
  if (request.headers.get('Origin') !== url.origin) return json({ error: 'Bad origin' }, 403);
  return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
}

// ---------- admin API ----------
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const httpsUrl = (v) => {
  try { const u = new URL(v); return u.protocol === 'https:' ? u.href : null; } catch { return null; }
};

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

async function readJson(request) {
  if (Number(request.headers.get('content-length') || 0) > 400000) throw new HttpError(413, 'Dữ liệu quá lớn');
  try { return await request.json(); } catch { throw new HttpError(400, 'JSON không hợp lệ'); }
}

async function admin(request, env, url) {
  const who = await authenticate(request, env);
  if (!who) return json({ error: 'Unauthorized' }, 401);
  const method = request.method;
  if (method !== 'GET') {
    const origin = request.headers.get('Origin');
    if (!origin || origin !== url.origin) return json({ error: 'Bad origin' }, 403);
  }
  const path = url.pathname.slice('/api/admin'.length);

  try {
    if (path === '/me' && method === 'GET') return json({ who, bio_url: (env.BIO_URL || '').replace(/\/$/, ''), raw_url: (env.RAW_URL || '').replace(/\/$/, '') });

    if (path === '/data' && method === 'GET') {
      const [p, l, s, t] = await env.DB.batch([
        env.DB.prepare('SELECT name, bio, avatar_url FROM profile WHERE id = 1'),
        env.DB.prepare('SELECT label, url, icon, tab_id FROM links ORDER BY sort, id'),
        env.DB.prepare('SELECT * FROM scripts ORDER BY updated_at DESC'),
        env.DB.prepare('SELECT id, name, kind FROM tabs ORDER BY sort, id'),
      ]);
      return json({ profile: p.results[0], links: l.results, scripts: s.results, tabs: t.results });
    }

    if (path === '/stats' && method === 'GET') {
      const since = today(-29);
      const { results } = await env.DB.prepare('SELECT day, kind, count FROM daily_stats WHERE day >= ? ORDER BY day').bind(since).all();
      return json({ since, today: today(), rows: results });
    }

    if (path === '/profile' && method === 'PUT') {
      const b = await readJson(request);
      const name = str(b.name, 60) || 'NOIR';
      const avatar = b.avatar_url ? httpsUrl(str(b.avatar_url, 500)) : '';
      if (avatar === null) throw new HttpError(400, 'Avatar phải là link https');
      await env.DB.prepare(
        'INSERT INTO profile (id, name, bio, avatar_url) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, bio = excluded.bio, avatar_url = excluded.avatar_url'
      ).bind(name, str(b.bio, 500), avatar).run();
      return json({ ok: true });
    }

    if (path === '/links' && method === 'PUT') {
      const b = await readJson(request);
      if (!Array.isArray(b.links) || b.links.length > 20) throw new HttpError(400, 'Tối đa 20 link');
      const stmts = [env.DB.prepare('DELETE FROM links')];
      b.links.forEach((x, i) => {
        const label = str(x.label, 40);
        const u = httpsUrl(str(x.url, 500));
        if (!label || !u) throw new HttpError(400, `Link #${i + 1}: cần tên và URL https hợp lệ`);
        stmts.push(env.DB.prepare('INSERT INTO links (label, url, icon, sort, tab_id) VALUES (?, ?, ?, ?, ?)').bind(label, u, str(x.icon, 8), i, Number.isInteger(x.tab_id) && x.tab_id >= 0 ? x.tab_id : 0));
      });
      await env.DB.batch(stmts);
      return json({ ok: true });
    }

    if (path === '/scripts' && method === 'POST') {
      const b = await readJson(request);
      const f = scriptFields(b);
      const id = str(b.id, 40);
      if (!ID_RE.test(id)) throw new HttpError(400, 'ID chỉ gồm a-z, 0-9, dấu gạch ngang (2-40 ký tự)');
      const now = Date.now();
      try {
        await env.DB.prepare(
          'INSERT INTO scripts (id, title, description, game, image_url, tab_id, status, code, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, f.title, f.description, f.game, f.image_url, f.tab_id, f.status, f.code, f.published, now, now).run();
      } catch (e) {
        if (String(e).includes('UNIQUE')) throw new HttpError(409, 'ID này đã tồn tại');
        throw e;
      }
      return json({ ok: true, id });
    }

    const m = path.match(/^\/scripts\/([a-z0-9-]{2,40})$/);
    if (m && method === 'PUT') {
      const f = scriptFields(await readJson(request));
      const r = await env.DB.prepare(
        'UPDATE scripts SET title = ?, description = ?, game = ?, image_url = ?, tab_id = ?, status = ?, code = ?, published = ?, updated_at = ? WHERE id = ?'
      ).bind(f.title, f.description, f.game, f.image_url, f.tab_id, f.status, f.code, f.published, Date.now(), m[1]).run();
      if (!r.meta.changes) throw new HttpError(404, 'Không tìm thấy script');
      return json({ ok: true });
    }
    if (m && method === 'DELETE') {
      await env.DB.prepare('DELETE FROM scripts WHERE id = ?').bind(m[1]).run();
      return json({ ok: true });
    }

    if (path === '/tabs' && method === 'POST') {
      const b = await readJson(request);
      const name = str(b.name, 24);
      if (!name) throw new HttpError(400, 'Thiếu tên tab');
      const nx = await env.DB.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM tabs').first();
      await env.DB.prepare('INSERT INTO tabs (name, kind, sort) VALUES (?, ?, ?)').bind(name, b.kind === 'script' ? 'script' : 'social', nx.n).run();
      return json({ ok: true });
    }
    const tm = path.match(/^\/tabs\/(\d+)$/);
    if (tm && method === 'PUT') {
      const name = str((await readJson(request)).name, 24);
      if (!name) throw new HttpError(400, 'Thiếu tên tab');
      await env.DB.prepare('UPDATE tabs SET name = ? WHERE id = ?').bind(name, Number(tm[1])).run();
      return json({ ok: true });
    }
    if (tm && method === 'DELETE') {
      const id = Number(tm[1]);
      const t = await env.DB.prepare('SELECT kind FROM tabs WHERE id = ?').bind(id).first();
      if (!t) throw new HttpError(404, 'Không tìm thấy tab');
      const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM tabs WHERE kind = ?').bind(t.kind).first();
      if (c.n <= 1) throw new HttpError(400, 'Mỗi loại cần ít nhất một tab');
      await env.DB.batch([
        env.DB.prepare('UPDATE links SET tab_id = 0 WHERE tab_id = ?').bind(id),
        env.DB.prepare('UPDATE scripts SET tab_id = 0 WHERE tab_id = ?').bind(id),
        env.DB.prepare('DELETE FROM tabs WHERE id = ?').bind(id),
      ]);
      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    throw e;
  }
}

function scriptFields(b) {
  const title = str(b.title, 80);
  const code = typeof b.code === 'string' ? b.code : '';
  if (!title) throw new HttpError(400, 'Thiếu tiêu đề');
  if (!code.trim()) throw new HttpError(400, 'Thiếu code');
  if (code.length > 200000) throw new HttpError(400, 'Code quá dài (tối đa 200.000 ký tự)');
  const status = STATUSES.includes(b.status) ? b.status : 'working';
  const image_url = b.image_url ? httpsUrl(str(b.image_url, 500)) : '';
  if (image_url === null) throw new HttpError(400, 'Ảnh game phải là link https');
  const tab_id = Number.isInteger(b.tab_id) && b.tab_id >= 0 ? b.tab_id : 0;
  return { title, code, status, image_url, tab_id, description: str(b.description, 500), game: str(b.game, 80), published: b.published ? 1 : 0 };
}
