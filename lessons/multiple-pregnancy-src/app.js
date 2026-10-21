(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 1123, H = 794;

  /* ---------- icons ---------- */
  var I = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    dna: '<path d="M7 3c0 6 10 6 10 12s-10 3-10 6M17 3c0 6-10 6-10 12s10 3 10 6"/><path d="M8 7h8M8 17h8"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>',
    pill: '<rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(-35 12 12.5)"/><path d="M9.5 8.5l5 7"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7 15h10"/>',
    baby: '<circle cx="12" cy="9" r="5"/><path d="M10 9h.01M14 9h.01M10.5 11.5c1 .7 2 .7 3 0M6 21c1-3 3.3-5 6-5s5 2 6 5"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3"/>',
    family: '<circle cx="7" cy="6" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="12" cy="14" r="2"/><path d="M3 20v-6a4 4 0 0 1 8 0M13 14a4 4 0 0 1 8 0v6M9 21a3 3 0 0 1 6 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    arrowsv: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    hand: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v5V4.5a1.5 1.5 0 0 1 3 0V11V5.5a1.5 1.5 0 0 1 3 0V12V9a1.5 1.5 0 0 1 3 0v5c0 4-3 7-7 7-3 0-4.5-1.5-6.5-4l-2.5-3.5a1.5 1.5 0 0 1 2.5-1.7z"/>',
    probe: '<path d="M9 3h6v6l3 4H6l3-4z"/><path d="M4 21c2-4 14-4 16 0"/><path d="M9 17c1.5-1 4.5-1 6 0"/>',
    medal: '<circle cx="12" cy="14" r="6"/><path d="M8 3l2 6M16 3l-2 6M12 11v6M10 13l2-2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    drop: '<path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
    wave: '<path d="M2 9c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 15c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0"/>',
    lungs: '<path d="M12 4v8M12 12c-1 1-3 1-4 0M12 12c1 1 3 1 4 0"/><path d="M8 7c-3 1-5 5-5 10 0 2 2 3 4 2l2-1V9M16 7c3 1 5 5 5 10 0 2-2 3-4 2l-2-1V9"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    virus: '<circle cx="12" cy="12" r="5"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    heart: '<path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3.1A4.6 4.6 0 0 1 20 10c0 5.8-8 11-8 11z"/>',
    apple: '<path d="M12 7c-2-2-7-1.5-7 4 0 5 3 10 5 10 1 0 1.3-.5 2-.5s1 .5 2 .5c2 0 5-5 5-10 0-5.5-5-6-7-4z"/><path d="M12 7c0-2 1-3.5 3-4"/>',
    bed: '<path d="M3 18V6M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="2"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10M10 20v-6h4v6"/>',
    hospital: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 7v6M9 10h6M10 21v-4h4v4"/>',
    syringe: '<path d="M18 3l3 3M16.5 4.5l3 3M19 6l-9.5 9.5-3-3L16 3M6.5 12.5l-3 3 3 3 3-3M4.5 19.5L2 22M10 9l2 2M8 11l2 2"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    pull: '<path d="M12 3v14M7 12l5 5 5-5"/><path d="M5 21h14"/>',
    plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    flow: '<path d="M4 7h11a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h11"/><path d="M17 16l3 3-3 3"/>',
    pin: '<path d="M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
  };
  $$("[data-i]").forEach(function (el) { el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (I[el.dataset.i] || "") + "</svg>"; });

  /* ---------- generated illustrations ---------- */
  (function dots() {
    var g = $("#dotgrid"); if (!g) return;
    var h = "";
    for (var i = 0; i < 100; i++) {
      var x = 26 + (i % 10) * 34.2, y = 26 + Math.floor(i / 10) * 34.2;
      h += '<circle cx="' + x + '" cy="' + y + '" r="6"' + (i < 2 ? ' class="a" style="--i:' + i + '"' : i === 2 ? ' class="b"' : "") + "/>";
    }
    g.innerHTML = h;
  })();
  (function conds() {
    var P = { v: 180, b: 0, t: 90 };
    var MAP = { vv: ["v", "v"], vb: ["v", "b"], vt: ["v", "t"], bx: ["b", "t"] };
    $$("svg[data-cond]").forEach(function (s) {
      var c = MAP[s.dataset.cond], col = getComputedStyle(s).getPropertyValue("--cc") || "var(--pc)";
      function fz(cx, cy, k, color, n, dash) {
        return '<g transform="translate(' + cx + " " + cy + ") rotate(" + P[k] + ')"' + (dash ? ' opacity=".55"' : "") + '><use href="#fz" x="-21" y="-26" width="42" height="52" style="color:' + color + '"/></g>' +
          '<circle cx="' + (cx + (n === 1 ? -26 : 26)) + '" cy="' + (cy - 20) + '" r="10" fill="' + color + '"/><text x="' + (cx + (n === 1 ? -26 : 26)) + '" y="' + (cy - 16) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">' + n + "</text>";
      }
      var h = '<path d="M80 6C128 6 150 38 148 74 146 108 118 132 94 140L66 140C42 132 14 108 12 74 10 38 32 6 80 6Z" fill="color-mix(in srgb,' + col + ' 7%,transparent)" stroke="' + col + '" stroke-width="2.2"/>' +
        '<path d="M66 140v8M94 140v8" stroke="' + col + '" stroke-width="2.2"/>';
      if (s.dataset.cond === "bx") {
        h += fz(60, 94, "b", "var(--p1)", 1) + fz(100, 58, "v", "var(--p4)", 2);
      } else {
        h += fz(60, 94, c[0], "var(--p1)", 1) + fz(100, 58, c[1], "var(--p4)", 2);
      }
      s.innerHTML = h;
    });
  })();
  (function ticks() {
    var g = $(".wk .ticks"); if (!g) return;
    var h = "";
    for (var w = 31; w <= 38; w++) { var x = 215 + (w - 32) * 113.33; h += '<line x1="' + x + '" y1="232" x2="' + x + '" y2="244" stroke="var(--line2)" stroke-width="2"/><text x="' + x + '" y="266">' + w + "</text>"; }
    h += '<text x="950" y="292" text-anchor="end" font-weight="700">weeks</text>';
    g.innerHTML = h;
  })();

  /* ---------- slides, kickers, footers ---------- */
  var slides = $$(".slide"), N = slides.length, cur = -1, build = false;
  var NAMES = ["", "Definition", "Incidence", "Etiology", "Classification", "Diagnosis", "Complications", "Management", "Special conditions"];
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  slides.forEach(function (s, i) {
    var p = +s.dataset.part || 0;
    s.style.setProperty("--pc", "var(--p" + p + ")");
    var sh = $(".sh", s);
    if (sh && !$(".kick", sh)) sh.insertAdjacentHTML("afterbegin", '<p class="kick">' + (p ? '<span class="n">' + pad(p) + "</span>" + esc(NAMES[p]) : esc(s.dataset.kicker || "")) + "</p>");
    if (p && !s.classList.contains("s-title")) s.insertAdjacentHTML("afterbegin", '<span class="wm" aria-hidden="true">' + pad(p) + "</span>");
    if (i > 0) s.insertAdjacentHTML("beforeend", '<footer class="sf"><span>Multiple Pregnancy</span>' + (p ? '<span class="sec">' + esc(NAMES[p]) + "</span>" : "") + '<span class="bar"></span><span class="pn">' + (i + 1) + "</span></footer>");
    $$(".f", s).forEach(function (f, k) { f.style.setProperty("--d", k); });
  });
  var runs = [];
  slides.forEach(function (s, i) { var p = +s.dataset.part || 0, l = runs[runs.length - 1]; if (l && l.p === p) l.n++; else runs.push({ p: p, start: i, n: 1 }); });
  $("#prog").innerHTML = runs.map(function (r) { return '<span class="seg2" data-i="' + r.start + '" style="--n:' + r.n + ';--pc:var(--p' + r.p + ')"><i></i></span>'; }).join("");
  var segs = $$("#prog .seg2");
  $("#prog").addEventListener("click", function (e) { var s = e.target.closest(".seg2"); if (s) go(+s.dataset.i); });

  /* ---------- scale the A4 stage to the window ---------- */
  var stage = $("#stage"), scale = 1;
  function fit() {
    var vw = window.innerWidth, vh = window.innerHeight, m = vw < 700 ? 0 : 18;
    scale = Math.min((vw - m * 2) / W, (vh - m * 2) / H);
    window.MP_SCALE = scale;
    stage.style.left = "0px"; stage.style.top = "0px";
    stage.style.transform = "translate(" + ((vw - W * scale) / 2) + "px," + ((vh - H * scale) / 2) + "px) scale(" + scale + ")";
  }
  window.addEventListener("resize", fit); fit();

  /* ---------- 3D ---------- */
  var has3D = window.MP3D && window.MP3D.ok;
  if (!has3D) document.documentElement.classList.add("no3d");
  var scenes = new Map();
  function sceneFor(host) {
    if (!has3D) return null;
    if (!scenes.has(host)) { var sc = null; try { sc = window.MP3D.make(host.dataset.scene, host); } catch (e) { sc = null; } scenes.set(host, sc); }
    return scenes.get(host);
  }
  function scenesOf(s) { return $$(".v3d[data-scene]", s).map(sceneFor).filter(Boolean); }

  /* option groups (3D controls) */
  var CHOR = [
    { t: "DCDA", d: "Dichorionic diamniotic", c: "var(--p3)", x: "8%" },
    { t: "MCDA", d: "Monochorionic diamniotic", c: "var(--p4)", x: "38%" },
    { t: "MCMA", d: "Monochorionic monoamniotic", c: "var(--p2)", x: "62%" },
    { t: "Conjoined", d: "Conjoined twins", c: "var(--p6)", x: "90%" }
  ];
  $$("[data-group]").forEach(function (grp) {
    grp.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-v]"); if (!b) return;
      pick(grp, +b.dataset.v);
    });
  });
  function pick(grp, v) {
    var btns = $$("button[data-v]", grp);
    btns.forEach(function (x) { x.setAttribute("aria-pressed", String(+x.dataset.v === v)); });
    var s = grp.closest(".slide"), host = $(".v3d[data-scene]", s), sc = host && sceneFor(host);
    if (sc && sc.set) sc.set(v);
    if (grp.dataset.group === "chor") {
      var c = CHOR[v], tag = $(".chorTag", s), ax = $(".dayaxis", s);
      tag.innerHTML = "<b>" + c.t + "</b><span>" + c.d + "</span>"; tag.style.setProperty("--tc", c.c);
      ax.style.setProperty("--tc", c.c); ax.style.setProperty("--x", c.x);
    }
  }

  function countUp(s) {
    $$("[data-count]", s).forEach(function (el) {
      var to = parseFloat(el.dataset.count), sep = el.dataset.sep;
      function fmt(v) { v = Math.round(v); return sep ? v.toLocaleString("en-US") : String(v); }
      if (REDUCED) { el.textContent = fmt(to); return; }
      var t0 = null, dur = 1500;
      function step(t) {
        if (t0 === null) t0 = t;
        var k = Math.min(1, Math.max(0, (t - t0 - 450) / dur)), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(to * e);
        if (k < 1 && s.classList.contains("active")) requestAnimationFrame(step); else el.textContent = fmt(to);
      }
      requestAnimationFrame(step);
    });
  }

  function go(i, dir) {
    i = Math.max(0, Math.min(N - 1, i));
    if (i === cur) return;
    if (dir === undefined) dir = i > cur ? 1 : -1;
    var old = cur >= 0 ? slides[cur] : null;
    cur = i;
    var s = slides[cur];
    if (old) {
      scenesOf(old).forEach(function (sc) { sc.stop(); });
      old.classList.remove("active", "play", "in-next", "in-prev", "building");
      old.classList.add(dir > 0 ? "out-next" : "out-prev");
      setTimeout(function () { old.classList.remove("out-next", "out-prev"); }, 520);
    }
    s.classList.remove("out-next", "out-prev", "in-next", "in-prev", "play");
    void s.offsetWidth;
    s.classList.add("active", dir > 0 ? "in-next" : "in-prev");
    var frags = $$(".f", s);
    if (build) { s.classList.add("building"); frags.forEach(function (f) { f.classList.toggle("hid", dir > 0); }); }
    else { s.classList.remove("building"); frags.forEach(function (f) { f.classList.remove("hid"); }); }
    s.classList.add("play");
    countUp(s);
    scenesOf(s).forEach(function (sc) { sc.start(); });
    update();
  }
  function next() { if (build) { var h = $(".f.hid", slides[cur]); if (h) { h.classList.remove("hid"); return; } } go(cur + 1, 1); }
  function prev() { go(cur - 1, -1); }
  function goId(id) { var i = slides.indexOf(document.getElementById(id)); if (i >= 0) go(i); }
  function update() {
    $("#count").textContent = (cur + 1) + " / " + N;
    runs.forEach(function (r, k) { segs[k].firstChild.style.setProperty("--k", Math.max(0, Math.min(1, (cur + 1 - r.start) / r.n))); });
    $("#prevBtn").disabled = cur === 0; $("#nextBtn").disabled = cur === N - 1;
    document.title = (slides[cur].dataset.title || "Multiple Pregnancy") + " · Multiple Pregnancy";
    clearInk();
    try { history.replaceState(null, "", "#" + (cur + 1)); } catch (e) {}
    store.set("mp-slide", String(cur));
  }

  /* ---------- build mode, toast ---------- */
  function toggleBuild() {
    build = !build; $("#buildBtn").setAttribute("aria-pressed", String(build));
    var s = slides[cur];
    if (build) s.classList.add("building"); else { s.classList.remove("building"); $$(".f.hid", s).forEach(function (f) { f.classList.remove("hid"); }); }
    toast(build ? "Build mode on: → reveals one point at a time" : "Build mode off");
  }
  $("#buildBtn").addEventListener("click", toggleBuild);
  var toastT;
  function toast(m) { var t = $("#toast"); t.textContent = m; t.classList.remove("off"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add("off"); }, 1800); }

  /* ---------- ink (drawn in stage coordinates) & laser ---------- */
  var ink = $("#ink"), ctx = ink.getContext("2d"), pen = false, drawing = false, laserOn = false;
  ink.width = W * 2; ink.height = H * 2; ctx.scale(2, 2);
  function clearInk() { ctx.clearRect(0, 0, W, H); }
  function pt(e) { var r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale]; }
  ink.addEventListener("pointerdown", function (e) {
    if (!pen) return; drawing = true;
    try { ink.setPointerCapture(e.pointerId); } catch (x) {}
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--pen").trim() || "#d6266b";
    ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    var p = pt(e); ctx.beginPath(); ctx.moveTo(p[0], p[1]);
  });
  ink.addEventListener("pointermove", function (e) { if (!drawing) return; var p = pt(e); ctx.lineTo(p[0], p[1]); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p[0], p[1]); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { ink.addEventListener(ev, function () { drawing = false; }); });
  function togglePen(f) { pen = typeof f === "boolean" ? f : !pen; if (pen && laserOn) toggleLaser(false); document.body.classList.toggle("pen", pen); $("#penBtn").setAttribute("aria-pressed", String(pen)); }
  function toggleLaser(f) { laserOn = typeof f === "boolean" ? f : !laserOn; if (laserOn && pen) togglePen(false); document.body.classList.toggle("laser", laserOn); $("#laserBtn").setAttribute("aria-pressed", String(laserOn)); }
  document.addEventListener("pointermove", function (e) { if (laserOn) $("#laser").style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)"; });
  $("#penBtn").addEventListener("click", function () { togglePen(); });
  $("#laserBtn").addEventListener("click", function () { toggleLaser(); });
  $("#clearBtn").addEventListener("click", clearInk);

  /* ---------- timer ---------- */
  var tAcc = 0, tStart = 0, tRun = false, tInt = null;
  function fmtT(ms) { var s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
  function paintTimer() { $("#tVal").textContent = fmtT(tAcc + (tRun ? Date.now() - tStart : 0)); $("#tBtn").setAttribute("aria-pressed", String(tRun)); }
  function toggleTimer() { if (tRun) { tAcc += Date.now() - tStart; tRun = false; clearInterval(tInt); } else { tStart = Date.now(); tRun = true; tInt = setInterval(paintTimer, 500); } paintTimer(); }
  $("#tBtn").addEventListener("click", toggleTimer);

  /* ---------- theme, fullscreen, print, dialogs ---------- */
  function isDark() { var t = document.documentElement.getAttribute("data-theme"); if (t) return t === "dark"; return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches; }
  function syncThemeAttr() { if (!document.documentElement.getAttribute("data-theme")) document.documentElement.setAttribute("data-theme", isDark() ? "dark" : "light"); }
  syncThemeAttr();
  $("#themeBtn").addEventListener("click", function () { var nt = isDark() ? "light" : "dark"; document.documentElement.setAttribute("data-theme", nt); store.set("mp-theme", nt); toast(nt === "dark" ? "Dark theme" : "Light theme"); });
  function toggleFull() {
    try {
      if (!document.fullscreenElement) { var r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (r && r.catch) r.catch(function () {}); }
      else if (document.exitFullscreen) { var x = document.exitFullscreen(); if (x && x.catch) x.catch(function () {}); }
    } catch (e) {}
  }
  $("#fsBtn").addEventListener("click", toggleFull);
  var printing = false, themeBefore = null;
  function beforePrint() {
    if (printing) return; printing = true;
    themeBefore = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "light");
    slides.forEach(function (s) { s.classList.add("play"); s.classList.remove("building"); $$(".f.hid", s).forEach(function (f) { f.classList.remove("hid"); }); });
    $$(".v3d[data-scene]").forEach(function (h) { var sc = sceneFor(h); if (sc) sc.snapshot(); });
  }
  function afterPrint() {
    printing = false;
    if (themeBefore) document.documentElement.setAttribute("data-theme", themeBefore);
    slides.forEach(function (s, i) { if (i !== cur) s.classList.remove("play"); });
    $$(".v3d.snapped").forEach(function (h) { h.classList.remove("snapped"); });
    if (build) slides[cur].classList.add("building");
  }
  window.addEventListener("beforeprint", beforePrint);
  window.addEventListener("afterprint", afterPrint);
  function doPrint() { beforePrint(); setTimeout(function () { window.print(); }, 60); }
  $("#printBtn").addEventListener("click", doPrint);

  function openDlg(d) { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); }
  function openOverview() {
    var html = "", last = null;
    slides.forEach(function (s, i) {
      var p = +s.dataset.part || 0;
      if (p !== last) { html += (last !== null ? "</div>" : "") + '<p class="ovp" style="--pc:var(--p' + p + ')">' + (p ? pad(p) + " · " + NAMES[p] : (i === 0 ? "Introduction" : "End")) + '</p><div class="ovg">'; last = p; }
      html += '<button type="button" class="ov' + (i === cur ? " cur" : "") + '" data-i="' + i + '" style="--pc:var(--p' + p + ')"><span class="n">' + (i + 1) + "</span><span>" + esc(s.dataset.title || "") + "</span></button>";
    });
    $("#ovGrid").innerHTML = html + "</div>";
    openDlg($("#ovDlg"));
  }
  $("#ovBtn").addEventListener("click", openOverview);
  $("#helpBtn").addEventListener("click", function () { openDlg($("#helpDlg")); });
  $("#ovGrid").addEventListener("click", function (e) { var b = e.target.closest(".ov"); if (!b) return; $("#ovDlg").close(); go(+b.dataset.i); });
  $$("dialog").forEach(function (d) { d.addEventListener("click", function (e) { if (e.target === e.currentTarget || e.target.closest("[data-close]")) d.close(); }); });

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-go],[data-target]");
    if (!t) return;
    if (t.dataset.go === "next") next();
    if (t.dataset.target) goId(t.dataset.target);
  });
  $("#prevBtn").addEventListener("click", prev);
  $("#nextBtn").addEventListener("click", next);

  /* ---------- auto-hide the dock ---------- */
  var idleT;
  function wake() { document.body.classList.remove("idle"); clearTimeout(idleT); idleT = setTimeout(function () { if (!$(".dock:hover")) document.body.classList.add("idle"); }, 2600); }
  document.addEventListener("pointermove", wake); document.addEventListener("pointerdown", wake); wake();

  /* ---------- keyboard & swipe ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || $("dialog[open]")) return;
    var tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (document.body.classList.contains("black") && e.key !== "Escape") { document.body.classList.remove("black"); e.preventDefault(); return; }
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === "ArrowDown") { e.preventDefault(); next(); return; }
    if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "ArrowUp") { e.preventDefault(); prev(); return; }
    if (e.key === " ") { if (tag === "BUTTON") return; e.preventDefault(); if (e.shiftKey) prev(); else next(); return; }
    if (e.key === "Home") { go(0); return; }
    if (e.key === "End") { go(N - 1); return; }
    if (e.key === "Escape") { togglePen(false); toggleLaser(false); document.body.classList.remove("black"); return; }
    if (e.key === "?") { openDlg($("#helpDlg")); return; }
    if (e.code === "Period") { document.body.classList.toggle("black"); return; }
    switch (e.code) {
      case "KeyB": toggleBuild(); break;
      case "KeyG": case "KeyO": openOverview(); break;
      case "KeyL": toggleLaser(); break;
      case "KeyD": togglePen(); break;
      case "KeyC": clearInk(); break;
      case "KeyT": toggleTimer(); break;
      case "KeyF": toggleFull(); break;
      case "KeyP": e.preventDefault(); doPrint(); break;
      default:
        if (/^Digit[1-8]$/.test(e.code)) goId("s-p" + e.code.slice(-1));
    }
  });
  $("#blackout").addEventListener("click", function () { document.body.classList.remove("black"); });
  (function () {
    var sx = 0, sy = 0, st = 0;
    document.addEventListener("touchstart", function (e) { if (pen || e.touches.length !== 1 || e.target.closest(".v3d,.dock")) { st = 0; return; } sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (pen || !st) return;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st < 700 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) next(); else prev(); }
      st = 0;
    }, { passive: true });
  })();

  /* ---------- start ---------- */
  window.addEventListener("hashchange", function () { var n = parseInt(location.hash.slice(1), 10); if (n >= 1 && n <= N) go(n - 1); });
  var startAt = 0, hn = parseInt(location.hash.slice(1), 10);
  if (hn >= 1 && hn <= N) startAt = hn - 1; else { var sv = parseInt(store.get("mp-slide"), 10); if (sv >= 0 && sv < N) startAt = sv; }
  go(startAt, 1); paintTimer();
})();
