(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Header: becomes solid on scroll
  var header = $('#siteHeader');
  var onScroll = function () { if (header) header.classList.toggle('scrolled', window.scrollY > 10); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Light / dark toggle (remembered in this browser)
  var themeBtn = $('#themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var d = document.documentElement, t = d.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      d.setAttribute('data-theme', t);
      try { localStorage.setItem('hsn-theme', t); } catch (e) {}
      var m = document.querySelector('meta[name=theme-color]');
      if (m) m.setAttribute('content', t === 'dark' ? '#070b16' : '#f6f8fc');
    });
  }

  // Work videos play inside the site: on hover (desktop) or when visible (phones)
  var vids = $$('video[data-hover-play]');
  if (vids.length) {
    var canHover = window.matchMedia && matchMedia('(hover: hover)').matches;
    // The card switches to the video only once frames are actually playing (no black flash)
    vids.forEach(function (v) {
      v.addEventListener('playing', function () { var c = v.closest('.work-card'); if (c && !v.paused) c.classList.add('playing'); });
    });
    var play = function (v) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); };
    var stop = function (v) { v.pause(); var c = v.closest('.work-card'); if (c) c.classList.remove('playing'); };
    if (canHover) {
      vids.forEach(function (v) {
        var card = v.closest('.work-card') || v;
        card.addEventListener('mouseenter', function () { play(v); });
        card.addEventListener('mouseleave', function () { stop(v); });
      });
    } else if ('IntersectionObserver' in window) {
      var vio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.intersectionRatio >= 0.6) play(en.target); else stop(en.target); });
      }, { threshold: [0, 0.6] });
      vids.forEach(function (v) { vio.observe(v); });
    }
  }

  // Timeline: the line fills as you scroll through the story
  var tl = $('#timeline');
  if (tl) {
    var tick = false;
    var upd = function () {
      tick = false;
      var r = tl.getBoundingClientRect(), vh = window.innerHeight;
      var p = Math.min(1, Math.max(0, (vh * 0.65 - r.top) / r.height));
      tl.style.setProperty('--p', p.toFixed(3));
    };
    upd();
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    window.addEventListener('resize', upd);
  }

  // Before / after comparison: drag (or use the keyboard) to reveal
  $$('[data-compare]').forEach(function (c) {
    var r = c.querySelector('.cmp-range');
    if (r) r.addEventListener('input', function () { c.style.setProperty('--pos', r.value + '%'); });
  });

  // Reading progress bar on articles
  var readBar = document.getElementById('readBar'), art = document.getElementById('article');
  if (readBar && art) {
    var rp = function () { var r = art.getBoundingClientRect(), h = r.height - window.innerHeight; readBar.style.width = (h > 0 ? Math.min(100, Math.max(0, -r.top / h * 100)) : 100) + '%'; };
    rp(); window.addEventListener('scroll', rp, { passive: true });
  }

  // Product page: switch the main image from the thumbnails
  var pMain = document.getElementById('productMain');
  $$('.product-thumbs button').forEach(function (t) {
    t.addEventListener('click', function () {
      if (!pMain) return;
      pMain.src = t.dataset.src;
      $$('.product-thumbs button').forEach(function (x) { x.classList.toggle('on', x === t); });
    });
  });

  // Banner live preview from the dashboard (only messages from this same site are accepted)
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || !e.data.heroPreview) return;
    var d = e.data.heroPreview, pt = $('.portrait');
    if (pt) {
      pt.className = 'portrait shape-' + (d.shape || 'portrait');
      if (d.size) pt.style.setProperty('--pw', d.size + 'px');
      var ring = $('.portrait-ring', pt);
      if (d.ring && !ring) { ring = document.createElement('div'); ring.className = 'portrait-ring'; pt.insertBefore(ring, pt.firstChild); }
      if (ring) ring.style.display = d.ring ? '' : 'none';
      var img = $(':scope > img', pt), orb = $('.orb', pt);
      if (d.img && !d.removeImg) {
        if (!img) { img = document.createElement('img'); img.alt = ''; if (orb) orb.replaceWith(img); else pt.appendChild(img); }
        img.src = d.img;
      }
    }
    var h1 = $('.hero h1');
    if (h1 && d.title != null) {
      h1.textContent = d.title;
      if (d.highlight && d.title.indexOf(d.highlight) >= 0) {
        var i = d.title.indexOf(d.highlight), sp = document.createElement('span');
        sp.className = 'grad'; sp.textContent = d.highlight;
        h1.textContent = d.title.slice(0, i); h1.appendChild(sp); h1.appendChild(document.createTextNode(d.title.slice(i + d.highlight.length)));
      }
    }
    var lead = $('.hero .lead'); if (lead && d.subtitle != null) lead.textContent = d.subtitle;
    var b1 = $('.hero-cta .btn-primary'); if (b1 && d.cta != null && b1.firstChild) b1.firstChild.nodeValue = d.cta;
    var b2 = $('.hero-cta .btn-ghost'); if (b2 && d.cta2 != null) b2.textContent = d.cta2;
  });

  // Mobile menu
  var menuBtn = $('#menuBtn'), nav = $('#nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('open'); }); });
    document.addEventListener('click', function (e) { if (!nav.contains(e.target) && !menuBtn.contains(e.target)) nav.classList.remove('open'); });
  }

  // Reveal on scroll
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  // Highlight the current section in the menu
  var spyLinks = $$('[data-spy]');
  if (spyLinks.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          spyLinks.forEach(function (l) { l.classList.toggle('active', l.dataset.spy === en.target.id); });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    spyLinks.forEach(function (l) { var s = document.getElementById(l.dataset.spy); if (s) spy.observe(s); });
  }

  // Animated counters for stats
  var counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && document.documentElement.classList.contains('motion')) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        cio.unobserve(en.target);
        var el = en.target, raw = el.dataset.count, m = raw.match(/^(\D*)([\d.,]+)(.*)$/);
        if (!m) return;
        var target = parseFloat(m[2].replace(/,/g, '')), dec = (m[2].split('.')[1] || '').length, start = null, dur = 1400;
        var step = function (t) {
          if (!start) start = t;
          var p = Math.min((t - start) / dur, 1), eased = 1 - Math.pow(1 - p, 3);
          el.textContent = m[1] + (target * eased).toFixed(dec) + m[3];
          if (p < 1) requestAnimationFrame(step); else el.textContent = raw;
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (c) { cio.observe(c); });
  }

  // Category filters
  $$('[data-filter]').forEach(function (bar) {
    var grid = document.getElementById(bar.dataset.filter);
    if (!grid) return;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      $$('button', bar).forEach(function (x) { x.classList.toggle('active', x === b); });
      var f = b.dataset.f;
      Array.prototype.forEach.call(grid.children, function (el) {
        var show = f === '*' || el.dataset.cat === f;
        el.classList.toggle('is-hidden', !show);
        if (show) { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); }
      });
      var empty = grid.parentNode.querySelector('.filter-empty');
      if (empty) empty.hidden = Array.prototype.some.call(grid.children, function (el) { return !el.classList.contains('is-hidden'); });
    });
  });

  // Prompt search
  var ps = $('#promptSearch');
  if (ps) {
    ps.addEventListener('input', function () {
      var q = ps.value.trim().toLowerCase();
      $$('#promptsGrid > *').forEach(function (el) { el.classList.toggle('is-hidden', q && el.textContent.toLowerCase().indexOf(q) === -1); });
    });
  }

  // Copy
  var copyText = function (text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res) {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); res();
    });
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    copyText(b.dataset.copy).then(function () {
      var label = b.querySelector('span'), old = label ? label.textContent : '';
      b.classList.add('copied');
      if (label) label.textContent = 'تم النسخ ✓';
      setTimeout(function () { b.classList.remove('copied'); if (label) label.textContent = old; }, 1800);
    });
  });

  // Simple lightbox for the gallery
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-lightbox]');
    if (!a) return;
    e.preventDefault();
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = '<img alt="">';
    lb.firstChild.src = a.href;
    document.body.appendChild(lb);
    requestAnimationFrame(function () { lb.classList.add('open'); });
    var close = function () { lb.classList.remove('open'); setTimeout(function () { lb.remove(); }, 350); document.removeEventListener('keydown', esc); };
    var esc = function (ev) { if (ev.key === 'Escape') close(); };
    lb.addEventListener('click', close);
    document.addEventListener('keydown', esc);
  });

  // Contact form (with optional email verification code)
  var form = $('#contactForm');
  if (form && window.fetch) {
    var msg = $('.form-msg', form), token = '';
    var steps = { form: $('.step-form', form), code: $('.step-code', form), done: $('.step-done', form) };
    var show = function (k) { Object.keys(steps).forEach(function (x) { if (steps[x]) steps[x].hidden = x !== k; }); };
    var say = function (t, err) { msg.textContent = t || ''; msg.classList.toggle('err', !!err); };
    var post = function (data, btn) {
      if (btn) btn.disabled = true;
      return fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .catch(function () { return { ok: false, message: 'صار خطأ في الاتصال، حاول مرة ثانية.' }; })
        .finally(function () { if (btn) btn.disabled = false; });
    };
    var finish = function () { form.reset(); show('done'); say(''); };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!steps.form.hidden) {
        var el = form.elements;
        if (!el['name'].value.trim() || !el['message'].value.trim()) { say('فضلاً اكتب اسمك ورسالتك.', true); return; }
        if (form.dataset.verify === '1' && !el['email'].value.trim()) { say('فضلاً اكتب بريدك الإلكتروني عشان نرسل لك رمز التأكيد.', true); return; }
        var fd = new FormData(form); fd.set('step', 'start'); fd.delete('code');
        say('');
        post(fd, $('button[type=submit]', steps.form)).then(function (d) {
          if (!d.ok) { say(d.message, true); return; }
          if (d.done) { finish(); return; }
          token = d.token;
          $('.code-email', form).textContent = d.email || '';
          show('code'); say('');
          var ci = $('.code-input', form); ci.value = ''; ci.focus();
        });
      } else if (!steps.code.hidden) {
        verify();
      }
    });

    var verify = function () {
      var code = ($('.code-input', form).value || '').replace(/\D/g, '');
      if (code.length !== 6) { say('اكتب الرمز المكون من 6 أرقام.', true); return; }
      var fd = new FormData(); fd.set('step', 'verify'); fd.set('token', token); fd.set('code', code);
      post(fd, $('[data-act=verify]', form)).then(function (d) {
        if (d.ok) { finish(); return; }
        say(d.message, true);
        if (d.restart) { show('form'); }
      });
    };
    form.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.dataset.act;
      if (act === 'verify') verify();
      if (act === 'back') { show('form'); say(''); }
      if (act === 'resend') {
        var fd = new FormData(); fd.set('step', 'resend'); fd.set('token', token);
        post(fd, b).then(function (d) { say(d.message, !d.ok); if (d.restart) show('form'); });
      }
    });
    var ci = $('.code-input', form);
    if (ci) ci.addEventListener('input', function () { ci.value = ci.value.replace(/\D/g, '').slice(0, 6); if (ci.value.length === 6) verify(); });
  }

  // Work quick view: small window with the work and a "view work" button
  var modal = $('#workModal');
  if (modal) {
    var lastFocus = null;
    var closeModal = function () {
      modal.classList.remove('open');
      document.body.classList.remove('modal-open');
      setTimeout(function () { modal.hidden = true; $('#wmMedia').innerHTML = ''; }, 300);
      if (lastFocus) lastFocus.focus();
    };
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]') && modal.contains(e.target)) { closeModal(); return; }
      var card = e.target.closest('[data-work]');
      if (!card || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      var d;
      try { d = JSON.parse(card.dataset.work); } catch (x) { return; }
      e.preventDefault();
      lastFocus = card;
      var media = $('#wmMedia'); media.innerHTML = '';
      if (d.video) {
        var v = document.createElement('video');
        v.src = d.video; v.controls = true; v.playsInline = true; v.autoplay = true; v.muted = true; v.loop = true;
        if (d.img) v.poster = d.img;
        media.appendChild(v);
      } else if (d.embed) {
        var f = document.createElement('iframe');
        f.src = d.embed; f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true; f.title = d.title;
        media.appendChild(f);
      } else if (d.img) {
        var im = new Image(); im.src = d.img; im.alt = d.title; media.appendChild(im);
      }
      $('#wmCat').textContent = d.cat || '';
      $('#wmTitle').textContent = d.title || '';
      $('#wmText').textContent = d.text || '';
      var tools = $('#wmTools'); tools.innerHTML = '';
      (d.tools || []).forEach(function (t) { var sp = document.createElement('span'); sp.textContent = t; tools.appendChild(sp); });
      var btn = $('#wmBtn'); btn.href = d.url;
      if (d.ext) { btn.target = '_blank'; btn.rel = 'noopener'; } else { btn.removeAttribute('target'); btn.removeAttribute('rel'); }
      modal.hidden = false;
      document.body.classList.add('modal-open');
      requestAnimationFrame(function () { modal.classList.add('open'); $('.modal-close', modal).focus(); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  }
})();
