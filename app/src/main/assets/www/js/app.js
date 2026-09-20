/* منطق التطبيق: ربط الجسر + WebGL + الأدوات + اللوحات + الحالة.
 * ينظّم وضعي العمل (مونيتور/تحكم) عبر لوحات جانبية، ويحسب FPS وزمن المعالجة فعليًا،
 * ولا يعرض أي وظيفة/قيمة إلا بناءً على أحداث حقيقية من الكاميرا.
 */
(() => {
  const $ = s => document.querySelector(s);
  const el = {
    welcome: $('#welcome'), app: $('#app'),
    wcStatus: $('#wcStatus'), wcStatusText: $('#wcStatusText'),
    manualWifi: $('#manualWifi'),
    noSignal: $('#noSignal'), noSignalTitle: $('#noSignalTitle'), noSignalMsg: $('#noSignalMsg'),
    diag: $('#diag'), diagSummary: $('#diagSummary'), diagBody: $('#diagBody'),
    homeBtn: $('#homeBtn'),
    stage: $('#stage'), glcanvas: $('#glcanvas'), flipWrap: $('#flipWrap'),
    guides: $('#guides'), refOverlay: $('#refOverlay'), sourceBadge: $('#sourceBadge'),
    connDot: $('#connDot'), connText: $('#connText'),
    recDot: $('#recDot'), recTime: $('#recTime'), recGroup: $('#recGroup'),
    fps: $('#fps'), latency: $('#latency'),
    camBatt: $('#camBatt'), phoneBatt: $('#phoneBatt'), camCard: $('#camCard'),
    hideUiBtn: $('#hideUiBtn'), toolrail: $('#toolrail'),
    panelHost: $('#panelHost'), panelTitle: $('#panelTitle'), panelBody: $('#panelBody'), panelClose: $('#panelClose'),
    toast: $('#toast')
  };

  // الحالة
  const defaults = {
    lutOn:false, lutIntensity:100, activeLutId:null,
    zebra:false, zebraTh:95, falseColor:false, clipWarn:true, crushWarn:false, crushTh:4,
    hist:true, histRGB:false, wave:false, parade:false, scopeSource:'pre', scopeRate:3,
    zoom:100, peaking:false, peakColor:'r', peakStr:30,
    gThirds:false, gCenter:false, gAspect:'', gSafe:false, gOpacity:60,
    flipH:false, refOn:false, refOpacity:50,
    keepOn:true, lvSize:'L'
  };
  let S = Object.assign({}, defaults, Store.getSettings());
  let caps = null;               // قدرات الكاميرا المكتشَفة
  let connected = false, testMode = false;
  let refImageURL = null;
  let recStartMs = 0, recTimer = null;
  let currentModel = 'default';

  // FPS
  let frameCount = 0, fpsWindow = [], lastProcMs = 0, lastFrameMs = 0;
  let appVisible = false;

  // تشخيص
  const diag = [];
  let framesTotal = 0, lastCaps = null, lastStream = '—', lastWifi = '—', lastFrameSize = '—';
  function dlog(s){
    const line = '['+new Date().toLocaleTimeString('en-GB')+'] '+s;
    diag.push(line);
    if(diag.length > 400) diag.shift();
    if(el.diag && !el.diag.classList.contains('hidden')) renderDiag();
  }
  function openDiag(){ renderDiag(); el.diag.classList.remove('hidden'); }
  function renderDiag(){
    const c = lastCaps || {};
    const rows = [
      ['الطبقة الأصلية', Bridge.hasNative ? 'متاحة' : 'غير متاحة (متصفح؟)'],
      ['شبكة Wi‑Fi', lastWifi],
      ['متصل بالكاميرا', connected ? 'نعم' : 'لا'],
      ['الموديل', c.model || '—'],
      ['يدعم البث (startLiveview)', c.hasLiveview==null?'—':(c.hasLiveview?'نعم':'لا')],
      ['عدد وظائف الكاميرا', c.apiList ? c.apiList.length : '—'],
      ['حالة البث', lastStream],
      ['إطارات وصلت', String(framesTotal)],
      ['حجم آخر إطار', lastFrameSize],
      ['حجم لوح العرض', (el.glcanvas.width||0)+'×'+(el.glcanvas.height||0)+' (عرض '+(el.glcanvas.clientWidth||0)+'×'+(el.glcanvas.clientHeight||0)+')'],
      ['وضع الاختبار', testMode ? 'مُفعّل' : 'لا']
    ];
    el.diagSummary.innerHTML = rows.map(([k,v])=>`<div class="kv"><span>${k}</span><span>${v}</span></div>`).join('');
    el.diagBody.textContent = diag.slice(-200).join('\n');
    el.diagBody.scrollTop = el.diagBody.scrollHeight;
  }
  function diagText(){
    const c = lastCaps || {};
    return 'SonyMonitor diag\nnative='+Bridge.hasNative+' wifi='+lastWifi+' connected='+connected+
      '\nmodel='+(c.model||'-')+' hasLiveview='+c.hasLiveview+' apiCount='+(c.apiList?c.apiList.length:'-')+
      '\napiList='+JSON.stringify(c.apiList||[])+
      '\nstream='+lastStream+' frames='+framesTotal+' lastFrame='+lastFrameSize+
      '\n----\n'+diag.join('\n');
  }

  // ============ التهيئة ============
  function boot(){
    try { GL.init(el.glcanvas); }
    catch(e){ toast('خطأ WebGL: '+e.message); }
    applyParamsToGL();
    loadActiveLut();
    Bridge.setFrameHandler(onNativeFrame);
    wireBridgeEvents();
    wireChrome();
    wireWelcome();
    wireManualWifi();
    Bridge.cmd.keepScreenOn(S.keepOn);
    pollPhoneStatus();
    drawGuides();
    setInterval(checkNoSignal, 800);
    requestAnimationFrame(loop);
  }

  // ============ التنقّل بين شاشة البداية والمونيتور ============
  function showApp(){
    appVisible = true;
    el.welcome.classList.add('hidden');
    el.manualWifi.classList.add('hidden');
    el.app.classList.remove('hidden');
    drawGuides();
    if(!el.panelHost) return;
  }
  function showWelcome(){
    appVisible = false;
    el.app.classList.add('hidden');
    el.welcome.classList.remove('hidden');
    el.panelHost.classList.add('hidden');
  }

  function wcStatus(text, spinning){
    if(!text){ el.wcStatus.classList.add('hidden'); return; }
    el.wcStatus.classList.remove('hidden');
    el.wcStatusText.textContent = text;
    el.wcStatus.querySelector('.spinner').style.visibility = spinning ? 'visible' : 'hidden';
  }

  // شاشة البداية
  function wireWelcome(){
    $('#wcQr').onclick = ()=>{ wcStatus('افتح الكاميرا لمسح رمز QR…', true); Bridge.cmd.scanQrConnect(); };
    $('#wcManual').onclick = ()=>{ el.manualWifi.classList.remove('hidden'); };
    $('#wcTest').onclick = ()=>{ setTestMode(true); showApp(); };
    el.homeBtn.onclick = ()=>{ goHome(); };
  }
  function wireManualWifi(){
    $('#mwClose').onclick = ()=> el.manualWifi.classList.add('hidden');
    $('#mwDirect').onclick = ()=>{ el.manualWifi.classList.add('hidden'); startCameraConnect(); };
    $('#mwConnect').onclick = ()=>{
      const ssid = $('#mwSsid').value.trim();
      if(!ssid){ toast('أدخل اسم الشبكة'); return; }
      el.manualWifi.classList.add('hidden');
      wcStatus('جارٍ الاتصال بشبكة «'+ssid+'»…', true);
      Bridge.cmd.connectWifi(ssid, $('#mwPass').value);
    };
  }

  function startCameraConnect(){
    setTestMode(false);
    wcStatus('جارٍ البحث عن الكاميرا…', true);
    if(!Bridge.hasNative) toast('الطبقة الأصلية غير متاحة (تشغيل على المتصفح؟)');
    dlog('بدء الاتصال بالكاميرا (SSDP)…');
    setConn('warn','جارٍ الاتصال…');
    Bridge.cmd.connect();
  }

  function goHome(){
    Bridge.cmd.stopLiveview();
    Bridge.cmd.disconnect();
    setTestMode(false);
    showWelcome();
    wcStatus(null);
  }

  // إطار مُعلّق يُعرض داخل rAF (ضروري ليُركّبه WebView على الشاشة)
  let pendingFrame = null;
  // لوح 2D وسيط — أكثر مصادر نسيج WebGL موثوقية داخل WebView
  const scratch = document.createElement('canvas');
  const sctx = scratch.getContext('2d');
  function toSource(bmp){
    if(scratch.width !== bmp.width || scratch.height !== bmp.height){ scratch.width = bmp.width; scratch.height = bmp.height; }
    sctx.drawImage(bmp, 0, 0);
    return scratch;
  }

  // ============ حلقة العرض (كل الرسم داخل rAF) ============
  function loop(){
    if(appVisible){
      if(testMode){
        const cv = TestPattern.draw();
        GL.uploadFrame(cv, TestPattern.width, TestPattern.height);
        GL.render();
        lastFrameMs = performance.now();
        tickFps(performance.now());
        maybeScopes();
      } else if(pendingFrame){
        const t = performance.now();
        const bmp = pendingFrame.bitmap, dec = pendingFrame.decodeMs;
        try {
          GL.uploadFrame(toSource(bmp), bmp.width, bmp.height);
          GL.render();
        } catch(e){ dlog('خطأ رسم: '+e.message); }
        lastProcMs = (performance.now()-t) + dec;
        lastFrameMs = t;
        el.noSignal.classList.add('hidden');
        if(bmp.close) bmp.close();
        pendingFrame = null;
        tickFps(t);
        maybeScopes();
      }
    }
    requestAnimationFrame(loop);
  }

  // ============ إطار حقيقي من الكاميرا (يُخزَّن ثم يُعرض في rAF) ============
  function onNativeFrame(f){
    if(testMode){ if(f.bitmap && f.bitmap.close) f.bitmap.close(); return; }
    if(pendingFrame && pendingFrame.bitmap && pendingFrame.bitmap.close) pendingFrame.bitmap.close();
    pendingFrame = { bitmap: f.bitmap, decodeMs: f.decodeMs || 0 };
    framesTotal++;
    lastFrameSize = f.bitmap.width + '×' + f.bitmap.height;
    if(framesTotal === 1) dlog('أول إطار وصل ✓ ('+lastFrameSize+') — يُعرض عبر rAF');
  }

  // يظهر حالة «لا إشارة» إذا لم تصل إطارات لفترة والمونيتور ظاهر
  function checkNoSignal(){
    if(!appVisible || testMode){ el.noSignal.classList.add('hidden'); return; }
    const stale = performance.now() - lastFrameMs > 2500;
    if(stale && connected){
      el.noSignalTitle.textContent = 'في انتظار البثّ الحيّ…';
      el.noSignalMsg.textContent = caps && !caps.hasLiveview
        ? 'هذه الكاميرا لا تُتيح البثّ الحيّ عبر هذا الاتصال (حسب قدراتها المكتشَفة).'
        : 'تأكّد أن الكاميرا في وضع التحكّم بالهاتف والبثّ مفعّل.';
      el.noSignal.classList.remove('hidden');
    } else if(stale && !connected){
      el.noSignalTitle.textContent = 'غير متصل بالكاميرا';
      el.noSignalMsg.textContent = 'ارجع للقائمة وأعد الاتصال.';
      el.noSignal.classList.remove('hidden');
    }
  }

  let scopeFrameCtr = 0;
  function maybeScopes(){
    if(!(S.hist||S.histRGB||S.wave||S.parade)) return;
    if((++scopeFrameCtr % Math.max(1,S.scopeRate)) !== 0) return;
    const data = GL.readScopePixels(S.scopeSource === 'post');
    if(data) Scopes.update(data);
  }

  function tickFps(t){
    fpsWindow.push(t);
    while(fpsWindow.length>2 && t - fpsWindow[0] > 1000) fpsWindow.shift();
    const span = t - fpsWindow[0];
    const fps = span>0 ? ((fpsWindow.length-1)*1000/span) : 0;
    el.fps.textContent = (fps?fps.toFixed(0):'—') + ' fps';
    el.latency.textContent = (lastProcMs?lastProcMs.toFixed(0):'—') + ' ms';
  }

  // ============ أحداث الأصل ============
  function wireBridgeEvents(){
    // أحداث الاتصال بشبكة Wi‑Fi (QR / يدوي)
    Bridge.on('wifi', d=>{
      lastWifi = d.state + (d.ssid?(' — '+d.ssid):'');
      dlog('WiFi: '+d.state+(d.ssid?(' ssid='+d.ssid):'')+(d.message?(' — '+d.message):''));
      if(d.state==='connecting') wcStatus('جارٍ الاتصال بشبكة الكاميرا…', true);
      else if(d.state==='connected'){ wcStatus('اتصلت بالشبكة ✓ — جارٍ البحث عن الكاميرا…', true); startCameraConnect(); }
      else if(d.state==='failed'){ wcStatus('تعذّر الاتصال: '+(d.message||''), false); toast(d.message||'تعذّر الاتصال بالشبكة'); }
      else if(d.state==='cancelled') wcStatus(null);
    });
    Bridge.on('status', d=>{
      dlog('الحالة: '+d.phase);
      if(d.phase==='binding'){ setConn('warn','جارٍ الربط بالشبكة…'); }
      if(d.phase==='discovering'){ setConn('warn','جارٍ البحث عن الكاميرا…'); wcStatus('جارٍ البحث عن الكاميرا…', true); }
    });
    Bridge.on('connected', d=>{
      caps = d; lastCaps = d; connected = true; currentModel = d.model || 'default';
      dlog('اتصلت بالكاميرا: '+(d.model||'?')+' | hasLiveview='+d.hasLiveview+' | api='+((d.apiList&&d.apiList.length)||0));
      dlog('apiList='+JSON.stringify(d.apiList||[]));
      setConn('on', 'متصل: ' + (d.model||'كاميرا'));
      wcStatus(null);
      showApp();
      applyCapsToControls(d);
      if(d.hasLiveview){ dlog('طلب بدء البث…'); Bridge.cmd.startLiveview(); }
      else { dlog('الكاميرا لا تُدرج startLiveview في وظائفها المتاحة.'); toast('هذه الكاميرا لا تُتيح البث الحي عبر هذا الاتصال.'); }
      loadFavLutForContext();
      toast('قدرات '+(d.model||'الكاميرا')+': بث='+yn(d.hasLiveview)+'، التقاط='+yn(d.hasTakePicture)+'، فيديو='+yn(d.hasMovieRec));
    });
    Bridge.on('disconnected', ()=>{ connected=false; caps=null; dlog('قُطع الاتصال'); setConn('off','غير متصل'); disableControls(); });
    Bridge.on('error', d=>{ dlog('خطأ: '+(d.code||'')+' — '+(d.message||'')); setConn('off', d.message||'خطأ'); wcStatus('خطأ: '+(d.message||''), false); toast(d.message||'خطأ'); });
    Bridge.on('stream', d=>{
      lastStream = d.state + (d.reason?(' — '+d.reason):'');
      dlog('البث: '+d.state+(d.url?(' url='+d.url):'')+(d.reason?(' — '+d.reason):'')+(d.attempt?(' محاولة '+d.attempt):''));
      if(d.state==='connected') setConn('on', 'البث حي');
      else if(d.state==='reconnecting') setConn('warn', `انقطع البث — إعادة محاولة (${d.attempt})…`);
      else if(d.state==='lost') setConn('warn', 'انقطع البث: '+(d.reason||''));
      else if(d.state==='starting') setConn('warn','بدء البث…');
    });
    Bridge.on('camera-status', updateCameraStatus);
    Bridge.on('action', d=>{
      logAction(d);
      if(d.action==='startMovieRec' && d.ok) setRecording(true);
      if(d.action==='stopMovieRec' && d.ok) setRecording(false);
      if(d.action==='takePicture' && d.ok) toast('تم الالتقاط ✓');
    });
  }

  function setConn(kind, text){
    el.connDot.className = 'dot ' + (kind==='on'?'dot-on':kind==='warn'?'dot-warn':'dot-off');
    el.connText.textContent = text;
  }

  function updateCameraStatus(st){
    // بطارية/بطاقة الكاميرا
    if(st.cameraBatteryLevel!=null && st.cameraBatteryDenom){
      el.camBatt.textContent = '📷 ' + Math.round(st.cameraBatteryLevel/st.cameraBatteryDenom*100) + '%';
    } else if(st.cameraBatteryStatus){ el.camBatt.textContent = '📷 ' + st.cameraBatteryStatus; }
    if(st.recordableImages!=null) el.camCard.textContent = '🗂 ' + st.recordableImages + ' صورة';
    else if(st.recordableTimeMin!=null) el.camCard.textContent = '🗂 ' + st.recordableTimeMin + ' د';

    if(st.isRecordingMovie===true) setRecording(true);
    if(st.isRecordingMovie===false) setRecording(false);

    // تحديث القيم الظاهرة في لوحة التحكم (القيمة الحالية فقط — تأكيد من الكاميرا)
    fillSelectCurrent('setIso', st.iso, st.isoCandidates);
    fillSelectCurrent('setShutter', st.shutter, st.shutterCandidates);
    fillSelectCurrent('setF', st.fnumber, st.fnumberCandidates);
  }

  function setRecording(on){
    el.recGroup.classList.toggle('hidden', !on);
    const recBtn = $('#btnRec');
    if(recBtn){ recBtn.classList.toggle('recording', on); recBtn.textContent = on?'إيقاف التسجيل':'بدء تسجيل'; }
    if(on && !recTimer){
      recStartMs = Date.now();
      recTimer = setInterval(()=>{
        const s = Math.floor((Date.now()-recStartMs)/1000);
        el.recTime.textContent = String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
      }, 500);
    } else if(!on && recTimer){ clearInterval(recTimer); recTimer=null; }
  }

  // ============ WebGL params ============
  function applyParamsToGL(){
    GL.setParams({
      lutOn: S.lutOn, lutIntensity: S.lutIntensity/100,
      zebra: S.zebra, zebraTh: S.zebraTh/100,
      falseColor: S.falseColor,
      peaking: S.peaking, peakColor: peakColorVec(S.peakColor), peakStr: S.peakStr/100,
      clipWarn: S.clipWarn, crushWarn: S.crushWarn, crushTh: S.crushTh/100,
      zoom: S.zoom/100
    });
    el.flipWrap.classList.toggle('flip', S.flipH);
    el.refOverlay.style.opacity = S.refOpacity/100;
    el.refOverlay.classList.toggle('show', S.refOn && !!refImageURL);
  }
  function peakColorVec(c){ return c==='g'?[0,1,0]:c==='b'?[0,0.4,1]:c==='y'?[1,0.9,0]:[1,0,0]; }

  function persist(){ Store.saveSettings(S); }

  // ============ LUT ============
  function loadActiveLut(){
    const luts = Store.getLuts();
    const active = luts.find(l=>l.id===S.activeLutId);
    if(active){ try { GL.setLut(LutParser.fromStorable(active.lut)); } catch(e){} }
    else { GL.setLut(LutParser.identity(2)); }
  }
  function loadFavLutForContext(){
    const favId = Store.getFavLut(currentModel);
    if(favId){ S.activeLutId = favId; loadActiveLut(); persist(); }
  }

  // ============ لوحات ============
  function openPanel(name){
    const tpl = document.getElementById('tpl-'+name);
    if(!tpl) return;
    el.panelBody.innerHTML = '';
    el.panelBody.appendChild(tpl.content.cloneNode(true));
    el.panelHost.classList.remove('hidden');
    [...el.toolrail.children].forEach(b=>b.classList.toggle('active', b.dataset.panel===name));
    el.panelTitle.textContent = ({scopes:'أدوات المراقبة',lut:'LUT للمعاينة',focus:'التركيز والتأطير',control:'التحكم بالكاميرا',files:'الملفات والمشاريع',settings:'الإعدادات'})[name]||'لوحة';
    ({scopes:wireScopes,lut:wireLut,focus:wireFocus,control:wireControl,files:wireFiles,settings:wireSettings})[name]();
  }

  function wireChrome(){
    [...el.toolrail.children].forEach(b=> b.onclick = ()=> openPanel(b.dataset.panel));
    el.panelClose.onclick = ()=> el.panelHost.classList.add('hidden');
    el.hideUiBtn.onclick = ()=> document.body.classList.toggle('hiddenUi');
    window.addEventListener('resize', drawGuides);
    el.stage.addEventListener('click', ()=>{ if(document.body.classList.contains('hiddenUi')) document.body.classList.remove('hiddenUi'); });

    // التشخيص
    $('#noSignalDiag').onclick = openDiag;
    $('#noSignalHome').onclick = goHome;
    $('#diagClose').onclick = ()=> el.diag.classList.add('hidden');
    $('#diagRetry').onclick = ()=>{ el.diag.classList.add('hidden'); Bridge.cmd.connect(); };
    $('#diagCopy').onclick = ()=>{
      const txt = diagText();
      try { navigator.clipboard.writeText(txt); toast('نُسخ السجل ✓'); }
      catch(e){ el.diagBody.textContent = txt; toast('انسخ النص يدويًا'); }
    };
  }

  // زر الرجوع من الأصل: يغلق اللوحة/يُظهر الواجهة قبل الخروج
  window.__onBackPressed = function(){
    if(document.body.classList.contains('hiddenUi')){ document.body.classList.remove('hiddenUi'); return true; }
    if(!el.panelHost.classList.contains('hidden')){ el.panelHost.classList.add('hidden'); return true; }
    return false;
  };

  function setTestMode(on){
    testMode = on;
    el.stage.classList.toggle('testmode', on);
    if(on){ el.noSignal.classList.add('hidden'); toast('نمط اختبار — ليس بثًا من الكاميرا'); }
  }

  // -------- لوحة الأدوات --------
  function wireScopes(){
    const host = $('#scopeCanvases');
    Scopes.init(host);
    Scopes.setEnabled({hist:S.hist,histRGB:S.histRGB,wave:S.wave,parade:S.parade});
    bindChk('#scHist','hist', v=>Scopes.setEnabled({hist:v}));
    bindChk('#scHistRGB','histRGB', v=>Scopes.setEnabled({histRGB:v}));
    bindChk('#scWave','wave', v=>Scopes.setEnabled({wave:v}));
    bindChk('#scParade','parade', v=>Scopes.setEnabled({parade:v}));
    bindChk('#scZebra','zebra', ()=>applyParamsToGL());
    bindChk('#scFalse','falseColor', ()=>applyParamsToGL());
    bindChk('#scClip','clipWarn', ()=>applyParamsToGL());
    bindRange('#zebraTh','#zebraThV','zebraTh', v=>v, ()=>applyParamsToGL());
    bindRange('#crushTh','#crushThV','crushTh', v=>v, ()=>applyParamsToGL());
    const src=$('#scopeSource'); src.value=S.scopeSource; src.onchange=()=>{ S.scopeSource=src.value; persist(); };
    // دليل False Color
    const legend = document.createElement('div'); legend.className='note small';
    legend.innerHTML = '<b>دليل False Color:</b><br>' + Scopes.falseColorLegend.map(([c,t])=>`<span style="display:inline-block;width:10px;height:10px;background:${c};margin-inline-end:4px;border-radius:2px"></span>${t}`).join('<br>');
    $('#scopeCanvases').before(legend);
  }

  // -------- لوحة LUT --------
  function wireLut(){
    $('#lutOn').checked = S.lutOn;
    $('#lutOn').onchange = e=>{ S.lutOn=e.target.checked; persist(); applyParamsToGL(); };
    bindRange('#lutIntensity','#lutIntensityV','lutIntensity', v=>v+'%', ()=>applyParamsToGL());
    const cmp=$('#btnLutCompare');
    const down=()=>{ GL.setParams({lutOn:false}); }; const up=()=>{ GL.setParams({lutOn:S.lutOn}); };
    cmp.addEventListener('touchstart',e=>{e.preventDefault();down();}); cmp.addEventListener('touchend',up);
    cmp.addEventListener('mousedown',down); cmp.addEventListener('mouseup',up); cmp.addEventListener('mouseleave',up);
    $('#btnLutImport').onclick = ()=> $('#lutFile').click();
    $('#lutFile').onchange = onLutFile;
    renderLutList();
  }
  function onLutFile(e){
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try {
        const lut = LutParser.parseCube(reader.result);
        const luts = Store.getLuts();
        const id = 'lut_'+Date.now();
        luts.push({ id, name: file.name.replace(/\.cube$/i,''), size: lut.size, order: luts.length, lut: LutParser.toStorable(lut) });
        if(!Store.saveLuts(luts)){ toast('تعذّر الحفظ — قد تكون مساحة التخزين ممتلئة'); return; }
        S.activeLutId = id; S.lutOn = true; persist();
        loadActiveLut(); applyParamsToGL(); renderLutList();
        toast('تم استيراد LUT: '+file.name);
      } catch(err){ toast('خطأ في الملف: '+err.message); }
    };
    reader.readAsText(file);
  }
  function renderLutList(){
    const host = $('#lutList'); if(!host) return; host.innerHTML='';
    const luts = Store.getLuts().sort((a,b)=>a.order-b.order);
    if(!luts.length){ host.innerHTML='<p class="note small">لا توجد LUTs محفوظة بعد.</p>'; return; }
    luts.forEach((l,idx)=>{
      const item=document.createElement('div'); item.className='lutItem'+(l.id===S.activeLutId?' active':'');
      const name=document.createElement('span'); name.className='name'; name.textContent=l.name+' ('+l.size+'³)';
      name.onclick=()=>{ S.activeLutId=l.id; S.lutOn=true; persist(); loadActiveLut(); applyParamsToGL(); renderLutList(); $('#lutOn').checked=true; };
      const fav=btn('★','حفظ كمفضّل لهذه الكاميرا',()=>{ Store.setFavLut(currentModel, l.id); toast('تم تعيين LUT مفضّل لـ '+currentModel); });
      const ren=btn('✎','إعادة تسمية',()=>{ const n=prompt('اسم جديد', l.name); if(n){ l.name=n; Store.saveLuts(luts); renderLutList(); } });
      const up=btn('▲','',()=>reorder(luts,idx,-1)); const dn=btn('▼','',()=>reorder(luts,idx,1));
      const del=btn('🗑','حذف',()=>{ if(confirm('حذف '+l.name+'؟')){ const rest=luts.filter(x=>x.id!==l.id); Store.saveLuts(rest); if(S.activeLutId===l.id){S.activeLutId=null;S.lutOn=false;persist();loadActiveLut();applyParamsToGL();} renderLutList(); } });
      item.append(name,fav,ren,up,dn,del); host.appendChild(item);
    });
  }
  function reorder(luts,idx,dir){ const j=idx+dir; if(j<0||j>=luts.length) return; const a=luts[idx],b=luts[j]; const o=a.order;a.order=b.order;b.order=o; Store.saveLuts(luts); renderLutList(); }

  // -------- لوحة التركيز والتأطير --------
  function wireFocus(){
    bindRange('#zoom','#zoomV','zoom', v=>(v/100).toFixed(1)+'x', ()=>applyParamsToGL());
    bindChk('#peakOn','peaking', ()=>applyParamsToGL());
    const pc=$('#peakColor'); pc.value=S.peakColor; pc.onchange=()=>{ S.peakColor=pc.value; persist(); applyParamsToGL(); };
    bindRange('#peakStr','#peakStrV','peakStr', v=>v, ()=>applyParamsToGL());
    bindChk('#gThirds','gThirds', drawGuides);
    bindChk('#gCenter','gCenter', drawGuides);
    const ga=$('#gAspect'); ga.value=S.gAspect; ga.onchange=()=>{ S.gAspect=ga.value; persist(); drawGuides(); };
    bindChk('#gSafe','gSafe', drawGuides);
    bindRange('#gOpacity','#gOpacityV','gOpacity', v=>v+'%', drawGuides);
    bindChk('#flipH','flipH', ()=>applyParamsToGL());
    $('#btnSetRef').onclick = ()=>{ const url=GL.captureDataURL(); if(url){ refImageURL=url; el.refOverlay.src=url; S.refOn=true; persist(); applyParamsToGL(); $('#refOn').checked=true; toast('حُفظت صورة معاينة مرجعية (ليست ملف الكاميرا)'); } };
    bindChk('#refOn','refOn', ()=>applyParamsToGL());
    bindRange('#refOpacity','#refOpacityV','refOpacity', v=>v+'%', ()=>applyParamsToGL());
  }

  // -------- لوحة التحكم --------
  function wireControl(){
    $('#btnShot').onclick = ()=> Bridge.cmd.takePicture();
    $('#btnRec').onclick = ()=>{ const rec=$('#btnRec').classList.contains('recording'); if(rec) Bridge.cmd.stopMovieRec(); else Bridge.cmd.startMovieRec(); };
    ['setIso','setShutter','setF','setWB'].forEach(id=>{ const s=$('#'+id); if(s) s.onchange=()=>onSettingChange(id, s.value); });
    if(caps) applyCapsToControls(caps);
    Bridge.cmd.refreshStatus();
  }
  function onSettingChange(id, val){
    const map={setIso:'iso',setShutter:'shutter',setF:'fnumber',setWB:'whitebalance'};
    Bridge.cmd.setSetting(map[id], val);
    toast('أُرسل الأمر — بانتظار تأكيد الكاميرا…');
  }
  function applyCapsToControls(d){
    const shot=$('#btnShot'), rec=$('#btnRec');
    if(shot) shot.disabled = !d.hasTakePicture;
    if(rec) rec.disabled = !d.hasMovieRec;
    setSel('setIso', d.canSetIso); setSel('setShutter', d.canSetShutter); setSel('setF', d.canSetFNumber); setSel('setWB', d.canSetWhiteBalance);
    const cc=$('#controlCaps'); if(cc) cc.textContent = 'مفعّل حسب قدرات '+(d.model||'الكاميرا')+': التقاط='+yn(d.hasTakePicture)+'، فيديو='+yn(d.hasMovieRec)+'، ISO='+yn(d.canSetIso)+'، غالق='+yn(d.canSetShutter)+'، فتحة='+yn(d.canSetFNumber)+'.';
  }
  function setSel(id, on){ const s=$('#'+id); if(s) s.disabled=!on; }
  function yn(b){ return b?'نعم':'لا'; }
  function disableControls(){ ['btnShot','btnRec','setIso','setShutter','setF','setWB'].forEach(id=>{ const e=document.getElementById(id); if(e) e.disabled=true; }); }
  function fillSelectCurrent(id, current, candidates){
    const s=document.getElementById(id); if(!s||current==null) return;
    // اعمر القائمة من الخيارات المتاحة القادمة من الكاميرا (إن وُجدت)
    if(Array.isArray(candidates) && candidates.length){
      const cur = s.value;
      s.innerHTML='';
      candidates.forEach(v=>{ const o=document.createElement('option'); o.value=String(v); o.textContent=String(v); s.appendChild(o); });
      if([...s.options].some(o=>o.value===cur)) s.value=cur;
    }
    // اضمن وجود القيمة الحالية المؤكَّدة من الكاميرا
    let opt=[...s.options].find(o=>o.value===String(current));
    if(!opt){ opt=document.createElement('option'); opt.value=String(current); opt.textContent=String(current); s.appendChild(opt); }
    s.value=String(current);
  }
  function logAction(d){
    const host=$('#actionLog'); if(!host) return;
    const line=document.createElement('div');
    line.className = d.ok?'ok':'err';
    const label = d.label || d.action || 'أمر';
    line.textContent = (d.ok?'✓ ':'✗ ') + label + (d.value?(' → '+d.value):'') + (d.message?(' — '+d.message):'');
    host.prepend(line);
  }

  // -------- لوحة الملفات والمشاريع --------
  function wireFiles(){
    document.querySelectorAll('#panelBody .tab').forEach(t=> t.onclick=()=>{
      document.querySelectorAll('#panelBody .tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      $('#filesBrowse').classList.toggle('hidden', t.dataset.tab!=='browse');
      $('#filesProjects').classList.toggle('hidden', t.dataset.tab!=='projects');
    });
    const bb=$('#btnBrowse');
    if(bb){ bb.disabled = !(caps && caps.hasAvContent); bb.onclick=()=> toast('استعراض الملفات يحتاج تبديل الكاميرا لوضع نقل المحتوى — قيد الاختبار على a7 III.'); }
    $('#btnAddProj').onclick = ()=>{ const n=$('#projName').value.trim(); if(!n) return; const ps=Store.getProjects(); ps.push({id:'p_'+Date.now(), name:n, shots:[]}); Store.saveProjects(ps); $('#projName').value=''; renderProjects(); };
    renderProjects();
  }
  function renderProjects(){
    const host=$('#projList'); if(!host) return; host.innerHTML='';
    const ps=Store.getProjects();
    if(!ps.length){ host.innerHTML='<p class="note small">لا مشاريع بعد. أنشئ مشروعًا لتنظيم اللقطات والملاحظات (يُحفظ داخل التطبيق فقط).</p>'; return; }
    ps.forEach(p=>{
      const it=document.createElement('div'); it.className='projItem';
      const nm=document.createElement('span'); nm.className='name'; nm.style.flex='1'; nm.textContent=p.name+' ('+p.shots.length+' لقطة)';
      const add=btn('+لقطة','', ()=>{ const scene=prompt('اسم المشهد:'); if(scene===null) return; const shot=prompt('رقم اللقطة:')||''; const note=prompt('ملاحظات:')||''; p.shots.push({scene,shot,note,fav:false,ts:Date.now()}); Store.saveProjects(ps); renderProjects(); });
      const fav=btn('★','مفضّلة', ()=>{ p.fav=!p.fav; Store.saveProjects(ps); });
      const del=btn('🗑','حذف', ()=>{ if(confirm('حذف المشروع؟')){ Store.saveProjects(ps.filter(x=>x.id!==p.id)); renderProjects(); } });
      it.append(nm,add,fav,del); host.appendChild(it);
    });
  }

  // -------- لوحة الإعدادات --------
  function wireSettings(){
    $('#btnDisconnectAll').onclick=()=>{ goHome(); };
    $('#btnDiag').onclick=()=>{ openDiag(); };
    $('#keepOn').checked=S.keepOn; $('#keepOn').onchange=e=>{ S.keepOn=e.target.checked; persist(); Bridge.cmd.keepScreenOn(S.keepOn); };
    const lv=$('#lvSize'); lv.value=S.lvSize; lv.onchange=()=>{ S.lvSize=lv.value; persist(); };
    const sr=$('#scopeRate'); sr.value=String(S.scopeRate); sr.onchange=()=>{ S.scopeRate=+sr.value; persist(); };
    $('#btnSaveLayout').onclick=()=>{ persist(); toast('حُفظ توزيع الأدوات'); };
    $('#btnResetLayout').onclick=()=>{ S=Object.assign({}, defaults); persist(); applyParamsToGL(); drawGuides(); toast('استُرجعت الإعدادات الافتراضية'); openPanel('settings'); };
    $('#about').innerHTML = 'مونيتور Sony — النسخة 0.2. الاتصال عبر Sony ScalarWebAPI (Camera Remote API) بعد الانضمام لشبكة الكاميرا (QR أو يدوي). البث الحي والالتقاط مبنيان على البروتوكول ويحتاجان تأكيدًا على a7 III؛ التفاصيل في COMPATIBILITY.md.';
  }

  // ============ أدلة التأطير (SVG) ============
  function drawGuides(){
    const svg=el.guides;
    // اضبط SVG فوق مستطيل عرض الكانفس
    const cr=el.glcanvas.getBoundingClientRect(), sr=el.stage.getBoundingClientRect();
    svg.style.left=(cr.left-sr.left)+'px'; svg.style.top=(cr.top-sr.top)+'px';
    svg.style.width=cr.width+'px'; svg.style.height=cr.height+'px';
    svg.setAttribute('viewBox','0 0 1000 1000'); svg.setAttribute('preserveAspectRatio','none');
    const op=S.gOpacity/100;
    let g='';
    const line=(x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="white" stroke-width="1.5" opacity="${op}"/>`;
    if(S.gThirds){ g+=line(333,0,333,1000)+line(667,0,667,1000)+line(0,333,1000,333)+line(0,667,1000,667); }
    if(S.gCenter){ g+=line(500,0,500,1000)+line(0,500,1000,500); }
    if(S.gSafe){ g+=`<rect x="100" y="100" width="800" height="800" fill="none" stroke="#f2b705" stroke-width="1.5" opacity="${op}"/>`; }
    if(S.gAspect){ g+=aspectFrame(S.gAspect, op); }
    svg.innerHTML=g;
  }
  function aspectFrame(aspect, op){
    const cw=el.glcanvas.width, ch=el.glcanvas.height; if(!cw||!ch) return '';
    const canvasAR=cw/ch;
    const [a,b]=aspect.split(':').map(Number); const targetAR=a/b;
    let x=0,y=0,w=1000,h=1000;
    if(targetAR>canvasAR){ h=1000*(canvasAR/targetAR); y=(1000-h)/2; }
    else { w=1000*(targetAR/canvasAR); x=(1000-w)/2; }
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#2b7fff" stroke-width="2" opacity="${op}"/>`
      + `<rect x="0" y="0" width="1000" height="${y}" fill="black" opacity="${op*0.5}"/>`
      + `<rect x="0" y="${y+h}" width="1000" height="${y}" fill="black" opacity="${op*0.5}"/>`
      + `<rect x="0" y="${y}" width="${x}" height="${h}" fill="black" opacity="${op*0.5}"/>`
      + `<rect x="${x+w}" y="${y}" width="${x}" height="${h}" fill="black" opacity="${op*0.5}"/>`;
  }

  // ============ حالة الهاتف ============
  function pollPhoneStatus(){
    const st=Bridge.cmd.phoneStatus();
    if(st && st.batteryPct!=null) el.phoneBatt.textContent = '📱 '+st.batteryPct+'%'+(st.charging?'⚡':'');
    setTimeout(pollPhoneStatus, 15000);
  }

  // ============ مساعدات ربط ============
  function bindChk(sel, key, after){ const e=$(sel); if(!e) return; e.checked=S[key]; e.onchange=()=>{ S[key]=e.checked; persist(); after&&after(e.checked); }; }
  function bindRange(sel, valSel, key, fmt, after){ const e=$(sel), v=$(valSel); if(!e) return; e.value=S[key]; if(v) v.textContent=fmt(S[key]); e.oninput=()=>{ S[key]=+e.value; if(v) v.textContent=fmt(+e.value); after&&after(+e.value); }; e.onchange=persist; }
  function btn(txt,title,fn){ const b=document.createElement('button'); b.textContent=txt; if(title)b.title=title; b.onclick=fn; return b; }
  let toastTimer=null;
  function toast(msg){ el.toast.textContent=msg; el.toast.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.toast.classList.add('hidden'), 3200); }

  document.addEventListener('DOMContentLoaded', boot);
})();
