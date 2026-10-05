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

  /* ================= Content data (taken from the lesson slides) ================= */
  var QUIZ = {
    p1: [
      { q: "Exclusive breastfeeding is recommended for…", o: ["The first 4 months", "The first 6 months", "The first 12 months", "The first 2 weeks"], a: 1, why: "Exclusive breastfeeding is recommended for the first 6 months of life." },
      { q: "Which of these is a LATE hunger cue?", o: ["Rooting", "Lip smacking", "Crying", "Hand-to-mouth movements"], a: 2, why: "Crying is a late hunger cue. Rooting, hand-to-mouth movements, lip smacking and restlessness come first." },
      { q: "Which is a sign of effective breastfeeding?", o: ["More areola visible below the mouth", "Fast, shallow sucking", "Chin touches the breast", "Baby unsettled after feeding"], a: 2, why: "Signs include a wide-open mouth, chin touching the breast, more areola visible above the mouth, slow deep sucking and audible swallowing." },
      { q: "Colostrum is rich in…", o: ["Fat only", "Antibodies, especially IgA", "Added sugar", "Water only"], a: 1, why: "Colostrum is rich in antibodies (especially IgA), proteins and immune cells." }
    ],
    p2: [
      { q: "How much powder should be used?", o: ["An extra scoop for better growth", "The manufacturer’s exact water-to-powder ratio", "Less powder for easier digestion", "An estimate by eye"], a: 1, why: "Follow the manufacturer’s exact ratio. Do not add extra powder or dilute excessively." },
      { q: "The correct position for bottle feeding is…", o: ["Lying completely flat", "Semi-upright with head and neck supported", "On the tummy", "Any position if the bottle is propped"], a: 1, why: "Hold the infant semi-upright and support the head and neck. Never feed while lying completely flat." },
      { q: "Formula left in the bottle after a feed should be…", o: ["Saved for the next feed", "Discarded", "Re-warmed", "Mixed with a fresh feed"], a: 1, why: "Discard leftover formula after feeding." },
      { q: "Incorrect formula preparation can cause…", o: ["Faster growth", "Dehydration or electrolyte disturbances", "Better sleep", "No effect"], a: 1, why: "Incorrect formula preparation → dehydration or electrolyte disturbances." }
    ],
    p3: [
      { q: "Before every NG feed, the nurse must…", o: ["Weigh the infant", "Check tube position using the approved method", "Warm the feed", "Change the tape"], a: 1, why: "Never administer a feed if tube placement is uncertain." },
      { q: "During an NG feed the infant coughs and becomes cyanosed. You…", o: ["Speed up to finish the feed", "Stop feeding", "Flush the tube", "Continue and observe"], a: 1, why: "Stop feeding if respiratory distress, vomiting, coughing, cyanosis or other concerning signs occur." },
      { q: "The most serious complication of NG feeding is…", o: ["Nasal irritation", "Constipation", "Aspiration", "Tube blockage"], a: 2, why: "Most serious complication: aspiration." },
      { q: "Enteral (NG) feeding requires…", o: ["A functional gastrointestinal tract", "A child over 2 years", "No prescription", "An empty stomach for 24 hours"], a: 0, why: "The gastrointestinal tract should be functional for enteral feeding." }
    ],
    p4: [
      { q: "Complementary feeding should begin at approximately…", o: ["2 months", "4 months", "6 months", "12 months"], a: 2, why: "Complementary feeding should begin at approximately 6 months of age." },
      { q: "Honey is avoided before 12 months because of…", o: ["Tooth decay", "Infant botulism", "Allergy", "Constipation"], a: 1, why: "Honey before 12 months → risk of infant botulism." },
      { q: "A child eating suddenly goes silent and cannot breathe or cough. This is…", o: ["Gagging", "Choking", "Normal swallowing", "Hiccups"], a: 1, why: "Choking may be silent, with inability to breathe or cough effectively. Gagging is usually noisy and protective." },
      { q: "Cow’s milk should not be the main drink before…", o: ["3 months", "6 months", "9 months", "12 months"], a: 3, why: "Cow’s milk should not be used as the main drink before 12 months." }
    ]
  };
  var CH = [
    { q: "A mother on day 2 wants to throw away her thick yellow milk. You…", o: ["Agree with her", "Explain it is colostrum and should not be discarded", "Advise formula instead", "Advise water instead"], a: 1, why: "Colostrum should not be discarded." },
    { q: "How often do most newborns breastfeed in 24 hours?", o: ["3–4 times", "5–6 times", "8–12 times", "Every 6 hours exactly"], a: 2, why: "Approximately 8–12 times / 24 hours, on demand." },
    { q: "A poor latch may cause…", o: ["Better milk transfer", "Nipple pain and cracked nipples", "Faster weight gain", "Deeper sucking"], a: 1, why: "Poor latch → nipple pain, cracked nipples, poor milk transfer, inadequate weight gain." },
    { q: "Which is a reason for artificial feeding?", o: ["The baby is 2 months old", "Breastfeeding is contraindicated", "The baby has hiccups", "The mother has colostrum"], a: 1, why: "Artificial feeding may be used when breastfeeding is contraindicated." },
    { q: "Which is NOT allowed during bottle feeding?", o: ["Allowing pauses", "Propping the bottle and leaving the infant", "Supporting the head and neck", "Burping when appropriate"], a: 1, why: "Never prop the bottle and leave the infant alone." },
    { q: "You are not sure the NG tube is in the right place. You…", o: ["Give a small feed", "Do not give the feed", "Feed slowly", "Flush and feed"], a: 1, why: "Never administer a feed if tube placement is uncertain." },
    { q: "Which formula suits most healthy term infants?", o: ["Preterm formula", "Specialised formula", "Standard cow’s-milk-based formula", "None"], a: 2, why: "Standard cow’s-milk-based formula is suitable for most healthy term infants." },
    { q: "Weaning foods should be rich in…", o: ["Salt and sugar", "Iron, protein, energy, vitamins and minerals", "Honey", "Unpasteurised dairy"], a: 1, why: "Choose foods rich in iron, protein, energy, vitamins and minerals." },
    { q: "Gagging during weaning is usually…", o: ["Silent", "Noisy and protective", "A reason to stop all food", "Choking"], a: 1, why: "Gagging is usually noisy and protective." },
    { q: "Which food is safe for a 7-month-old?", o: ["Whole grapes", "Mashed lentils", "Honey on bread", "Whole nuts"], a: 1, why: "Legumes are on the list of foods to offer; the others are on the avoid list." }
  ];
  var SORT = [
    { n: "Mashed lentils", art: "legumes", safe: true, why: "Legumes are on the list of foods to offer." },
    { n: "Honey on bread", art: "honey", safe: false, why: "Honey before 12 months → risk of infant botulism." },
    { n: "Cereal", art: "grains", safe: true, why: "Cereals and grains are on the list of foods to offer." },
    { n: "Whole grapes", art: "grapes", safe: false, why: "Whole grapes are a choking hazard unless prepared safely." },
    { n: "Mashed banana", art: "banana", safe: true, why: "Fruits are on the list of foods to offer." },
    { n: "Whole nuts", art: "nuts", safe: false, why: "Whole nuts → choking risk." },
    { n: "Cooked egg", art: "egg", safe: true, why: "Eggs are on the list of foods to offer." },
    { n: "Salty, sugary snack", art: "salt", safe: false, why: "Avoid foods with excessive salt or added sugar." },
    { n: "Mashed carrot", art: "carrot", safe: true, why: "Vegetables are on the list of foods to offer." },
    { n: "Unpasteurised milk", art: "raw", safe: false, why: "Avoid unpasteurised milk and products." },
    { n: "Fish or chicken", art: "meat", safe: true, why: "Meat, chicken and fish are on the list of foods to offer." },
    { n: "Cow’s milk as main drink", art: "cowmilk", safe: false, why: "Cow’s milk should not be the main drink before 12 months." },
    { n: "Sweet juice", art: "juicebox", safe: false, why: "Avoid foods and drinks with added sugar." }
  ];
  var SIM = {
    1: { z: "bad", pos: 9, o: "Much less", v: "Over-diluted", d: "Do not dilute formula excessively. Incorrect dilution can cause serious complications.", op: .12 },
    2: { z: "bad", pos: 26, o: "Less", v: "Over-diluted", d: "Do not dilute formula excessively. Incorrect dilution can cause serious complications.", op: .3 },
    3: { z: "ok", pos: 50, o: "Exact", v: "Correct", d: "Follow the manufacturer’s exact water-to-powder ratio and measure water and formula accurately.", op: .52 },
    4: { z: "bad", pos: 74, o: "More", v: "Extra powder", d: "Do not add extra powder. Incorrect formula preparation → dehydration or electrolyte disturbances.", op: .74 },
    5: { z: "bad", pos: 91, o: "Much more", v: "Extra powder", d: "Do not add extra powder. Incorrect formula preparation → dehydration or electrolyte disturbances.", op: .94 }
  };

  /* ================= Icons & illustrations ================= */
  function icon(n) { var p = (window.IFL_ICONS || {})[n]; return p ? '<svg viewBox="0 0 48 48" aria-hidden="true">' + p + "</svg>" : ""; }
  function art(n) { var p = (window.IFL_ART || {})[n]; return p ? '<svg viewBox="0 0 64 64" aria-hidden="true">' + p + "</svg>" : ""; }
  $$("[data-ic]").forEach(function (el) { el.innerHTML = icon(el.dataset.ic); });
  $$("[data-art]").forEach(function (el) { el.innerHTML = art(el.dataset.art); });
  if (!(window.IFL3D && window.IFL3D.ok)) document.body.classList.add("no3d");

  /* ================= Slides ================= */
  var PARTS = ["", "Breastfeeding", "Artificial Feeding", "NG Tube Feeding", "Weaning"];
  var slides = $$(".slide");
  var N = slides.length;
  var cur = -1, build = false;

  slides.forEach(function (s) {
    var p = +s.dataset.part || 0;
    var sh = $(".sh", s);
    if (sh && !$(".eyebrow", sh)) {
      var label = p ? "Part " + p + " · " + PARTS[p] : (s.dataset.kicker || "Lesson");
      sh.insertAdjacentHTML("afterbegin", '<p class="eyebrow"><span class="dot"></span>' + esc(label) + "</p>");
    }
  });

  var runs = [];
  slides.forEach(function (s, i) {
    var p = +s.dataset.part || 0, last = runs[runs.length - 1];
    if (last && last.p === p) last.n++; else runs.push({ p: p, start: i, n: 1 });
  });
  $("#progress").innerHTML = runs.map(function (r) { return '<span class="seg" style="flex:' + r.n + ';--pc:var(--p' + r.p + ')"><i></i></span>'; }).join("");
  var segs = $$("#progress .seg i");
  var reviewIdx = slides.indexOf(document.getElementById("s-review"));

  /* ---- 3D scene lifecycle ---- */
  var scenes = [];
  function sceneFor(host) {
    for (var i = 0; i < scenes.length; i++) if (scenes[i].host === host) return scenes[i].c;
    if (!(window.IFL3D && window.IFL3D.ok)) return null;
    var c = null;
    try { c = window.IFL3D.make(host.dataset.scene, host); } catch (e) { if (window.console) console.warn(e); }
    if (!c) { document.body.classList.add("no3d"); return null; }
    scenes.push({ host: host, c: c });
    wireScene(host, c);
    return c;
  }
  function enterScenes(s) { $$("[data-scene]", s).forEach(function (h) { var c = sceneFor(h); if (c) c.start(); }); }
  function leaveScenes(s) {
    $$("[data-scene]", s).forEach(function (h) { for (var i = 0; i < scenes.length; i++) if (scenes[i].host === h) scenes[i].c.stop(); });
  }
  function wireScene(host, c) {
    var kind = host.dataset.scene;
    if (kind === "hero") {
      $$("[data-hero]").forEach(function (b) {
        var i = +b.dataset.hero;
        b.addEventListener("mouseenter", function () { c.highlight(i); });
        b.addEventListener("focus", function () { c.highlight(i); });
        b.addEventListener("mouseleave", function () { c.highlight(-1); });
        b.addEventListener("blur", function () { c.highlight(-1); });
      });
    }
    if (kind === "bottle") {
      var range = $("#tiltRange");
      range.addEventListener("input", function () { c.setTilt(range.value); });
      $$("[data-tilt]", host).forEach(function (b) {
        b.addEventListener("click", function () {
          range.value = b.dataset.tilt; c.setTilt(b.dataset.tilt);
          $$("[data-tilt]", host).forEach(function (x) { x.classList.toggle("primary", x === b); });
        });
      });
    }
    if (kind === "ng") $("#ngReplay").addEventListener("click", function () { c.replay(); });
  }
  function rethemeScenes() { scenes.forEach(function (s) { if (s.c.retheme) s.c.retheme(); }); }

  /* ---- Navigation with motion ---- */
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
      leaveScenes(old);
      onLeave(old);
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
    enterScenes(s);
    onEnter(s);
    update();
  }
  function next() {
    if (build) { var h = $(".f.hid", slides[cur]); if (h) { h.classList.remove("hid"); return; } }
    go(cur + 1, 1);
  }
  function prev() { go(cur - 1, -1); }
  function goId(id) { var i = slides.indexOf(document.getElementById(id)); if (i >= 0) go(i); }

  function update() {
    var s = slides[cur], p = +s.dataset.part || 0;
    $("#count").textContent = (cur + 1) + " / " + N;
    $("#stitle").textContent = s.dataset.title || "";
    runs.forEach(function (r, k) { segs[k].style.width = (Math.max(0, Math.min(1, (cur + 1 - r.start) / r.n)) * 100) + "%"; });
    $$(".ptab").forEach(function (t) {
      var tp = +t.dataset.part;
      t.setAttribute("aria-current", String(tp === p && (p !== 0 || cur >= reviewIdx)));
    });
    $("#prevBtn").disabled = cur === 0;
    $("#nextBtn").disabled = cur === N - 1;
    fillDrawer();
    clearInk();
    try { history.replaceState(null, "", "#" + (cur + 1)); } catch (e) {}
    store.set("ifl-slide", String(cur));
  }

  function onEnter(s) {
    if (s.contains($("#hub"))) requestAnimationFrame(drawHub);
  }
  function onLeave(s) {
    if (s.contains($("#prep"))) stopPrep();
  }

  /* ================= Drawer ================= */
  var drawer = $("#drawer"), drTab = "ar";
  function fillDrawer() {
    var s = slides[cur], a = $("template[data-ar]", s), n = $("template[data-notes]", s);
    $("#drSlide").textContent = (cur + 1) + " · " + (s.dataset.title || "");
    $("#drAr").innerHTML = a ? a.innerHTML : "<p>لا يوجد شرح لهذه الشريحة.</p>";
    $("#drNt").innerHTML = n ? n.innerHTML : "<p>No notes for this slide.</p>";
  }
  function setTab(tab) {
    drTab = tab;
    $$(".dr-tabs [role=tab]").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === tab)); });
    $("#drAr").hidden = tab !== "ar"; $("#drNt").hidden = tab !== "nt";
    syncDrawerBtns();
  }
  function syncDrawerBtns() {
    $("#arBtn").setAttribute("aria-pressed", String(!drawer.hidden && drTab === "ar"));
    $("#ntBtn").setAttribute("aria-pressed", String(!drawer.hidden && drTab === "nt"));
  }
  function toggleDrawer(tab) {
    if (!drawer.hidden && drTab === tab) { closeDrawer(); return; }
    drawer.hidden = false; setTab(tab); requestAnimationFrame(afterLayout);
  }
  function closeDrawer() { drawer.hidden = true; syncDrawerBtns(); requestAnimationFrame(afterLayout); }
  $$(".dr-tabs [role=tab]").forEach(function (b) { b.addEventListener("click", function () { setTab(b.dataset.tab); }); });
  $("#drClose").addEventListener("click", closeDrawer);
  $("#arBtn").addEventListener("click", function () { toggleDrawer("ar"); });
  $("#ntBtn").addEventListener("click", function () { toggleDrawer("nt"); });
  function afterLayout() { sizeInk(); if (slides[cur] && slides[cur].contains($("#hub"))) drawHub(); }

  /* ================= Build mode & toast ================= */
  function toggleBuild() {
    build = !build;
    $("#buildBtn").setAttribute("aria-pressed", String(build));
    var s = slides[cur];
    if (build) s.classList.add("building");
    else { s.classList.remove("building"); $$(".f.hid", s).forEach(function (f) { f.classList.remove("hid"); }); }
    toast(build ? "Build mode on: → reveals one point at a time" : "Build mode off");
  }
  $("#buildBtn").addEventListener("click", toggleBuild);
  var toastT;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.remove("off");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add("off"); }, 1800);
  }

  /* ================= Ink & laser ================= */
  var ink = $("#ink"), ctx = ink.getContext("2d"), pen = false, drawing = false, laserOn = false;
  function sizeInk() {
    var r = $("#deck").getBoundingClientRect(), d = window.devicePixelRatio || 1;
    ink.width = Math.max(1, Math.round(r.width * d)); ink.height = Math.max(1, Math.round(r.height * d));
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function clearInk() { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ink.width, ink.height); ctx.restore(); }
  function pt(e) { var r = ink.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  ink.addEventListener("pointerdown", function (e) {
    if (!pen) return;
    drawing = true;
    try { ink.setPointerCapture(e.pointerId); } catch (err) {}
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--pen").trim() || "#d6266b";
    ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    var p = pt(e); ctx.beginPath(); ctx.moveTo(p[0], p[1]);
  });
  ink.addEventListener("pointermove", function (e) {
    if (!drawing) return;
    var p = pt(e); ctx.lineTo(p[0], p[1]); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p[0], p[1]);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { ink.addEventListener(ev, function () { drawing = false; }); });
  function togglePen(force) {
    pen = typeof force === "boolean" ? force : !pen;
    if (pen && laserOn) toggleLaser(false);
    document.body.classList.toggle("pen", pen);
    $("#penBtn").setAttribute("aria-pressed", String(pen));
    if (typeof force !== "boolean") toast(pen ? "Pen on: draw on the slide · C clears" : "Pen off");
  }
  function toggleLaser(force) {
    laserOn = typeof force === "boolean" ? force : !laserOn;
    if (laserOn && pen) togglePen(false);
    document.body.classList.toggle("laser", laserOn);
    $("#laserBtn").setAttribute("aria-pressed", String(laserOn));
  }
  document.addEventListener("pointermove", function (e) { if (laserOn) $("#laser").style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)"; });
  $("#penBtn").addEventListener("click", function () { togglePen(); });
  $("#laserBtn").addEventListener("click", function () { toggleLaser(); });
  $("#clearBtn").addEventListener("click", clearInk);
  window.addEventListener("resize", afterLayout);

  /* ================= Timer ================= */
  var tAcc = 0, tStart = 0, tRun = false, tInt = null;
  function fmt(ms) { var s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
  function paintTimer() { $("#tVal").textContent = fmt(tAcc + (tRun ? Date.now() - tStart : 0)); $("#tBtn").setAttribute("aria-pressed", String(tRun)); }
  function toggleTimer() {
    if (tRun) { tAcc += Date.now() - tStart; tRun = false; clearInterval(tInt); }
    else { tStart = Date.now(); tRun = true; tInt = setInterval(paintTimer, 500); }
    paintTimer();
  }
  $("#tBtn").addEventListener("click", toggleTimer);
  $("#tReset").addEventListener("click", function () { tAcc = 0; tStart = Date.now(); paintTimer(); });

  /* ================= Theme & fullscreen ================= */
  function isDark() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }
  $("#themeBtn").addEventListener("click", function () {
    var nt = isDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nt);
    store.set("ifl-theme", nt);
    rethemeScenes();
  });
  if (window.matchMedia) {
    var mq = matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", rethemeScenes);
  }
  function toggleFull() {
    try {
      if (!document.fullscreenElement) { var r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (r && r.catch) r.catch(function () {}); }
      else if (document.exitFullscreen) { var x = document.exitFullscreen(); if (x && x.catch) x.catch(function () {}); }
    } catch (e) {}
  }
  $("#fsBtn").addEventListener("click", toggleFull);
  document.addEventListener("fullscreenchange", function () { setTimeout(afterLayout, 80); });

  /* ================= Dialogs ================= */
  function openDlg(id) {
    var d = document.getElementById(id);
    if (!d || d.open) return;
    if (id === "ovDlg") buildOverview();
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  }
  $$("dialog").forEach(function (d) { d.addEventListener("click", function (e) { if (e.target === d) d.close(); }); });
  document.addEventListener("click", function (e) { var c = e.target.closest("[data-close]"); if (c) { var d = c.closest("dialog"); if (d) d.close(); } });
  function buildOverview() {
    var html = "", lastP = null;
    slides.forEach(function (s, i) {
      var p = +s.dataset.part || 0;
      if (p !== lastP) { html += '<p class="ovpart">' + (p ? "Part " + p + " · " + PARTS[p] : (i === 0 ? "Introduction" : "Review")) + "</p>"; lastP = p; }
      html += '<button type="button" class="ov' + (i === cur ? " cur" : "") + '" data-i="' + i + '" style="--pc:var(--p' + p + ')"><span class="n">' + (i + 1) + "</span><span>" + esc(s.dataset.title || "") + "</span></button>";
    });
    $("#ovGrid").innerHTML = html;
  }
  $("#ovGrid").addEventListener("click", function (e) { var b = e.target.closest(".ov"); if (!b) return; $("#ovDlg").close(); go(+b.dataset.i); });
  $("#ovBtn").addEventListener("click", function () { openDlg("ovDlg"); });
  $("#helpBtn").addEventListener("click", function () { openDlg("helpDlg"); });
  $("#pickBtn").addEventListener("click", function () { openDlg("pickerDlg"); });

  /* ================= Random picker ================= */
  var pool = [], poolN = 0, rolling = false;
  function resetPool() {
    poolN = Math.max(2, Math.min(300, parseInt($("#pkN").value, 10) || 30));
    pool = []; for (var i = 1; i <= poolN; i++) pool.push(i);
    $("#pkLeft").textContent = poolN + " students in the draw."; $("#pkOut").textContent = "?";
  }
  $("#pkGo").addEventListener("click", function () {
    if (rolling) return;
    var n = Math.max(2, Math.min(300, parseInt($("#pkN").value, 10) || 30)), noRep = $("#pkNoRep").checked;
    if (n !== poolN || pool.length === 0) resetPool();
    var idx = Math.floor(Math.random() * pool.length), pick = pool[idx];
    if (noRep) pool.splice(idx, 1);
    rolling = true;
    var k = 0, out = $("#pkOut");
    out.classList.remove("land");
    var iv = setInterval(function () {
      out.textContent = 1 + Math.floor(Math.random() * n);
      if (++k > 14) {
        clearInterval(iv); out.textContent = pick; void out.offsetWidth; out.classList.add("land");
        $("#pkLeft").textContent = noRep ? pool.length + " left in the draw." : "Repeats allowed.";
        rolling = false;
      }
    }, 55);
  });
  $("#pkReset").addEventListener("click", resetPool);
  $("#pkN").addEventListener("change", resetPool);

  /* ================= Generic actions ================= */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-go],[data-target],[data-target-idx],[data-open],[data-reveal]");
    if (!t) return;
    if (t.dataset.go === "next") next();
    if (t.dataset.target) goId(t.dataset.target);
    if (t.dataset.targetIdx) go(+t.dataset.targetIdx - 1);
    if (t.dataset.open) openDlg(t.dataset.open);
    if (t.dataset.reveal) {
      var el = document.getElementById(t.dataset.reveal);
      el.hidden = !el.hidden;
      t.textContent = el.hidden ? "Reveal answer" : "Hide answer";
    }
  });
  $("#prevBtn").addEventListener("click", prev);
  $("#nextBtn").addEventListener("click", next);
  $$(".mf").forEach(function (b) { b.addEventListener("click", function () { b.classList.toggle("open"); }); });

  /* ================= Quizzes ================= */
  $$(".quiz").forEach(function (el) {
    var data = QUIZ[el.dataset.quiz];
    el.innerHTML = '<div class="qgrid">' + data.map(function (d, qi) {
      return '<div class="q f" data-qi="' + qi + '"><p class="qt"><span class="qn">Q' + (qi + 1) + "</span>" + esc(d.q) + '</p><div class="opts">' +
        d.o.map(function (o, oi) { return '<button type="button" class="opt" data-oi="' + oi + '"><span class="ol">' + "ABCD"[oi] + "</span><span>" + esc(o) + "</span></button>"; }).join("") +
        '</div><p class="why" hidden><b></b> ' + esc(d.why) + "</p></div>";
    }).join("") + '</div><div class="qbar"><p class="qscore" aria-live="polite"></p><button type="button" class="btn ghost sm qreset">Reset answers</button></div>';
    function score() {
      var done = $$(".q.done", el).length, ok = $$(".q.ok", el).length;
      $(".qscore", el).textContent = done ? ok + " of " + data.length + " correct" + (done < data.length ? " · " + (data.length - done) + " to go" : "") : data.length + " questions · tap an answer to check it";
    }
    score();
    el.addEventListener("click", function (e) {
      var b = e.target.closest(".opt");
      if (b) {
        var q = b.closest(".q");
        if (q.classList.contains("done")) return;
        var d = data[+q.dataset.qi], oi = +b.dataset.oi;
        q.classList.add("done");
        $$(".opt", q)[d.a].classList.add("right");
        if (oi === d.a) q.classList.add("ok"); else b.classList.add("wrong");
        var w = $(".why", q); w.firstElementChild.textContent = oi === d.a ? "Correct." : "Not quite."; w.hidden = false;
        score(); return;
      }
      if (e.target.closest(".qreset")) {
        $$(".q", el).forEach(function (q) { q.classList.remove("done", "ok"); $$(".opt", q).forEach(function (o) { o.classList.remove("right", "wrong"); }); $(".why", q).hidden = true; });
        score();
      }
    });
  });

  /* ================= Feeding dial ================= */
  (function () {
    var dial = $("#dial"); if (!dial) return;
    var cx = 100, cy = 100, R = 80, h = '<circle class="ring" cx="100" cy="100" r="80"/>';
    function at(hr, rad) { var a = hr / 24 * 2 * Math.PI - Math.PI / 2; return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]; }
    for (var k = 0; k < 24; k++) {
      var maj = k % 6 === 0, a1 = at(k, maj ? R - 10 : R - 5), a2 = at(k, R);
      h += '<line class="tk' + (maj ? " maj" : "") + '" x1="' + a1[0].toFixed(1) + '" y1="' + a1[1].toFixed(1) + '" x2="' + a2[0].toFixed(1) + '" y2="' + a2[1].toFixed(1) + '"/>';
    }
    [[0, "00:00", 0, -2], [6, "06:00", 10, 0], [12, "12:00", 0, 2], [18, "18:00", -10, 0]].forEach(function (l) {
      var p = at(l[0], R + 15); h += '<text class="hl" x="' + (p[0] + l[2]).toFixed(1) + '" y="' + (p[1] + l[3]).toFixed(1) + '">' + l[1] + "</text>";
    });
    [.8, 3.2, 5.6, 8.1, 10.4, 12.9, 15.3, 17.6, 19.9, 22.3].forEach(function (hr, i) {
      var p = at(hr, R); h += '<circle class="fd" style="--i:' + i + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="6.5"/>';
    });
    h += '<text class="big" x="100" y="104">8–12</text><text class="cap" x="100" y="122">FEEDS / 24 H</text><text class="cap" x="100" y="136">on demand</text>';
    dial.innerHTML = h;
  })();

  /* ================= Preparation step player ================= */
  var prepTimer = null;
  function stopPrep() {
    clearInterval(prepTimer); prepTimer = null;
    $$("#prep .icard").forEach(function (c) { c.classList.remove("on"); });
    var b = $("#prepPlay"); if (b) b.textContent = "▶ Play the steps";
  }
  $("#prepPlay").addEventListener("click", function () {
    if (prepTimer) { stopPrep(); return; }
    var cards = $$("#prep .icard"), i = 0;
    this.textContent = "■ Stop";
    function step() {
      cards.forEach(function (c) { c.classList.remove("on"); });
      if (i >= cards.length) { stopPrep(); return; }
      cards[i].classList.add("on"); i++;
    }
    step(); prepTimer = setInterval(step, 1400);
  });

  /* ================= Dilution ================= */
  (function () {
    var r = $("#sim-scoops"); if (!r) return;
    function paint() {
      var s = SIM[+r.value];
      $("#simOut").textContent = s.o;
      $("#simNeedle").style.left = s.pos + "%";
      $("#simMilk").style.fillOpacity = s.op;
      $("#simRes").dataset.z = s.z;
      $("#simV").textContent = s.v;
      $("#simD").textContent = s.d;
    }
    r.addEventListener("input", paint); paint();
  })();

  /* ================= NG checklist ================= */
  (function () {
    var cbs = $$("#ngList input"), start = $("#ngStart"), msg = $("#ngMsg");
    function check() {
      var k = cbs.filter(function (c) { return c.checked; }).length;
      start.disabled = k < cbs.length;
      $("#ngMeter").style.width = (k / cbs.length * 100) + "%";
      msg.className = "cl-msg";
      msg.textContent = k < cbs.length ? (cbs.length - k) + " of " + cbs.length + " checks still open. The feed stays locked." : "All checks done. You may start the feed.";
    }
    cbs.forEach(function (c) { c.addEventListener("change", check); });
    start.addEventListener("click", function () { msg.className = "cl-msg go"; msg.textContent = "Administer the feed at the prescribed rate and observe the infant throughout feeding."; });
    $("#ngUnsure").addEventListener("click", function () { msg.className = "cl-msg stop"; msg.textContent = "STOP. Never administer a feed if tube placement is uncertain."; });
    $("#ngReset").addEventListener("click", function () { cbs.forEach(function (c) { c.checked = false; }); check(); });
    check();
  })();

  /* ================= Sorting game ================= */
  (function () {
    var deck = [], si = 0, sc = 0, answered = false;
    var food = $("#sortFood"), fb = $("#sortFb"), btns = $$("[data-sort]"), card = $("#sortCard");
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function show() {
      $("#sortN").textContent = Math.min(si + 1, deck.length); $("#sortS").textContent = sc;
      card.classList.remove("flip"); void card.offsetWidth; card.classList.add("flip");
      if (si >= deck.length) {
        $("#sortArt").innerHTML = ""; food.textContent = "All sorted!";
        fb.className = "sort-fb good"; fb.textContent = "Final score: " + sc + " of " + deck.length + ". Press Restart to play again.";
        btns.forEach(function (b) { b.disabled = true; }); $("#sortNext").disabled = true; return;
      }
      $("#sortArt").innerHTML = art(deck[si].art); food.textContent = deck[si].n;
      fb.className = "sort-fb"; fb.textContent = "Which bin does this food go in?";
      btns.forEach(function (b) { b.disabled = false; }); $("#sortNext").disabled = true; answered = false;
    }
    function start(shuf) {
      deck = shuf ? shuffle(SORT.slice()) : SORT.slice(); si = 0; sc = 0;
      $("#sortT").textContent = deck.length; $("#binSafe").innerHTML = ""; $("#binAvoid").innerHTML = "";
      show();
    }
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        if (answered || si >= deck.length) return;
        answered = true;
        var it = deck[si], right = (b.dataset.sort === "safe") === it.safe;
        if (right) sc++;
        fb.className = "sort-fb " + (right ? "good" : "miss");
        fb.innerHTML = "<b>" + (right ? "Correct" : "Not quite") + " · " + (it.safe ? "Safe" : "Avoid") + ".</b> " + esc(it.why);
        var box = it.safe ? $("#binSafeBox") : $("#binAvoidBox");
        (it.safe ? $("#binSafe") : $("#binAvoid")).insertAdjacentHTML("beforeend", '<li><span class="art">' + art(it.art) + "</span>" + esc(it.n) + "</li>");
        box.classList.add("hit"); setTimeout(function () { box.classList.remove("hit"); }, 600);
        $("#sortS").textContent = sc;
        btns.forEach(function (x) { x.disabled = true; });
        si++;
        $("#sortNext").disabled = false; $("#sortNext").textContent = si >= deck.length ? "See score →" : "Next card →";
      });
    });
    $("#sortNext").addEventListener("click", show);
    $("#sortRestart").addEventListener("click", function () { start(true); });
    start(false);
  })();

  /* ================= Case tabs ================= */
  $$(".case-tabs [role=tab]").forEach(function (b) {
    b.addEventListener("click", function () {
      $$(".case-tabs [role=tab]").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
      $$("[data-case-panel]").forEach(function (p) { p.hidden = p.dataset.casePanel !== b.dataset.case; });
    });
  });

  /* ================= Role-of-the-nurse hub ================= */
  function drawHub() {
    var hub = $("#hub"), svg = $("#hubLines");
    if (!hub || getComputedStyle(svg).display === "none") return;
    var core = $(".hub-core", hub), W = hub.clientWidth, H = hub.clientHeight;
    var cx = core.offsetLeft + core.offsetWidth / 2, cy = core.offsetTop + core.offsetHeight / 2, R = core.offsetWidth / 2 + 8;
    var html = "";
    $$(".hub-col li", hub).forEach(function (li, i) {
      var ul = li.parentNode, left = ul.classList.contains("left");
      var x1 = ul.offsetLeft + li.offsetLeft + (left ? li.offsetWidth : 0), y1 = ul.offsetTop + li.offsetTop + li.offsetHeight / 2;
      var ang = Math.atan2(y1 - cy, x1 - cx), x2 = cx + Math.cos(ang) * R, y2 = cy + Math.sin(ang) * R, mx = (x1 + x2) / 2;
      html += '<path class="draw" pathLength="1" style="--dd:' + (i * 90) + '" d="M' + x1.toFixed(1) + " " + y1.toFixed(1) + "C" + mx.toFixed(1) + " " + y1.toFixed(1) + " " + mx.toFixed(1) + " " + y2.toFixed(1) + " " + x2.toFixed(1) + " " + y2.toFixed(1) + '"/>';
    });
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = html;
  }

  /* ================= Final challenge ================= */
  (function () {
    var ci = 0, scores = [0, 0], left = 20, run = false, iv = null, finished = false, clock = $("#chClock");
    function paintClock() { $("#chSec").textContent = left > 0 ? left : "0"; clock.style.setProperty("--p", (left / 20).toFixed(3)); clock.classList.toggle("out", left <= 0); }
    function stopClock() { run = false; clearInterval(iv); }
    function resetClock() { stopClock(); left = 20; paintClock(); }
    clock.addEventListener("click", function () {
      if (finished) return;
      if (left <= 0) { resetClock(); return; }
      if (run) { stopClock(); return; }
      run = true;
      iv = setInterval(function () { left--; paintClock(); if (left <= 0) { stopClock(); toast("Time’s up!"); } }, 1000);
    });
    function paintScores(t) {
      $("#score0").textContent = scores[0]; $("#score1").textContent = scores[1];
      $("#teamCard0").classList.toggle("lead", scores[0] > scores[1]); $("#teamCard1").classList.toggle("lead", scores[1] > scores[0]);
      if (t !== undefined) { var o = $("#score" + t); o.classList.remove("bump"); void o.offsetWidth; o.classList.add("bump"); }
    }
    function show() {
      finished = false;
      var d = CH[ci], q = $("#chQ");
      $("#chNum").textContent = "Question " + (ci + 1) + " of " + CH.length;
      q.textContent = d.q; q.classList.remove("swap"); void q.offsetWidth; q.classList.add("swap");
      $("#chOpts").innerHTML = d.o.map(function (o, oi) { return '<button type="button" class="opt" data-oi="' + oi + '"><span class="ol">' + "ABCD"[oi] + "</span><span>" + esc(o) + "</span></button>"; }).join("");
      $("#chOpts").classList.remove("done"); $("#chWhy").hidden = true;
      $("#chPrev").disabled = ci === 0;
      $("#chNext").textContent = ci === CH.length - 1 ? "Show results →" : "Next question →";
      clock.hidden = false; resetClock();
    }
    function results() {
      finished = true; stopClock(); clock.hidden = true;
      var a = $("#teamA").value || "Team A", b = $("#teamB").value || "Team B";
      $("#chNum").textContent = "Final result";
      $("#chQ").textContent = scores[0] === scores[1] ? "It’s a draw!" : (scores[0] > scores[1] ? a : b) + " wins!";
      $("#chOpts").innerHTML = '<div class="result" style="grid-column:1/-1">' + esc(a) + " " + scores[0] + " – " + scores[1] + " " + esc(b) + "</div>";
      $("#chWhy").hidden = true; $("#chNext").textContent = "Play again ↺";
    }
    $("#chOpts").addEventListener("click", function (e) {
      var b = e.target.closest(".opt");
      if (!b || finished || $("#chOpts").classList.contains("done")) return;
      var d = CH[ci], oi = +b.dataset.oi;
      $("#chOpts").classList.add("done");
      $$(".opt", $("#chOpts"))[d.a].classList.add("right");
      if (oi !== d.a) b.classList.add("wrong");
      $("#chWhy").innerHTML = "<b>" + (oi === d.a ? "Correct." : "Not quite.") + "</b> " + esc(d.why);
      $("#chWhy").hidden = false; stopClock();
    });
    $("#chNext").addEventListener("click", function () {
      if (finished) { ci = 0; scores = [0, 0]; paintScores(); show(); return; }
      if (ci === CH.length - 1) { results(); return; }
      ci++; show();
    });
    $("#chPrev").addEventListener("click", function () { if (finished) { show(); return; } if (ci > 0) { ci--; show(); } });
    $$("[data-award]").forEach(function (b) {
      b.addEventListener("click", function () { var t = +b.dataset.award; scores[t] = Math.max(0, scores[t] + (+b.dataset.d)); paintScores(t); });
    });
    paintScores(); show();
  })();

  /* ================= Keyboard ================= */
  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if ($("dialog[open]")) return;
    var t = e.target, tag = t.tagName, type = (t.type || "").toLowerCase();
    if (tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return;
    if (tag === "INPUT" && type !== "checkbox" && type !== "range") return;
    if (type === "range" && /^(Arrow|Home|End|Page)/.test(e.key)) return;
    var onCtl = tag === "BUTTON" || type === "checkbox", code = e.code;
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); next(); return; }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); return; }
    if (e.key === " " || code === "Space") { if (onCtl) return; e.preventDefault(); if (e.shiftKey) prev(); else next(); return; }
    if (e.key === "Home") { e.preventDefault(); go(0); return; }
    if (e.key === "End") { e.preventDefault(); go(N - 1); return; }
    if (e.key === "Escape") { if (pen) togglePen(false); if (laserOn) toggleLaser(false); if (!drawer.hidden) closeDrawer(); return; }
    if (e.key === "?" || e.key === "؟" || (code === "Slash" && e.shiftKey)) { openDlg("helpDlg"); return; }
    switch (code) {
      case "KeyA": toggleDrawer("ar"); break;
      case "KeyN": toggleDrawer("nt"); break;
      case "KeyB": toggleBuild(); break;
      case "KeyG": case "KeyO": openDlg("ovDlg"); break;
      case "KeyL": toggleLaser(); break;
      case "KeyD": togglePen(); break;
      case "KeyC": clearInk(); break;
      case "KeyR": openDlg("pickerDlg"); break;
      case "KeyT": toggleTimer(); break;
      case "KeyF": toggleFull(); break;
      case "Digit1": case "Digit2": case "Digit3": case "Digit4": goId("s-p" + code.slice(-1)); break;
      default: return;
    }
  });

  /* ================= Touch swipe ================= */
  (function () {
    var sx = 0, sy = 0, st = 0, deckEl = $("#deck");
    deckEl.addEventListener("touchstart", function (e) { if (pen || e.touches.length !== 1) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }, { passive: true });
    deckEl.addEventListener("touchend", function (e) {
      if (pen || !st || e.target.closest(".no-swipe")) { st = 0; return; }
      var tt = e.changedTouches[0], dx = tt.clientX - sx, dy = tt.clientY - sy;
      if (Date.now() - st < 700 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) { if (dx < 0) next(); else prev(); }
      st = 0;
    }, { passive: true });
  })();

  /* ================= Start ================= */
  if (REDUCED) $$("svg").forEach(function (s) { if (s.pauseAnimations) s.pauseAnimations(); });
  window.addEventListener("hashchange", function () { var n = parseInt(location.hash.slice(1), 10); if (n >= 1 && n <= N) go(n - 1); });
  var startAt = 0, hn = parseInt(location.hash.slice(1), 10);
  if (hn >= 1 && hn <= N) startAt = hn - 1;
  else { var sv = parseInt(store.get("ifl-slide"), 10); if (sv >= 0 && sv < N) startAt = sv; }
  sizeInk();
  go(startAt, 1);
  paintTimer();
  resetPool();
})();
