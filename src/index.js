// DASH worker: trang admin + API admin. ĐÓNG MẶC ĐỊNH:
// chỉ nhận request có cookie phiên hợp lệ (sau khi đăng nhập bằng mật khẩu), còn lại trả 401.
const TZ_OFFSET_HOURS = 7; // phải giống bên bio
const STATUSES = ['working', 'patched', 'outdated'];
const ID_RE = /^[a-z0-9-]{2,40}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/theme' && request.method === 'GET') return json(await getSettings(env));
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

async function getProfile(env) {
  let row;
  try { row = await env.DB.prepare('SELECT name, bio, avatar_url, extra FROM profile WHERE id = 1').first(); }
  catch (e) { row = await env.DB.prepare('SELECT name, bio, avatar_url FROM profile WHERE id = 1').first(); }
  if (!row) return { name: 'NOIR', bio: '', avatar_url: '' };
  let ex = {}; try { ex = JSON.parse(row.extra || '{}'); } catch (e) { /* bỏ qua */ }
  return { ...ex, name: row.name, bio: row.bio, avatar_url: row.avatar_url };
}

// v18.3: links.extra là JSON {i: icon, b: banner, c: màu}; trả ra thành icon_url, banner_url, color
const flatLinks = (rows) => rows.map((r) => {
  if (!('extra' in r)) return r;
  const { extra, ...o } = r; let e = {}; try { e = JSON.parse(extra || '{}'); } catch (x) { /* bỏ qua */ }
  return { ...o, icon_url: e.i || '', banner_url: e.b || '', color: e.c || '' };
});
const HEX6 = /^#[0-9a-f]{6}$/i;
// v19: scripts.extra là JSON {g: [ảnh minh họa, tối đa 3], k: {n: mô tả key, u: link lấy key}}; k có mặt nghĩa là script cần key.
// Trả ra thành images (mảng), has_key, key_note, key_url
const flatScripts = (rows) => rows.map((r) => {
  if (!('extra' in r)) return r;
  const { extra, ...o } = r; let e = {}; try { e = JSON.parse(extra || '{}'); } catch (x) { /* bỏ qua */ }
  const k = e && typeof e.k === 'object' && e.k ? e.k : null;
  return { ...o, images: Array.isArray(e.g) ? e.g.filter((u) => /^https:\/\//.test(u)).slice(0, 3) : [], has_key: !!k, key_note: (k && k.n) || '', key_url: (k && k.u) || '' };
});
// chuỗi JSON lưu vào scripts.extra ('' nếu không có gì). strict: link sai thì báo lỗi (khi lưu); không strict: bỏ qua (khi khôi phục sao lưu)
function scriptExtra(images, hasKey, note, link, strict) {
  const list = Array.isArray(images) ? images : [];
  if (strict && list.length > 3) throw new HttpError(400, 'Tối đa 3 ảnh minh họa');
  const g = [];
  list.slice(0, 3).forEach((x) => {
    const u = httpsUrl(str(x, 500));
    if (u) g.push(u); else if (strict) throw new HttpError(400, 'Ảnh minh họa phải là link https');
  });
  const o = {};
  if (g.length) o.g = g;
  if (hasKey) {
    const k = {}, n = str(note, 200), l = link ? httpsUrl(str(link, 500)) : '';
    if (n) k.n = n;
    if (l) k.u = l; else if (link && strict) throw new HttpError(400, 'Link lấy key phải là link https');
    o.k = k;
  }
  return Object.keys(o).length ? JSON.stringify(o) : '';
}
async function hasScriptExtra(env) { // chưa chạy migration 011 thì không có cột extra
  try { await env.DB.prepare('SELECT extra FROM scripts LIMIT 1').first(); return true; } catch (e) { return false; }
}

// chuỗi JSON lưu vào links.extra (chỉ link không phải ảnh & video); icon, banner phải là https, màu dạng #rrggbb
function linkExtra(x) {
  if (!x || x.mode === 'media') return '';
  const i = httpsUrl(str(x.icon_url, 500)) || '', b = httpsUrl(str(x.banner_url, 500)) || '', c = typeof x.color === 'string' && HEX6.test(x.color.trim()) ? x.color.trim().toLowerCase() : '';
  const o = {}; if (i) o.i = i; if (b) o.b = b; if (c) o.c = c;
  return Object.keys(o).length ? JSON.stringify(o) : '';
}
async function hasLinkExtra(env) { // chưa chạy migration 010 thì không có cột extra
  try { await env.DB.prepare('SELECT extra FROM links LIMIT 1').first(); return true; } catch (e) { return false; }
}
async function getLinks(env) {
  try { return flatLinks((await env.DB.prepare('SELECT label, url, icon, tab_id, note, mode, extra FROM links ORDER BY sort, id').all()).results); }
  catch (e) { /* chưa chạy migration 010 */ }
  try { return (await env.DB.prepare('SELECT label, url, icon, tab_id, note, mode FROM links ORDER BY sort, id').all()).results; }
  catch (e) { /* chưa chạy migration 009 */ }
  try { return (await env.DB.prepare('SELECT label, url, icon, tab_id, note FROM links ORDER BY sort, id').all()).results; }
  catch (e) { return (await env.DB.prepare('SELECT label, url, icon, tab_id FROM links ORDER BY sort, id').all()).results; }
}

// Tab: chế độ (kind), chức năng tab "custom" (opts), nội dung tab ghi chú (body). Chưa chạy migration 009 thì rơi về cột cũ.
async function getTabs(env, order, withSort) {
  const sel = 'id, name, kind' + (withSort ? ', sort' : '');
  try { return (await env.DB.prepare('SELECT ' + sel + ', opts, body FROM tabs ORDER BY ' + order).all()).results; }
  catch (e) { return (await env.DB.prepare('SELECT ' + sel + ' FROM tabs ORDER BY ' + order).all()).results; }
}

async function adminScripts(env) {
  try { return flatScripts((await env.DB.prepare('SELECT * FROM scripts ORDER BY sort, updated_at DESC').all()).results); }
  catch (e) { return flatScripts((await env.DB.prepare('SELECT * FROM scripts ORDER BY updated_at DESC').all()).results); }
}

async function getSettings(env) {
  try {
    const r = await env.DB.prepare('SELECT data FROM site_settings WHERE id = 1').first();
    return r ? JSON.parse(r.data) : {};
  } catch (e) { return {}; }
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

// ---------- ghi chú nhiều mục (v18.2) ----------
// tabs.body của tab ghi chú là JSON {"notes":[{id,title,text,c,u}]} (c = lúc tạo, u = lúc cập nhật, mili giây).
// Dạng cũ là văn bản thường: coi như một ghi chú id "n0" chưa rõ thời gian. Thời gian do SERVER đặt, bỏ qua mọi giá trị client gửi.
const NOTE_MAX = 50, NOTE_TITLE = 80, NOTE_TEXT = 5000, BODY_MAX = 80000;
function noteList(body) {
  const s = typeof body === 'string' ? body : '';
  if (s.charAt(0) === '{') {
    try { const o = JSON.parse(s); if (o && Array.isArray(o.notes)) return { isNew: true, list: o.notes.map((n) => ({ id: String((n && n.id) || ''), title: String((n && n.title) || ''), text: String((n && n.text) || ''), c: Number(n && n.c) || 0, u: Number(n && n.u) || 0 })) }; } catch (e) { /* văn bản thường */ }
  }
  return { isNew: false, list: s.trim() ? [{ id: 'n0', title: '', text: s, c: 0, u: 0 }] : [] };
}
// oldBody: body đang lưu; incoming: chuỗi client gửi (JSON ghi chú hoặc văn bản thường). Trả về chuỗi lưu vào cột body.
function noteBody(oldBody, incoming, now) {
  const old = noteList(oldBody), byId = new Map(old.list.map((n) => [n.id, n]));
  const raw = typeof incoming === 'string' ? incoming : '';
  let list = null;
  if (raw.charAt(0) === '{') { try { const o = JSON.parse(raw); if (o && Array.isArray(o.notes)) list = o.notes; } catch (e) { /* văn bản thường */ } }
  if (!list) {
    if (old.isNew) return oldBody; // file dash cũ gửi văn bản thường: đừng ghi đè nhiều ghi chú bằng một đoạn văn bản
    list = raw.trim() ? [{ id: 'n0', title: '', text: raw }] : [];
  }
  if (list.length > NOTE_MAX) throw new HttpError(400, 'Tối đa ' + NOTE_MAX + ' ghi chú');
  const seen = new Set(), out = [];
  for (const x of list) {
    const title = str(x && x.title, NOTE_TITLE), text = str(x && x.text, NOTE_TEXT);
    if (!title && !text) continue;
    let id = x && typeof x.id === 'string' && /^[a-z0-9]{1,16}$/.test(x.id) && !seen.has(x.id) ? x.id : '';
    if (!id) { do { id = 'n' + Math.random().toString(36).slice(2, 8); } while (seen.has(id) || byId.has(id)); }
    seen.add(id);
    const o = byId.get(id);
    out.push(o ? { id, title, text, c: o.c, u: o.title === title && o.text === text ? o.u : now } : { id, title, text, c: now, u: now });
  }
  if (!out.length) return '';
  const s = JSON.stringify({ notes: out });
  if (s.length > BODY_MAX) throw new HttpError(400, 'Ghi chú quá dài, hãy xoá bớt');
  return s;
}
const httpsUrl = (v) => {
  try { const u = new URL(v); return u.protocol === 'https:' ? u.href : null; } catch { return null; }
};

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

// Chế độ tab. Danh sách này phải khớp TAB_MODES / TAB_FEATS trong look.js
const TAB_KINDS = ['social', 'link', 'media', 'script', 'note', 'custom'];
const TAB_FEATS = ['note', 'social', 'link', 'media', 'script'];
const LINK_FEATS = ['social', 'link', 'media'];
function tabOptsJson(kind, o) { // chuỗi JSON lưu vào tabs.opts; chỉ tab custom mới có
  if (kind !== 'custom') return '';
  const f = {};
  TAB_FEATS.forEach((k) => { if (o && o.f && o.f[k] === true) f[k] = true; });
  if (!Object.keys(f).length) throw new HttpError(400, 'Tab "Khác" cần bật ít nhất một chức năng');
  return JSON.stringify({ f, tools: !(o && o.tools === false) });
}
function tabFeatsOf(t) {
  if (t.kind !== 'custom') return [t.kind];
  let o = {}; try { o = JSON.parse(t.opts || '{}'); } catch (e) { o = {}; }
  return TAB_FEATS.filter((k) => o.f && o.f[k]);
}
// sau khi sửa hoặc xoá, vẫn phải còn ít nhất một tab chứa script và một tab chứa link (social, link hoặc ảnh & video)
function checkProviders(tabs) {
  const fs = tabs.flatMap(tabFeatsOf);
  if (!fs.includes('script')) throw new HttpError(400, 'Cần giữ ít nhất một tab chứa Script');
  if (!fs.some((k) => LINK_FEATS.includes(k))) throw new HttpError(400, 'Cần giữ ít nhất một tab chứa link (Social, Link hoặc Ảnh & video)');
}

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
      return json({ profile: await getProfile(env), links: await getLinks(env), scripts: await adminScripts(env), tabs: await getTabs(env, 'sort, id'), settings: await getSettings(env) });
    }

    if (path === '/stats' && method === 'GET') {
      const days = Math.min(90, Math.max(7, Number(url.searchParams.get('days')) || 30));
      const since = today(-(days - 1)), prevSince = today(-(2 * days - 1));
      const { results } = await env.DB.prepare('SELECT day, kind, count FROM daily_stats WHERE day >= ? ORDER BY day').bind(since).all();
      const prev = {};
      (await env.DB.prepare('SELECT kind, SUM(count) AS n FROM daily_stats WHERE day >= ? AND day < ? GROUP BY kind').bind(prevSince, since).all()).results.forEach((r) => { prev[r.kind] = r.n; });
      const agg = async (dim, limit) => {
        try { return (await env.DB.prepare('SELECT value, SUM(count) AS n FROM visit_stats WHERE dim = ? AND day >= ? GROUP BY value ORDER BY n DESC LIMIT ?').bind(dim, since, limit).all()).results; }
        catch (e) { return []; }
      };
      const dims = {};
      for (const [dim, lim] of [['country', 10], ['city', 10], ['device', 4], ['os', 8], ['browser', 8], ['model', 10], ['src', 12], ['srcgrp', 6], ['hour', 24], ['visitor', 2]]) dims[dim] = await agg(dim, lim);
      let per = [];
      try { per = (await env.DB.prepare('SELECT day, script_id, kind, count FROM script_stats WHERE day >= ?').bind(since).all()).results; } catch (e) { /* chưa có bảng */ }
      return json({ since, today: today(), days, rows: results, prev, per, dims });
    }

    if (path === '/profile' && method === 'PUT') {
      const b = await readJson(request);
      const name = str(b.name, 60) || 'NOIR';
      const img = (v) => { const u = v ? httpsUrl(str(v, 500)) : ''; if (u === null) throw new HttpError(400, 'Link ảnh phải bắt đầu bằng https'); return u; };
      const FR = ['none', 'ring', 'neon', 'gradient', 'spin', 'pulse', 'double'], FX = ['none', 'snow', 'stars', 'rain', 'fireflies'];
      const frames = (Array.isArray(b.frames) ? b.frames : []).slice(0, 20)
        .map((x) => ({ id: str(x.id, 16).replace(/[^a-z0-9]/gi, ''), name: str(x.name, 40), url: httpsUrl(str(x.url, 500)) }))
        .filter((x) => x.id && x.name && x.url);
      const dc = str(b.deco, 24);
      const deco = /^b:[a-z]{2,16}$/.test(dc) || frames.some((f) => 'c:' + f.id === dc) ? dc : 'none';
      const frame_scale = Math.min(170, Math.max(100, Math.round(Number(b.frame_scale) || 130)));
      const extra = {
        tagline: str(b.tagline, 60), pronouns: str(b.pronouns, 20), location: str(b.location, 40), status: str(b.status, 60),
        banner_url: img(b.banner_url), deco, frames, frame_scale,
        frame: FR.includes(b.frame) ? b.frame : 'none',
        frame_color: /^#[0-9a-f]{6}$/i.test(b.frame_color || '') ? b.frame_color : '',
        effect: FX.includes(b.effect) ? b.effect : 'none',
        badges: (Array.isArray(b.badges) ? b.badges : []).slice(0, 8).map((x) => str(x, 24)).filter(Boolean),
      };
      await env.DB.prepare(
        'INSERT INTO profile (id, name, bio, avatar_url, extra) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, bio = excluded.bio, avatar_url = excluded.avatar_url, extra = excluded.extra'
      ).bind(name, str(b.bio, 500), img(b.avatar_url), JSON.stringify(extra)).run();
      return json({ ok: true });
    }

    if (path === '/links' && method === 'PUT') {
      const b = await readJson(request);
      if (!Array.isArray(b.links) || b.links.length > 120) throw new HttpError(400, 'Tối đa 120 link');
      const stmts = [env.DB.prepare('DELETE FROM links')], withX = await hasLinkExtra(env);
      let wantX = false;
      b.links.forEach((x, i) => {
        const label = str(x.label, 40);
        const u = httpsUrl(str(x.url, 500));
        if (!label || !u) throw new HttpError(400, `Link #${i + 1}: cần tên và URL https hợp lệ`);
        const ex = linkExtra(x); if (ex) wantX = true;
        const mode = LINK_FEATS.includes(x.mode) ? x.mode : '', tab = Number.isInteger(x.tab_id) && x.tab_id >= 0 ? x.tab_id : 0;
        stmts.push(withX
          ? env.DB.prepare('INSERT INTO links (label, url, icon, sort, tab_id, note, mode, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(label, u, str(x.icon, 24), i, tab, str(x.note, 80), mode, ex)
          : env.DB.prepare('INSERT INTO links (label, url, icon, sort, tab_id, note, mode) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(label, u, str(x.icon, 24), i, tab, str(x.note, 80), mode));
      });
      await env.DB.batch(stmts);
      return json({ ok: true, extra: withX || !wantX }); // extra = false: chưa chạy migration 010 nên icon, banner, màu chưa được lưu
    }

    if (path === '/scripts' && method === 'POST') {
      const b = await readJson(request);
      const f = scriptFields(b);
      const id = str(b.id, 40);
      if (!ID_RE.test(id)) throw new HttpError(400, 'ID chỉ gồm a-z, 0-9, dấu gạch ngang (2-40 ký tự)');
      const now = Date.now(), withX = await hasScriptExtra(env);
      try {
        await env.DB.prepare(
          'INSERT INTO scripts (id, title, description, game, image_url, tab_id, status, code, published, created_at, updated_at, version, changelog, features, howto, executors, sort' + (withX ? ', extra' : '') + ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT MIN(sort) FROM scripts), 0) - 1' + (withX ? ', ?' : '') + ')'
        ).bind(...[id, f.title, f.description, f.game, f.image_url, f.tab_id, f.status, f.code, f.published, now, now, f.version, f.changelog, f.features, f.howto, f.executors].concat(withX ? [f.extra] : [])).run();
      } catch (e) {
        if (String(e).includes('UNIQUE')) throw new HttpError(409, 'ID này đã tồn tại');
        throw e;
      }
      if (f.version) {
        try { await env.DB.prepare('INSERT INTO script_versions (script_id, version, changelog, created_at) VALUES (?, ?, ?, ?)').bind(id, f.version, f.changelog, now).run(); } catch (e) { /* chưa chạy migration 008 */ }
      }
      return json({ ok: true, id, extra: withX || !f.extra }); // extra = false: chưa chạy migration 011 nên ảnh minh họa và key chưa được lưu
    }

    const vm = path.match(/^\/scripts\/([a-z0-9-]{2,40})\/versions$/);
    if (vm && method === 'GET') {
      try { return json((await env.DB.prepare('SELECT id, version, changelog, created_at FROM script_versions WHERE script_id = ? ORDER BY id DESC').bind(vm[1]).all()).results); }
      catch (e) { return json([]); }
    }
    const dv = path.match(/^\/versions\/(\d+)$/);
    if (dv && method === 'DELETE') {
      await env.DB.prepare('DELETE FROM script_versions WHERE id = ?').bind(Number(dv[1])).run();
      return json({ ok: true });
    }

    const m = path.match(/^\/scripts\/([a-z0-9-]{2,40})$/);
    if (m && method === 'PUT') {
      const f = scriptFields(await readJson(request));
      const cur = await env.DB.prepare('SELECT version FROM scripts WHERE id = ?').bind(m[1]).first();
      if (!cur) throw new HttpError(404, 'Không tìm thấy script');
      const now = Date.now(), withX = await hasScriptExtra(env);
      await env.DB.prepare(
        'UPDATE scripts SET title = ?, description = ?, game = ?, image_url = ?, tab_id = ?, status = ?, code = ?, published = ?, updated_at = ?, version = ?, changelog = ?, features = ?, howto = ?, executors = ?' + (withX ? ', extra = ?' : '') + ' WHERE id = ?'
      ).bind(...[f.title, f.description, f.game, f.image_url, f.tab_id, f.status, f.code, f.published, now, f.version, f.changelog, f.features, f.howto, f.executors].concat(withX ? [f.extra] : [], [m[1]])).run();
      if (f.version) {
        try { // đổi số phiên bản thì ghi thêm vào lịch sử; giữ nguyên số phiên bản thì chỉ sửa ghi chú của mục hiện tại
          let done = false;
          if (f.version === (cur.version || '')) {
            const r = await env.DB.prepare('UPDATE script_versions SET changelog = ? WHERE id = (SELECT id FROM script_versions WHERE script_id = ? AND version = ? ORDER BY id DESC LIMIT 1)').bind(f.changelog, m[1], f.version).run();
            done = r.meta.changes > 0;
          }
          if (!done) await env.DB.prepare('INSERT INTO script_versions (script_id, version, changelog, created_at) VALUES (?, ?, ?, ?)').bind(m[1], f.version, f.changelog, now).run();
        } catch (e) { /* chưa chạy migration 008 */ }
      }
      return json({ ok: true, extra: withX || !f.extra });
    }
    if (m && method === 'DELETE') {
      await env.DB.prepare('DELETE FROM scripts WHERE id = ?').bind(m[1]).run();
      try { await env.DB.prepare('DELETE FROM script_versions WHERE script_id = ?').bind(m[1]).run(); } catch (e) { /* bỏ qua */ }
      return json({ ok: true });
    }

    if (path === '/settings' && method === 'PUT') {
      const b = await readJson(request);
      const accent = /^#[0-9a-f]{6}$/i.test((b.theme && b.theme.accent) || '') ? b.theme.accent : '#9370ff';
      const bgs = (Array.isArray(b.backgrounds) ? b.backgrounds : []).slice(0, 20)
        .map((x) => ({ id: str(x.id, 16).replace(/[^a-z0-9]/gi, ''), name: str(x.name, 40), url: httpsUrl(str(x.url, 500)) }))
        .filter((x) => x.id && x.name && x.url);
      const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
      // một cấu hình hình nền: active, mode (off|fixed|random|slide), interval, trans, blur, dim, anim, glass
      const cfg = (c) => {
        c = c || {};
        return { active: bgs.some((x) => x.id === c.active) ? c.active : '', mode: ['fixed', 'random', 'slide'].includes(c.mode) ? c.mode : 'off',
                 interval: clamp(c.interval || 30, 5, 300), trans: ['slide', 'zoom', 'ink', 'random'].includes(c.trans) ? c.trans : 'fade',
                 blur: clamp(c.blur, 0, 24), dim: clamp(c.dim, 0, 90), anim: c.anim === 'zoom' ? 'zoom' : 'none', glass: !!c.glass };
      };
      const slot = (x) => { x = x || {}; const mb = x.mobile || {}; return { pc: cfg(x.pc), mobile: { ...cfg(mb), same: mb.same !== false } }; };
      let src = b.bgs;
      if (!src) { // file dash cũ (trước v14) gửi dạng một cấu hình bg + apply: đổi sang dạng mới để không mất hình nền
        const g = b.bg || {}, ap = ['bio', 'dash'].includes(g.apply) ? g.apply : 'both';
        const old = { ...g, mode: g.mode || (g.active ? 'fixed' : 'off') };
        src = { bio: { pc: ap === 'dash' ? {} : old }, dash: { pc: ap === 'bio' ? {} : old } };
      }
      const data = {
        theme: { accent }, backgrounds: bgs, layout: { links: b.layout && b.layout.links === 'grid' ? 'grid' : 'list' },
        bgs: { bio: slot(src.bio), dash: slot(src.dash) },
      };
      // giữ thêm khoá cũ `bg` (lấy từ bio, máy tính) để file bio/look.js cũ chưa kịp cập nhật vẫn hiện được nền
      const L = data.bgs.bio.pc;
      data.bg = { ...L, mode: L.mode === 'fixed' || L.mode === 'random' || L.mode === 'slide' ? L.mode : 'fixed', active: L.mode === 'off' ? '' : L.active, apply: 'both' };
      await env.DB.prepare('INSERT INTO site_settings (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data').bind(JSON.stringify(data)).run();
      return json({ ok: true });
    }

    if (path === '/backup' && method === 'GET') {
      const q = async (sql) => (await env.DB.prepare(sql).all()).results;
      let profile;
      try { profile = await env.DB.prepare('SELECT name, bio, avatar_url, extra FROM profile WHERE id = 1').first(); }
      catch (e) { profile = await env.DB.prepare('SELECT name, bio, avatar_url FROM profile WHERE id = 1').first(); }
      let settings = '';
      try { const r = await env.DB.prepare('SELECT data FROM site_settings WHERE id = 1').first(); settings = r ? r.data : ''; } catch (e) { /* chưa có bảng */ }
      const body = JSON.stringify({
        version: 1, exported_at: new Date().toISOString(), profile, settings,
        tabs: await getTabs(env, 'id', true),
        links: await getLinks(env),
        scripts: await q('SELECT * FROM scripts ORDER BY created_at'),
        versions: await q('SELECT script_id, version, changelog, created_at FROM script_versions ORDER BY id').catch(() => []),
        daily_stats: await q('SELECT day, kind, count FROM daily_stats'),
      });
      return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="noir-backup.json"' } });
    }

    if (path === '/restore' && method === 'POST') {
      if (Number(request.headers.get('content-length') || 0) > 8e6) throw new HttpError(413, 'File quá lớn (tối đa 8 MB)');
      let b;
      try { b = await request.json(); } catch (e) { throw new HttpError(400, 'File không phải JSON hợp lệ'); }
      if (!b || b.version !== 1 || !Array.isArray(b.scripts) || !Array.isArray(b.links) || !Array.isArray(b.tabs)) throw new HttpError(400, 'Đây không phải file sao lưu của NOIR');
      const n = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d);
      const withX = await hasLinkExtra(env), withSX = await hasScriptExtra(env);
      let hasV = true;
      try { await env.DB.prepare('SELECT 1 FROM script_versions LIMIT 1').first(); } catch (e) { hasV = false; }
      const st = ['links', 'scripts', 'tabs', 'daily_stats'].concat(hasV ? ['script_versions'] : []).map((t) => env.DB.prepare('DELETE FROM ' + t));
      b.tabs.forEach((t) => {
        let kind = TAB_KINDS.includes(t.kind) ? t.kind : 'social', opts = '';
        if (kind === 'custom') { try { opts = tabOptsJson('custom', JSON.parse(t.opts || '{}')); } catch (e) { kind = 'social'; } }
        st.push(env.DB.prepare('INSERT INTO tabs (id, name, kind, sort, opts, body) VALUES (?, ?, ?, ?, ?, ?)').bind(n(t.id), str(t.name, 24) || 'Tab', kind, n(t.sort), opts, str(t.body, BODY_MAX)));
      });
      b.links.forEach((l, i) => {
        const u = httpsUrl(str(l.url, 500)), label = str(l.label, 40);
        if (u && label) st.push(withX
          ? env.DB.prepare('INSERT INTO links (label, url, icon, sort, tab_id, note, mode, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(label, u, str(l.icon, 24), i, n(l.tab_id), str(l.note, 80), LINK_FEATS.includes(l.mode) ? l.mode : '', linkExtra(l))
          : env.DB.prepare('INSERT INTO links (label, url, icon, sort, tab_id, note, mode) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(label, u, str(l.icon, 24), i, n(l.tab_id), str(l.note, 80), LINK_FEATS.includes(l.mode) ? l.mode : ''));
      });
      b.scripts.forEach((x) => {
        const id = str(x.id, 40), code = typeof x.code === 'string' ? x.code : '';
        if (!ID_RE.test(id) || !str(x.title, 80) || !code || code.length > 200000) return;
        let ex = ''; try { const e = JSON.parse(x.extra || '{}'), k = e && typeof e.k === 'object' ? e.k : null; ex = scriptExtra(e.g, !!k, k && k.n, k && k.u, false); } catch (e) { /* bỏ qua */ }
        st.push(env.DB.prepare('INSERT INTO scripts (id, title, description, game, image_url, tab_id, status, code, published, runs, copies, created_at, updated_at, version, changelog, features, howto, executors, sort' + (withSX ? ', extra' : '') + ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?' + (withSX ? ', ?' : '') + ')')
          .bind(...[id, str(x.title, 80), str(x.description, 500), str(x.game, 80), x.image_url ? (httpsUrl(str(x.image_url, 500)) || '') : '', n(x.tab_id),
            STATUSES.includes(x.status) ? x.status : 'working', code, x.published ? 1 : 0, n(x.runs), n(x.copies), n(x.created_at, Date.now()), n(x.updated_at, Date.now()), str(x.version, 20), str(x.changelog, 300), str(x.features, 600), str(x.howto, 600), str(x.executors, 100), n(x.sort)].concat(withSX ? [ex] : [])));
      });
      if (hasV) {
        (Array.isArray(b.versions) ? b.versions : []).forEach((v) => {
          const sid = str(v.script_id, 40), ver = str(v.version, 20);
          if (ID_RE.test(sid) && ver) st.push(env.DB.prepare('INSERT INTO script_versions (script_id, version, changelog, created_at) VALUES (?, ?, ?, ?)').bind(sid, ver, str(v.changelog, 300), n(v.created_at, Date.now())));
        });
      }
      (Array.isArray(b.daily_stats) ? b.daily_stats : []).forEach((r) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(r.day || '') && ['view', 'copy', 'run'].includes(r.kind)) st.push(env.DB.prepare('INSERT INTO daily_stats (day, kind, count) VALUES (?, ?, ?)').bind(r.day, r.kind, Math.max(0, n(r.count))));
      });
      if (b.profile && typeof b.profile === 'object') {
        let extra = '{}';
        try { if (typeof b.profile.extra === 'string') { JSON.parse(b.profile.extra); extra = b.profile.extra; } } catch (e) { /* bỏ qua */ }
        st.push(env.DB.prepare('INSERT OR REPLACE INTO profile (id, name, bio, avatar_url, extra) VALUES (1, ?, ?, ?, ?)').bind(str(b.profile.name, 60) || 'NOIR', str(b.profile.bio, 500), str(b.profile.avatar_url, 500), extra));
      }
      if (typeof b.settings === 'string' && b.settings) {
        try { JSON.parse(b.settings); st.push(env.DB.prepare('INSERT OR REPLACE INTO site_settings (id, data) VALUES (1, ?)').bind(b.settings)); } catch (e) { /* bỏ qua */ }
      }
      await env.DB.batch(st);
      return json({ ok: true, scripts: b.scripts.length, links: b.links.length });
    }

    if ((path === '/scripts-order' || path === '/tabs-order') && method === 'PUT') {
      const b = await readJson(request);
      if (!Array.isArray(b.ids) || b.ids.length > 500) throw new HttpError(400, 'Danh sách không hợp lệ');
      const isS = path === '/scripts-order';
      await env.DB.batch(b.ids.map((id, i) => env.DB.prepare(isS ? 'UPDATE scripts SET sort = ? WHERE id = ?' : 'UPDATE tabs SET sort = ? WHERE id = ?').bind(i + 1, isS ? str(id, 40) : Number(id))));
      return json({ ok: true });
    }

    if (path === '/tabs' && method === 'POST') {
      const b = await readJson(request);
      const name = str(b.name, 24);
      if (!name) throw new HttpError(400, 'Thiếu tên tab');
      const kind = TAB_KINDS.includes(b.kind) ? b.kind : 'social';
      const opts = tabOptsJson(kind, b.opts);
      const nx = await env.DB.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM tabs').first();
      await env.DB.prepare('INSERT INTO tabs (name, kind, sort, opts, body) VALUES (?, ?, ?, ?, ?)').bind(name, kind, nx.n, opts, kind === 'note' || kind === 'custom' ? noteBody('', b.body, Date.now()) : '').run();
      return json({ ok: true });
    }
    const tm = path.match(/^\/tabs\/(\d+)$/);
    if (tm && method === 'PUT') {
      const id = Number(tm[1]);
      const b = await readJson(request);
      const cur = await env.DB.prepare('SELECT id, name, kind, opts, body FROM tabs WHERE id = ?').bind(id).first();
      if (!cur) throw new HttpError(404, 'Không tìm thấy tab');
      const name = b.name === undefined ? cur.name : str(b.name, 24);
      if (!name) throw new HttpError(400, 'Thiếu tên tab');
      const kind = b.kind === undefined ? cur.kind : (TAB_KINDS.includes(b.kind) ? b.kind : cur.kind);
      const opts = tabOptsJson(kind, b.opts === undefined ? (() => { try { return JSON.parse(cur.opts || '{}'); } catch (e) { return {}; } })() : b.opts);
      const body = kind === 'note' || kind === 'custom' ? (b.body === undefined ? cur.body : noteBody(cur.body, b.body, Date.now())) : '';
      const all = await getTabs(env, 'id');
      checkProviders(all.map((t) => (t.id === id ? { id, kind, opts } : t)));
      await env.DB.prepare('UPDATE tabs SET name = ?, kind = ?, opts = ?, body = ? WHERE id = ?').bind(name, kind, opts, body, id).run();
      return json({ ok: true });
    }
    if (tm && method === 'DELETE') {
      const id = Number(tm[1]);
      const all = await getTabs(env, 'id');
      if (!all.some((t) => t.id === id)) throw new HttpError(404, 'Không tìm thấy tab');
      checkProviders(all.filter((t) => t.id !== id));
      await env.DB.batch([
        env.DB.prepare("UPDATE links SET tab_id = 0, mode = '' WHERE tab_id = ?").bind(id),
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
  return { title, code, status, image_url, tab_id, version: str(b.version, 20), changelog: str(b.changelog, 300), features: str(b.features, 600), howto: str(b.howto, 600), executors: str(b.executors, 100), description: str(b.description, 500), game: str(b.game, 80), published: b.published ? 1 : 0, extra: scriptExtra(b.images, !!b.has_key, b.key_note, b.key_url, true) };
}
