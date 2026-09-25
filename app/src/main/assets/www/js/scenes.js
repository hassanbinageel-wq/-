/* إعدادات المشاهد — تجهيز مشاهد مسبقًا وتطبيقها على الكاميرا المتصلة فعليًا.
 *
 * مبادئ:
 *  - الحقل الفارغ = «بدون تغيير» فلا يُرسل للكاميرا.
 *  - لا نستبدل قيمة غير مدعومة بأخرى: نطابق القيمة مع ما تعلنه الكاميرا، وإلا نتخطّاها مع السبب.
 *  - كل ضبط يُرسل بالترتيب وننتظر ردّ الكاميرا، ثم نتحقق من القيمة المقروءة منها (readback).
 *  - العدسة والإضاءة والملاحظات = تجهيزات يدوية تُعرض كتعليمات، لا أوامر.
 *  - عند انقطاع الاتصال يُلغى «المشهد المطبّق» ولا يُعاد تطبيق أي شيء تلقائيًا.
 */
const Scenes = (() => {
  const KEY = 'sm_scenes_v1';
  let ctx = null;              // { getCaps, getStatus, isConnected, toast, dlog, openPanel, host }
  let scenes = load();
  let applying = null;         // { sceneId, rows, aborted }
  let applied = null;          // { id, name, expected:{field:value}, partial }
  let driftShown = false;
  let pending = null;          // انتظار رد أمر set
  let editingId = null;
  let lastResult = null;       // آخر نتيجة تطبيق تُعرض في اللوحة

  // ---------- التخزين ----------
  function load(){ try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch(e){ return []; } }
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(scenes)); } catch(e){ ctx && ctx.toast('تعذّر حفظ المشاهد في ذاكرة الهاتف'); } }
  const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const blank = (n) => ({ id: uid(), name: 'مشهد ' + n, iso:'', shutter:'', fnumber:'', wbMode:'', kelvin:'', expMode:'',
    movieFormat:'', movieQuality:'', lens:'', focal:'', lightType:'', lightIntensity:'', lightDirection:'', lightTemp:'', notes:'', model:'' });

  // ---------- أدوات القيم ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v == null ? '' : v).trim().toLowerCase().replace(/^f\/?\s*/, '').replace(/\s+/g, '').replace(/s$/, '');
  function matchCandidate(v, list){
    if(!Array.isArray(list) || !list.length) return { found: null, hasList: false };
    const n = norm(v);
    const found = list.find(c => norm(c) === n || (Number(norm(c)) && Number(norm(c)) === Number(n)));
    return { found: found == null ? null : String(found), hasList: true };
  }
  const caps = () => (ctx && ctx.getCaps()) || {};
  const st = () => (ctx && ctx.getStatus()) || {};
  const wbIsK = w => /color\s*temp/i.test(String(w || ''));
  function kRange(){ const r = caps().colorTempRange || {}; return { min: r.min || 2500, max: r.max || 9900, step: r.step || 100 }; }
  function kelvinSupported(){ const c = caps(); return c.canSetWhiteBalance !== false && (!!c.colorTempRange || (c.wbCandidates || []).some(wbIsK)); }

  function summary(s){
    const p = [];
    if(s.expMode) p.push(shortMode(s.expMode));
    if(s.iso) p.push('ISO ' + s.iso);
    if(s.shutter) p.push(s.shutter);
    if(s.fnumber) p.push('f/' + String(s.fnumber).replace(/^f\/?/i, ''));
    if(s.wbMode === 'K' && s.kelvin) p.push(s.kelvin + 'K'); else if(s.wbMode) p.push(s.wbMode);
    if(s.movieFormat) p.push(s.movieFormat);
    if(s.movieQuality) p.push(s.movieQuality);
    return p;
  }
  function preps(s){
    const out = [];
    if(s.lens || s.focal) out.push('🔧 ركّب عدسة ' + (s.lens || '') + (s.focal ? ((s.lens ? ' — ' : '') + 'البعد البؤري ' + s.focal + (/mm/i.test(s.focal) ? '' : 'mm')) : ''));
    const L = [s.lightType, s.lightIntensity && ('شدة ' + s.lightIntensity), s.lightDirection && ('اتجاه ' + s.lightDirection), s.lightTemp && ('حرارة ' + s.lightTemp)].filter(Boolean);
    if(L.length) out.push('💡 اضبط الإضاءة: ' + L.join('، '));
    return out;
  }
  function shortMode(m){ const s = String(m); if(/manual/i.test(s)) return 'M'; if(/aperture/i.test(s)) return 'A'; if(/shutter/i.test(s)) return 'S'; if(/program/i.test(s)) return 'P'; return s; }

  // ---------- محرّك التطبيق ----------
  // الترتيب: الوضع أولًا (يحدّد ما يمكن ضبطه) ← صيغة/جودة الفيديو ← توازن الأبيض ← الفتحة ← الشتر ← ISO
  const STEPS = [
    { key:'expMode', kind:'exposuremode', label:'وضع التصوير', can:c=>c.canSetExposureMode, cand:()=>st().exposureModeCandidates || caps().exposureModeCandidates, status:'exposureMode',
      why:'هذه الكاميرا/الاتصال لا يتيح تغيير وضع التصوير عن بُعد — يُضبط من دايل الكاميرا' },
    { key:'movieFormat', kind:'movieformat', label:'صيغة/دقة الفيديو', can:c=>c.canSetMovieFormat, cand:()=>caps().movieFormatCandidates, status:'movieFileFormat', noRec:true,
      why:'تغيير صيغة/دقة الفيديو غير متاح عبر هذا الاتصال' },
    { key:'movieQuality', kind:'moviequality', label:'معدل الإطارات/الجودة', can:c=>c.canSetMovieQuality, cand:null, status:'movieQuality', noRec:true,
      why:'تغيير معدل الإطارات/الجودة غير متاح عبر هذا الاتصال' },
    { key:'wb', label:'توازن الأبيض' },
    { key:'fnumber', kind:'fnumber', label:'الفتحة', can:c=>c.canSetFNumber, cand:()=>st().fnumberCandidates, status:'fnumber', why:'الكاميرا لا تتيح تغيير الفتحة عبر هذا الاتصال' },
    { key:'shutter', kind:'shutter', label:'الشتر', can:c=>c.canSetShutter, cand:()=>st().shutterCandidates, status:'shutter', why:'الكاميرا لا تتيح تغيير الشتر عبر هذا الاتصال' },
    { key:'iso', kind:'iso', label:'ISO', can:c=>c.canSetIso, cand:()=>st().isoCandidates, status:'iso', why:'الكاميرا لا تتيح تغيير ISO عبر هذا الاتصال' },
  ];

  function sendAndWait(kind, value, ms){
    return new Promise(resolve => {
      const timer = setTimeout(() => { if(pending && pending.kind === kind){ pending = null; resolve({ ok:false, message:'لا رد من الكاميرا خلال المهلة' }); } }, ms || 15000);
      pending = { kind, resolve: d => { clearTimeout(timer); resolve(d); } };
      Bridge.cmd.setSetting(kind, value);
    });
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /** ينتظر أن تُظهر حالة الكاميرا القيمة المطلوبة (عند غياب readback مباشر). */
  async function waitStatus(check, ms){
    const t0 = Date.now();
    while(Date.now() - t0 < ms){ if(check(st())) return true; await sleep(200); }
    return check(st());
  }

  function modeNote(){ const m = st().exposureMode; return m ? ` في الوضع الحالي (${shortMode(m)})` : ''; }
  function listHint(list){ if(!Array.isArray(list) || !list.length) return ''; const l = list.slice(0, 14).join('، '); return ' المتاح: ' + l + (list.length > 14 ? '…' : ''); }

  async function apply(id){
    const s = scenes.find(x => x.id === id); if(!s) return;
    if(applying){ ctx.toast('جارٍ تطبيق مشهد آخر…'); return; }
    if(!ctx.isConnected()){ ctx.toast('غير متصل بكاميرا — لن يُطبَّق المشهد (ولن يُطبَّق تلقائيًا عند عودة الاتصال).', 5000); return; }
    const c = caps();
    const rows = [];
    applying = { sceneId: id, rows, aborted: false };
    lastResult = { sceneId: id, name: s.name, rows, done: false, preps: preps(s), notes: s.notes, model: c.model, transport: c.transport };
    applied = null; driftShown = false; updateChip();
    render();
    ctx.dlog('تطبيق مشهد: ' + s.name + ' → ' + JSON.stringify(summary(s)));

    const recording = !!st().isRecordingMovie;
    let expModeChanged = false;

    for(const step of STEPS){
      if(applying.aborted) break;
      // توازن الأبيض له منطق خاص (كلفن أو وضع جاهز)
      let kind, value, statusCheck, label = step.label, display;
      if(step.key === 'wb'){
        if(!s.wbMode) continue;
        if(s.wbMode === 'K'){
          const k = parseInt(s.kelvin, 10);
          display = (k || s.kelvin) + 'K';
          const row = addRow(label, display);
          if(!k){ fail(row, 'قيمة الكلفن فارغة أو غير صحيحة'); continue; }
          if(!kelvinSupported()){ skip(row, 'الكاميرا لا تتيح ضبط حرارة اللون (كلفن) عبر هذا الاتصال'); continue; }
          const r = kRange();
          if(k < r.min || k > r.max || (k - r.min) % r.step !== 0){ skip(row, `القيمة خارج ما تقبله الكاميرا (${r.min}–${r.max}K بخطوة ${r.step}) — لم نُقرّبها تلقائيًا`); continue; }
          kind = 'colortemp'; value = String(k);
          statusCheck = x => wbIsK(x.whiteBalance) && Number(x.colorTemp) === k;
          await runStep(row, kind, value, statusCheck, recording, false);
        } else {
          display = s.wbMode;
          const row = addRow(label, display);
          if(c.canSetWhiteBalance === false){ skip(row, 'الكاميرا لا تتيح تغيير توازن الأبيض عبر هذا الاتصال'); continue; }
          const m = matchCandidate(s.wbMode, c.wbCandidates);
          if(m.hasList && !m.found){ skip(row, 'الوضع غير متاح على هذه الكاميرا.' + listHint(c.wbCandidates)); continue; }
          kind = 'whitebalance'; value = m.found || s.wbMode;
          statusCheck = x => String(x.whiteBalance || '').toLowerCase() === value.toLowerCase();
          await runStep(row, kind, value, statusCheck, recording, false);
        }
        continue;
      }

      const raw = s[step.key];
      if(!raw) continue;
      display = step.key === 'fnumber' ? 'f/' + String(raw).replace(/^f\/?/i, '') : raw;
      const row = addRow(label, display);
      if(!step.can(c)){ skip(row, step.why); continue; }
      if(step.noRec && recording){ skip(row, 'الكاميرا تسجّل الآن — لا يمكن تغيير هذا أثناء التسجيل (لم نوقف التسجيل).'); continue; }

      // بعد تغيير الوضع ننتظر تحديث القوائم المتاحة من الكاميرا
      if(expModeChanged && /^(fnumber|shutter|iso)$/.test(step.key)){ await sleep(900); expModeChanged = false; }

      value = String(raw).trim();
      if(step.cand){
        const list = step.cand();
        const m = matchCandidate(value, list);
        if(m.hasList && !m.found){
          skip(row, step.key === 'expMode'
            ? 'الكاميرا لا تسمح بهذا الوضع الآن (غالبًا يُحدَّد من دايل الكاميرا).' + listHint(list)
            : 'القيمة غير متاحة الآن على الكاميرا' + modeNote() + '.' + listHint(list));
          continue;
        }
        if(m.found) value = m.found; // نفس القيمة بالصياغة الدقيقة التي تعرفها الكاميرا
        else if(/^(fnumber|shutter|iso)$/.test(step.key) && st().exposureMode){
          // لا قائمة متاحة: غالبًا الإعداد مقفول في هذا الوضع — نحاول ونعرض رد الكاميرا الحقيقي
        }
      }
      const target = value;
      statusCheck = x => norm(x[step.status]) === norm(target) || (step.status === 'movieQuality' && norm(caps().movieQuality) === norm(target));
      const ok = await runStep(row, step.kind, value, statusCheck, recording, false);
      if(ok && step.key === 'expMode') expModeChanged = true;
    }

    finish(s);
  }

  async function runStep(row, kind, value, statusCheck, recording){
    if(!ctx.isConnected()){ fail(row, 'انقطع الاتصال بالكاميرا'); applying.aborted = true; return false; }
    row.state = 'run'; render();
    const d = await sendAndWait(kind, value);
    if(applying && applying.aborted && !d.ok){ fail(row, d.message || 'انقطع الاتصال'); return false; }
    if(!d.ok){
      fail(row, (d.message || 'رفضت الكاميرا الأمر') + (recording ? ' — الكاميرا تسجّل الآن وقد لا تقبل هذا التغيير أثناء التسجيل (لم نوقف التسجيل).' : ''));
      return false;
    }
    if(d.verified === true){ ok(row, 'تأكيد من الكاميرا: ' + fmtRb(d.readback), kind, value); return true; }
    if(d.verified === false){ fail(row, 'أُرسلت القيمة لكن الكاميرا تقرأ الآن: ' + (fmtRb(d.readback) || 'غير معروف')); return false; }
    // لا getter مباشر: نتحقق من حالة الكاميرا (getEvent)
    const confirmed = await waitStatus(statusCheck, 3500);
    if(confirmed){ ok(row, 'تأكيد من حالة الكاميرا', kind, value); return true; }
    unverified(row, 'قبلت الكاميرا الأمر لكن لم نتمكّن من قراءة القيمة للتحقق');
    return false;
  }
  function fmtRb(rb){ if(rb == null) return ''; const s = String(rb); return s.includes('|') ? s.split('|')[1] + 'K' : s; }

  function addRow(label, value){ const r = { label, value, state:'wait', msg:'' }; applying.rows.push(r); render(); return r; }
  function ok(r, msg, kind, value){ r.state = 'ok'; r.msg = msg; r.kind = kind; r.sent = value; render(); }
  function fail(r, msg){ r.state = 'fail'; r.msg = msg; render(); }
  function skip(r, msg){ r.state = 'skip'; r.msg = msg; render(); }
  function unverified(r, msg){ r.state = 'unv'; r.msg = msg; render(); }

  function finish(s){
    const rows = applying ? applying.rows : [];
    const aborted = applying && applying.aborted;
    applying = null;
    const okRows = rows.filter(r => r.state === 'ok');
    lastResult.done = true;
    lastResult.okCount = okRows.length; lastResult.total = rows.length; lastResult.aborted = aborted;
    if(okRows.length && !aborted && ctx.isConnected()){
      const expected = {};
      okRows.forEach(r => { expected[r.kind] = r.sent; });
      applied = { id: s.id, name: s.name, expected, partial: okRows.length < rows.length, drift: [] };
    } else applied = null;
    const verdict = !rows.length ? 'لا توجد إعدادات كاميرا في هذا المشهد — التجهيزات اليدوية فقط'
      : okRows.length === rows.length ? `✓ طُبّق «${s.name}» بالكامل (${rows.length})`
      : okRows.length ? `⚠ طُبّق «${s.name}» جزئيًا: ${okRows.length} من ${rows.length}`
      : `✗ لم يُطبَّق أي إعداد من «${s.name}»`;
    lastResult.verdict = verdict;
    ctx.dlog('نتيجة المشهد: ' + verdict + ' | ' + rows.map(r => r.label + '=' + r.state + (r.msg ? '(' + r.msg + ')' : '')).join(' ; '));
    ctx.toast(verdict, 4500);
    updateChip(); render();
  }

  // ---------- مراقبة التغيّر بعد التطبيق ----------
  function currentOf(kind, x){
    switch(kind){
      case 'iso': return x.iso; case 'shutter': return x.shutter; case 'fnumber': return x.fnumber;
      case 'exposuremode': return x.exposureMode;
      case 'whitebalance': return x.whiteBalance;
      case 'colortemp': return wbIsK(x.whiteBalance) ? String(x.colorTemp || '') : (x.whiteBalance || '');
      case 'moviequality': return x.movieQuality || caps().movieQuality;
      case 'movieformat': return x.movieFileFormat || caps().movieFileFormat;
    }
  }
  const kindLabel = { iso:'ISO', shutter:'الشتر', fnumber:'الفتحة', exposuremode:'الوضع', whitebalance:'توازن الأبيض', colortemp:'الكلفن', moviequality:'الجودة', movieformat:'الصيغة' };
  function onStatus(){
    if(!applied || applying) return;
    const x = st(); const drift = [];
    for(const [kind, val] of Object.entries(applied.expected)){
      const cur = currentOf(kind, x);
      if(cur == null || cur === '') continue;
      if(norm(cur) !== norm(val)) drift.push({ kind, expected: val, now: cur });
    }
    const changed = JSON.stringify(drift) !== JSON.stringify(applied.drift);
    applied.drift = drift;
    if(drift.length && !driftShown){ driftShown = true; ctx.toast('⚠ تغيّرت إعدادات الكاميرا بعد تطبيق «' + applied.name + '»: ' + driftText(drift), 6000); }
    if(!drift.length) driftShown = false;
    if(changed){ updateChip(); if(isOpen()) render(); }
  }
  const driftText = d => d.map(x => `${kindLabel[x.kind] || x.kind} ${fmtRb(x.now) || x.now} (المشهد ${x.expected})`).join('، ');

  function onDisconnected(){
    if(pending){ const p = pending; pending = null; p.resolve({ ok:false, message:'انقطع الاتصال بالكاميرا' }); }
    if(applying) applying.aborted = true;
    applied = null; driftShown = false;
    updateChip(); if(isOpen()) render();
  }
  function onConnected(){ applied = null; updateChip(); if(isOpen()) render(); }

  /** يعيد true إن كان الحدث رد أمر ينتظره محرّك المشاهد (فلا تعرض الواجهة إشعارًا منفصلًا). */
  function onAction(d){
    if(pending && d && d.action === 'set' && d.kind === pending.kind){ const p = pending; pending = null; p.resolve(d); return true; }
    return false;
  }

  // ---------- شريحة المشهد على المونيتور ----------
  function updateChip(){
    const chip = document.getElementById('sceneChip'); if(!chip) return;
    if(applying){ chip.textContent = '🎬 جارٍ التطبيق…'; chip.className = 'scenechip run'; return; }
    if(!applied){ chip.className = 'scenechip hidden'; return; }
    const drift = applied.drift && applied.drift.length;
    chip.textContent = '🎬 ' + applied.name + (drift ? ' ⚠ تغيّر' : applied.partial ? ' (جزئي)' : '');
    chip.className = 'scenechip' + (drift ? ' warn' : applied.partial ? ' part' : '');
  }

  // ---------- الواجهة ----------
  function host(){ return document.getElementById('scenesRoot'); }
  function isOpen(){ return !!host(); }

  function render(){
    const root = host(); if(!root) return;
    if(editingId){ renderEditor(root); return; }
    const c = caps(), conn = ctx.isConnected();
    let h = '';
    h += `<div class="sc-cap">${conn
      ? `<b>${esc(c.model || 'كاميرا')}</b> عبر ${c.transport === 'ptpip' ? 'PTP/IP' : 'ScalarWebAPI'} — يمكن ضبط: ${capList(c)}`
      : 'غير متصل — يمكنك تجهيز المشاهد الآن وتطبيقها بعد الاتصال.'}</div>`;
    h += `<div class="sc-tools"><button class="btn primary" data-a="new">＋ مشهد جديد</button><button class="btn" data-a="capture" ${conn ? '' : 'disabled'}>حفظ إعدادات الكاميرا الحالية كمشهد</button></div>`;
    if(lastResult) h += resultHtml();
    if(!scenes.length) h += `<div class="note">لا توجد مشاهد بعد. أضف مشهدًا وحدد ما تريد تغييره فقط — الحقل الفارغ يعني «بدون تغيير».</div>`;
    h += '<div class="sc-list">';
    scenes.forEach((s, i) => {
      const isApplied = applied && applied.id === s.id;
      const drift = isApplied && applied.drift && applied.drift.length;
      const sum = summary(s), pr = preps(s);
      h += `<div class="sc-card${isApplied ? ' on' : ''}${drift ? ' warn' : ''}${applying && applying.sceneId === s.id ? ' run' : ''}" data-id="${s.id}">
        <div class="sc-main" data-a="apply">
          <div class="sc-top"><span class="sc-num">${i + 1}</span><b class="sc-name">${esc(s.name)}</b>
            ${isApplied ? `<span class="sc-badge">${drift ? '⚠ تغيّرت الكاميرا' : applied.partial ? 'مطبّق جزئيًا' : 'مطبّق'}</span>` : ''}</div>
          <div class="sc-sum">${sum.length ? sum.map(x => `<span>${esc(x)}</span>`).join('') : '<i>بدون إعدادات كاميرا</i>'}</div>
          ${pr.length ? `<div class="sc-prep">${pr.map(esc).join('<br>')}</div>` : ''}
          ${drift ? `<div class="sc-drift">${esc(driftText(applied.drift))}</div>` : ''}
        </div>
        <div class="sc-acts">
          <button data-a="edit">تعديل</button><button data-a="dup">تكرار</button>
          <button data-a="up" ${i === 0 ? 'disabled' : ''}>▲</button><button data-a="down" ${i === scenes.length - 1 ? 'disabled' : ''}>▼</button>
          <button data-a="del" class="del">حذف</button>
        </div></div>`;
    });
    h += '</div>';
    root.innerHTML = h;
  }

  function capList(c){
    const items = [['ISO', c.canSetIso], ['الشتر', c.canSetShutter], ['الفتحة', c.canSetFNumber], ['الكلفن', kelvinSupported()], ['الوضع', c.canSetExposureMode], ['صيغة الفيديو', c.canSetMovieFormat], ['الجودة/FPS', c.canSetMovieQuality]];
    return items.map(([n, v]) => `<span class="${v ? 'y' : 'n'}">${v ? '✓' : '✗'} ${n}</span>`).join(' ');
  }

  function resultHtml(){
    const r = lastResult;
    const icon = { wait:'⏳', run:'⏳', ok:'✓', fail:'✗', skip:'—', unv:'?' };
    let h = `<div class="sc-result"><div class="sc-rhead"><b>${esc(r.done ? r.verdict : 'جارٍ تطبيق «' + r.name + '»…')}</b>${r.done ? '<button class="iconlink" data-a="closeres">إخفاء</button>' : '<span class="spin"></span>'}</div>`;
    r.rows.forEach(x => { h += `<div class="sc-row ${x.state}"><span class="i">${icon[x.state]}</span><span class="l">${esc(x.label)}: <b>${esc(x.value)}</b></span>${x.msg ? `<span class="m">${esc(x.msg)}</span>` : ''}</div>`; });
    if(r.done && r.aborted) h += `<div class="sc-row fail"><span class="i">✗</span><span class="l">توقف التطبيق: انقطع الاتصال — لن يُستكمل تلقائيًا.</span></div>`;
    if(r.preps && r.preps.length) h += `<div class="sc-manual"><b>تجهيزات يدوية (لا تُنفّذ تلقائيًا):</b><br>${r.preps.map(esc).join('<br>')}</div>`;
    if(r.notes) h += `<div class="sc-manual">📝 ${esc(r.notes)}</div>`;
    return h + '</div>';
  }

  function onClick(e){
    const b = e.target.closest('[data-a]'); if(!b) return;
    const a = b.dataset.a;
    const card = b.closest('.sc-card'); const id = card && card.dataset.id;
    const i = scenes.findIndex(s => s.id === id);
    if(a === 'apply') return apply(id);
    if(a === 'new'){ const s = blank(scenes.length + 1); s.model = caps().model || ''; scenes.push(s); save(); editingId = s.id; return render(); }
    if(a === 'capture') return captureCurrent();
    if(a === 'closeres'){ lastResult = null; return render(); }
    if(a === 'edit'){ editingId = id; return render(); }
    if(a === 'dup'){ const c = Object.assign({}, scenes[i], { id: uid(), name: scenes[i].name + ' (نسخة)' }); scenes.splice(i + 1, 0, c); save(); return render(); }
    if(a === 'up' && i > 0){ [scenes[i - 1], scenes[i]] = [scenes[i], scenes[i - 1]]; save(); return render(); }
    if(a === 'down' && i < scenes.length - 1){ [scenes[i + 1], scenes[i]] = [scenes[i], scenes[i + 1]]; save(); return render(); }
    if(a === 'del'){
      if(b.dataset.confirm !== '1'){ b.dataset.confirm = '1'; b.textContent = 'تأكيد الحذف؟'; setTimeout(() => { if(b.isConnected){ b.dataset.confirm = ''; b.textContent = 'حذف'; } }, 3000); return; }
      if(applied && applied.id === id){ applied = null; updateChip(); }
      scenes.splice(i, 1); save(); return render();
    }
  }

  function captureCurrent(){
    if(!ctx.isConnected()){ ctx.toast('اتصل بالكاميرا أولًا'); return; }
    const x = st(), c = caps();
    const s = blank(scenes.length + 1);
    s.model = c.model || '';
    if(x.iso) s.iso = String(x.iso);
    if(x.shutter) s.shutter = String(x.shutter);
    if(x.fnumber) s.fnumber = String(x.fnumber).replace(/^F/i, '');
    if(wbIsK(x.whiteBalance) && x.colorTemp){ s.wbMode = 'K'; s.kelvin = String(x.colorTemp); }
    else if(x.whiteBalance) s.wbMode = String(x.whiteBalance);
    if(x.exposureMode) s.expMode = String(x.exposureMode);
    const mf = x.movieFileFormat || c.movieFileFormat, mq = x.movieQuality || c.movieQuality;
    if(mf) s.movieFormat = String(mf);
    if(mq) s.movieQuality = String(mq);
    scenes.push(s); save();
    ctx.toast('حُفظت إعدادات الكاميرا الحالية كـ «' + s.name + '» — عدّل الاسم والتجهيزات إن شئت');
    editingId = s.id; render();
  }

  // ---------- محرّر المشهد ----------
  const DEF = {
    iso: ['AUTO','100','200','400','640','800','1600','3200','6400','12800'],
    shutter: ['1/25','1/30','1/50','1/60','1/100','1/125','1/200','1/250','1/500','1/1000'],
    fnumber: ['1.4','1.8','2.0','2.8','4.0','5.6','8.0','11','16'],
    expMode: ['Manual Exposure','Aperture Priority','Shutter Priority','Program Auto'],
    lightType: ['سوفت بوكس','LED بانل','فرينل','ضوء طبيعي','رينغ لايت','عاكس'],
    lightDirection: ['أمامية','جانبية','خلفية (Rim)','علوية','45°'],
  };
  function opts(key){
    const x = st(), c = caps(), conn = ctx.isConnected();
    const cam = { iso: x.isoCandidates, shutter: x.shutterCandidates, fnumber: x.fnumberCandidates, expMode: x.exposureModeCandidates || c.exposureModeCandidates,
      movieFormat: c.movieFormatCandidates, movieQuality: c.movieQualityCandidates }[key];
    return (conn && Array.isArray(cam) && cam.length) ? cam.map(String) : (DEF[key] || []);
  }
  function field(s, key, label, hint, type){
    const list = opts(key);
    const dl = list.length ? `<datalist id="dl-${key}">${list.map(v => `<option value="${esc(v)}">`).join('')}</datalist>` : '';
    return `<label class="sc-f"><span>${label}</span><input ${type ? `type="${type}"` : ''} data-k="${key}" value="${esc(s[key])}" placeholder="بدون تغيير" ${list.length ? `list="dl-${key}"` : ''}>${dl}${hint ? `<small>${hint}</small>` : ''}</label>`;
  }
  function renderEditor(root){
    const s = scenes.find(x => x.id === editingId);
    if(!s){ editingId = null; return render(); }
    const c = caps(), conn = ctx.isConnected();
    const warn = (ok, t) => (conn && !ok) ? `⚠ ${t}` : '';
    const wbList = (conn && c.wbCandidates && c.wbCandidates.length ? c.wbCandidates : ['Auto WB','Daylight','Shade','Cloudy','Incandescent']).filter(w => !wbIsK(w));
    const r = kRange();
    root.innerHTML = `
      <div class="sc-ed">
        <div class="sc-edhead"><input class="sc-title" data-k="name" value="${esc(s.name)}" placeholder="اسم المشهد"></div>
        <div class="note small">${conn ? `القيم المقترحة من ${esc(c.model || 'الكاميرا')} المتصلة.` : 'غير متصل — ستُطابَق القيم مع الكاميرا عند التطبيق.'} الحقل الفارغ = «بدون تغيير».</div>
        <div class="sc-sec">إعدادات الكاميرا</div>
        ${field(s, 'expMode', 'وضع التصوير', warn(c.canSetExposureMode, 'لا يمكن تغييره عن بُعد على هذه الكاميرا — يُضبط من الدايل'))}
        ${field(s, 'iso', 'ISO', 'اكتب AUTO للتلقائي' + (warn(c.canSetIso, ' — غير قابل للضبط عبر هذا الاتصال')))}
        ${field(s, 'shutter', 'سرعة الشتر', warn(c.canSetShutter, 'غير قابل للضبط عبر هذا الاتصال'))}
        ${field(s, 'fnumber', 'فتحة العدسة (f/)', warn(c.canSetFNumber, 'غير قابل للضبط عبر هذا الاتصال'))}
        <label class="sc-f"><span>توازن الأبيض</span>
          <select data-k="wbMode"><option value="">بدون تغيير</option><option value="K" ${s.wbMode === 'K' ? 'selected' : ''}>كلفن (رقم)</option>
          ${wbList.map(w => `<option value="${esc(w)}" ${s.wbMode === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}
          ${s.wbMode && s.wbMode !== 'K' && !wbList.includes(s.wbMode) ? `<option value="${esc(s.wbMode)}" selected>${esc(s.wbMode)}</option>` : ''}</select></label>
        <label class="sc-f ${s.wbMode === 'K' ? '' : 'hidden'}" id="scKRow"><span>الكلفن</span><input type="number" inputmode="numeric" data-k="kelvin" value="${esc(s.kelvin)}" min="${r.min}" max="${r.max}" step="${r.step}" placeholder="5600">
          <small>${r.min}–${r.max}K بخطوة ${r.step}${warn(kelvinSupported(), ' — الكاميرا لا تتيح الكلفن عبر هذا الاتصال')}</small></label>
        ${field(s, 'movieFormat', 'دقة/صيغة الفيديو', conn ? (c.canSetMovieFormat ? '' : '⚠ غير قابل للضبط عبر هذا الاتصال') : 'مثل XAVC S 4K')}
        ${field(s, 'movieQuality', 'معدل الإطارات/الجودة', conn ? (c.canSetMovieQuality ? '' : '⚠ غير قابل للضبط عبر هذا الاتصال') : 'مثل 30p 100M')}
        <div class="sc-sec">العدسة (مرجع وتجهيز يدوي)</div>
        <label class="sc-f"><span>العدسة</span><input data-k="lens" value="${esc(s.lens)}" placeholder="مثل FE 35mm F1.8"></label>
        <label class="sc-f"><span>البعد البؤري</span><input data-k="focal" value="${esc(s.focal)}" placeholder="مثل 35mm"></label>
        <div class="sc-sec">الإضاءة (مرجع وتجهيز يدوي)</div>
        ${field(s, 'lightType', 'النوع')}
        <label class="sc-f"><span>الشدة</span><input data-k="lightIntensity" value="${esc(s.lightIntensity)}" placeholder="مثل 60% / ناعمة"></label>
        ${field(s, 'lightDirection', 'الاتجاه')}
        <label class="sc-f"><span>حرارة الإضاءة</span><input data-k="lightTemp" value="${esc(s.lightTemp)}" placeholder="مثل 5600K"></label>
        <div class="sc-sec">ملاحظات</div>
        <textarea data-k="notes" rows="3" placeholder="ملاحظات خاصة بالمشهد">${esc(s.notes)}</textarea>
        <div class="sc-edbar"><button class="btn primary" data-e="done">حفظ</button><button class="btn" data-e="apply" ${conn ? '' : 'disabled'}>حفظ وتطبيق</button></div>
      </div>`;
    root.querySelectorAll('[data-k]').forEach(inp => {
      const upd = () => {
        s[inp.dataset.k] = inp.value.trim();
        if(inp.dataset.k === 'wbMode'){ const kr = root.querySelector('#scKRow'); if(kr) kr.classList.toggle('hidden', inp.value !== 'K'); }
        save();
      };
      inp.addEventListener('input', upd); inp.addEventListener('change', upd);
    });
    root.querySelector('[data-e="done"]').onclick = () => { if(!s.name) s.name = 'مشهد'; save(); editingId = null; render(); };
    root.querySelector('[data-e="apply"]').onclick = () => { if(!s.name) s.name = 'مشهد'; save(); editingId = null; apply(s.id); };
  }

  function mount(container){
    container.innerHTML = '<div id="scenesRoot" class="scenes"></div>';
    const root = host();
    root.addEventListener('click', onClick);
    render();
  }
  function onPanelClosed(){ if(editingId){ editingId = null; } }

  function init(c){ ctx = c; updateChip(); }

  return { init, mount, render, onStatus, onAction, onConnected, onDisconnected, onPanelClosed, isEditing: () => !!editingId,
    closeEditor(){ if(editingId){ editingId = null; render(); return true; } return false; },
    _debug: { get scenes(){ return scenes; }, get applied(){ return applied; }, apply } };
})();
