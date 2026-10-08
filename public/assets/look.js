(function () {
  var css = '#bgfx,#bgfx2,#bgdim{position:fixed;inset:0;z-index:-1;pointer-events:none}' +
    '#bgfx,#bgfx2{background-position:center;background-size:cover;transform:scale(1.1);transition:opacity 1.4s ease}' +
    '#bgfx2{opacity:0}' +
    '#bgfx.zoom,#bgfx2.zoom{animation:bgz 28s ease-in-out infinite alternate}' +
    '@keyframes bgz{from{transform:scale(1.1)}to{transform:scale(1.22)}}' +
    '.glass{--s1:rgba(27,25,37,.55);--bg-card:rgba(23,21,31,.55);--bg-input:rgba(13,12,19,.5)}' +
    '.glass .strip,.glass .chart,.glass .pv,.glass .scard,.glass .card,.glass dialog,.glass .gcard,.glass input,.glass textarea,.glass select{-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}' +
    '@media(prefers-reduced-motion:reduce){#bgfx.zoom,#bgfx2.zoom{animation:none}#bgfx,#bgfx2{transition:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.append(st);

  var timer = null, tkey = '', rnd = null, si = 0, front = true;
  var mix = function (h, p) {
    return '#' + [1, 3, 5].map(function (i) {
      return Math.round(parseInt(h.substr(i, 2), 16) * (1 - p) + 255 * p).toString(16).padStart(2, '0');
    }).join('');
  };
  var setImg = function (el, url) { el.style.backgroundImage = 'url("' + url.replace(/"/g, '%22').replace(/\\/g, '%5C') + '")'; };
  var clear = function () {
    clearInterval(timer); timer = null; tkey = '';
    ['bgfx', 'bgfx2', 'bgdim'].forEach(function (id) { var e = document.getElementById(id); if (e) e.remove(); });
    document.body.classList.remove('glass');
  };
  var layers = function () {
    var a = document.getElementById('bgfx');
    if (!a) {
      a = document.createElement('div'); a.id = 'bgfx';
      var b = document.createElement('div'); b.id = 'bgfx2';
      var d = document.createElement('div'); d.id = 'bgdim';
      document.body.prepend(a, b, d); front = true;
    }
    return { a: a, b: document.getElementById('bgfx2'), dim: document.getElementById('bgdim') };
  };

  window.applyLook = function (s, page) {
    s = s || {};
    var t = s.theme || {}, b = s.bg || {}, r = document.documentElement.style;
    var ac = /^#[0-9a-f]{6}$/i.test(t.accent || '') ? t.accent : '#9370ff';
    r.setProperty('--ac', ac); r.setProperty('--ac2', mix(ac, .3));
    r.setProperty('--accent', ac); r.setProperty('--accent-light', mix(ac, .3)); r.setProperty('--accent-glow', ac + '2e');

    var on = (b.apply || 'both') === 'both' || b.apply === page;
    var bgs = (s.backgrounds || []).filter(function (x) { return /^https:\/\//.test(x.url); });
    var mode = b.mode === 'random' || b.mode === 'slide' ? b.mode : 'fixed';
    var cur = bgs.find(function (x) { return x.id === b.active; });
    if (!on || !bgs.length || (mode === 'fixed' && !cur)) { clear(); return; }

    var L = layers();
    [L.a, L.b].forEach(function (e) {
      e.style.filter = 'blur(' + (+b.blur || 0) + 'px)';
      e.classList.toggle('zoom', b.anim === 'zoom');
    });
    L.dim.style.background = 'rgba(8,6,14,' + ((+b.dim || 0) / 100) + ')';
    document.body.classList.toggle('glass', !!b.glass);

    if (mode === 'slide') {
      var sec = Math.min(300, Math.max(5, +b.interval || 30));
      var key = bgs.map(function (x) { return x.id + x.url; }).join('|') + sec;
      if (key === tkey) return; // đang chạy đúng cấu hình này, không khởi động lại
      clearInterval(timer); tkey = key;
      si = Math.max(0, bgs.findIndex(function (x) { return x.id === b.active; }));
      front = true; setImg(L.a, bgs[si].url); L.a.style.opacity = 1; L.b.style.opacity = 0;
      timer = setInterval(function () {
        si = (si + 1) % bgs.length;
        var url = bgs[si].url, im = new Image();
        im.onload = function () { // tải xong mới chuyển để không bị nháy trống
          var inc = front ? L.b : L.a, out = front ? L.a : L.b;
          setImg(inc, url); inc.style.opacity = 1; out.style.opacity = 0; front = !front;
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
