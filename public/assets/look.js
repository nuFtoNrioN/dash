window.LOOK_V = 11;
// Giao diện dùng chung cho bio và dash: màu, hình nền (cố định/ngẫu nhiên/trình chiếu + hiệu ứng chuyển),
// thẻ hồ sơ (khung avatar), hiệu ứng hạt, danh sách nền tảng mạng xã hội.
(function () {
  var A = 'var(--ac,#9370ff)', FC = 'var(--fc,var(--ac,#9370ff))';
  window.PF_FRAMES = [['none', 'Không'], ['ring', 'Viền màu'], ['neon', 'Neon'], ['gradient', 'Gradient'], ['spin', 'Xoay'], ['pulse', 'Nhịp đập'], ['double', 'Viền đôi']];
  window.PF_FX = [['none', 'Không'], ['snow', 'Tuyết'], ['stars', 'Sao lấp lánh'], ['rain', 'Mưa'], ['fireflies', 'Đom đóm']];
  window.PLAT = { discord: ['Discord', '#5865F2'], tiktok: ['TikTok', '#FE2C55'], youtube: ['YouTube', '#FF0000'], github: ['GitHub', '#9aa4b2'], roblox: ['Roblox', '#E2231A'],
    facebook: ['Facebook', '#1877F2'], instagram: ['Instagram', '#E4405F'], x: ['X', '#9aa4b2'], telegram: ['Telegram', '#26A5E4'], twitch: ['Twitch', '#9146FF'],
    spotify: ['Spotify', '#1DB954'], steam: ['Steam', '#66c0f4'], reddit: ['Reddit', '#FF4500'] };

  var css = [
    '*{-webkit-tap-highlight-color:transparent}:focus{outline:none}',
    ':focus-visible{outline:none;box-shadow:0 0 0 2px #0a0a10,0 0 0 4px ' + A + '}',
    '::selection{background:color-mix(in srgb,' + A + ' 40%,transparent)}',
    '.btn,.link,.tab,.scard,.nav a{transition:transform .12s,background .15s,border-color .15s,color .15s}',
    '.btn:active,.link:active,.tab:active,.scard:active,.nav a:active{transform:scale(.96)}',
    '#panel>*{animation:tabin .3s ease backwards}.view{animation:viewin .25s ease backwards}@keyframes tabin{from{opacity:0;transform:translateY(8px)}}@keyframes viewin{from{opacity:0}}',
    '.link{gap:10px}.link:hover{border-color:var(--bc,' + A + ')}.lk-i{width:20px;height:20px;flex:none}',
    '@property --r{syntax:"<length>";inherits:false;initial-value:0px}',
    '#bgfx,#bgfx2,#bgdim{position:fixed;inset:0;pointer-events:none}#bgfx{z-index:-3}#bgfx2{z-index:-2;opacity:0}#bgdim{z-index:-1}',
    '#bgfx,#bgfx2{background-position:center;background-size:cover;transform:scale(1.1)}',
    '#bgfx.zoom,#bgfx2.zoom{animation:bgz 28s ease-in-out infinite alternate}@keyframes bgz{from{transform:scale(1.1)}to{transform:scale(1.22)}}',
    '.glass{--s1:rgba(27,25,37,.55);--bg-card:rgba(23,21,31,.55);--bg-input:rgba(13,12,19,.5)}',
    '.glass .strip,.glass .chart,.glass .pvwrap,.glass .scard,.glass .card,.glass dialog,.glass .gcard,.glass input,.glass textarea,.glass select{-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}',
    // thẻ hồ sơ
    '.pf{text-align:center}.pf-ban{height:132px;border-radius:16px;background:linear-gradient(135deg,color-mix(in srgb,' + A + ' 55%,#14121c),#14121c) center/cover}',
    '.pf-av{position:relative;width:104px;height:104px;margin:-52px auto 12px;border-radius:50%}',
    '.pf-img{position:relative;z-index:1;display:block;width:100%;height:100%;border-radius:50%;object-fit:cover;background:#242134;box-shadow:0 0 0 4px #0f0d16}',
    '.pf-img.ph{display:grid;place-items:center;font-size:38px;font-weight:700;color:#938da8}',
    '.pf-av::before{content:"";position:absolute;inset:-8px;border-radius:50%;opacity:0}',
    '.fr-ring::before,.fr-neon::before,.fr-gradient::before,.fr-spin::before,.fr-pulse::before,.fr-double::before{opacity:1;background:' + FC + '}',
    '.fr-neon::before{box-shadow:0 0 14px ' + FC + ',0 0 34px ' + FC + '}',
    '.fr-gradient::before{background:linear-gradient(135deg,#ff6bd6,' + FC + ',#4f8cff)}',
    '.fr-spin::before{background:conic-gradient(' + FC + ',transparent 45%,' + FC + ');animation:pfspin 3s linear infinite}',
    '.fr-pulse::before{animation:pfpulse 2s ease-in-out infinite}',
    '.fr-double::before{inset:-5px;box-shadow:0 0 0 4px #0f0d16,0 0 0 7px ' + FC + '}',
    '@keyframes pfspin{to{transform:rotate(360deg)}}@keyframes pfpulse{50%{box-shadow:0 0 22px ' + FC + ';transform:scale(1.05)}}',
    '.pf-fo{position:absolute;left:50%;top:50%;width:calc(var(--fs,130)*1%);height:calc(var(--fs,130)*1%);transform:translate(-50%,-50%);z-index:2;pointer-events:none;object-fit:contain}',
    '.pf-nm{font-size:24px;font-weight:700;line-height:1.2}.pf-tg{color:#938da8;margin-top:2px}',
    '.pf-meta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;color:#938da8;font-size:13px;margin-top:6px}',
    '.pf-st{display:inline-flex;align-items:center;gap:7px;margin-top:10px;padding:4px 12px;border:1px solid #302c43;border-radius:99px;font-size:13px;background:rgba(27,25,37,.6)}',
    '.pf-st::before{content:"";width:8px;height:8px;border-radius:50%;background:#5fd38d}',
    '.pf-bio{color:#cfc9df;margin-top:12px;white-space:pre-line}',
    '.pf-bd{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:12px}',
    '.pf-bd span{font-size:13px;padding:3px 10px;border-radius:99px;background:color-mix(in srgb,' + A + ' 16%,transparent);border:1px solid color-mix(in srgb,' + A + ' 40%,transparent)}',
    '@media(prefers-reduced-motion:reduce){*{animation:none!important}}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.append(st);

  var ok = function (u) { return /^https:\/\//.test(u || ''); };
  var el = function (t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
  var cssUrl = function (u) { return 'url("' + u.replace(/"/g, '%22').replace(/\\/g, '%5C') + '")'; };

  // ---------- thư viện khung avatar (ảnh SVG vẽ sẵn, kiểu Discord decoration) ----------
  var SV = function (i) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' + i + '</svg>'; };
  var pt = function (a, r) { return [60 + r * Math.cos(a * Math.PI / 180), 60 + r * Math.sin(a * Math.PI / 180)]; };
  var f1 = function (n) { return n.toFixed(1); };
  var STAR = 'M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4Z';
  var flower = function (a, r, s) {
    var p = pt(a, r), o = '<g transform="translate(' + f1(p[0]) + ' ' + f1(p[1]) + ') scale(' + s + ')">';
    for (var k = 0; k < 5; k++) o += '<ellipse cx="0" cy="-5" rx="3.6" ry="5.2" fill="#ffb7d5" stroke="#f08ab4" stroke-width=".6" transform="rotate(' + k * 72 + ')"/>';
    return o + '<circle r="1.9" fill="#ffe08a"/></g>';
  };
  var DECOS = [
    ['halo', 'Quầng sáng', function () {
      return SV('<defs><filter id="g"><feGaussianBlur stdDeviation="1.8"/></filter></defs><ellipse cx="60" cy="9" rx="25" ry="7" fill="none" stroke="#ffe066" stroke-width="5" filter="url(#g)" opacity=".8"/><ellipse cx="60" cy="9" rx="25" ry="7" fill="none" stroke="#fff3b0" stroke-width="2.6"><animate attributeName="opacity" values="1;.6;1" dur="3s" repeatCount="indefinite"/></ellipse>');
    }],
    ['cat', 'Tai mèo', function () {
      return SV('<path d="M18 46 L20 6 L50 22 Z" fill="#2c2840" stroke="#8f7bd6" stroke-width="2" stroke-linejoin="round"/><path d="M24 36 L25 15 L40 24 Z" fill="#ff9ec8"/><path d="M102 46 L100 6 L70 22 Z" fill="#2c2840" stroke="#8f7bd6" stroke-width="2" stroke-linejoin="round"/><path d="M96 36 L95 15 L80 24 Z" fill="#ff9ec8"/>');
    }],
    ['bunny', 'Tai thỏ', function () {
      return SV('<ellipse cx="40" cy="8" rx="8.5" ry="24" transform="rotate(-14 40 8)" fill="#f6f1ff" stroke="#cdbff0" stroke-width="1.6"/><ellipse cx="40" cy="9" rx="4" ry="16" transform="rotate(-14 40 8)" fill="#ffb5d3"/><ellipse cx="80" cy="8" rx="8.5" ry="24" transform="rotate(14 80 8)" fill="#f6f1ff" stroke="#cdbff0" stroke-width="1.6"/><ellipse cx="80" cy="9" rx="4" ry="16" transform="rotate(14 80 8)" fill="#ffb5d3"/>');
    }],
    ['horns', 'Sừng quỷ', function () {
      return SV('<path d="M30 30 C18 24 16 8 28 2 C27 12 33 18 42 22 Z" fill="#d6293a" stroke="#7d1020" stroke-width="1.5" stroke-linejoin="round"/><path d="M90 30 C102 24 104 8 92 2 C93 12 87 18 78 22 Z" fill="#d6293a" stroke="#7d1020" stroke-width="1.5" stroke-linejoin="round"/>');
    }],
    ['crown', 'Vương miện', function () {
      return SV('<path d="M36 24 L40 5 L52 17 L60 2 L68 17 L80 5 L84 24 Z" fill="#ffcf40" stroke="#b8860b" stroke-width="2" stroke-linejoin="round"/><circle cx="60" cy="14" r="2.6" fill="#ff5d73"/><circle cx="43" cy="17" r="2" fill="#6ec1ff"/><circle cx="77" cy="17" r="2" fill="#6ec1ff"/>');
    }],
    ['laurel', 'Vòng nguyệt quế', function () {
      var o = '';
      [1, -1].forEach(function (sd) {
        for (var i = 0; i < 9; i++) {
          var a = 100 + i * 17, aa = sd > 0 ? a : 180 - a, p = pt(aa, 52);
          o += '<ellipse cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" rx="3.4" ry="8" transform="rotate(' + (aa + 90 + (sd > 0 ? -28 : 28)) + ' ' + f1(p[0]) + ' ' + f1(p[1]) + ')" fill="' + (i % 2 ? '#4f9d5a' : '#6fbf6a') + '"/>';
        }
      });
      return SV(o);
    }],
    ['stars', 'Sao quay quanh', function () {
      var o = '';
      for (var i = 0; i < 8; i++) {
        var p = pt(i * 45 + 20, 53 + (i % 2) * 3);
        o += '<path d="' + STAR + '" transform="translate(' + f1(p[0]) + ' ' + f1(p[1]) + ') scale(' + (i % 2 ? .8 : 1.15) + ')" fill="#fff6c2"><animate attributeName="opacity" values=".2;1;.2" dur="2.4s" begin="-' + (i * .3).toFixed(1) + 's" repeatCount="indefinite"/></path>';
      }
      return SV(o);
    }],
    ['blossom', 'Hoa anh đào', function () {
      return SV(flower(-55, 52, 1.2) + flower(-30, 57, .8) + flower(-125, 57, .75) + flower(150, 54, 1) + flower(122, 52, .7));
    }],
    ['wings', 'Cánh thiên thần', function () {
      var w = '<path d="M14 58 C-4 50 -4 22 10 10 C10 24 20 34 28 40 Z" fill="#fff" stroke="#cfd8ff" stroke-width="1.4"/><path d="M16 72 C2 70 -2 50 6 38 C10 50 18 56 26 58 Z" fill="#f2f5ff" stroke="#cfd8ff" stroke-width="1.4"/>';
      return SV(w + '<g transform="translate(120 0) scale(-1 1)">' + w + '</g>');
    }]
  ];
  window.PF_DECOS = DECOS.map(function (d) { return { id: d[0], name: d[1], uri: 'data:image/svg+xml,' + encodeURIComponent(d[2]()) }; });
  var decoUrl = function (p) {
    var d = p.deco || '';
    if (d.indexOf('b:') === 0) { var x = PF_DECOS.find(function (z) { return z.id === d.slice(2); }); return x ? x.uri : ''; }
    if (d.indexOf('c:') === 0) { var f = (p.frames || []).find(function (z) { return z.id === d.slice(2); }); return f && /^https:\/\//.test(f.url || '') ? f.url : ''; }
    return /^https:\/\//.test(p.frame_url || '') ? p.frame_url : '';
  };

  // ---------- thẻ hồ sơ ----------
  window.buildProfile = function (p) {
    p = p || {};
    var root = el('div', 'pf'), ban = el('div', 'pf-ban');
    if (ok(p.banner_url)) ban.style.backgroundImage = cssUrl(p.banner_url);
    var fr = PF_FRAMES.some(function (f) { return f[0] === p.frame; }) ? p.frame : 'none';
    var av = el('div', 'pf-av fr-' + fr);
    if (/^#[0-9a-f]{6}$/i.test(p.frame_color || '')) av.style.setProperty('--fc', p.frame_color);
    var im;
    if (ok(p.avatar_url)) { im = el('img', 'pf-img'); im.src = p.avatar_url; im.alt = ''; }
    else im = el('div', 'pf-img ph', (p.name || 'N').trim().charAt(0).toUpperCase());
    av.append(im);
    var du = decoUrl(p);
    if (du) { var o = el('img', 'pf-fo'); o.src = du; o.alt = ''; o.style.setProperty('--fs', Math.min(170, Math.max(100, +p.frame_scale || 130))); av.append(o); }
    root.append(ban, av, el('div', 'pf-nm', p.name || 'NOIR'));
    if (p.tagline) root.append(el('div', 'pf-tg', p.tagline));
    if (p.pronouns || p.location) {
      var m = el('div', 'pf-meta'); if (p.pronouns) m.append(el('span', '', p.pronouns)); if (p.location) m.append(el('span', '', p.location)); root.append(m);
    }
    if (p.status) root.append(el('div', 'pf-st', p.status));
    if (p.bio) root.append(el('div', 'pf-bio', p.bio));
    if (p.badges && p.badges.length) { var bd = el('div', 'pf-bd'); p.badges.forEach(function (t) { bd.append(el('span', '', t)); }); root.append(bd); }
    return root;
  };

  // ---------- hiệu ứng hạt (chỉ bio dùng) ----------
  var fxStop = null;
  window.startFx = function (kind) {
    if (fxStop) fxStop();
    if (!kind || kind === 'none' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = el('canvas'); c.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none'; document.body.append(c);
    var x = c.getContext('2d'), W, H, P = [], raf;
    var ac = getComputedStyle(document.documentElement).getPropertyValue('--ac').trim() || '#9370ff';
    var size = function () { W = c.width = innerWidth; H = c.height = innerHeight; }; size(); addEventListener('resize', size);
    var N = kind === 'rain' ? 110 : kind === 'stars' ? 80 : 55;
    for (var i = 0; i < N; i++) P.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2 + 1, s: Math.random() + .4, p: Math.random() * 6.28 });
    (function tick() {
      x.clearRect(0, 0, W, H);
      P.forEach(function (q) {
        q.p += .02;
        if (kind === 'snow') { q.y += q.s; q.x += Math.sin(q.p) * .6; x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.arc(q.x, q.y, q.r, 0, 6.28); x.fill(); }
        else if (kind === 'rain') { q.y += q.s * 9; q.x -= 1.5; x.strokeStyle = 'rgba(170,190,255,.35)'; x.beginPath(); x.moveTo(q.x, q.y); x.lineTo(q.x + 1.5, q.y - q.r * 7); x.stroke(); }
        else if (kind === 'stars') { x.fillStyle = 'rgba(255,255,255,' + (.2 + .8 * Math.abs(Math.sin(q.p))) + ')'; x.beginPath(); x.arc(q.x, q.y, q.r * .8, 0, 6.28); x.fill(); }
        else { q.x += Math.cos(q.p) * .5; q.y += Math.sin(q.p * 1.3) * .5; x.globalAlpha = .3 + .6 * Math.abs(Math.sin(q.p)); x.fillStyle = ac; x.shadowColor = ac; x.shadowBlur = 14; x.beginPath(); x.arc(q.x, q.y, q.r * 1.4, 0, 6.28); x.fill(); x.shadowBlur = 0; x.globalAlpha = 1; }
        if (q.y > H + 12) { q.y = -12; q.x = Math.random() * W; } if (q.x < -12) q.x = W + 12; if (q.x > W + 12) q.x = -12;
      });
      raf = requestAnimationFrame(tick);
    })();
    fxStop = function () { cancelAnimationFrame(raf); removeEventListener('resize', size); c.remove(); fxStop = null; };
  };

  // ---------- nền ----------
  var timer = null, tkey = '', rnd = null, si = 0, front = true, trans = 'fade';
  var mix = function (h, p) { return '#' + [1, 3, 5].map(function (i) { return Math.round(parseInt(h.substr(i, 2), 16) * (1 - p) + 255 * p).toString(16).padStart(2, '0'); }).join(''); };
  var setImg = function (e, u) { e.style.backgroundImage = cssUrl(u); };
  var clear = function () {
    clearInterval(timer); timer = null; tkey = '';
    ['bgfx', 'bgfx2', 'bgdim'].forEach(function (id) { var e = document.getElementById(id); if (e) e.remove(); });
    document.body.classList.remove('glass');
  };
  var layers = function () {
    var a = document.getElementById('bgfx');
    if (!a) {
      a = el('div'); a.id = 'bgfx'; var b = el('div'); b.id = 'bgfx2'; var d = el('div'); d.id = 'bgdim';
      document.body.prepend(a, b, d); front = true;
    }
    return { a: a, b: document.getElementById('bgfx2'), dim: document.getElementById('bgdim') };
  };
  var inkMask = function () {
    var f = [1, .8, .64];
    return f.map(function (k) {
      return 'radial-gradient(circle at ' + Math.round(Math.random() * 100) + '% ' + Math.round(Math.random() * 100) + '%,#000 calc(var(--r)*' + k + '),transparent calc(var(--r)*' + k + ' + 90px))';
    }).join(',');
  };
  // Chuyển ảnh: inc là lớp mang ảnh mới, out là lớp ảnh cũ
  var go = function (inc, out, kind) {
    inc.style.zIndex = -2; out.style.zIndex = -3; inc.style.opacity = 1;
    var red = matchMedia('(prefers-reduced-motion: reduce)').matches; if (red) kind = 'fade';
    var a, d = 1400, ease = 'cubic-bezier(.7,0,.2,1)';
    if (kind === 'slide') {
      a = inc.animate([{ transform: 'translateX(100%) scale(1.1)' }, { transform: 'translateX(0) scale(1.1)' }], { duration: d, easing: ease });
      out.animate([{ transform: 'translateX(0) scale(1.1)' }, { transform: 'translateX(-30%) scale(1.1)' }], { duration: d, easing: ease });
    } else if (kind === 'zoom') {
      a = inc.animate([{ opacity: 0, transform: 'scale(1.4)' }, { opacity: 1, transform: 'scale(1.1)' }], { duration: d, easing: 'ease-out' });
    } else if (kind === 'ink') {
      inc.style.webkitMaskImage = inc.style.maskImage = inkMask();
      a = inc.animate([{ '--r': '0px' }, { '--r': '160vmax' }], { duration: 2400, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
    } else a = inc.animate([{ opacity: 0 }, { opacity: 1 }], { duration: red ? 1 : d });
    a.onfinish = function () { out.style.opacity = 0; inc.style.webkitMaskImage = inc.style.maskImage = ''; if (kind === 'ink') a.cancel(); };
  };

  window.applyLook = function (s, page) {
    s = s || {};
    var t = s.theme || {}, b = s.bg || {}, r = document.documentElement.style;
    var ac = /^#[0-9a-f]{6}$/i.test(t.accent || '') ? t.accent : '#9370ff';
    r.setProperty('--ac', ac); r.setProperty('--ac2', mix(ac, .3));
    r.setProperty('--accent', ac); r.setProperty('--accent-light', mix(ac, .3)); r.setProperty('--accent-glow', ac + '2e');

    var on = (b.apply || 'both') === 'both' || b.apply === page;
    var bgs = (s.backgrounds || []).filter(function (x) { return ok(x.url); });
    var mode = b.mode === 'random' || b.mode === 'slide' ? b.mode : 'fixed';
    var cur = bgs.find(function (x) { return x.id === b.active; });
    trans = b.trans || 'fade';
    if (!on || !bgs.length || (mode === 'fixed' && !cur)) { clear(); return; }

    var L = layers();
    [L.a, L.b].forEach(function (e) { e.style.filter = 'blur(' + (+b.blur || 0) + 'px)'; e.classList.toggle('zoom', b.anim === 'zoom'); });
    L.dim.style.background = 'rgba(8,6,14,' + ((+b.dim || 0) / 100) + ')';
    document.body.classList.toggle('glass', !!b.glass);

    if (mode === 'slide') {
      var sec = Math.min(300, Math.max(5, +b.interval || 30));
      var key = bgs.map(function (x) { return x.id + x.url; }).join('|') + sec;
      if (key === tkey) return;
      clearInterval(timer); tkey = key;
      si = Math.max(0, bgs.findIndex(function (x) { return x.id === b.active; }));
      front = true; setImg(L.a, bgs[si].url); L.a.style.opacity = 1; L.b.style.opacity = 0;
      timer = setInterval(function () {
        si = (si + 1) % bgs.length;
        var url = bgs[si].url, im = new Image();
        im.onload = function () {
          var kind = trans === 'random' ? ['fade', 'slide', 'zoom', 'ink'][Math.floor(Math.random() * 4)] : trans;
          var inc = front ? L.b : L.a, out = front ? L.a : L.b;
          setImg(inc, url); go(inc, out, kind); front = !front;
        };
        im.src = url;
      }, sec * 1000);
      return;
    }
    clearInterval(timer); timer = null; tkey = '';
    var url;
    if (mode === 'random') {
      if (!rnd || !bgs.some(function (x) { return x.id === rnd; })) rnd = bgs[Math.floor(Math.random() * bgs.length)].id;
      url = bgs.find(function (x) { return x.id === rnd; }).url;
    } else url = cur.url;
    setImg(L.a, url); L.a.style.opacity = 1; L.b.style.opacity = 0; front = true;
  };
})();
