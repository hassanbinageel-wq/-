/* motion.js — مفردات الحركة لأفلام seek(t)
 * كل دالة هنا دالة صافية في الزمن: لا مؤقّتات، لا CSS transitions، لا حالة محمولة بين الإطارات،
 * فأي إطار يُرسم وحده. يُحمَّل كسكربت عادي (لا ES module) لأن Chromium يمنع الـ modules عبر file://.
 * الأفكار: سبرينغ مغلق الصيغة وشبكة الإيقاع وحلقة النقد من كورس Movez (@0xMovez)، كُتبت هنا من جديد.
 */
(function (G) {
  'use strict';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const range = (t, t0, t1) => clamp((t - t0) / (t1 - t0));

  // ------------------------------------------------------------------ easings (للانتقالات فقط، لا للدخول)
  const ease = {
    out3: k => 1 - Math.pow(1 - clamp(k), 3),
    in3: k => Math.pow(clamp(k), 3),
    inOut3: k => (k = clamp(k)) < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
    power4In: k => Math.pow(clamp(k), 4),           // خروج الدرزة: يتسارع إلى القطع
    power4Out: k => 1 - Math.pow(1 - clamp(k), 4),  // دخول الدرزة: ينطلق بسرعة القطع ثم يهدأ
    nudge: k => { k = clamp(k); return k < .1 ? .5 * (k / .1) * .1 : k < .75 ? .05 + (k - .1) / .65 * .85 : .9 + ease.out3((k - .75) / .25) * .1; },
  };

  // ------------------------------------------------------------------ springs (صيغة مغلقة: بدون محاكاة)
  function spring(t, k = 170, d = 26) {
    if (t <= 0) return 0;
    const w0 = Math.sqrt(k), z = d / (2 * w0);
    if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
    }
    if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const s = Math.sqrt(z * z - 1), r1 = -w0 * (z - s), r2 = -w0 * (z + s);
    return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
  }
  // [stiffness, damping] — الواجهة قد تتجاوز شعرة، الخط الكبير لا يتجاوز أبدًا
  const SPRING = {
    snappy: [320, 30], ui: [220, 24], base: [170, 26], type: [150, 26], heavy: [90, 20], playful: [260, 14],
  };
  const sp = (t, preset = 'base') => spring(t, ...(Array.isArray(preset) ? preset : SPRING[preset]));

  /** قيمة لها عدة أهداف: [[t0,v0],[t1,v1],...] — سبرينغ واحد لكل تغيير، بدون إعادة تشغيل */
  function track(t, keys, preset = 'base') {
    let v = keys[0][1];
    for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * sp(t - keys[i][0], preset);
    return v;
  }
  /** Snap & hold: تغيّر في ~إطارين ثم ثبات تام */
  const snap = (t, t0, dur = .07) => ease.power4Out((t - t0) / dur);
  const stagger = (i, step = .08) => i * step;

  // ------------------------------------------------------------------ الإيقاع
  function grid(bpm = 120) {
    const b = 60 / bpm;
    return { bpm, beat: b, at: n => n * b, bar: n => n * 4 * b, pulse: (t, decay = .18) => { const x = ((t % b) + b) % b; return Math.exp(-x / decay * 3); } };
  }

  // ------------------------------------------------------------------ عشوائية حتمية
  function rng(seed = 1) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ------------------------------------------------------------------ DOM helpers
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  function set(el, { x = 0, y = 0, s = 1, sx, sy, r = 0, o = 1, blur = 0, origin } = {}) {
    if (!el) return;
    const scale = sx != null || sy != null ? `scale(${sx ?? s},${sy ?? s})` : `scale(${s})`;
    el.style.transform = `translate(${x}px,${y}px) ${scale} rotate(${r}deg)`;
    el.style.opacity = o;
    el.style.filter = blur > .05 ? `blur(${blur}px)` : 'none';
    if (origin) el.style.transformOrigin = origin;
  }
  const show = (el, on) => { if (el) el.style.visibility = on ? 'visible' : 'hidden'; };

  // ------------------------------------------------------------------ الطباعة العربية
  // قاعدة: لا تقسّم الكلمة العربية إلى حروف أبدًا — يكسر الوصل والتشكيل. التحريك على مستوى الكلمة،
  // وكشف الحروف يتم بقناع clip-path من اليمين على الكلمة كاملة.
  function words(el, text) {
    el.innerHTML = '';
    el.setAttribute('dir', 'rtl');
    return text.split(/\s+/).filter(Boolean).map((w, i, a) => {
      const s = document.createElement('span');
      s.className = 'w'; s.textContent = w; s.style.display = 'inline-block';
      el.appendChild(s);
      if (i < a.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
  }
  /** دخول كلمة: ترتفع على سبرينغ type وتتّضح من ضبابية خفيفة */
  function wordIn(el, t, at, { preset = 'type', rise = 48, from = 1.16, blur = 14 } = {}) {
    const s = sp(t - at, preset), p = clamp((t - at) / .1);
    set(el, { y: (1 - s) * rise, s: lerp(from, 1, s), o: p, blur: (1 - clamp(s * 1.25)) * blur });
    return s;
  }
  /** خروج كلمة: تتسارع للخارج حتى يقع القطع على أعلى سرعة */
  function wordOut(el, t, at, { dur = .16, lift = -36, to = 1.08, blur = 12 } = {}) {
    const p = ease.power4In((t - at) / dur);
    if (p <= 0) return 0;
    set(el, { y: p * lift, s: lerp(1, to, p), o: 1 - p, blur: p * blur });
    return p;
  }
  /** Slam: الكلمة تهبط من حجم كبير وتستقر بثقل (heavy) — للحظات الضرب على الإيقاع */
  function slam(el, t, at, { from = 2.2, preset = 'heavy' } = {}) {
    const s = sp(t - at, preset);
    set(el, { s: lerp(from, 1, s), o: clamp((t - at) / .05), blur: (1 - clamp(s * 1.4)) * 18 });
    return s;
  }
  /** كشف من اليمين لليسار (اتجاه القراءة العربية) بقناع على العنصر كاملًا */
  function revealRTL(el, p) { el.style.clipPath = `inset(-20% 0 -20% ${(1 - clamp(p)) * 100}%)`; }
  function revealLTR(el, p) { el.style.clipPath = `inset(-20% ${(1 - clamp(p)) * 100}% -20% 0)`; }
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const arDigits = (n) => String(n).replace(/\d/g, d => AR_DIGITS[d]);
  /** عدّاد متسارع: يصل للرقم النهائي على سبرينغ ثم يثبت */
  const counter = (t, at, to, { preset = 'base', arabic = true, from = 0 } = {}) => {
    const v = Math.round(lerp(from, to, clamp(sp(t - at, preset))));
    return arabic ? arDigits(v) : String(v);
  };

  // ------------------------------------------------------------------ الدرزات (seams) والكاميرا
  /** قانون المتّجه: مشهد A يخرج بتسارع، B يدخل بنفس السرعة والاتجاه — القطع يقع في منتصف الحركة */
  const seamOut = (t, at, dur = .22, dist = 600) => ease.power4In((t - (at - dur)) / dur) * dist;
  const seamIn = (t, at, dur = .22, dist = 600) => (1 - ease.power4Out((t - at) / dur)) * -dist;
  /** ضربة كاميرا: اهتزاز يخمد + زوم قصير، حتمي */
  function impact(t, hits, { amp = 18, zoom = .06, decay = .22 } = {}) {
    let x = 0, y = 0, z = 0;
    for (const h of hits) {
      const d = t - h; if (d < 0 || d > decay * 3) continue;
      const e = Math.exp(-d / decay * 2.5);
      x += Math.sin(d * 90 + h) * amp * e; y += Math.cos(d * 77 + h * 3) * amp * e; z += zoom * e;
    }
    return { x, y, s: 1 + z };
  }
  /** نافذة المشهد: هل t داخل [a,b) */
  const within = (t, a, b) => t >= a && t < b;

  G.M = { clamp, lerp, range, ease, spring, SPRING, sp, track, snap, stagger, grid, rng, hash, $, $$, set, show,
    words, wordIn, wordOut, slam, revealRTL, revealLTR, arDigits, counter, seamOut, seamIn, impact, within };
})(window);
