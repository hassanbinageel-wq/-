/* 3D scenes for the Chest Trauma lesson (three.js r149, bundled). A scene renders only while its slide is shown. */
(function () {
  "use strict";
  var T = window.THREE;
  function hasGL() {
    try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); }
    catch (e) { return false; }
  }
  var OK = !!T && hasGL();
  window.CT3D = { ok: OK, make: make };
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
    r.localClippingEnabled = !!o.clip;
    var scene = new T.Scene();
    var cam = new T.PerspectiveCamera(o.fov || 30, 1, .1, 100);
    var st = { r: r, scene: scene, cam: cam, host: host, w: 0, h: 0, pr: 0, running: false };
    function resize() {
      var w = host.clientWidth, h = host.clientHeight;
      var pr = Math.min(2.5, Math.max(1, (window.devicePixelRatio || 1) * (window.CT_SCALE || 1)));
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
  function Drag(el) {
    var s = { yaw: 0, pitch: 0, vy: 0, down: false }, px = 0, py = 0;
    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button")) return;
      s.down = true; px = e.clientX; py = e.clientY;
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
    });
    el.addEventListener("pointermove", function (e) {
      if (!s.down) return;
      var k = 1 / (window.CT_SCALE || 1), dx = (e.clientX - px) * k, dy = (e.clientY - py) * k; px = e.clientX; py = e.clientY;
      s.yaw += dx * .01; s.vy = dx * .01;
      s.pitch = clamp(s.pitch + dy * .006, -.45, .45);
    });
    function up() { s.down = false; }
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    s.tick = function () { if (!s.down) { s.yaw += s.vy; s.vy *= .9; } };
    return s;
  }
  function label(host, key) { return host.querySelector('.lbl3d[data-l="' + key + '"]'); }
  function place(st, el, world, dx, dy) {
    if (!el) return;
    var half = (el.offsetWidth || 80) / 2 + 6, p = st.project(world), x = clamp(p.x + (dx || 0), half, st.w - half), y = clamp(p.y + (dy || 0), 16, st.h - 16);
    if (!isFinite(x) || !isFinite(y)) return;
    el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) translate(-50%,-50%)";
  }
  function lights(scene) {
    scene.add(new T.HemisphereLight(0xffffff, 0x8090a8, .9));
    var d = new T.DirectionalLight(0xffffff, .9); d.position.set(4, 6, 8); scene.add(d);
    var d2 = new T.DirectionalLight(0xdde8ff, .4); d2.position.set(-6, -2, 5); scene.add(d2);
  }
  /* "X-ray" rim material: clear in the middle, bright at the silhouette. */
  function xray(color, base, pow, alpha) {
    return new T.ShaderMaterial({
      uniforms: { uColor: { value: color }, uBase: { value: base }, uPow: { value: pow }, uAlpha: { value: alpha } },
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform vec3 uColor; uniform float uBase; uniform float uPow; uniform float uAlpha; varying vec3 vN; varying vec3 vV; void main(){ float r = 1.0 - abs(dot(normalize(vN), normalize(vV))); float a = uBase + pow(r, uPow); gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0) * uAlpha); }",
      transparent: true, depthWrite: false, side: T.DoubleSide
    });
  }
  function phys(c, o) { return new T.MeshPhysicalMaterial(Object.assign({ color: c, roughness: .5, clearcoat: .5, clearcoatRoughness: .4 }, o || {})); }

  /* ---------- anatomy builders (patient's right side is x < 0, the front is +z) ---------- */
  var RIB_A = [.62, .9, 1.1, 1.25, 1.36, 1.44, 1.5, 1.52, 1.5, 1.44];      // half-width of each rib loop
  var RIB_F = [.2, .17, .15, .14, .14, .15, .17, .5, .78, 1.05];           // where each rib ends at the front (8-10 stop short)
  function ribPoint(i, side, phi) {
    var a = RIB_A[i], b = a * .72, y0 = 1.9 - i * .4, drop = .5 + i * .03;
    return V(side * a * Math.sin(phi), y0 + drop * (phi / Math.PI - .55), b * Math.cos(phi));
  }
  function ribOut(side, phi) { return V(side * Math.sin(phi), 0, Math.cos(phi) * .8).normalize(); }
  function ribTube(i, side, p0, p1, mat, rad) {
    var pts = [], n = 18;
    for (var k = 0; k <= n; k++) pts.push(ribPoint(i, side, p0 + (p1 - p0) * k / n));
    return new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, rad || .058, 10, false), mat);
  }
  var PHI_BACK = Math.PI - .12;
  // opts.split: { ribs:[i...], side, p1, p2 } cuts those ribs in two places and returns the middle pieces in `seg`
  // opts.breakAt: { rib, side, phi } leaves a small gap in one rib
  function ribCage(mat, opts) {
    opts = opts || {};
    var g = new T.Group(), seg = new T.Group(), sp = opts.split, bk = opts.breakAt, gap = .035;
    for (var i = 0; i < 10; i++) [-1, 1].forEach(function (side) {
      if (sp && sp.side === side && sp.ribs.indexOf(i) >= 0) {
        g.add(ribTube(i, side, RIB_F[i], sp.p1 - gap, mat));
        seg.add(ribTube(i, side, sp.p1 + gap, sp.p2 - gap, opts.segMat || mat, .064));
        g.add(ribTube(i, side, sp.p2 + gap, PHI_BACK, mat));
      } else if (bk && bk.side === side && bk.rib === i) {
        g.add(ribTube(i, side, RIB_F[i], bk.phi - gap, mat));
        g.add(ribTube(i, side, bk.phi + gap, PHI_BACK, mat));
      } else g.add(ribTube(i, side, RIB_F[i], PHI_BACK, mat));
    });
    // sternum
    var top = V(0, 1.72, .46), bot = V(0, -.95, 1.02), mid = top.clone().lerp(bot, .5);
    var st = new T.Mesh(new T.BoxGeometry(.36, top.distanceTo(bot), .1), mat); st.position.copy(mid); st.quaternion.setFromUnitVectors(V(0, 1, 0), top.clone().sub(bot).normalize()); g.add(st);
    var xi = new T.Mesh(new T.ConeGeometry(.12, .34, 12), mat); xi.position.copy(bot).add(V(0, -.2, .04)); xi.rotation.x = Math.PI + .2; g.add(xi);
    // spine
    for (var v = 0; v < 13; v++) { var y = 2.3 - v * .37, z = -(.5 + clamp(v - 1, 0, 9) * .062); var vb = new T.Mesh(new T.CylinderGeometry(.17, .17, .26, 16), mat); vb.position.set(0, y, z); g.add(vb); }
    // clavicles
    [-1, 1].forEach(function (s) {
      var c = new T.CatmullRomCurve3([V(s * .2, 1.86, .5), V(s * .8, 2.0, .62), V(s * 1.45, 2.12, .3), V(s * 1.8, 2.16, -.05)]);
      g.add(new T.Mesh(new T.TubeGeometry(c, 30, .07, 10, false), mat));
    });
    g.add(seg);
    return { group: g, seg: seg };
  }
  var LUNG = [[0, 1.72], [.26, 1.66], [.47, 1.42], [.6, .95], [.69, .3], [.75, -.4], [.77, -1.0], [.7, -1.36], [.45, -1.55], [0, -1.6]];
  function lungGeo() {
    var c = new T.SplineCurve(LUNG.map(function (p) { return new T.Vector2(p[0], p[1]); }));
    var g = new T.LatheGeometry(c.getPoints(40).map(function (v) { return new T.Vector2(Math.max(0, v.x), v.y); }), 48);
    g.scale(1, 1, .86);
    return g;
  }
  function lung(side, mat) { var m = new T.Mesh(lungGeo(), mat); m.position.set(side * .8, .02, -.05); return m; }
  function heart(mat) {
    var g = new T.Group();
    var b = new T.Mesh(new T.SphereGeometry(.5, 36, 26), mat); b.scale.set(1, 1.15, .9); g.add(b);
    var apex = new T.Mesh(new T.ConeGeometry(.4, .6, 28), mat); apex.position.set(.12, -.55, .02); apex.rotation.z = Math.PI + .25; g.add(apex);
    g.position.set(.2, -.5, .38); g.rotation.z = -.35;
    return g;
  }
  function airway(mat) {
    var g = new T.Group();
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([V(0, 2.75, .12), V(0, 2.0, .05), V(0, 1.2, -.05)]), 24, .12, 14, false), mat));
    [-1, 1].forEach(function (s) { g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([V(0, 1.24, -.05), V(s * .25, .98, -.06), V(s * .55, .7, -.06)]), 16, .085, 12, false), mat)); });
    for (var i = 0; i < 7; i++) { var r = new T.Mesh(new T.TorusGeometry(.125, .022, 8, 20), mat); r.position.set(0, 2.6 - i * .2, .115 - i * .022); r.rotation.x = Math.PI / 2; g.add(r); }
    return g;
  }
  function vessels(red, blue) {
    var g = new T.Group();
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([V(.12, -.1, .36), V(.02, .55, .32), V(.12, 1.05, .12), V(.34, .95, -.25), V(.3, .2, -.5), V(.24, -1.7, -.72)]), 60, .11, 14, false), red));
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([V(-.26, 1.5, .12), V(-.27, .7, .2), V(-.22, -.1, .28)]), 24, .1, 14, false), blue));
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([V(-.2, -.9, .2), V(-.2, -1.7, -.3)]), 12, .1, 14, false), blue));
    return g;
  }
  function setAlpha(obj, a) {
    obj.traverse(function (c) {
      if (!c.material) return;
      if (c.material.uniforms && c.material.uniforms.uAlpha) c.material.uniforms.uAlpha.value = a * (c.material.userData.base || 1);
      else { var m = c.material; if (m.userData.cc === undefined) m.userData.cc = m.clearcoat || 0; m.transparent = a < .999; m.opacity = a; m.depthWrite = a > .6; if (m.isMeshPhysicalMaterial) { m.clearcoat = m.userData.cc * a; m.specularIntensity = a; } }
    });
    obj.visible = a > .01;
  }

  /* ================= Thorax: title and "structures that may be injured" ================= */
  function thorax(host) {
    var st = Stage(host, { fov: 30, update: update });
    st.cam.position.set(0, .35, 12.6); st.cam.lookAt(0, .25, 0);
    lights(st.scene);
    var drag = Drag(host), root = new T.Group(); st.scene.add(root);
    var parts = [
      ribCage(phys(C("--bone", "#d9c9a8"), { roughness: .6 })).group,
      (function () { var g = new T.Group(), m = phys(0xf2a3b3, { roughness: .6 }); g.add(lung(-1, m), lung(1, m)); return g; })(),
      (function () { var g = new T.Group(); [-1, 1].forEach(function (s) { var m = xray(C("--p4", "#0b8f8a"), .1, 1.6, 1), p = new T.Mesh(lungGeo(), m); p.position.set(s * .8, .02, -.05); p.scale.setScalar(1.09); g.add(p); }); return g; })(),
      heart(phys(0xc8102e, { roughness: .4 })),
      vessels(phys(0xd7263d, { roughness: .4 }), phys(0x2f6fd0, { roughness: .4 })),
      airway(phys(0xbfd6ea, { roughness: .5 }))
    ];
    var alpha = parts.map(function () { return 1; });
    parts.forEach(function (p) { root.add(p); });
    setAlpha(parts[2], 0); alpha[2] = 0;
    var focus = -1, hero = !host.closest(".slide").querySelector("[data-group]");
    function update(dt, t) {
      drag.tick();
      root.rotation.y = drag.yaw + (hero ? t * .28 : Math.sin(t * .35) * .5); root.rotation.x = drag.pitch * .6;
      var k = 1 + Math.sin(t * 1.4) * .012; parts[1].scale.set(k, k, k);
      parts[3].scale.setScalar(1 + Math.max(0, Math.sin(t * 5)) * .05);
      parts.forEach(function (p, i) {
        var target = focus < 0 ? (i === 2 ? 0 : 1) : (i === focus ? 1 : (i === 0 ? .1 : .08));
        if (focus === 2 && i === 1) target = .5;
        if (Math.abs(alpha[i] - target) > .003) { alpha[i] = damp(alpha[i], target, 5, dt); setAlpha(p, alpha[i]); }
      });
    }
    return { start: st.start, stop: st.stop, snapshot: st.snapshot, set: function (v) { focus = v >= 0 && v < 6 ? v : -1; } };
  }

  /* ================= Rib fracture and flail chest ================= */
  function ribs(host, flail) {
    var st = Stage(host, { fov: 30, update: update });
    st.cam.position.set(0, .2, 12.2); st.cam.lookAt(0, .1, 0);
    lights(st.scene);
    var drag = Drag(host), root = new T.Group(); st.scene.add(root);
    var bone = phys(C("--bone", "#d9c9a8"), { roughness: .6 }), hot = phys(C("--p1", "#c8102e"), { roughness: .45, emissive: C("--p1", "#c8102e"), emissiveIntensity: .25 });
    var P1 = .62, P2 = 1.5, PM = (P1 + P2) / 2;
    var cage = flail ? ribCage(bone, { split: { ribs: [3, 4, 5], side: -1, p1: P1, p2: P2 }, segMat: hot }) : ribCage(bone, { breakAt: { rib: 4, side: -1, phi: 1.0 } });
    root.add(cage.group);
    var lm = xray(new T.Color(0xf08ca0), .12, 1.5, .9), lungs = new T.Group(); lungs.add(lung(-1, lm), lung(1, lm)); root.add(lungs);
    var inward = ribOut(-1, PM).multiplyScalar(-1);
    // fracture markers
    var marks = [], mm = new T.MeshBasicMaterial({ color: C("--p1", "#c8102e"), transparent: true, opacity: .9 });
    function mark(p, parent) { var m = new T.Mesh(new T.TorusGeometry(.13, .025, 8, 28), mm); m.position.copy(p); m.lookAt(p.clone().multiplyScalar(2)); (parent || cage.group).add(m); marks.push(m); return m; }
    if (flail) [3, 4, 5].forEach(function (i) { mark(ribPoint(i, -1, P1)); mark(ribPoint(i, -1, P2)); });
    else mark(ribPoint(4, -1, 1.0));
    var mode = 0, k = .5, lastPhase = "", phaseEl = host.querySelector(".phase");
    var lseg = label(host, "seg"), lfx = label(host, "fx");
    root.rotation.y = .55;
    function update(dt, t) {
      drag.tick();
      root.rotation.y = .55 + drag.yaw + Math.sin(t * .3) * .12; root.rotation.x = drag.pitch * .6;
      var auto = (Math.sin(t * 1.5) + 1) / 2, target = mode === 1 ? 1 : mode === 2 ? 0 : auto;
      k = mode === 0 ? auto : damp(k, target, 4, dt);
      var e = 1 + k * .05; cage.group.scale.set(e, 1 + k * .012, e); lungs.scale.set(.96 + k * .06, .97 + k * .04, .96 + k * .06);
      if (flail) {
        cage.seg.position.copy(inward).multiplyScalar(k * .34 - .1);   // in on inspiration, out on expiration
        var phase = mode === 1 || (mode === 0 && Math.cos(t * 1.5) > 0) ? "in" : "out";
        if (phase !== lastPhase && phaseEl) {
          lastPhase = phase; phaseEl.dataset.ph = phase;
          phaseEl.innerHTML = phase === "in" ? "<b>Inspiration</b><span>the injured segment moves <u>inward</u></span>" : "<b>Expiration</b><span>the injured segment moves <u>outward</u></span>";
        }
      }
      marks.forEach(function (m, i) { var s = 1 + Math.sin(t * 4 + i) * .25; m.scale.setScalar(s); });
      st.scene.updateMatrixWorld();
      if (flail) place(st, lseg, cage.seg.localToWorld(ribPoint(4, -1, PM)), -30, -46);
      else place(st, lfx, cage.group.localToWorld(ribPoint(4, -1, 1.0)), -40, -34);
    }
    return { start: st.start, stop: st.stop, snapshot: st.snapshot, set: function (v) { mode = clamp(+v || 0, 0, 2); } };
  }

  /* ================= Pleural space: pneumothorax types and hemothorax ================= */
  // modes: 0 normal · 1 closed · 2 open · 3 tension · 4 hemothorax
  var PL = [
    { s: 1, air: 0, blood: 0, shift: 0, wound: 0 },
    { s: .7, air: .55, blood: 0, shift: 0, wound: 0 },
    { s: .5, air: .85, blood: 0, shift: 0, wound: 1 },
    { s: .26, air: 1, blood: 0, shift: .42, wound: 1 },
    { s: .62, air: 0, blood: 1, shift: 0, wound: 0 }
  ];
  function pleura(host) {
    var st = Stage(host, { fov: 30, update: update, clip: true });
    st.cam.position.set(0, .2, 12.4); st.cam.lookAt(0, .05, 0);
    lights(st.scene);
    var drag = Drag(host), root = new T.Group(); st.scene.add(root);
    var boneM = new T.MeshStandardMaterial({ color: C("--bone", "#d9c9a8"), transparent: true, opacity: .2, depthWrite: false, roughness: .7 });
    root.add(ribCage(boneM).group);
    var cAir = C("--air", "#2f9be0"), cPl = C("--p4", "#0b8f8a");
    var cav = [-1, 1].map(function (s) { var m = new T.Mesh(lungGeo(), xray(cPl, .05, 1.8, 1)); m.position.set(s * .8, .02, -.05); m.scale.setScalar(1.08); root.add(m); return m; });
    var airFill = new T.Mesh(lungGeo(), new T.MeshBasicMaterial({ color: cAir, transparent: true, opacity: 0, depthWrite: false })); airFill.position.copy(cav[0].position); airFill.scale.setScalar(1.06); root.add(airFill);
    var lungM = phys(0xf2a3b3, { roughness: .6 }), lungM2 = phys(0xf2a3b3, { roughness: .6 });
    var bad = lung(-1, lungM), good = lung(1, lungM2); root.add(bad, good);
    var HIL = V(-.22, .25, -.05), BASE = bad.position.clone();
    var medi = new T.Group(); medi.add(heart(phys(0xc8102e, { roughness: .4 })), airway(phys(0xbfd6ea, { roughness: .5 })), vessels(phys(0xd7263d, { roughness: .4 }), phys(0x2f6fd0, { roughness: .4 }))); root.add(medi);
    var dia = new T.Mesh(new T.SphereGeometry(1.75, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2.4), new T.MeshStandardMaterial({ color: 0xb5524a, transparent: true, opacity: .55, roughness: .7, depthWrite: false })); dia.scale.set(1, .35, .72); dia.position.set(0, -2.05, 0); root.add(dia);
    // blood pooling at the base of the pleural cavity (clipped at a horizontal level)
    var plane = new T.Plane(V(0, -1, 0), -3);
    var bloodM = new T.MeshPhysicalMaterial({ color: C("--blood", "#c8102e"), roughness: .25, clearcoat: 1, transparent: true, opacity: .9, side: T.DoubleSide, clippingPlanes: [plane] });
    var blood = new T.Mesh(lungGeo(), bloodM); blood.position.copy(cav[0].position); blood.scale.setScalar(1.05); root.add(blood);
    // free air particles in the cavity
    var rnd = rng(5), N = 90, pos = new Float32Array(N * 3), seeds = [];
    for (var i = 0; i < N; i++) { seeds.push([rnd() * 6.28, rnd() * 2 - 1, .35 + rnd() * .6, rnd() * 6.28]); }
    var pg = new T.BufferGeometry(); pg.setAttribute("position", new T.BufferAttribute(pos, 3));
    var pm = new T.PointsMaterial({ color: cAir, size: .075, transparent: true, opacity: 0, depthWrite: false });
    var pts = new T.Points(pg, pm); root.add(pts);
    // wound on the chest wall and the air stream through it
    var WP = ribPoint(4, -1, 1.25).add(V(0, .2, 0)), WOUT = ribOut(-1, 1.25);
    var wound = new T.Mesh(new T.TorusGeometry(.15, .045, 10, 28), new T.MeshBasicMaterial({ color: C("--p1", "#c8102e"), transparent: true, opacity: 0 })); wound.position.copy(WP); wound.lookAt(WP.clone().add(WOUT)); root.add(wound);
    var stream = [], sm = new T.MeshBasicMaterial({ color: cAir, transparent: true, opacity: 0 });
    for (i = 0; i < 9; i++) { var b = new T.Mesh(new T.SphereGeometry(.05, 10, 8), sm); root.add(b); stream.push(b); }
    var mode = +host.dataset.mode || 0, cur = { s: 1, air: 0, blood: 0, shift: 0, wound: 0 }, flow = 0;
    var ll = label(host, "lung"), la = label(host, "air"), lb = label(host, "blood"), lw = label(host, "wound"), ls = label(host, "shift"), lastMode = -1;
    function update(dt, t) {
      drag.tick();
      root.rotation.y = drag.yaw + Math.sin(t * .3) * .16; root.rotation.x = drag.pitch * .6;
      var M = PL[mode], k = (Math.sin(t * 1.5) + 1) / 2, insp = Math.cos(t * 1.5) > 0;
      ["s", "air", "blood", "shift", "wound"].forEach(function (p) { cur[p] = damp(cur[p], M[p], 3, dt); });
      // affected lung collapses towards the hilum; in an open pneumothorax it collapses more on inspiration
      var breath = mode === 0 ? .03 * k : mode === 2 ? -.07 * k : mode === 3 ? 0 : .015 * k, s = cur.s + breath;
      bad.scale.setScalar(s); bad.position.copy(HIL).add(BASE.clone().sub(HIL).multiplyScalar(s));
      lungM.color.setRGB(.95 - (1 - cur.s) * .25, .64 - (1 - cur.s) * .22, .7 - (1 - cur.s) * .15);
      // mediastinum and the normal lung are pushed to the opposite side
      medi.position.x = cur.shift; good.position.x = .8 + cur.shift * .75;
      var gs = 1 - cur.shift * .32 + .03 * k * (1 - cur.shift); good.scale.set(gs, 1 - cur.shift * .1 + .02 * k, gs);
      cav[1].position.x = .8 + cur.shift * .4; cav[0].scale.setScalar(1.08 + cur.shift * .22); airFill.scale.setScalar(1.06 + cur.shift * .22);
      airFill.material.opacity = cur.air * .16; pm.opacity = cur.air * .8;
      for (var i = 0; i < N; i++) {
        var sd = seeds[i], a = sd[0] + t * .25, y = sd[1] * 1.45 + Math.sin(t * .8 + sd[3]) * .08, rr = (.78 - Math.abs(y) * .22) * (1.05 + cur.shift * .2) * (.55 + sd[2] * .5);
        pos[i * 3] = -.8 + Math.cos(a) * rr; pos[i * 3 + 1] = y + .05; pos[i * 3 + 2] = -.05 + Math.sin(a) * rr * .86;
      }
      pg.attributes.position.needsUpdate = true;
      // blood level rises from the base
      plane.constant = -1.75 + cur.blood * 1.25 + Math.sin(t * 1.2) * .015 * cur.blood; blood.visible = cur.blood > .02; bloodM.opacity = .9 * Math.min(1, cur.blood * 3);
      // air through the wound: both ways when open, inwards only (one-way valve) in tension
      wound.material.opacity = cur.wound; wound.scale.setScalar(1 + Math.sin(t * 5) * .08);
      var dir = mode === 2 ? (insp ? 1 : -1) : mode === 3 ? (insp ? 1 : 0) : 0;
      flow += dt * dir * .9;
      stream.forEach(function (b, j) {
        var u = (((flow + j / stream.length) % 1) + 1) % 1;   // 0 outside → 1 inside
        b.position.copy(WP).add(WOUT.clone().multiplyScalar(1.1 - u * 1.5)); b.position.y += Math.sin(j * 2.1) * .05;
      });
      sm.opacity = cur.wound * (dir === 0 && mode === 3 ? .25 : .95);
      if (mode !== lastMode) {
        lastMode = mode;
        if (lw) lw.textContent = mode === 3 ? "Valvular tear: air enters, cannot come out" : "Wound: air moves in and out";
        if (ll) ll.textContent = mode === 0 ? "Lung" : "Collapsed lung";
        [[la, mode >= 1 && mode <= 3], [lb, mode === 4], [lw, mode === 2 || mode === 3], [ls, mode === 3]].forEach(function (x) { if (x[0]) x[0].classList.toggle("off", !x[1]); });
      }
      st.scene.updateMatrixWorld();
      place(st, ll, bad.localToWorld(V(0, .1, .5)), 0, 0);
      place(st, la, root.localToWorld(V(-1.25, 1.25, .3)), -40, -26);
      place(st, lb, root.localToWorld(V(-.9, -1.15, .5)), -30, 30);
      place(st, lw, root.localToWorld(WP.clone().add(WOUT.clone().multiplyScalar(.9))), -70, 58);
      place(st, ls, root.localToWorld(V(.25 + cur.shift, 1.9, .4)), 60, -30);
    }
    return { start: st.start, stop: st.stop, snapshot: st.snapshot, set: function (v) { mode = clamp(+v || 0, 0, 4); } };
  }

  /* ================= Landmarks: needle decompression and chest tube sites ================= */
  function sites(host) {
    var st = Stage(host, { fov: 30, update: update });
    st.cam.position.set(0, .3, 11.6); st.cam.lookAt(0, .2, 0);
    lights(st.scene);
    var drag = Drag(host), root = new T.Group(); st.scene.add(root);
    root.add(ribCage(phys(C("--bone", "#d9c9a8"), { roughness: .6 })).group);
    var lm = xray(new T.Color(0xf08ca0), .12, 1.5, .8); root.add(lung(-1, lm), lung(1, lm));
    function between(i, phi) { return ribPoint(i, -1, phi).lerp(ribPoint(i + 1, -1, phi), .5); }
    function lineOn(fn, col) {
      var p = []; for (var i = 0; i <= 8; i++) p.push(fn(i).add(V(0, 0, 0)));
      var m = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(p), 40, .016, 6, false), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .9 })); root.add(m); return m;
    }
    var cN = C("--p2", "#1c6dd0"), cT = C("--p4", "#0b8f8a");
    // midclavicular line (through the middle of the clavicle) and the mid-axillary line
    var mcl = lineOn(function (i) { var phi = Math.asin(clamp(.78 / RIB_A[Math.min(9, i + 1)], -1, 1)); return ribPoint(Math.min(9, i), -1, phi).add(ribOut(-1, phi).multiplyScalar(.07)); }, cN);
    var mal = lineOn(function (i) { return ribPoint(Math.min(9, i + 1), -1, 1.4).add(ribOut(-1, 1.4).multiplyScalar(.07)); }, cT);
    // needle in the 2nd intercostal space, midclavicular line
    var phiN = Math.asin(.78 / RIB_A[2]), pN = between(1, phiN), oN = ribOut(-1, phiN);
    var needle = new T.Group(), steel = new T.MeshStandardMaterial({ color: 0xdfe6ee, metalness: .8, roughness: .25 });
    var shaft = new T.Mesh(new T.CylinderGeometry(.022, .022, 1.3, 10), steel); shaft.position.y = .45; needle.add(shaft);
    var hub = new T.Mesh(new T.CylinderGeometry(.09, .06, .34, 16), phys(cN, { roughness: .35 })); hub.position.y = 1.2; needle.add(hub);
    needle.position.copy(pN); needle.quaternion.setFromUnitVectors(V(0, 1, 0), oN); root.add(needle);
    // chest tube in the 4th intercostal space, mid / anterior axillary line
    var phiT = 1.4, pT = between(3, phiT), oT = ribOut(-1, phiT);
    var tubeC = new T.CatmullRomCurve3([pT.clone().add(oT.clone().multiplyScalar(-.9)).add(V(0, .5, 0)), pT.clone().add(oT.clone().multiplyScalar(-.3)).add(V(0, .12, 0)), pT.clone(), pT.clone().add(oT.clone().multiplyScalar(.6)).add(V(0, -.15, 0)), pT.clone().add(oT.clone().multiplyScalar(1.0)).add(V(0, -.9, 0)), pT.clone().add(oT.clone().multiplyScalar(1.05)).add(V(0, -2.1, 0))]);
    var tube = new T.Mesh(new T.TubeGeometry(tubeC, 60, .06, 12, false), new T.MeshPhysicalMaterial({ color: cT, roughness: .25, clearcoat: 1, transparent: true, opacity: .9 })); root.add(tube);
    var rings = [pN, pT].map(function (p, i) { var o = i ? oT : oN, m = new T.Mesh(new T.TorusGeometry(.17, .028, 8, 28), new T.MeshBasicMaterial({ color: i ? cT : cN, transparent: true, opacity: .9 })); m.position.copy(p).add(o.clone().multiplyScalar(.07)); m.lookAt(p.clone().add(o.clone().multiplyScalar(2))); root.add(m); return m; });
    // rib number tags
    var tags = []; for (var i = 0; i < 6; i++) { var el = document.createElement("span"); el.className = "lbl3d num"; el.textContent = String(i + 1); host.appendChild(el); tags.push(el); }
    var mode = +host.dataset.mode || 0, yaw = mode ? 1.05 : .15, a = [1, 1];
    var ln = label(host, "needle"), lt = label(host, "tube");
    function update(dt, t) {
      drag.tick();
      yaw = damp(yaw, mode ? 1.05 : .15, 3, dt);
      root.rotation.y = yaw + drag.yaw + Math.sin(t * .3) * .06; root.rotation.x = drag.pitch * .6;
      a[0] = damp(a[0], mode === 0 ? 1 : .18, 4, dt); a[1] = damp(a[1], mode === 1 ? 1 : .18, 4, dt);
      setAlpha(needle, a[0]); mcl.material.opacity = a[0] * .9; rings[0].material.opacity = a[0];
      tube.material.opacity = a[1] * .9; tube.material.depthWrite = a[1] > .6; mal.material.opacity = a[1] * .9; rings[1].material.opacity = a[1];
      rings.forEach(function (r, i) { r.scale.setScalar(1 + Math.sin(t * 4 + i) * .2); });
      if (ln) ln.classList.toggle("off", mode !== 0); if (lt) lt.classList.toggle("off", mode !== 1);
      st.scene.updateMatrixWorld();
      place(st, ln, root.localToWorld(pN.clone().add(oN.clone().multiplyScalar(1.45))), 0, -46);
      place(st, lt, root.localToWorld(pT.clone().add(oT.clone().multiplyScalar(1.1)).add(V(0, -1.2, 0))), 0, 40);
      tags.forEach(function (el, i) { var phi = mode ? 1.75 : .5 + i * .02; place(st, el, root.localToWorld(ribPoint(i, mode ? -1 : 1, phi).add(ribOut(mode ? -1 : 1, phi).multiplyScalar(.1))), 0, 0); });
    }
    return { start: st.start, stop: st.stop, snapshot: st.snapshot, set: function (v) { mode = clamp(+v || 0, 0, 1); } };
  }

  function make(kind, host) {
    if (kind === "thorax") return thorax(host);
    if (kind === "fracture") return ribs(host, false);
    if (kind === "flail") return ribs(host, true);
    if (kind === "pleura") return pleura(host);
    if (kind === "sites") return sites(host);
    return null;
  }
})();
