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

  /* ---------- Illustrations & small tag icons ---------- */
  var TAGS = {
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    hand: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v5V4.5a1.5 1.5 0 0 1 3 0V11V5.5a1.5 1.5 0 0 1 3 0V12V9a1.5 1.5 0 0 1 3 0v5c0 4-3 7-7 7-3 0-4.5-1.5-6.5-4l-2.5-3.5a1.5 1.5 0 0 1 2.5-1.7z"/>',
    tap: '<path d="M4 19h16M6 15h12M12 3v8M9 8l3 3 3-3"/>',
    steth: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v3a4 4 0 0 0 8 0v-2"/><circle cx="18" cy="12" r="2"/>',
    brain: '<path d="M12 4a4 4 0 0 0-7 3 4 4 0 0 0 0 6 4 4 0 0 0 7 4 4 4 0 0 0 7-4 4 4 0 0 0 0-6 4 4 0 0 0-7-3z"/><path d="M12 4v16"/>'
  };
  $$("[data-ill]").forEach(function (el) {
    var d = (window.IFL_ILL || {})[el.dataset.ill];
    if (d) el.innerHTML = '<svg class="ill" viewBox="' + d[0] + '" aria-hidden="true">' + d[1] + "</svg>";
  });
  $$("[data-tag]").forEach(function (el) { el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (TAGS[el.dataset.tag] || "") + "</svg>"; });

  /* ---------- Slides ---------- */
  var slides = $$(".slide"), N = slides.length, cur = -1, build = false;
  var NAMES = ["", "Cardiovascular system", "Respiratory system", "Abdomen", "Neurological system"];
  slides.forEach(function (s) {
    var p = +s.dataset.part || 0, sh = $(".sh", s);
    if (sh && !$(".eyebrow", sh)) sh.insertAdjacentHTML("afterbegin", '<p class="eyebrow"><span class="dot"></span>' + esc(p ? NAMES[p] : (s.dataset.kicker || "")) + "</p>");
  });
  var runs = [];
  slides.forEach(function (s, i) { var p = +s.dataset.part || 0, l = runs[runs.length - 1]; if (l && l.p === p) l.n++; else runs.push({ p: p, start: i, n: 1 }); });
  $("#progress").innerHTML = runs.map(function (r) { return '<span class="seg" style="flex:' + r.n + ';--pc:var(--p' + r.p + ')"><i></i></span>'; }).join("");
  var segs = $$("#progress .seg i");
  var genIdx = slides.indexOf(document.getElementById("s-gen"));

  function countUp(s) {
    $$("[data-count]", s).forEach(function (el) {
      var to = parseFloat(el.dataset.count), from = parseFloat(el.dataset.from || 0), dec = +el.dataset.dec || 0, suf = el.dataset.suffix || "";
      if (REDUCED) { el.textContent = to.toFixed(dec) + suf; return; }
      var t0 = null, dur = 1600;
      function step(t) {
        if (t0 === null) t0 = t;
        var k = Math.min(1, (t - t0 - 500) / dur); if (k < 0) k = 0;
        var e = 1 - Math.pow(1 - k, 3);
        el.textContent = (from + (to - from) * e).toFixed(dec) + suf;
        if (k < 1 && s.classList.contains("active")) requestAnimationFrame(step); else el.textContent = to.toFixed(dec) + suf;
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
      old.classList.remove("active", "play", "in-next", "in-prev", "building");
      old.classList.add(dir > 0 ? "out-next" : "out-prev");
      setTimeout(function () { old.classList.remove("out-next", "out-prev"); }, 540);
    }
    s.classList.remove("out-next", "out-prev", "in-next", "in-prev", "play");
    void s.offsetWidth;
    s.classList.add("active", dir > 0 ? "in-next" : "in-prev");
    s.scrollTop = 0;
    var frags = $$(".f", s);
    frags.forEach(function (f, k) { f.style.setProperty("--d", k); });
    if (build) { s.classList.add("building"); frags.forEach(function (f) { f.classList.toggle("hid", dir > 0); }); }
    else { s.classList.remove("building"); frags.forEach(function (f) { f.classList.remove("hid"); }); }
    s.classList.add("play");
    countUp(s);
    update();
  }
  function next() { if (build) { var h = $(".f.hid", slides[cur]); if (h) { h.classList.remove("hid"); return; } } go(cur + 1, 1); }
  function prev() { go(cur - 1, -1); }
  function goId(id) { var i = slides.indexOf(document.getElementById(id)); if (i >= 0) go(i); }
  function update() {
    var s = slides[cur], p = +s.dataset.part || 0;
    $("#count").textContent = (cur + 1) + " / " + N;
    $("#stitle").textContent = s.dataset.title || "";
    runs.forEach(function (r, k) { segs[k].style.width = (Math.max(0, Math.min(1, (cur + 1 - r.start) / r.n)) * 100) + "%"; });
    $$(".ptab").forEach(function (t) { var tp = +t.dataset.part; t.setAttribute("aria-current", String(tp === p && (p !== 0 || (cur >= genIdx && cur < N - 1)))); });
    $("#prevBtn").disabled = cur === 0; $("#nextBtn").disabled = cur === N - 1;
    clearInk();
    try { history.replaceState(null, "", "#" + (cur + 1)); } catch (e) {}
    store.set("ce-slide", String(cur));
  }

  /* ---------- Build mode, toast ---------- */
  function toggleBuild() {
    build = !build; $("#buildBtn").setAttribute("aria-pressed", String(build));
    var s = slides[cur];
    if (build) s.classList.add("building"); else { s.classList.remove("building"); $$(".f.hid", s).forEach(function (f) { f.classList.remove("hid"); }); }
    toast(build ? "Build mode on: → reveals one point at a time" : "Build mode off");
  }
  $("#buildBtn").addEventListener("click", toggleBuild);
  var toastT;
  function toast(m) { var t = $("#toast"); t.textContent = m; t.classList.remove("off"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add("off"); }, 1800); }

  /* ---------- Ink & laser ---------- */
  var ink = $("#ink"), ctx = ink.getContext("2d"), pen = false, drawing = false, laserOn = false;
  function sizeInk() { var r = $("#deck").getBoundingClientRect(), d = window.devicePixelRatio || 1; ink.width = Math.max(1, Math.round(r.width * d)); ink.height = Math.max(1, Math.round(r.height * d)); ctx.setTransform(d, 0, 0, d, 0, 0); }
  function clearInk() { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ink.width, ink.height); ctx.restore(); }
  function pt(e) { var r = ink.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
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
  window.addEventListener("resize", sizeInk);

  /* ---------- Timer ---------- */
  var tAcc = 0, tStart = 0, tRun = false, tInt = null;
  function fmt(ms) { var s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
  function paintTimer() { $("#tVal").textContent = fmt(tAcc + (tRun ? Date.now() - tStart : 0)); $("#tBtn").setAttribute("aria-pressed", String(tRun)); }
  function toggleTimer() { if (tRun) { tAcc += Date.now() - tStart; tRun = false; clearInterval(tInt); } else { tStart = Date.now(); tRun = true; tInt = setInterval(paintTimer, 500); } paintTimer(); }
  $("#tBtn").addEventListener("click", toggleTimer);
  $("#tReset").addEventListener("click", function () { tAcc = 0; tStart = Date.now(); paintTimer(); });

  /* ---------- Theme, fullscreen, overview ---------- */
  function isDark() { var t = document.documentElement.getAttribute("data-theme"); if (t) return t === "dark"; return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches; }
  $("#themeBtn").addEventListener("click", function () { var nt = isDark() ? "light" : "dark"; document.documentElement.setAttribute("data-theme", nt); store.set("ce-theme", nt); });
  function toggleFull() {
    try {
      if (!document.fullscreenElement) { var r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (r && r.catch) r.catch(function () {}); }
      else if (document.exitFullscreen) { var x = document.exitFullscreen(); if (x && x.catch) x.catch(function () {}); }
    } catch (e) {}
  }
  $("#fsBtn").addEventListener("click", toggleFull);
  document.addEventListener("fullscreenchange", function () { setTimeout(sizeInk, 80); });
  function openOverview() {
    var html = "", last = null;
    slides.forEach(function (s, i) {
      var p = +s.dataset.part || 0;
      if (p !== last) { html += '<p class="ovpart">' + (p ? NAMES[p] : (i === 0 ? "Introduction" : "General")) + "</p>"; last = p; }
      html += '<button type="button" class="ov' + (i === cur ? " cur" : "") + '" data-i="' + i + '" style="--pc:var(--p' + p + ')"><span class="n">' + (i + 1) + "</span><span>" + esc(s.dataset.title || "") + "</span></button>";
    });
    $("#ovGrid").innerHTML = html;
    var d = $("#ovDlg"); if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  }
  $("#ovBtn").addEventListener("click", openOverview);
  $("#ovGrid").addEventListener("click", function (e) { var b = e.target.closest(".ov"); if (!b) return; $("#ovDlg").close(); go(+b.dataset.i); });
  $("#ovDlg").addEventListener("click", function (e) { if (e.target === e.currentTarget || e.target.closest("[data-close]")) e.currentTarget.close(); });

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-go],[data-target]");
    if (!t) return;
    if (t.dataset.go === "next") next();
    if (t.dataset.target) goId(t.dataset.target);
  });
  $("#prevBtn").addEventListener("click", prev);
  $("#nextBtn").addEventListener("click", next);

  /* ---------- Keyboard & swipe ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || $("dialog[open]")) return;
    var tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); next(); return; }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); return; }
    if (e.key === " ") { if (tag === "BUTTON") return; e.preventDefault(); if (e.shiftKey) prev(); else next(); return; }
    if (e.key === "Home") { go(0); return; }
    if (e.key === "End") { go(N - 1); return; }
    if (e.key === "Escape") { togglePen(false); toggleLaser(false); return; }
    switch (e.code) {
      case "KeyB": toggleBuild(); break;
      case "KeyG": case "KeyO": openOverview(); break;
      case "KeyL": toggleLaser(); break;
      case "KeyD": togglePen(); break;
      case "KeyC": clearInk(); break;
      case "KeyT": toggleTimer(); break;
      case "KeyF": toggleFull(); break;
      case "Digit1": case "Digit2": case "Digit3": case "Digit4": goId("s-p" + e.code.slice(-1)); break;
    }
  });
  (function () {
    var sx = 0, sy = 0, st = 0, deck = $("#deck");
    deck.addEventListener("touchstart", function (e) { if (pen || e.touches.length !== 1) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }, { passive: true });
    deck.addEventListener("touchend", function (e) {
      if (pen || !st) return;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st < 700 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) { if (dx < 0) next(); else prev(); }
      st = 0;
    }, { passive: true });
  })();

  /* ---------- Start ---------- */
  window.addEventListener("hashchange", function () { var n = parseInt(location.hash.slice(1), 10); if (n >= 1 && n <= N) go(n - 1); });
  var startAt = 0, hn = parseInt(location.hash.slice(1), 10);
  if (hn >= 1 && hn <= N) startAt = hn - 1; else { var sv = parseInt(store.get("ce-slide"), 10); if (sv >= 0 && sv < N) startAt = sv; }
  sizeInk(); go(startAt, 1); paintTimer();
})();
