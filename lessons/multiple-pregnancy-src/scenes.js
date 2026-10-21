/* 3D scenes for the Multiple Pregnancy lesson (three.js r149, bundled). A scene renders only while its slide is shown. */
(function () {
  "use strict";
  var T = window.THREE;
  function hasGL() {
    try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); }
    catch (e) { return false; }
  }
  var OK = !!T && hasGL();
  window.MP3D = { ok: OK, make: make };
  if (!OK) return;

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function C(n, fb) { var v = css(n); try { return new T.Color(v || fb); } catch (e) { return new T.Color(fb); } }
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function damp(a, b, k, dt) { return a + (b - a) * (1 - Math.exp(-k * dt)); }
  function lathe(pts, seg) { return new T.LatheGeometry(pts.map(function (p) { return new T.Vector2(p[0], p[1]); }), seg || 72); }

  function lights(scene) {
    scene.add(new T.HemisphereLight(0xffffff, 0x9a8aa0, .9));
    var d = new T.DirectionalLight(0xffffff, .95); d.position.set(4, 6, 8); scene.add(d);
    var d2 = new T.DirectionalLight(0xffe2ee, .4); d2.position.set(-6, -2, 5); scene.add(d2);
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

  function Stage(host, o) {
    var canvas = host.querySelector("canvas");
    var r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setClearColor(0x000000, 0);
    var scene = new T.Scene();
    var cam = new T.PerspectiveCamera(o.fov || 30, 1, .1, 100);
    var st = { r: r, scene: scene, cam: cam, host: host, w: 0, h: 0, pr: 0, running: false };
    function resize() {
      var w = host.clientWidth, h = host.clientHeight;
      var pr = Math.min(2.5, Math.max(1, (window.devicePixelRatio || 1) * (window.MP_SCALE || 1)));
      if (!w || !h || (w === st.w && h === st.h && pr === st.pr)) return;
      st.w = w; st.h = h; st.pr = pr;
      r.setPixelRatio(pr); r.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    var last = 0, t = 0;
    function frame(dt) { resize(); o.update(dt, t); r.render(scene, cam); if (o.after) o.after(); }
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
      for (var i = 0; i < 90; i++) { t += 1 / 30; frame(1 / 30); } // settle any easing before the still is taken
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
      var k = 1 / (window.MP_SCALE || 1), dx = (e.clientX - px) * k, dy = (e.clientY - py) * k; px = e.clientX; py = e.clientY;
      s.yaw += dx * .01; s.vy = dx * .01;
      s.pitch = clamp(s.pitch + dy * .006, -.5, .5);
    });
    function up() { s.down = false; }
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    s.tick = function () { if (!s.down) { s.yaw += s.vy; s.vy *= .92; } };
    return s;
  }

  function label(host, key) { return host.querySelector('.lbl3d[data-l="' + key + '"]'); }
  function place(st, el, world, dx, dy) {
    if (!el) return;
    var p = st.project(world), x = clamp(p.x + (dx || 0), 40, st.w - 40), y = clamp(p.y + (dy || 0), 16, st.h - 16);
    if (!isFinite(x) || !isFinite(y)) return;
    el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) translate(-50%,-50%)";
  }

  /* ---------- models ---------- */
  function fetus(color) {
    var g = new T.Group();
    var col = new T.Color(color).lerp(new T.Color(0xfff1ec), .28);
    var m = new T.MeshPhysicalMaterial({ color: col, roughness: .55, clearcoat: .35, clearcoatRoughness: .5, sheen: .8, sheenColor: new T.Color(0xffe4ec) });
    function ell(r, sx, sy, sz, x, y, z, rx, ry, rz) {
      var e = new T.Mesh(new T.SphereGeometry(r, 36, 24), m);
      e.scale.set(sx, sy, sz); e.position.set(x, y, z); e.rotation.set(rx || 0, ry || 0, rz || 0); g.add(e); return e;
    }
    var head = ell(.44, 1, 1.02, 1, 0, .7, .1);                 // large fetal head, tucked chin
    ell(.5, .74, .98, .7, 0, -.02, 0, .32);                      // curved trunk
    ell(.17, 1, 2.0, 1, -.2, -.2, .3, -1.05, 0, .12);            // thighs flexed onto the abdomen
    ell(.17, 1, 2.0, 1, .2, -.2, .3, -1.05, 0, -.12);
    ell(.12, 1, 2.2, 1, -.24, -.02, .5, .35, 0, .2);             // shins folded back
    ell(.12, 1, 2.2, 1, .24, -.02, .5, .35, 0, -.2);
    ell(.1, 1.3, .7, 1, -.2, -.32, .62);                          // feet
    ell(.1, 1.3, .7, 1, .2, -.32, .62);
    ell(.09, 1, 2.4, 1, -.24, .32, .38, .4, 0, -.9);             // arms crossed over the chest
    ell(.09, 1, 2.4, 1, .24, .32, .38, .4, 0, .9);
    var eye = new T.MeshBasicMaterial({ color: 0x5a3446, transparent: true, opacity: .45 });
    var e1 = new T.Mesh(new T.SphereGeometry(.03, 10, 8), eye); e1.position.set(-.14, .74, .52); e1.scale.set(1.6, .5, 1); g.add(e1);
    var e2 = e1.clone(); e2.position.x = .14; g.add(e2);
    g.userData.head = head;
    return g;
  }
  function smooth(pts, n) {
    var c = new T.SplineCurve(pts.map(function (p) { return new T.Vector2(p[0], p[1]); }));
    return c.getPoints(n || 80).map(function (v) { return [Math.max(0, v.x), v.y]; });
  }
  var UTERUS = [[0, -2.15], [.3, -2.12], [.42, -1.9], [.6, -1.5], [1.1, -1.02], [1.52, -.36], [1.7, .38], [1.64, 1.08], [1.34, 1.64], [.8, 2.0], [0, 2.12]];
  function uterus(color) {
    var g = new T.Group();
    var geo = lathe(smooth(UTERUS, 90), 96);
    g.add(new T.Mesh(geo, xray(color, .04, 2.2, .95)));
    var fill = new T.Mesh(geo, new T.MeshBasicMaterial({ color: color, transparent: true, opacity: .05, depthWrite: false, side: T.BackSide }));
    g.add(fill);
    return g;
  }
  function placenta(color, r) {
    var geo = new T.SphereGeometry(r || 1, 40, 20); geo.scale(1, .26, 1);
    return new T.Mesh(geo, new T.MeshPhysicalMaterial({ color: color, roughness: .6, clearcoat: .5, transparent: true, opacity: 1 }));
  }
  function motes(n, spread, color) {
    var p = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) { p[i * 3] = (Math.random() - .5) * spread; p[i * 3 + 1] = (Math.random() - .5) * spread; p[i * 3 + 2] = (Math.random() - .5) * spread * .6; }
    var g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(p, 3));
    return new T.Points(g, new T.PointsMaterial({ color: color, size: .05, transparent: true, opacity: .55, depthWrite: false }));
  }

  /* ================= Title: twins in the uterus ================= */
  function hero(host) {
    var st = Stage(host, { fov: 30, update: update });
    st.cam.position.set(0, .1, 11.5);
    lights(st.scene);
    var drag = Drag(host);
    var root = new T.Group(); st.scene.add(root);
    root.add(uterus(C("--p1", "#c2416b")));
    var pl = placenta(new T.Color(0xa8475c), .8); pl.scale.y = .7; pl.position.set(.2, 1.5, -.75); pl.rotation.set(-.9, 0, .25); root.add(pl);
    var a = fetus(C("--p1", "#e8a0b8")), b = fetus(C("--p4", "#8fb4e8"));
    a.position.set(-.6, -.55, .1); a.rotation.z = Math.PI; a.scale.setScalar(.95);
    b.position.set(.6, .45, -.1); b.rotation.z = Math.PI + .25; b.scale.setScalar(.95);
    root.add(a, b);
    var dust = motes(120, 6, C("--p1", "#c2416b")); st.scene.add(dust);
    var la = label(host, "a"), lb = label(host, "b");
    function update(dt, t) {
      drag.tick();
      root.rotation.y = drag.yaw + t * .25; root.rotation.x = drag.pitch * .6 + Math.sin(t * .5) * .05;
      root.position.y = Math.sin(t * .8) * .06;
      a.rotation.y = Math.sin(t * .9) * .25; b.rotation.y = Math.sin(t * .7 + 1) * .25;
      dust.rotation.y = t * .03;
      st.scene.updateMatrixWorld();
      place(st, la, a.userData.head.getWorldPosition(V()), 0, 0);
      place(st, lb, b.userData.head.getWorldPosition(V()), 0, 0);
    }
    return { start: st.start, stop: st.stop, snapshot: st.snapshot };
  }

  /* ================= Lie & presentation ================= */
  function pres(host) {
    var st = Stage(host, { fov: 30, update: update });
    st.cam.position.set(0, 0, 11);
    lights(st.scene);
    var drag = Drag(host);
    var root = new T.Group(); st.scene.add(root);
    root.add(uterus(C("--p3", "#12867c")));
    var a = fetus(C("--p1", "#e8a0b8")), b = fetus(C("--p4", "#8fb4e8"));
    root.add(a, b);
    var P = Math.PI, H = P / 2;
    var COMBOS = [
      { a: [P, -.6, -.6], b: [P, .62, .4] },
      { a: [P, -.6, -.6], b: [0, .62, .35] },
      { a: [0, -.55, -.5], b: [P, .62, .4] },
      { a: [0, -.55, -.5], b: [0, .62, .35] },
      { a: [P, -.6, -.6], b: [H, .35, .95] },
      { a: [H, 0, -.85], b: [-H, 0, .75] }
    ];
    var cur = COMBOS[0], la = label(host, "a"), lb = label(host, "b");
    a.rotation.z = cur.a[0]; a.position.set(cur.a[1], cur.a[2], .1);
    b.rotation.z = cur.b[0]; b.position.set(cur.b[1], cur.b[2], -.15);
    function update(dt, t) {
      drag.tick();
      root.rotation.y = drag.yaw + Math.sin(t * .35) * .35; root.rotation.x = drag.pitch * .6;
      a.rotation.z = damp(a.rotation.z, cur.a[0], 4, dt); a.position.x = damp(a.position.x, cur.a[1], 4, dt); a.position.y = damp(a.position.y, cur.a[2], 4, dt);
      b.rotation.z = damp(b.rotation.z, cur.b[0], 4, dt); b.position.x = damp(b.position.x, cur.b[1], 4, dt); b.position.y = damp(b.position.y, cur.b[2], 4, dt);
      a.rotation.y = Math.sin(t) * .15; b.rotation.y = Math.sin(t * .8 + 1) * .15;
      st.scene.updateMatrixWorld();
      place(st, la, a.userData.head.getWorldPosition(V()), 0, -2);
      place(st, lb, b.userData.head.getWorldPosition(V()), 0, -2);
    }
    return { start: st.start, stop: st.stop, snapshot: st.snapshot, set: function (v) { cur = COMBOS[v] || COMBOS[0]; } };
  }

  /* ================= Timing of division → chorionicity ================= */
  function chor(host) {
    var st = Stage(host, { fov: 30, update: update });
    st.cam.position.set(0, 1.4, 10.5); st.cam.lookAt(0, 0, 0);
    lights(st.scene);
    var drag = Drag(host);
    var root = new T.Group(); root.scale.setScalar(.8); st.scene.add(root);
    var cCho = C("--cho", "#7b4bb7"), cAmn = C("--amn", "#12867c"), cPl = C("--p6", "#c23b30");
    function shell(c, base, alpha) { var m = new T.Mesh(new T.SphereGeometry(1, 56, 36), xray(c, base, 2, alpha)); return m; }
    var choA = shell(cCho, .06, 1), choB = shell(cCho, .06, 1), amA = shell(cAmn, .03, 1), amB = shell(cAmn, .03, 1);
    var fillA = new T.Mesh(new T.SphereGeometry(1, 40, 28), new T.MeshBasicMaterial({ color: cAmn, transparent: true, opacity: .07, depthWrite: false }));
    var fillB = fillA.clone(); fillB.material = fillA.material.clone();
    var plA = placenta(cPl, 1), plB = placenta(cPl, 1);
    var fA = fetus(C("--p1", "#e8a0b8")), fB = fetus(C("--p4", "#8fb4e8"));
    var bridge = new T.Mesh(new T.CylinderGeometry(.16, .16, .5, 20), new T.MeshPhysicalMaterial({ color: C("--p8", "#4b55c2"), roughness: .5, transparent: true, opacity: 0 }));
    bridge.rotation.z = Math.PI / 2;
    root.add(choA, choB, amA, amB, fillA, fillB, plA, plB, fA, fB, bridge);
    var objs = [choA, choB, amA, amB, fillA, fillB, plA, plB, fA, fB, bridge];
    // target per state: [x,y,z, sx,sy,sz, alpha]
    var S = [
      { choA: [-1.35, 0, 0, 1.2, 1.2, 1.2, 1], choB: [1.35, 0, 0, 1.2, 1.2, 1.2, 1], amA: [-1.35, -.08, 0, .92, .92, .92, 1], amB: [1.35, -.08, 0, .92, .92, .92, 1],
        plA: [-1.35, 1.22, 0, .82, .82, .82, 1], plB: [1.35, 1.22, 0, .82, .82, .82, 1], fA: [-1.35, -.15, 0, .55, .55, .55, 1], fB: [1.35, -.15, 0, .55, .55, .55, 1], bridge: [0, -.1, 0, 1, 1, 1, 0], ry: [.3, -.3] },
      { choA: [0, 0, 0, 2.25, 1.3, 1.3, 1], choB: [0, 0, 0, 2.25, 1.3, 1.3, 0], amA: [-.95, -.1, 0, .98, .98, .98, 1], amB: [.95, -.1, 0, .98, .98, .98, 1],
        plA: [0, 1.32, 0, 1.25, .9, .9, 1], plB: [0, 1.32, 0, 1.25, .9, .9, 0], fA: [-.95, -.15, 0, .55, .55, .55, 1], fB: [.95, -.15, 0, .55, .55, .55, 1], bridge: [0, -.1, 0, 1, 1, 1, 0], ry: [.3, -.3] },
      { choA: [0, 0, 0, 2.25, 1.3, 1.3, 1], choB: [0, 0, 0, 2.25, 1.3, 1.3, 0], amA: [0, -.08, 0, 1.95, 1.08, 1.08, 1], amB: [0, -.08, 0, 1.95, 1.08, 1.08, 0],
        plA: [0, 1.32, 0, 1.25, .9, .9, 1], plB: [0, 1.32, 0, 1.25, .9, .9, 0], fA: [-.6, -.15, 0, .55, .55, .55, 1], fB: [.6, -.15, 0, .55, .55, .55, 1], bridge: [0, -.1, 0, 1, 1, 1, 0], ry: [.5, -.5] },
      { choA: [0, 0, 0, 2.25, 1.3, 1.3, 1], choB: [0, 0, 0, 2.25, 1.3, 1.3, 0], amA: [0, -.08, 0, 1.95, 1.08, 1.08, 1], amB: [0, -.08, 0, 1.95, 1.08, 1.08, 0],
        plA: [0, 1.32, 0, 1.25, .9, .9, 1], plB: [0, 1.32, 0, 1.25, .9, .9, 0], fA: [-.3, -.15, 0, .55, .55, .55, 1], fB: [.3, -.15, 0, .55, .55, .55, 1], bridge: [0, -.18, .08, 1, 1, 1, 1], ry: [1.25, -1.25] }
    ];
    var names = { choA: choA, choB: choB, amA: amA, amB: amB, plA: plA, plB: plB, fA: fA, fB: fB, bridge: bridge };
    var state = 0;
    function setAlpha(o, a) {
      if (o.material && o.material.uniforms) o.material.uniforms.uAlpha.value = a;
      else if (o.material) { o.material.opacity = a; o.material.transparent = true; o.material.depthWrite = a > .98; }
      else o.traverse(function (c) { if (c.material) { c.material.transparent = a < .999; c.material.opacity = a; c.material.depthWrite = a > .98; } });
      o.visible = a > .01;
    }
    function apply(dt, snap) {
      var s = S[state];
      Object.keys(names).forEach(function (k) {
        var o = names[k], v = s[k], k2 = snap ? 1e3 : 5;
        o.position.set(damp(o.position.x, v[0], k2, dt), damp(o.position.y, v[1], k2, dt), damp(o.position.z, v[2], k2, dt));
        o.scale.set(damp(o.scale.x, v[3], k2, dt), damp(o.scale.y, v[4], k2, dt), damp(o.scale.z, v[5], k2, dt));
        o.userData.a = damp(o.userData.a === undefined ? v[6] : o.userData.a, v[6], k2, dt);
        setAlpha(o, o.userData.a);
      });
      fA.rotation.y = damp(fA.rotation.y, s.ry[0], 4, dt); fB.rotation.y = damp(fB.rotation.y, s.ry[1], 4, dt);
      // the fill follows its amnion
      fillA.position.copy(amA.position); fillA.scale.copy(amA.scale).multiplyScalar(.98); setAlpha(fillA, .07 * amA.userData.a);
      fillB.position.copy(amB.position); fillB.scale.copy(amB.scale).multiplyScalar(.98); setAlpha(fillB, .07 * amB.userData.a);
    }
    apply(1, true);
    var lc = label(host, "cho"), la = label(host, "amn"), lp = label(host, "pla");
    function update(dt, t) {
      drag.tick();
      root.rotation.y = drag.yaw + Math.sin(t * .3) * .3; root.rotation.x = drag.pitch * .6;
      apply(dt);
      fA.position.y += Math.sin(t * 1.3) * .03; fB.position.y += Math.sin(t * 1.1 + 1) * .03;
      st.scene.updateMatrixWorld();
      var tl = choA.localToWorld(V(-.55, .75, .2)), al = amA.localToWorld(V(-.2, -.95, .25)), pl = plA.localToWorld(V(.6, .3, 0));
      place(st, lc, tl, -20, -8); place(st, la, al, 0, 16); place(st, lp, pl, 40, -12);
    }
    return { start: st.start, stop: st.stop, snapshot: st.snapshot, set: function (v) { state = clamp(+v || 0, 0, 3); } };
  }

  /* ================= TTTS ================= */
  function ttts(host) {
    var st = Stage(host, { fov: 30, update: update });
    st.cam.position.set(0, 1.0, 12); st.cam.lookAt(0, .2, 0);
    lights(st.scene);
    var drag = Drag(host);
    var root = new T.Group(); root.scale.setScalar(.92); st.scene.add(root);
    var cAmn = C("--amn", "#12867c");
    // shared placenta: its fetal surface (local +y) is tilted towards the viewer
    var R = 2.1, TH = .32;
    var pl = new T.Group(); pl.position.set(0, 1.75, -1.1); pl.rotation.x = 1.05; root.add(pl);
    var disc = new T.Mesh(new T.SphereGeometry(R, 56, 24), new T.MeshPhysicalMaterial({ color: 0xa8475c, roughness: .65, clearcoat: .4 }));
    disc.scale.y = TH / R; pl.add(disc);
    function surf(x, z) { var q = 1 - (x * x + z * z) / (R * R); return TH * Math.sqrt(Math.max(0, q)) + .05; }
    function onSurf(pts) { return pts.map(function (p) { return V(p[0], surf(p[0], p[1]), p[1]); }); }
    var vesselM = new T.MeshPhysicalMaterial({ color: 0x6e2238, roughness: .4, clearcoat: .7 });
    var insR = [-.95, .35], insD = [1.0, .3];
    [[[-.95, .35], [-1.4, .9], [-1.6, 1.0]], [[-.95, .35], [-1.5, -.2], [-1.7, -.5]], [[-.95, .35], [-.8, -.6], [-.6, -1.4]],
     [[1.0, .3], [1.4, .8], [1.55, 1.1]], [[1.0, .3], [1.5, -.3], [1.6, -.6]], [[1.0, .3], [.8, -.6], [.5, -1.4]]].forEach(function (v) {
      pl.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(onSurf(v)), 30, .045, 8, false), vesselM));
    });
    var anaCurve = new T.CatmullRomCurve3(onSurf([[.95, .45], [.5, .75], [0, .85], [-.5, .75], [-.9, .5]]));
    pl.add(new T.Mesh(new T.TubeGeometry(anaCurve, 80, .075, 10, false), new T.MeshPhysicalMaterial({ color: C("--p5", "#b8730b"), roughness: .35, clearcoat: .8, emissive: C("--p5", "#b8730b"), emissiveIntensity: .3 })));
    // amniotic sacs: recipient large with hydramnios, donor small and "stuck"
    var recSac = new T.Mesh(new T.SphereGeometry(1.45, 56, 36), xray(cAmn, .05, 2, 1)); recSac.position.set(-1.15, -.55, .5);
    var recFill = new T.Mesh(new T.SphereGeometry(1.42, 40, 28), new T.MeshBasicMaterial({ color: cAmn, transparent: true, opacity: .14, depthWrite: false })); recFill.position.copy(recSac.position);
    var donSac = new T.Mesh(new T.SphereGeometry(.62, 48, 32), xray(cAmn, .05, 2, 1)); donSac.position.set(1.4, -.35, .6); donSac.scale.set(.95, 1.08, .9);
    root.add(recSac, recFill, donSac);
    var rec = fetus(C("--p6", "#e98a80")); rec.position.set(-1.15, -.6, .5); rec.scale.setScalar(1.05); rec.rotation.z = Math.PI + .3;
    var don = fetus(C("--p4", "#9ab8e0")); don.position.set(1.4, -.35, .6); don.scale.setScalar(.5); don.rotation.z = Math.PI - .2;
    root.add(rec, don);
    // umbilical cords to the insertion points
    var cordM = new T.MeshPhysicalMaterial({ color: 0xe6d3dc, roughness: .5, clearcoat: .5 });
    root.updateMatrixWorld();
    function cord(from, ins) {
      var to = root.worldToLocal(pl.localToWorld(V(ins[0], surf(ins[0], ins[1]) - .03, ins[1])));
      var mid = from.clone().lerp(to, .5).add(V(.25, 0, .35));
      root.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([from, mid, to]), 40, .06, 10, false), cordM));
    }
    cord(V(-1.1, -.55, .95), insR); cord(V(1.4, -.35, .82), insD);
    // blood cells flowing donor → recipient through the anastomosis
    var cells = [], cellM = new T.MeshPhysicalMaterial({ color: 0xff3b3b, emissive: 0xaa0000, emissiveIntensity: .5, roughness: .3 });
    for (var i = 0; i < 14; i++) { var c = new T.Mesh(new T.SphereGeometry(.085, 12, 10), cellM); c.scale.set(1, .6, 1); pl.add(c); cells.push(c); }
    var lr = label(host, "rec"), ld = label(host, "don"), lana = label(host, "ana");
    function update(dt, t) {
      drag.tick();
      root.rotation.y = drag.yaw + Math.sin(t * .3) * .25; root.rotation.x = drag.pitch * .5;
      cells.forEach(function (c, k) { var u = (t * .2 + k / cells.length) % 1; c.position.copy(anaCurve.getPointAt(u)); c.position.y += .06; });
      var s = 1 + Math.sin(t * 2) * .012; recSac.scale.setScalar(s); recFill.scale.setScalar(s);
      rec.rotation.y = Math.sin(t * .8) * .2;
      st.scene.updateMatrixWorld();
      place(st, lr, recSac.localToWorld(V(-.2, -1.25, .4)), 0, 16);
      place(st, ld, donSac.localToWorld(V(0, -1.1, .2)), 0, 16);
      place(st, lana, pl.localToWorld(anaCurve.getPointAt(.5)), 0, -48);
    }
    return { start: st.start, stop: st.stop, snapshot: st.snapshot };
  }

  function make(kind, host) {
    if (kind === "hero") return hero(host);
    if (kind === "pres") return pres(host);
    if (kind === "chor") return chor(host);
    if (kind === "ttts") return ttts(host);
    return null;
  }
})();
