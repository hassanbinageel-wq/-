/* 3D scenes for the URTIs lesson (three.js r149, bundled). A scene renders only while its slide is shown. */
(function () {
  "use strict";
  var T = window.THREE;
  function hasGL() {
    try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); }
    catch (e) { return false; }
  }
  var OK = !!T && hasGL();
  window.UR3D = { ok: OK, make: make };
  if (!OK) return;

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function C(n, fb) { var v = css(n); try { return new T.Color(v || fb); } catch (e) { return new T.Color(fb); } }
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function damp(a, b, k, dt) { return a + (b - a) * (1 - Math.exp(-k * dt)); }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function Stage(host, o) {
    var canvas = host.querySelector("canvas");
    var r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setClearColor(0x000000, 0);
    var scene = new T.Scene();
    var cam = new T.PerspectiveCamera(o.fov || 30, 1, .1, 100);
    var st = { r: r, scene: scene, cam: cam, host: host, w: 0, h: 0, pr: 0, running: false };
    function resize() {
      var w = host.clientWidth, h = host.clientHeight;
      var pr = Math.min(2.5, Math.max(1, (window.devicePixelRatio || 1) * (window.UR_SCALE || 1)));
      if (!w || !h || (w === st.w && h === st.h && pr === st.pr)) return;
      st.w = w; st.h = h; st.pr = pr;
      r.setPixelRatio(pr); r.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    var last = 0, t = 0;
    function frame(dt) { resize(); o.update(dt, t); r.render(scene, cam); }
    function loop(now) {
      if (!st.running) return;
      var dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now; t += dt;
      frame(dt);
      requestAnimationFrame(loop);
    }
    st.start = function () { if (st.running) return; st.running = true; last = performance.now(); requestAnimationFrame(loop); };
    st.stop = function () { st.running = false; };
    st.project = function (v) { var p = v.clone().project(cam); return { x: (p.x * .5 + .5) * st.w, y: (-p.y * .5 + .5) * st.h, z: p.z }; };
    st.snapshot = function () {
      for (var i = 0; i < 90; i++) { t += 1 / 30; frame(1 / 30); } // let easing settle before the still is taken
      var img = host.querySelector(".snap");
      try { if (img) { img.src = canvas.toDataURL("image/png"); host.classList.add("snapped"); } } catch (e) {}
    };
    return st;
  }

  function Drag(el, lim) {
    var s = { yaw: 0, pitch: 0, vy: 0, down: false }, px = 0, py = 0;
    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button")) return;
      s.down = true; px = e.clientX; py = e.clientY;
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
    });
    el.addEventListener("pointermove", function (e) {
      if (!s.down) return;
      var k = 1 / (window.UR_SCALE || 1), dx = (e.clientX - px) * k, dy = (e.clientY - py) * k; px = e.clientX; py = e.clientY;
      s.yaw += dx * .01; s.vy = dx * .01;
      if (lim) s.yaw = clamp(s.yaw, -lim, lim);
      s.pitch = clamp(s.pitch + dy * .006, -.4, .4);
    });
    function up() { s.down = false; }
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    s.tick = function () { if (!s.down) { s.yaw += s.vy; s.vy *= .9; if (lim) s.yaw = clamp(s.yaw, -lim, lim); } };
    return s;
  }
  function label(host, key) { return host.querySelector('.lbl3d[data-l="' + key + '"]'); }
  function place(st, el, world, dx, dy) {
    if (!el) return;
    var p = st.project(world), x = clamp(p.x + (dx || 0), 50, st.w - 50), y = clamp(p.y + (dy || 0), 16, st.h - 16);
    if (!isFinite(x) || !isFinite(y)) return;
    el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) translate(-50%,-50%)";
  }
  function glossy(c, rough) { return new T.MeshPhysicalMaterial({ color: c, roughness: rough === undefined ? .35 : rough, clearcoat: .8, clearcoatRoughness: .25 }); }
  function lights(scene) {
    scene.add(new T.HemisphereLight(0xffffff, 0xb08098, .85));
    var d = new T.DirectionalLight(0xffffff, .95); d.position.set(4, 6, 8); scene.add(d);
    var d2 = new T.DirectionalLight(0xffd6e6, .45); d2.position.set(-6, -3, 4); scene.add(d2);
  }

  /* ---------- virus models ---------- */
  function spikesOn(g, pts, len, rad, headR, mat, headMat) {
    var up = V(0, 1, 0);
    pts.forEach(function (n) {
      n = n.clone().normalize();
      var stalk = new T.Mesh(new T.CylinderGeometry(rad * .7, rad, len, 8), mat);
      stalk.quaternion.setFromUnitVectors(up, n); stalk.position.copy(n.clone().multiplyScalar(1 + len / 2 - .04)); g.add(stalk);
      if (headR) { var h = new T.Mesh(new T.SphereGeometry(headR, 12, 10), headMat || mat); h.position.copy(n.clone().multiplyScalar(1 + len)); g.add(h); }
    });
  }
  function fib(n) { var out = [], ga = Math.PI * (3 - Math.sqrt(5)); for (var i = 0; i < n; i++) { var y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i; out.push(V(Math.cos(th) * r, y, Math.sin(th) * r)); } return out; }
  function icoVerts(detail) {
    var g = new T.IcosahedronGeometry(1, detail), p = g.attributes.position, seen = {}, out = [];
    for (var i = 0; i < p.count; i++) { var v = V(p.getX(i), p.getY(i), p.getZ(i)), k = v.toArray().map(function (x) { return x.toFixed(3); }).join(); if (!seen[k]) { seen[k] = 1; out.push(v); } }
    return out;
  }
  function rhino(c) {   // small icosahedral virus with surface knobs
    var g = new T.Group(), m = glossy(c, .45);
    g.add(new T.Mesh(new T.IcosahedronGeometry(1, 1), new T.MeshPhysicalMaterial({ color: c, roughness: .5, clearcoat: .6, flatShading: true })));
    icoVerts(1).forEach(function (v) { var k = new T.Mesh(new T.SphereGeometry(.16, 12, 10), m); k.position.copy(v.multiplyScalar(1.02)); g.add(k); });
    return g;
  }
  function corona(c, spikeC) { // spherical envelope with club-shaped spikes (crown)
    var g = new T.Group();
    g.add(new T.Mesh(new T.SphereGeometry(1, 40, 28), glossy(c, .5)));
    spikesOn(g, fib(46), .32, .05, .13, glossy(spikeC, .3));
    return g;
  }
  function adeno(c, fiberC) {  // icosahedral capsid with long fibres at the vertices
    var g = new T.Group();
    g.add(new T.Mesh(new T.IcosahedronGeometry(1, 0), new T.MeshPhysicalMaterial({ color: c, roughness: .45, clearcoat: .7, flatShading: true })));
    spikesOn(g, icoVerts(0), .75, .025, .1, glossy(fiberC, .3));
    return g;
  }
  function rsv(c, spikeC) {    // envelope with dense short glycoprotein spikes
    var g = new T.Group();
    g.add(new T.Mesh(new T.SphereGeometry(1, 40, 28), glossy(c, .55)));
    spikesOn(g, fib(56), .2, .04, 0, glossy(spikeC, .35));
    return g;
  }

  /* ================= Viruses: title and causes of common cold ================= */
  function viruses(host) {
    var st = Stage(host, { fov: 32, update: update });
    st.cam.position.set(0, 0, 11);
    lights(st.scene);
    var drag = Drag(host);
    var root = new T.Group(); root.scale.setScalar(.82); st.scene.add(root);
    var pink = C("--p1", "#e64980"), deep = C("--p2", "#c2255c"), orch = C("--p3", "#ae3ec9"), lilac = C("--p4", "#7950c8"), lt = new T.Color(0xffd3e3);
    var V4 = [
      { o: rhino(pink), p: V(-1.15, .95, .4), s: .95, l: "rhino" },
      { o: corona(deep, lt), p: V(1.35, .75, -.2), s: 1.05, l: "corona" },
      { o: adeno(orch, new T.Color(0xf3c4ff)), p: V(-1.3, -1.45, -.3), s: .8, l: "adeno" },
      { o: rsv(lilac, new T.Color(0xd9ccff)), p: V(1.3, -1.35, .3), s: .85, l: "rsv" }
    ];
    V4.forEach(function (v, i) { v.o.position.copy(v.p); v.o.scale.setScalar(v.s); v.base = v.s; v.ph = i * 1.7; v.el = label(host, v.l); root.add(v.o); });
    // droplets
    var dm = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: .1, transparent: true, opacity: .45, clearcoat: 1 });
    var drops = [], rnd = rng(7);
    for (var i = 0; i < 22; i++) { var d = new T.Mesh(new T.SphereGeometry(.06 + rnd() * .12, 16, 12), dm); d.position.set((rnd() - .5) * 7, (rnd() - .5) * 6, (rnd() - .5) * 3 - 1); d.userData.sp = .2 + rnd() * .4; st.scene.add(d); drops.push(d); }
    var focus = -1;
    function update(dt, t) {
      drag.tick();
      root.rotation.y = drag.yaw + Math.sin(t * .2) * .25; root.rotation.x = drag.pitch * .6;
      V4.forEach(function (v, i) {
        v.o.rotation.y += dt * (.25 + i * .05); v.o.rotation.x = Math.sin(t * .5 + v.ph) * .3;
        v.o.position.y = v.p.y + Math.sin(t * .9 + v.ph) * .12;
        var target = focus < 0 ? v.base : (focus === i ? v.base * 1.35 : v.base * .7);
        var s = damp(v.o.scale.x, target, 5, dt); v.o.scale.setScalar(s);
        if (v.el) v.el.classList.toggle("off", focus >= 0 && focus !== i);
      });
      drops.forEach(function (d) { d.position.y += d.userData.sp * dt; if (d.position.y > 3.4) d.position.y = -3.4; });
      st.scene.updateMatrixWorld();
      V4.forEach(function (v) { place(st, v.el, v.o.getWorldPosition(V()).add(V(0, -1.45 * v.o.scale.x, 0)), 0, 0); });
    }
    return { start: st.start, stop: st.stop, snapshot: st.snapshot, set: function (v) { focus = v >= 0 && v < 4 ? v : -1; } };
  }

  /* ================= Throat: open mouth view of the pharynx and tonsils ================= */
  // modes: 0 normal · 1 common cold · 2 pharyngitis · 3 tonsillitis · 4 severe tonsillitis
  var MODES = [
    { wall: 0xef9aa9, tons: 0xe98d9d, tS: 1.0, tX: 1.02, exu: 0, wallSwell: 1, wallExu: 0, uvula: 0xec95a5, cav: 0xe58a9c },
    { wall: 0xe06f84, tons: 0xe98d9d, tS: 1.0, tX: 1.02, exu: 0, wallSwell: 1.05, wallExu: 0, uvula: 0xe88a9c, cav: 0xe2808f },
    { wall: 0xc42a46, tons: 0xe27a8c, tS: 1.08, tX: 1.0, exu: 0, wallSwell: 1.3, wallExu: 1, uvula: 0xdb5c73, cav: 0xd8687e },
    { wall: 0xd9687c, tons: 0xc92a45, tS: 1.55, tX: .86, exu: 1, wallSwell: 1.1, wallExu: 0, uvula: 0xdc5f76, cav: 0xe0788b },
    { wall: 0xd45a70, tons: 0xbf1f3c, tS: 2.0, tX: .56, exu: 1, wallSwell: 1.1, wallExu: 0, uvula: 0xd85570, cav: 0xdc6e83 }
  ];
  function throat(host) {
    var st = Stage(host, { fov: 34, update: update });
    st.cam.position.set(0, .1, 6.9); st.cam.lookAt(0, -.1, -1);
    st.scene.add(new T.HemisphereLight(0xffffff, 0x9a5060, .55));
    var lamp = new T.PointLight(0xfff2e6, .85, 14, 1.4); lamp.position.set(.3, .4, 3.2); st.scene.add(lamp);
    var d = new T.DirectionalLight(0xffffff, .35); d.position.set(2, 4, 6); st.scene.add(d);
    var drag = Drag(host, .55);
    var root = new T.Group(); st.scene.add(root);
    var mucosa = function (hex) { return new T.MeshPhysicalMaterial({ color: hex, roughness: .5, clearcoat: .6, clearcoatRoughness: .35 }); };

    // lips and cheeks
    var lips = new T.Mesh(new T.TorusGeometry(1.9, .3, 24, 80), mucosa(0xd2566e)); lips.scale.set(1.04, .98, .7); lips.position.z = .35; root.add(lips);
    var face = new T.Mesh(new T.RingGeometry(2.05, 4.6, 80), new T.MeshStandardMaterial({ color: 0xf7c9b4, roughness: .8 })); face.position.z = .3; root.add(face);
    // mouth cavity (we look into a tube) and the back wall
    var tube = new T.Mesh(new T.CylinderGeometry(1.85, 1.6, 3.2, 64, 1, true), mucosa(0xe58a9c)); tube.material.side = T.BackSide;
    tube.rotation.x = Math.PI / 2; tube.position.z = -1.25; root.add(tube);
    var wallM = new T.MeshBasicMaterial({ color: 0xef9aa9 });
    var wall = new T.Mesh(new T.CircleGeometry(1.62, 64), wallM); wall.position.z = -2.82; root.add(wall);
    // lymphoid follicles on the posterior pharyngeal wall
    var rnd = rng(3), bumps = [], bumpM = mucosa(0xe98a9c), wallExu = [], exM = new T.MeshPhysicalMaterial({ color: 0xfff6dc, roughness: .55, clearcoat: .3, transparent: true, opacity: 0 });
    for (var i = 0; i < 16; i++) {
      var a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 1.1, b = new T.Mesh(new T.SphereGeometry(.045 + rnd() * .035, 12, 10), bumpM);
      b.position.set(Math.cos(a) * rr, Math.sin(a) * rr * .8 - .1, -2.8); b.scale.z = .6; root.add(b); bumps.push(b);
    }
    for (i = 0; i < 9; i++) { var e = new T.Mesh(new T.SphereGeometry(.05 + rnd() * .05, 12, 10), exM); e.position.set((rnd() - .5) * 1.4, (rnd() - .5) * 1.0 - .1, -2.76); e.scale.z = .35; root.add(e); wallExu.push(e); }
    // teeth
    var toothM = new T.MeshPhysicalMaterial({ color: 0xfffdf8, roughness: .25, clearcoat: 1 });
    for (i = 0; i < 10; i++) {
      var tx = -1.25 + i * .278, ty = 1.52 - Math.pow(Math.abs(tx) / 1.6, 2) * .55;
      var th = new T.Mesh(new T.BoxGeometry(.24, .3, .2), toothM); th.position.set(tx, ty, .15 - Math.abs(tx) * .25); th.rotation.y = tx * .35; root.add(th);
    }
    // soft palate arches and the uvula
    var archM = mucosa(0xe58a9c);
    var a1 = new T.Mesh(new T.TorusGeometry(1.32, .17, 18, 60, Math.PI), archM); a1.position.set(0, -.55, -1.0); a1.scale.y = 1.25; root.add(a1);
    var a2 = new T.Mesh(new T.TorusGeometry(1.08, .15, 18, 60, Math.PI), archM); a2.position.set(0, -.55, -1.85); a2.scale.y = 1.3; root.add(a2);
    var uvM = mucosa(0xec95a5);
    var uvula = new T.Mesh(new T.CapsuleGeometry(.15, .42, 8, 18), uvM); uvula.position.set(0, .62, -1.45); root.add(uvula);
    // palatine tonsils with crypts and exudates
    function tonsil(side) {
      var g = new T.Group(), m = mucosa(0xe98d9d);
      var body = new T.Mesh(new T.SphereGeometry(.36, 40, 30), m); body.scale.set(.85, 1.25, .75); g.add(body);
      var cryptM = new T.MeshBasicMaterial({ color: 0x7a1830, transparent: true, opacity: .45 });
      var r2 = rng(side > 0 ? 11 : 17), ex = [], exu = new T.MeshPhysicalMaterial({ color: 0xfff1c9, roughness: .6, clearcoat: .2, transparent: true, opacity: 0 });
      for (var k = 0; k < 7; k++) {
        var u = (r2() - .5) * 1.6, w = (r2() - .5) * 1.1, n = V(Math.sin(u) * .85, Math.sin(w) * 1.25, Math.cos(u) * .75).normalize();
        var c = new T.Mesh(new T.SphereGeometry(.03, 8, 6), cryptM); c.position.copy(n.clone().multiplyScalar(.36)); c.position.x *= .85; c.position.y *= 1.25; c.position.z *= .75; g.add(c);
        var ep = new T.Mesh(new T.SphereGeometry(.04 + r2() * .035, 12, 10), exu); ep.position.copy(c.position).multiplyScalar(1.02); ep.scale.set(1.25, .9, .22); ep.lookAt(ep.position.clone().multiplyScalar(2)); g.add(ep); ex.push(ep);
      }
      g.userData = { mat: m, exu: exu, body: body, crypt: cryptM };
      g.position.set(side * 1.02, -.42, -1.42); g.rotation.y = -side * .45;
      root.add(g); return g;
    }
    var tL = tonsil(-1), tR = tonsil(1);
    // tongue
    var tongue = new T.Mesh(new T.SphereGeometry(1.5, 48, 32), mucosa(0xe57d8c)); tongue.scale.set(1.1, .48, 1.25); tongue.position.set(0, -1.45, -.55); root.add(tongue);
    var groove = new T.Mesh(new T.CylinderGeometry(.02, .02, 1.6, 6), new T.MeshBasicMaterial({ color: 0xb34a5e, transparent: true, opacity: .45 })); groove.rotation.x = Math.PI / 2 - .25; groove.position.set(0, -.78, -.35); root.add(groove);

    var mode = +host.dataset.mode || 0, cur = { tS: 1, tX: 1.02, ex: 0, sw: 1, wex: 0 };
    var cW = new T.Color(), cT = new T.Color(), cU = new T.Color(), cC = new T.Color();
    var lu = label(host, "uvula"), lt = label(host, "tonsil"), lw = label(host, "wall"), lg = label(host, "tongue"), le = label(host, "exu");
    function update(dt, t) {
      drag.tick();
      root.rotation.y = drag.yaw * .6 + Math.sin(t * .4) * .06; root.rotation.x = drag.pitch * .4;
      var M = MODES[mode];
      cW.set(M.wall); wallM.color.lerp(cW, 1 - Math.exp(-4 * dt)); bumpM.color.copy(wallM.color).offsetHSL(0, .05, -.04);
      cU.set(M.uvula); uvM.color.lerp(cU, 1 - Math.exp(-4 * dt));
      cC.set(M.cav); tube.material.color.lerp(cC, 1 - Math.exp(-4 * dt)); archM.color.lerp(cC, 1 - Math.exp(-4 * dt));
      cT.set(M.tons);
      cur.tS = damp(cur.tS, M.tS, 4, dt); cur.tX = damp(cur.tX, M.tX, 4, dt); cur.ex = damp(cur.ex, M.exu, 4, dt); cur.sw = damp(cur.sw, M.wallSwell, 4, dt); cur.wex = damp(cur.wex, M.wallExu, 4, dt);
      [tL, tR].forEach(function (g, k) {
        var side = k ? 1 : -1, pulse = 1 + (mode >= 3 ? Math.sin(t * 2.4) * .015 : 0);
        g.userData.mat.color.lerp(cT, 1 - Math.exp(-4 * dt));
        g.scale.setScalar(cur.tS * pulse); g.position.x = side * cur.tX;
        g.userData.exu.opacity = cur.ex; g.userData.crypt.opacity = .45 * (1 - cur.ex);
      });
      bumps.forEach(function (b) { b.scale.set(cur.sw, cur.sw, .6 * cur.sw); });
      exM.opacity = cur.wex;
      uvula.rotation.z = Math.sin(t * 1.3) * .06;
      st.scene.updateMatrixWorld();
      place(st, lu, uvula.localToWorld(V(0, -.45, 0)), 64, 0);
      place(st, lt, tR.localToWorld(V(.3, -.1, .2)), 50, 34);
      place(st, lw, wall.localToWorld(V(-.55, .75, 0)), -60, -22);
      place(st, lg, tongue.localToWorld(V(-.5, .3, .9)), -40, 30);
      if (le) { le.classList.toggle("off", cur.ex < .5 && cur.wex < .5); place(st, le, (cur.wex > .5 ? wall.localToWorld(V(.4, -.5, 0)) : tL.localToWorld(V(-.2, .25, .3))), cur.wex > .5 ? 70 : -70, -10); }
    }
    return { start: st.start, stop: st.stop, snapshot: st.snapshot, set: function (v) { mode = clamp(+v || 0, 0, 4); } };
  }

  function make(kind, host) {
    if (kind === "viruses") return viruses(host);
    if (kind === "throat") return throat(host);
    return null;
  }
})();
