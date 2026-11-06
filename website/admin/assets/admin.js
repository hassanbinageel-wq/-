(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Sidebar on mobile
  var side = $('#sidebar'), back = $('#sideBackdrop'), toggle = $('#menuToggle');
  var setSide = function (open) { side.classList.toggle('open', open); back.classList.toggle('open', open); };
  if (toggle) toggle.addEventListener('click', function () { setSide(!side.classList.contains('open')); });
  if (back) back.addEventListener('click', function () { setSide(false); });

  // Auto-hide success alerts
  $$('.alert-ok[data-autohide]').forEach(function (a) {
    setTimeout(function () { a.classList.add('hide'); setTimeout(function () { a.remove(); }, 400); }, 3500);
  });

  // Confirm before delete
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.dataset.confirm && !window.confirm(f.dataset.confirm)) { e.preventDefault(); return; }
    if (f.hasAttribute('data-dirty-check')) f.dataset.submitting = '1';
  }, true);

  // Warn before leaving with unsaved changes
  $$('form[data-dirty-check]').forEach(function (f) {
    f.addEventListener('input', function () { f.dataset.dirty = '1'; });
    f.addEventListener('change', function () { f.dataset.dirty = '1'; });
  });
  window.addEventListener('beforeunload', function (e) {
    var dirty = $$('form[data-dirty-check]').some(function (f) { return f.dataset.dirty && !f.dataset.submitting; });
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // Image preview before upload
  $$('[data-upload]').forEach(function (box) {
    var input = $('input[type=file]', box), prev = $('.upload-preview', box);
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var url = URL.createObjectURL(file);
      prev.innerHTML = '';
      var el;
      if (/^video\//.test(file.type)) { el = document.createElement('video'); el.muted = true; el.controls = true; el.playsInline = true; }
      else { el = new Image(); }
      el.src = url; prev.appendChild(el); prev.classList.add('has');
      var label = $('label.btn span', box); if (label) label.textContent = file.name.length > 22 ? file.name.slice(0, 20) + '…' : file.name;
    });
  });

  // Gallery preview
  $$('[data-gallery]').forEach(function (box) {
    var input = $('input[type=file]', box), add = $('.g-add', box);
    input.addEventListener('change', function () {
      $$('.g-new', box).forEach(function (n) { n.remove(); });
      Array.prototype.forEach.call(input.files, function (file) {
        var d = document.createElement('div'); d.className = 'g-item g-new';
        var img = new Image(); img.src = URL.createObjectURL(file); d.appendChild(img);
        add.parentNode.insertBefore(d, add);
      });
    });
  });

  // Large uploads (videos): send with a progress bar
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (e.defaultPrevented || f.enctype !== 'multipart/form-data' || !window.XMLHttpRequest || !window.FormData) return;
    var total = 0;
    $$('input[type=file]', f).forEach(function (i) { Array.prototype.forEach.call(i.files || [], function (x) { total += x.size; }); });
    if (total < 2 * 1024 * 1024) return;
    e.preventDefault();
    var fd;
    try { fd = new FormData(f, e.submitter); } catch (err) { fd = new FormData(f); if (e.submitter && e.submitter.name) fd.append(e.submitter.name, e.submitter.value); }
    var ov = document.createElement('div');
    ov.className = 'upload-overlay';
    ov.innerHTML = '<div class="upload-box"><strong>جاري رفع الملفات…</strong><div class="upload-bar"><span></span></div><small>0%</small></div>';
    document.body.appendChild(ov);
    var bar = $('.upload-bar span', ov), lbl = $('small', ov);
    var mb = function (b) { return (b / 1048576).toFixed(1) + ' MB'; };
    var xhr = new XMLHttpRequest();
    xhr.open('POST', f.getAttribute('action') || location.href);
    xhr.upload.onprogress = function (ev) {
      if (!ev.lengthComputable) return;
      var p = Math.round(ev.loaded / ev.total * 100);
      bar.style.width = p + '%';
      lbl.textContent = p + '% — ' + mb(ev.loaded) + ' من ' + mb(ev.total);
      if (p >= 100) lbl.textContent = 'تم الرفع، جاري الحفظ…';
    };
    xhr.onload = function () { f.dataset.submitting = '1'; location.href = xhr.responseURL || location.href; };
    xhr.onerror = function () { ov.remove(); alert('انقطع الاتصال أثناء الرفع، حاول مرة ثانية.'); };
    f.dataset.submitting = '1';
    xhr.send(fd);
  });

  // Color code
  $$('.color-field input').forEach(function (c) {
    c.addEventListener('input', function () { c.nextElementSibling.textContent = c.value; });
  });

  // Table search
  $$('[data-table-search]').forEach(function (inp) {
    var t = $(inp.dataset.tableSearch);
    inp.addEventListener('input', function () {
      var q = inp.value.trim().toLowerCase();
      $$('tbody tr', t).forEach(function (tr) { tr.hidden = q && tr.textContent.toLowerCase().indexOf(q) === -1; });
    });
  });
  $$('[data-list-search]').forEach(function (inp) {
    var l = $(inp.dataset.listSearch);
    inp.addEventListener('input', function () {
      var q = inp.value.trim().toLowerCase();
      Array.prototype.forEach.call(l.children, function (el) { el.hidden = q && el.textContent.toLowerCase().indexOf(q) === -1; });
    });
  });

  // Simple HTML editor
  $$('[data-editor]').forEach(function (ed) {
    var ta = $('textarea', ed), pv = $('.editor-preview', ed);
    var wrap = function (open, close, placeholder) {
      var s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || placeholder || '';
      var ins = open + sel + close;
      ta.setRangeText(ins, s, e, 'end');
      ta.focus();
      if (!ta.value.slice(s, e).length) { ta.selectionStart = s + open.length; ta.selectionEnd = s + open.length + sel.length; }
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    };
    $$('[data-wrap]', ed).forEach(function (b) {
      b.addEventListener('click', function () { var t = b.dataset.wrap; wrap('<' + t + '>', '</' + t + '>\n', 'نص'); });
    });
    var lb = $('[data-list]', ed);
    if (lb) lb.addEventListener('click', function () {
      var s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e);
      var items = (sel ? sel.split(/\n/) : ['عنصر 1', 'عنصر 2']).filter(Boolean).map(function (x) { return '  <li>' + x + '</li>'; }).join('\n');
      ta.setRangeText('<ul>\n' + items + '\n</ul>\n', s, e, 'end'); ta.focus();
    });
    var lk = $('[data-link]', ed);
    if (lk) lk.addEventListener('click', function () {
      var u = prompt('الصق الرابط:', 'https://'); if (!u) return;
      wrap('<a href="' + u.replace(/"/g, '&quot;') + '" target="_blank">', '</a>', 'نص الرابط');
    });
    var im = $('[data-img]', ed);
    if (im) im.addEventListener('click', function () {
      var u = prompt('رابط الصورة:', 'https://'); if (!u) return;
      wrap('<img src="' + u.replace(/"/g, '&quot;') + '" alt="">\n', '', '');
    });
    var pb = $('[data-preview]', ed);
    if (pb) pb.addEventListener('click', function () {
      var showing = !pv.hidden;
      if (!showing) {
        // Preview inside a sandboxed document (scripts never run)
        var doc = new DOMParser().parseFromString(ta.value, 'text/html');
        $$('script,iframe[srcdoc],object,embed', doc).forEach(function (n) { n.remove(); });
        $$('*', doc).forEach(function (n) { Array.prototype.slice.call(n.attributes).forEach(function (a) { if (/^on/i.test(a.name)) n.removeAttribute(a.name); }); });
        pv.innerHTML = doc.body.innerHTML;
      }
      pv.hidden = showing; ta.hidden = !showing; pb.classList.toggle('on', !showing);
    });
  });
})();

(function () {
  // Copy buttons (secret dashboard link)
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy-target]');
    if (!b) return;
    var el = document.querySelector(b.dataset.copyTarget), text = el ? el.textContent.trim() : '';
    var done = function () { var s = b.querySelector('span'); if (s) { var o = s.textContent; s.textContent = 'تم ✓'; setTimeout(function () { s.textContent = o; }, 1600); } };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () {});
    else { var r = document.createRange(); r.selectNodeContents(el); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); try { document.execCommand('copy'); done(); } catch (x) {} }
  });
})();

(function () {
  // Drag rows by their handle to reorder (mouse and touch). Saves automatically.
  var body = document.querySelector('tbody[data-sortable]');
  if (!body) return;
  var toast = document.createElement('div'); toast.className = 'toast-mini'; document.body.appendChild(toast);
  var tt;
  var say = function (t, err) { toast.textContent = t; toast.classList.toggle('err', !!err); toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove('show'); }, 1800); };
  var row = null, startOrder = '';
  var order = function () { return Array.prototype.map.call(body.querySelectorAll('tr[data-id]'), function (r) { return r.dataset.id; }).join(','); };
  body.addEventListener('pointerdown', function (e) {
    var g = e.target.closest('.grip');
    if (!g || e.button > 0) return;
    e.preventDefault();
    row = g.closest('tr'); startOrder = order();
    row.classList.add('dragging'); document.body.classList.add('is-sorting');
  });
  document.addEventListener('pointermove', function (e) {
    if (!row) return;
    var rows = Array.prototype.filter.call(body.querySelectorAll('tr[data-id]'), function (r) { return r !== row && !r.hidden; });
    for (var i = 0; i < rows.length; i++) {
      var b = rows[i].getBoundingClientRect();
      if (e.clientY < b.top + b.height / 2) { if (rows[i].previousElementSibling !== row) body.insertBefore(row, rows[i]); return; }
    }
    if (rows.length && body.lastElementChild !== row) body.appendChild(row);
    if (e.clientY < 60) window.scrollBy(0, -12); else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
  });
  var end = function () {
    if (!row) return;
    row.classList.remove('dragging'); document.body.classList.remove('is-sorting'); row = null;
    var ids = order();
    if (ids === startOrder) return;
    var fd = new FormData(); fd.append('_csrf', body.dataset.csrf); fd.append('_do', 'reorder'); fd.append('ids', ids);
    fetch(location.href, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (d) { say(d.message || 'تم'); })
      .catch(function () { say('ما انحفظ الترتيب، حدّث الصفحة وحاول مرة ثانية', true); });
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
})();
