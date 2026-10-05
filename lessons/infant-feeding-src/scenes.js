/* 3D scenes for the lesson (three.js r149, bundled). Each scene renders only while its slide is active. */
(function () {
  "use strict";
  var T = window.THREE;

  function hasGL() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) { return false; }
  }
  var OK = !!T && hasGL();
  window.IFL3D = { ok: OK, make: make };
  if (!OK) return;

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function C(n, fb) { var v = css(n); try { return new T.Color(v || fb); } catch (e) { return new T.Color(fb); } }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeInOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOutBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function lathe(pts, seg) { return new T.LatheGeometry(pts.map(function (p) { return new T.Vector2(p[0], p[1]); }), seg || 64); }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* Bottle profiles (radius, height). The milk profile runs up into the teat so the teat can fill. */
  var BOTTLE_OUT = [[0, 0], [.42, 0], [.52, .06], [.56, .18], [.56, 1.9], [.5, 2.08], [.43, 2.2], [.43, 2.32]];
  var TEAT = [[.40, 2.58], [.39, 2.68], [.27, 2.8], [.14, 2.95], [.12, 3.12], [.10, 3.28], [.06, 3.35], [0, 3.37]];
  var MILK = [[0, .03], [.4, .03], [.5, .09], [.53, .2], [.53, 1.88], [.47, 2.06], [.4, 2.18], [.39, 2.6], [.36, 2.69], [.25, 2.79], [.12, 2.94], [.1, 3.12], [.08, 3.26], [.045, 3.32], [0, 3.33]];

  function lights(scene) {
    scene.add(new T.HemisphereLight(0xffffff, 0x8899aa, .85));
    var d = new T.DirectionalLight(0xffffff, .95); d.position.set(4, 6, 8); scene.add(d);
    var d2 = new T.DirectionalLight(0xffffff, .35); d2.position.set(-6, -2, 4); scene.add(d2);
  }

  /* "X-ray" rim material: transparent in the middle, bright at the silhouette. */
  function xray(color, base, pow, alpha) {
    return new T.ShaderMaterial({
      uniforms: { uColor: { value: color }, uBase: { value: base }, uPow: { value: pow }, uAlpha: { value: alpha } },
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform vec3 uColor; uniform float uBase; uniform float uPow; uniform float uAlpha; varying vec3 vN; varying vec3 vV; void main(){ float r = 1.0 - abs(dot(normalize(vN), normalize(vV))); float a = uBase + pow(r, uPow); gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0) * uAlpha); }",
      transparent: true, depthWrite: false, side: T.DoubleSide
    });
  }

  var blobTexture = null;
  function blob(w) {
    if (!blobTexture) {
      var c = document.createElement("canvas"); c.width = c.height = 128;
      var g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(0,0,0,0.32)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      blobTexture = new T.CanvasTexture(c);
    }
    return new T.Mesh(new T.PlaneGeometry(w, w * .3), new T.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false }));
  }

  function Stage(host, o) {
    var canvas = host.querySelector("canvas");
    var r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setClearColor(0x000000, 0);
    r.localClippingEnabled = !!o.clip;
    var scene = new T.Scene();
    var cam = new T.PerspectiveCamera(o.fov || 30, 1, .1, 100);
    var st = { r: r, scene: scene, cam: cam, host: host, w: 0, h: 0, running: false };
    function resize() {
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h || (w === st.w && h === st.h)) return;
      st.w = w; st.h = h;
      r.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    var last = 0, t = 0;
    function loop(now) {
      if (!st.running) return;
      var dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now; t += dt;
      resize();
      o.update(dt, t);
      r.render(scene, cam);
      if (o.after) o.after();
      requestAnimationFrame(loop);
    }
    st.start = function () { if (st.running) return; st.running = true; last = performance.now(); resize(); requestAnimationFrame(loop); };
    st.stop = function () { st.running = false; };
    st.project = function (v) { var p = v.clone().project(cam); return { x: (p.x * .5 + .5) * st.w, y: (-p.y * .5 + .5) * st.h, z: p.z }; };
    return st;
  }

  function Drag(el, yawOnly) {
    var s = { yaw: 0, pitch: 0, vy: 0, down: false }, px = 0, py = 0;
    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button,input,label")) return;
      s.down = true; px = e.clientX; py = e.clientY;
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
    });
    el.addEventListener("pointermove", function (e) {
      if (!s.down) return;
      var dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
      s.yaw += dx * .01; s.vy = dx * .01;
      if (!yawOnly) s.pitch = clamp(s.pitch + dy * .006, -.45, .45);
    });
    function up() { s.down = false; }
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    s.tick = function () { if (!s.down) { s.yaw += s.vy; s.vy *= .92; } };
    return s;
  }

  function label(host, key) { return host.querySelector('.lbl3d[data-l="' + key + '"]'); }
  function placeLabel(st, el, world, dx, dy) {
    if (!el) return;
    var p = st.project(world);
    el.style.transform = "translate(" + (p.x + (dx || 0)).toFixed(1) + "px," + (p.y + (dy || 0)).toFixed(1) + "px) translate(-50%,-50%)";
  }

  /* ================= Hero: four floating objects, one per part ================= */
  function hero(host) {
    var st = Stage(host, { fov: 30, update: update });
    st.cam.position.set(0, 0, 12.5);
    lights(st.scene);
    var root = new T.Group(); st.scene.add(root);
    var objs = [], hl = -1, px = 0, py = 0, t0 = null;

    function glossy(v) { return new T.MeshPhysicalMaterial({ color: C(v, "#888"), roughness: .28, metalness: 0, clearcoat: 1, clearcoatRoughness: .16 }); }
    var mats = { p1: glossy("--p1"), p2: glossy("--p2"), p3: glossy("--p3"), p4: glossy("--p4") };

    // 1 · milk drop
    var dp = []; for (var i = 0; i <= 48; i++) { var a = i / 48 * Math.PI; dp.push([Math.sin(a) * Math.sin(a / 2) * .95, Math.cos(a) * 1.25]); }
    var drop = new T.Mesh(lathe(dp, 72), mats.p1); drop.rotation.z = .28;
    // 2 · bottle
    var bottle = new T.Group();
    var bin = new T.Group(); bin.position.y = -1.7; bottle.add(bin);
    bin.add(new T.Mesh(lathe(BOTTLE_OUT, 64), mats.p2));
    var collar = new T.Mesh(new T.CylinderGeometry(.47, .47, .3, 48), new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: .3, clearcoat: 1 })); collar.position.y = 2.45; bin.add(collar);
    bin.add(new T.Mesh(lathe(TEAT, 48), new T.MeshPhysicalMaterial({ color: 0xf2d3a2, roughness: .45, clearcoat: .6 })));
    bottle.scale.setScalar(.62); bottle.rotation.z = -.3;
    // 3 · feeding tube coil
    var cp = []; for (i = 0; i <= 80; i++) { var k = i / 80, an = k * Math.PI * 4.2, rr = .78 - k * .28; cp.push(V(Math.cos(an) * rr, (k - .5) * 1.7, Math.sin(an) * rr)); }
    var tube = new T.Group();
    tube.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(cp), 260, .1, 16, false), mats.p3));
    var con = new T.Mesh(new T.CylinderGeometry(.17, .14, .42, 24), new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: .3, clearcoat: 1 }));
    con.position.copy(cp[cp.length - 1]); con.position.y += .2; tube.add(con);
    tube.rotation.x = .35;
    // 4 · spoon
    var spoon = new T.Group();
    var bowl = new T.Mesh(new T.SphereGeometry(.62, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mats.p4);
    bowl.material.side = T.DoubleSide; bowl.scale.set(1, .32, 1.35); bowl.rotation.x = Math.PI; spoon.add(bowl);
    var puree = new T.Mesh(new T.SphereGeometry(.42, 32, 16), new T.MeshPhysicalMaterial({ color: 0xf3b16b, roughness: .6, clearcoat: .3 }));
    puree.scale.set(1, .32, 1.25); puree.position.y = -.04; spoon.add(puree);
    var handle = new T.Mesh(new T.CapsuleGeometry(.08, 1.9, 8, 16), mats.p4); handle.rotation.x = Math.PI / 2; handle.position.set(0, .05, 1.75); spoon.add(handle);
    spoon.rotation.set(.85, .5, -.2); spoon.scale.setScalar(1.05);

    [[drop, -1.8, 1.35], [bottle, 1.85, 1.25], [tube, -1.8, -1.45], [spoon, 1.75, -1.35]].forEach(function (d, idx) {
      var holder = new T.Group(), spin = new T.Group();
      spin.add(d[0]); holder.add(spin); holder.position.set(d[1], d[2], 0);
      var sh = blob(2.2); sh.position.set(d[1], d[2] - 1.35, -.6);
      root.add(holder); root.add(sh);
      objs.push({ g: holder, spin: spin, sh: sh, y: d[2], s: 1 });
    });

    host.addEventListener("pointermove", function (e) {
      var b = host.getBoundingClientRect();
      px = ((e.clientX - b.left) / b.width) * 2 - 1; py = ((e.clientY - b.top) / b.height) * 2 - 1;
    });
    host.addEventListener("pointerleave", function () { px = 0; py = 0; });

    function update(dt, t) {
      if (t0 === null) t0 = t;
      var e = t - t0;
      objs.forEach(function (o, i) {
        var k = clamp((e - .15 - i * .16) / .9, 0, 1), s = k <= 0 ? .0001 : easeOutBack(k);
        o.s += ((i === hl ? 1.2 : 1) - o.s) * Math.min(1, dt * 6);
        o.g.scale.setScalar(Math.max(.0001, s * o.s));
        var bob = Math.sin(t * 1.1 + i * 1.7) * .13;
        o.g.position.y = o.y + bob;
        o.spin.rotation.y += dt * (i === hl ? 1.8 : .45);
        o.sh.scale.set(1 - bob * .6, 1 - bob * .6, 1);
        o.sh.material.opacity = clamp(k, 0, 1) * (1 - bob);
      });
      root.rotation.y += (px * .35 - root.rotation.y) * Math.min(1, dt * 3);
      root.rotation.x += (py * .18 - root.rotation.x) * Math.min(1, dt * 3);
    }
    return {
      start: function () { t0 = null; st.start(); },
      stop: st.stop,
      highlight: function (i) { hl = i; },
      retheme: function () { mats.p1.color.copy(C("--p1")); mats.p2.color.copy(C("--p2")); mats.p3.color.copy(C("--p3")); mats.p4.color.copy(C("--p4")); }
    };
  }

  /* ================= NG tube: X-ray infant with the tube travelling nose → stomach ================= */
  function ng(host) {
    var st = Stage(host, { fov: 30, update: update, after: after });
    st.cam.position.set(0, .7, 11.6); st.cam.lookAt(0, .65, 0);
    lights(st.scene);
    var root = new T.Group(); st.scene.add(root);
    var drag = Drag(host, false);

    var bodyM = xray(C("--muted"), .02, 2.2, .9);
    var head = new T.Mesh(new T.SphereGeometry(1, 64, 48), bodyM); head.position.set(0, 2.25, 0); head.scale.set(.95, 1.05, 1); root.add(head);
    var nose = new T.Mesh(new T.SphereGeometry(.16, 24, 16), bodyM); nose.position.set(0, 2.13, .98); nose.scale.set(.8, 1, 1.1); root.add(nose);
    [-1, 1].forEach(function (sx) { var ear = new T.Mesh(new T.SphereGeometry(.18, 24, 16), bodyM); ear.position.set(sx * .95, 2.2, 0); ear.scale.set(.5, 1, .8); root.add(ear); });
    var neck = new T.Mesh(new T.CylinderGeometry(.42, .48, .6, 40, 1, true), bodyM); neck.position.set(0, 1.15, -.05); root.add(neck);
    var torso = new T.Mesh(new T.CapsuleGeometry(.95, 1.3, 16, 48), bodyM); torso.position.set(0, -.35, 0); torso.scale.set(1, 1, .72); root.add(torso);

    var esoCurve = new T.CatmullRomCurve3([V(0, 2.02, .25), V(0, 1.72, .04), V(0, 1.25, -.12), V(0, .6, -.22), V(0, 0, -.2), V(.1, -.42, -.1)]);
    var esoM = xray(C("--p3"), .06, 1.5, .85);
    root.add(new T.Mesh(new T.TubeGeometry(esoCurve, 80, .11, 16, false), esoM));
    var airM = xray(C("--p2"), .03, 1.8, .7);
    var trachea = new T.CatmullRomCurve3([V(0, 1.68, .26), V(0, 1.2, .3), V(0, .62, .32)]);
    root.add(new T.Mesh(new T.TubeGeometry(trachea, 40, .09, 14, false), airM));
    [-1, 1].forEach(function (sx) {
      var lung = new T.Mesh(new T.SphereGeometry(.5, 32, 24), airM); lung.position.set(sx * .56, .02, .12); lung.scale.set(.78, 1.25, .7); root.add(lung);
    });
    var stomach = new T.Mesh(new T.SphereGeometry(.55, 40, 28), new T.MeshStandardMaterial({ color: 0xe8899b, roughness: .55, transparent: true, opacity: .55, depthWrite: false }));
    stomach.position.set(.42, -.62, 0); stomach.scale.set(1.25, .85, .8); stomach.rotation.z = -.5; root.add(stomach);

    var tubePts = [V(.9, .95, .75), V(.85, 1.45, .58), V(.72, 1.85, .6), V(.32, 2.05, .97), V(.06, 2.08, 1.07), V(0, 2.06, .7), V(0, 2.0, .3), V(0, 1.72, .06), V(0, 1.25, -.1), V(0, .6, -.2), V(0, 0, -.2), V(.1, -.42, -.1), V(.32, -.62, 0), V(.55, -.68, .05)];
    var curve = new T.CatmullRomCurve3(tubePts, false, "centripetal");
    var tubeGeo = new T.TubeGeometry(curve, 320, .042, 10, false);
    var tubeM = new T.MeshStandardMaterial({ color: C("--p3"), emissive: C("--p3"), emissiveIntensity: .25, roughness: .35 });
    var tubeMesh = new T.Mesh(tubeGeo, tubeM); root.add(tubeMesh);
    var total = tubeGeo.index.count;
    var tip = new T.Mesh(new T.SphereGeometry(.075, 20, 14), new T.MeshBasicMaterial({ color: 0xffffff })); root.add(tip);
    var glow = new T.Mesh(new T.SphereGeometry(.16, 20, 14), new T.MeshBasicMaterial({ color: C("--p3"), transparent: true, opacity: .35, depthWrite: false })); root.add(glow);
    var con = new T.Mesh(new T.CylinderGeometry(.09, .07, .34, 20), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .4 }));
    con.position.copy(tubePts[0]); con.position.y -= .12; root.add(con);
    var tape = new T.Mesh(new T.BoxGeometry(.34, .16, .025), new T.MeshStandardMaterial({ color: 0xf5f1e6, roughness: .8 }));
    tape.position.set(.73, 1.86, .62); tape.lookAt(V(1.6, 1.6, 1.4)); root.add(tape);

    var anchors = { nose: V(.06, 2.12, 1.12), eso: V(0, .85, -.22), stom: V(.55, -.75, .2), air: V(0, 1.0, .34) };
    var offs = { nose: [-50, -22], eso: [-78, 14], stom: [48, 20], air: [70, -18] };
    var shows = { nose: .18, eso: .55, stom: .93, air: .55 };
    var els = {}; Object.keys(anchors).forEach(function (k) { els[k] = label(host, k); });

    var p = 0, playing = false, pStart = 0, BASE_YAW = -.95;
    function update(dt, t) {
      drag.tick();
      root.rotation.y = BASE_YAW + Math.sin(t * .35) * .3 + drag.yaw;
      root.rotation.x = drag.pitch * .6;
      if (playing) {
        if (pStart === null) pStart = t;
        var k = clamp((t - pStart - .4) / 5, 0, 1); p = easeInOut(k); if (k >= 1) playing = false;
      }
      var cnt = Math.max(0, Math.floor(total * p / 3) * 3);
      tubeGeo.setDrawRange(0, cnt);
      var pos = curve.getPointAt(clamp(p, .001, 1));
      tip.position.copy(pos); glow.position.copy(pos);
      var pulse = 1 + Math.sin(t * 6) * .25; glow.scale.setScalar(pulse);
      tip.visible = glow.visible = p > .002;
    }
    var tmp = new T.Vector3();
    function after() {
      root.updateMatrixWorld();
      Object.keys(anchors).forEach(function (k) {
        if (!els[k]) return;
        tmp.copy(anchors[k]); root.localToWorld(tmp);
        placeLabel(st, els[k], tmp, offs[k][0], offs[k][1]);
        els[k].classList.toggle("on", p >= shows[k]);
      });
    }
    function replay() { p = 0; playing = true; pStart = null; }
    return {
      start: function () { replay(); st.start(); },
      stop: st.stop,
      replay: replay,
      retheme: function () {
        bodyM.uniforms.uColor.value.copy(C("--muted")); esoM.uniforms.uColor.value.copy(C("--p3")); airM.uniforms.uColor.value.copy(C("--p2"));
        tubeM.color.copy(C("--p3")); tubeM.emissive.copy(C("--p3")); glow.material.color.copy(C("--p3"));
      },
      _st: st
    };
  }

  /* ================= Bottle: semi-upright baby, tilted bottle, milk that obeys gravity ================= */
  function bottle(host) {
    var plane = new T.Plane(V(0, -1, 0), 0);
    var st = Stage(host, { fov: 30, clip: true, update: update, after: after });
    st.cam.position.set(.55, .2, 12.2); st.cam.lookAt(.55, .2, 0);
    lights(st.scene);
    var world = new T.Group(); st.scene.add(world);
    var drag = Drag(host, true);

    // Baby
    var skinM = new T.MeshStandardMaterial({ color: 0xf1c49c, roughness: .65 });
    var head = new T.Mesh(new T.SphereGeometry(.72, 48, 32), skinM); head.position.set(-.78, .14, 0); world.add(head);
    var ear = new T.Mesh(new T.SphereGeometry(.16, 20, 14), skinM); ear.position.set(-.9, .1, .66); ear.scale.set(.8, 1, .45); world.add(ear);
    var noseB = new T.Mesh(new T.SphereGeometry(.08, 16, 12), skinM); noseB.position.set(-.07, .2, .05); world.add(noseB);
    var eye = new T.Mesh(new T.TorusGeometry(.075, .018, 8, 20, Math.PI), new T.MeshBasicMaterial({ color: 0x3b2a20 }));
    eye.position.set(-.33, .38, .52); eye.rotation.set(0, .5, Math.PI); world.add(eye);
    var blush = new T.Mesh(new T.SphereGeometry(.13, 16, 12), new T.MeshBasicMaterial({ color: 0xf29a9a, transparent: true, opacity: .55, depthWrite: false }));
    blush.position.set(-.4, .02, .56); blush.scale.set(1, .6, .35); world.add(blush);
    var curl = new T.Mesh(new T.TorusGeometry(.12, .035, 8, 24, Math.PI * 1.5), new T.MeshStandardMaterial({ color: 0x8a5a3a, roughness: .8 }));
    curl.position.set(-.86, .87, .1); curl.rotation.set(1.2, 0, .4); world.add(curl);
    var clothM = new T.MeshStandardMaterial({ color: C("--p2").lerp(new T.Color(0xffffff), .55), roughness: .8 });
    var bodyB = new T.Mesh(new T.CapsuleGeometry(.58, 1.0, 12, 32), clothM); bodyB.position.set(-1.48, -1.42, 0); bodyB.rotation.z = -.61; world.add(bodyB);
    var arm = new T.Mesh(new T.CapsuleGeometry(.15, .62, 8, 16), clothM); arm.position.set(-.95, -1.0, .45); arm.rotation.z = -1.15; world.add(arm);
    var hand = new T.Mesh(new T.SphereGeometry(.16, 16, 12), skinM); hand.position.set(-.55, -.78, .5); world.add(hand);

    // Bottle: pivot sits at the baby's mouth; the inner group puts the teat tip on the pivot
    var pivot = new T.Group(); pivot.position.set(-.1, .02, 0); world.add(pivot);
    var inner = new T.Group(); inner.position.y = -3.37; pivot.add(inner);
    var milkF = new T.Mesh(lathe(MILK, 64), new T.MeshStandardMaterial({ color: 0xf7eedb, roughness: .4, clippingPlanes: [plane] }));
    var milkB = new T.Mesh(lathe(MILK, 64), new T.MeshBasicMaterial({ color: 0xeedfbe, side: T.BackSide, clippingPlanes: [plane] }));
    milkF.renderOrder = 1; milkB.renderOrder = 1; inner.add(milkB); inner.add(milkF);
    var glassM = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: .05, transparent: true, opacity: .14, depthWrite: false });
    var glass = new T.Mesh(lathe(BOTTLE_OUT, 64), glassM); glass.renderOrder = 3; inner.add(glass);
    var rimM = xray(C("--muted"), .0, 2.6, .8);
    var rim = new T.Mesh(lathe(BOTTLE_OUT, 64), rimM); rim.renderOrder = 4; inner.add(rim);
    var collarM = new T.MeshStandardMaterial({ color: C("--p2"), roughness: .35 });
    var collar = new T.Mesh(new T.CylinderGeometry(.46, .46, .3, 48), collarM); collar.position.y = 2.45; inner.add(collar);
    var teat = new T.Mesh(lathe(TEAT, 48), new T.MeshStandardMaterial({ color: 0xe8c48a, roughness: .4, transparent: true, opacity: .45, depthWrite: false }));
    teat.renderOrder = 2; inner.add(teat);
    [.7, 1.2, 1.7].forEach(function (y) {
      var tk = new T.Mesh(new T.TorusGeometry(.565, .01, 6, 64, Math.PI * .5), new T.MeshBasicMaterial({ color: C("--muted"), transparent: true, opacity: .7 }));
      tk.rotation.x = Math.PI / 2; tk.rotation.z = Math.PI * .25; tk.position.y = y; inner.add(tk);
    });

    // Uniform samples of the milk volume, used to find a gravity-correct milk level for any tilt
    var R = rng(7), samples = [], teatIdx = [];
    function rAt(y) {
      for (var i = 0; i < MILK.length - 1; i++) {
        var a = MILK[i], b = MILK[i + 1];
        if (y >= a[1] && y <= b[1]) { var k = (y - a[1]) / ((b[1] - a[1]) || 1); return a[0] + (b[0] - a[0]) * k; }
      }
      return 0;
    }
    while (samples.length < 3200) {
      var y = .03 + R() * 3.3, x = (R() * 2 - 1) * .53, z = (R() * 2 - 1) * .53, ra = rAt(y);
      if (x * x + z * z < ra * ra) { if (y > 2.62) teatIdx.push(samples.length); samples.push(V(x, y, z)); }
    }
    var ys = new Float32Array(samples.length), tmp = new T.Vector3(), FILL = .42;
    function settle() {
      world.updateMatrixWorld(true);
      var m = inner.matrixWorld;
      for (var i = 0; i < samples.length; i++) { tmp.copy(samples[i]).applyMatrix4(m); ys[i] = tmp.y; }
      var sorted = Array.prototype.slice.call(ys).sort(function (a, b) { return a - b; });
      var level = sorted[Math.floor(FILL * sorted.length)];
      plane.constant = level;
      var full = 0; teatIdx.forEach(function (i) { if (ys[i] <= level) full++; });
      return full / teatIdx.length;
    }

    var beta = 32, target = 32, lastBeta = null, frac = 1;
    var status = host.querySelector("#tiltStatus");
    var lblSemi = document.createElement("span"); lblSemi.className = "lbl3d on"; lblSemi.textContent = "Semi-upright"; host.appendChild(lblSemi);
    var lblNip = document.createElement("span"); lblNip.className = "lbl3d on"; lblNip.textContent = "Nipple"; host.appendChild(lblNip);

    function update(dt, t) {
      drag.tick();
      world.rotation.y = clamp(drag.yaw * .6, -.9, .9) + Math.sin(t * .3) * .06;
      beta += (target - beta) * Math.min(1, dt * 4);
      pivot.rotation.z = (90 + beta) * Math.PI / 180;
      if (lastBeta === null || Math.abs(beta - lastBeta) > .05 || drag.down || Math.abs(drag.vy) > .0005) { frac = settle(); lastBeta = beta; }
      if (status) {
        var good = frac > .97;
        status.textContent = good ? "Nipple filled with milk ✓" : "Air in the nipple ✕";
        status.classList.toggle("good", good); status.classList.toggle("miss", !good);
      }
    }
    function after() {
      tmp.set(-1.3, -1.15, .6); world.localToWorld(tmp); placeLabel(st, lblSemi, tmp, -40, 0);
      tmp.set(0, 2.95, 0); inner.localToWorld(tmp); placeLabel(st, lblNip, tmp, 0, -30);
    }
    return {
      start: function () { lastBeta = null; st.start(); },
      stop: st.stop,
      setTilt: function (v) { target = clamp(+v, -10, 50); },
      retheme: function () { rimM.uniforms.uColor.value.copy(C("--muted")); collarM.color.copy(C("--p2")); clothM.color.copy(C("--p2").lerp(new T.Color(0xffffff), .55)); }
    };
  }

  function make(kind, host) {
    if (kind === "hero") return hero(host);
    if (kind === "ng") return ng(host);
    if (kind === "bottle") return bottle(host);
    return null;
  }
})();
