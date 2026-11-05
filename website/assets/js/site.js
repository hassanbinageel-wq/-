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
    var play = function (v) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); var c = v.closest('.work-card'); if (c) c.classList.add('playing'); };
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

  // Contact form
  var form = $('#contactForm');
  if (form && window.fetch) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = $('.form-msg', form), btn = $('button[type=submit]', form);
      msg.classList.remove('err');
      if (!form.elements['name'].value.trim() || !form.elements['message'].value.trim()) {
        msg.textContent = 'فضلاً اكتب اسمك ورسالتك.'; msg.classList.add('err'); return;
      }
      btn.disabled = true;
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          msg.textContent = d.message; msg.classList.toggle('err', !d.ok);
          if (d.ok) form.reset();
        })
        .catch(function () { msg.textContent = 'صار خطأ في الاتصال، حاول مرة ثانية.'; msg.classList.add('err'); })
        .finally(function () { btn.disabled = false; });
    });
  }
})();
