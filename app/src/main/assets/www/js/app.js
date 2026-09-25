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
    stage: $('#stage'), glcanvas: $('#glcanvas'), view: $('#view'), flipWrap: $('#flipWrap'),
    guides: $('#guides'), refOverlay: $('#refOverlay'),
    ovHist: $('#ovHist'), ovWave: $('#ovWave'),
    connDot: $('#connDot'), connText: $('#connText'),
    recTime: $('#recTime'), recGroup: $('#recGroup'),
    fps: $('#fps'), latency: $('#latency'),
    camBatt: $('#camBatt'), phoneBatt: $('#phoneBatt'), camCard: $('#camCard'),
    hideUiBtn: $('#hideUiBtn'),
    menuBtn: $('#menuBtn'), menu: $('#menu'),
    rdF: $('#rdF'), rdSS: $('#rdSS'), rdISO: $('#rdISO'), rdWB: $('#rdWB'), rdFocus: $('#rdFocus'), rdMode: $('#rdMode'),
    ccISO: $('#ccISO'), ccF: $('#ccF'), ccSS: $('#ccSS'), ccWB: $('#ccWB'), ccEV: $('#ccEV'),
    valuePicker: $('#valuePicker'), vpTitle: $('#vpTitle'), vpList: $('#vpList'),
    btnPhoto: $('#btnPhoto'), btnRecDock: $('#btnRecDock'), filesBtn: $('#filesBtn'), teleBtn: $('#teleBtn'),
    teleprompter: $('#teleprompter'), teleText: $('#teleText'), focusMark: $('#focusMark'),
    panelHost: $('#panelHost'), panelTitle: $('#panelTitle'), panelBody: $('#panelBody'), panelClose: $('#panelClose'),
    toast: $('#toast'),
    vpKelvin: $('#vpKelvin'), kInput: $('#kInput'), kSlider: $('#kSlider'),
    pvThumb: $('#pvThumb'), gallery: $('#gallery'), gGrid: $('#gGrid'), gSession: $('#gSession'), gSessionWrap: $('#gSessionWrap'),
    gStatus: $('#gStatus'), gViewer: $('#gViewer'), gvImg: $('#gvImg'), gvInfo: $('#gvInfo'), gvImport: $('#gvImport'),
    gvOpen: $('#gvOpen'), gvProg: $('#gvProg')
  };

  // الحالة
  const defaults = {
    lutOn:false, lutIntensity:100, activeLutId:null,
    zebra:false, zebraTh:95, falseColor:false, clipWarn:false, crushWarn:false, crushTh:4,
    hist:true, histRGB:false, wave:false, parade:false, scopeSource:'pre', scopeRate:3,
    zoom:100, peaking:false, peakColor:'r', peakStr:30,
    gThirds:false, gCenter:false, gAspect:'', gSafe:false, gOpacity:60,
    flipH:false, refOn:false, refOpacity:50,
    lutSplit:false,
    teleOn:false, teleRun:false, teleTextContent:'', teleSpeed:40, teleSize:34, telePos:'center', teleMirror:false, teleBg:35,
    keepOn:true, lvSize:'L'
  };
  let S = Object.assign({}, defaults, Store.getSettings());
  let caps = null;               // قدرات الكاميرا المكتشَفة
  let lastStatus = {};           // آخر حالة كاميرا (للمنتقي)
  let connected = false, testMode = false;
  let refImageURL = null;
  let recStartMs = 0, recTimer = null;
  let currentModel = 'default';

  // FPS
  let frameCount = 0, fpsWindow = [], lastProcMs = 0, lastFrameMs = 0;
  let appVisible = false;

  // تشخيص
  const diag = [];
  let framesTotal = 0, lastCaps = null, lastStream = '—', lastWifi = '—', lastFrameSize = '—', lastDisplayPath = '—';
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
      ['مسار العرض', lastDisplayPath],
      ['حجم لوح العرض', (el.view.width||0)+'×'+(el.view.height||0)+' (عرض '+(el.view.clientWidth||0)+'×'+(el.view.clientHeight||0)+')'],
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
    Scopes.attach(el.ovHist.querySelector('canvas'), el.ovWave.querySelector('canvas'));
    Scopes.setEnabled({hist:S.hist, histRGB:S.histRGB, wave:S.wave, parade:S.parade});
    Bridge.setFrameHandler(onNativeFrame);
    wireBridgeEvents();
    wireChrome();
    wireWelcome();
    wireManualWifi();
    Bridge.cmd.keepScreenOn(S.keepOn);
    pollPhoneStatus();
    drawGuides();
    applyTele();
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

  // إطار مُعلّق يُعرض داخل rAF
  let pendingFrame = null;
  const vctx = el.view.getContext('2d');
  // LUT نشط للمعالجة على المعالج المركزي (2D) — أوثق من WebGL على هذا الجهاز
  let activeLut = null;
  let splitX = 0.5; // موضع شريط المقارنة قبل/بعد (0..1 من عرض الكادر)
  function updateSplitHandle(){
    const sh = document.getElementById('splitHandle'); if(!sh) return;
    const show = S.lutOn && S.lutSplit && appVisible;
    sh.classList.toggle('hidden', !show);
    if(show){
      const cr = el.view.getBoundingClientRect(), sr = el.stage.getBoundingClientRect();
      sh.style.top = (cr.top - sr.top) + 'px';
      sh.style.height = cr.height + 'px';
      sh.style.left = (cr.left - sr.left + splitX * cr.width) + 'px';
    }
  }

  // لوح معالجة المؤثّرات
  const fx = document.createElement('canvas');
  const fxctx = fx.getContext('2d', { willReadFrequently: true });
  let lastVW = 0, lastVH = 0;

  function anyEffect(){ return S.lutOn || S.falseColor || S.zebra || S.peaking || S.clipWarn || S.crushWarn; }

  function renderFrame(src, w, h){
    if(fx.width !== w || fx.height !== h){ fx.width = w; fx.height = h; }
    fxctx.drawImage(src, 0, 0, w, h);
    if(anyEffect()){
      try {
        const img = fxctx.getImageData(0, 0, w, h);
        applyEffects2D(img.data, w, h);
        fxctx.putImageData(img, 0, 0);
      } catch(e){ dlog('خطأ مؤثّرات: '+e.message); }
    }
    drawToView(fx, w, h);
    // مقارنة قبل/بعد بشريط قابل للسحب (عند تفعيل LUT + وضع المقارنة)
    if(S.lutOn && S.lutSplit){ drawSplitRaw(src, w, h); }
    updateSplitHandle();
    if(w !== lastVW || h !== lastVH){ lastVW = w; lastVH = h; drawGuides(); }
  }
  function drawSplitRaw(src, w, h){
    const sx = Math.round(splitX * w);
    const z = S.zoom/100;
    try {
      vctx.save(); vctx.beginPath(); vctx.rect(sx, 0, w - sx, h); vctx.clip();
      if(z <= 1.001){ vctx.drawImage(src, 0, 0, w, h); }
      else { const sw=w/z, sh=h/z, ox=(w-sw)/2, oy=(h-sh)/2; vctx.drawImage(src, ox,oy,sw,sh, 0,0,w,h); }
      vctx.restore();
      vctx.fillStyle = '#f5b301'; vctx.fillRect(sx-1, 0, 2, h);
    } catch(e){ try{ vctx.restore(); }catch(_){}}
  }
  function drawToView(canvasSrc, w, h){
    if(el.view.width !== w || el.view.height !== h){ el.view.width = w; el.view.height = h; }
    const z = S.zoom/100;
    try {
      if(z <= 1.001){ vctx.drawImage(canvasSrc, 0, 0); }
      else { const sw=w/z, sh=h/z, sx=(w-sw)/2, sy=(h-sh)/2; vctx.drawImage(canvasSrc, sx,sy,sw,sh, 0,0,w,h); }
    } catch(e){}
  }

  // ---- مؤثّرات المونيتور على المعالج (تعمل على كل الأجهزة) ----
  function applyEffects2D(d, w, h){
    const lut = (S.lutOn && activeLut) ? activeLut : null;
    const N = lut ? lut.size : 0;
    const inten = S.lutIntensity/100;
    const Nf = N-1, NN = N*N, N3 = N*3, NN3 = NN*3, L = lut ? lut.rgb : null;
    const zth = S.zebraTh/100*255;
    const cth = S.crushTh/100*255;
    let peak = null, pc = null;
    if(S.peaking){ peak = computeEdges(d, w, h); pc = peakColor255(S.peakColor); }
    for(let i=0, p=0; i<d.length; i+=4, p++){
      let r=d[i], g=d[i+1], b=d[i+2];
      if(lut){
        // استيفاء ثلاثي خطّي (trilinear) — يزيل التدرّج/التحبّب الناتج عن أقرب نقطة
        const fr=r*Nf/255, fg=g*Nf/255, fb=b*Nf/255;
        let r0=fr|0, g0=fg|0, b0=fb|0; if(r0>Nf)r0=Nf; if(g0>Nf)g0=Nf; if(b0>Nf)b0=Nf;
        const dr=fr-r0, dg=fg-g0, db=fb-b0;
        const sr=r0<Nf?3:0, sg=g0<Nf?N3:0, sb=b0<Nf?NN3:0;
        const i000=(r0+g0*N+b0*NN)*3, i100=i000+sr, i010=i000+sg, i110=i010+sr,
              i001=i000+sb, i101=i001+sr, i011=i001+sg, i111=i011+sr;
        const er=1-dr, eg=1-dg, eb=1-db;
        let o0=0,o1=0,o2=0;
        for(let c=0;c<3;c++){
          const c0=(L[i000+c]*er+L[i100+c]*dr)*eg+(L[i010+c]*er+L[i110+c]*dr)*dg;
          const c1=(L[i001+c]*er+L[i101+c]*dr)*eg+(L[i011+c]*er+L[i111+c]*dr)*dg;
          const v=(c0*eb+c1*db)*255;
          if(c===0)o0=v; else if(c===1)o1=v; else o2=v;
        }
        if(inten<1){ o0=r+(o0-r)*inten; o1=g+(o1-g)*inten; o2=b+(o2-b)*inten; }
        r=o0; g=o1; b=o2;
      }
      const y=0.2126*r+0.7152*g+0.0722*b;
      if(S.falseColor){ const c=falseColor255(y); r=c[0]; g=c[1]; b=c[2]; }
      else {
        if(S.clipWarn && (r>=252||g>=252||b>=252)){ r=255; g=0; b=0; }
        else if(S.crushWarn && y<=cth){ r=0; g=48; b=255; }
        if(S.zebra && y>=zth){ if((((p%w)+((p/w)|0))%14)<7){ r*=0.12; g*=0.12; b*=0.12; } } // خطوط داكنة مائلة تظهر على المناطق الساطعة
        if(peak && peak[p]){ r=pc[0]; g=pc[1]; b=pc[2]; }
      }
      d[i]=r; d[i+1]=g; d[i+2]=b;
    }
  }
  function computeEdges(d, w, h){
    const out=new Uint8Array(w*h);
    const th=(0.62 - S.peakStr/100*0.55)*255;
    for(let y=0;y<h-1;y++){
      for(let x=0;x<w-1;x++){
        const p=y*w+x, i=p*4;
        const l=0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2];
        const ir=i+4, lr=0.2126*d[ir]+0.7152*d[ir+1]+0.0722*d[ir+2];
        const id=i+w*4, ld=0.2126*d[id]+0.7152*d[id+1]+0.0722*d[id+2];
        if(Math.abs(l-lr)+Math.abs(l-ld) > th) out[p]=1;
      }
    }
    return out;
  }
  function falseColor255(y){
    const f=y/255;
    if(f<0.02) return [128,0,128]; if(f<0.10) return [0,0,204]; if(f<0.20) return [0,153,204];
    if(f<0.38) return [0,153,51]; if(f<0.44) return [102,230,77]; if(f<0.52) return [153,153,153];
    if(f<0.56) return [242,128,153]; if(f<0.70) return [204,204,204]; if(f<0.90) return [242,217,51];
    if(f<0.97) return [242,140,26]; return [242,26,26];
  }
  function peakColor255(c){ return c==='g'?[0,255,0]:c==='b'?[0,102,255]:c==='y'?[255,230,0]:[255,0,0]; }

  // حساب الأدوات من إطار مصغّر
  const scopeCv = document.createElement('canvas');
  const scctx = scopeCv.getContext('2d', { willReadFrequently: true });
  let scopeFrameCtr = 0;
  function maybeScopes2D(src, w, h){
    if(!(S.hist||S.histRGB||S.wave||S.parade)) return;
    if((++scopeFrameCtr % Math.max(1,S.scopeRate)) !== 0) return;
    const sw = 256, sh = Math.max(48, Math.round(256 * h / w));
    if(scopeCv.width !== sw || scopeCv.height !== sh){ scopeCv.width = sw; scopeCv.height = sh; }
    try {
      scctx.drawImage(src, 0, 0, sw, sh);
      const img = scctx.getImageData(0, 0, sw, sh);
      Scopes.update({ width: sw, height: sh, pixels: img.data });
    } catch(e){}
  }

  // ============ حلقة العرض (كل الرسم داخل rAF) ============
  function loop(){
    if(appVisible){
      if(testMode){
        const cv = TestPattern.draw();
        renderFrame(cv, TestPattern.width, TestPattern.height);
        lastFrameMs = performance.now();
        tickFps(performance.now());
        maybeScopes2D(cv, TestPattern.width, TestPattern.height);
      } else if(pendingFrame){
        const t = performance.now();
        const bmp = pendingFrame.bitmap, dec = pendingFrame.decodeMs;
        const w = bmp.width, h = bmp.height;
        try { renderFrame(bmp, w, h); } catch(e){ dlog('خطأ رسم: '+e.message); }
        lastProcMs = (performance.now()-t) + dec;
        lastFrameMs = t;
        el.noSignal.classList.add('hidden');
        lastDisplayPath = anyEffect() ? '2D + مؤثّرات' : '2D مباشر';
        maybeScopes2D(bmp, w, h);
        if(bmp.close) bmp.close();
        pendingFrame = null;
        tickFps(t);
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

  // يظهر حالة «لا إشارة» إذا لم تصل إطارات لفترة والمونيتور ظاهر + إعادة اتصال تلقائية
  let lastAutoConnect = 0;
  function checkNoSignal(){
    if(!appVisible){ el.noSignal.classList.add('hidden'); return; }
    drawGuides(); // إعادة محاذاة الأدلة (مثلًا بعد قلب الشاشة)
    if(testMode){ el.noSignal.classList.add('hidden'); return; }
    const staleMs = performance.now() - lastFrameMs;
    const stale = staleMs > 2500;
    // إعادة اتصال تلقائية عند انقطاع طويل (مثلًا بعد تبديل وضع الكاميرا فوتو/فيديو)
    if(staleMs > 6000 && Bridge.hasNative && (performance.now() - lastAutoConnect > 9000)){
      lastAutoConnect = performance.now();
      dlog('إعادة اتصال تلقائية بعد انقطاع البثّ…');
      Bridge.cmd.connect();
    }
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
      if(d.action==='touchFocus' && d.ok) onFocusResult(d);
      if(d.action==='set' && d.ok && d.kind==='colortemp') toast('أُرسلت '+d.value+'K — بانتظار تأكيد الكاميرا');
      if(!d.ok){ if(d.label==='التركيز') markFocus('fail'); toast('✗ '+(d.label||d.action||'أمر')+': '+(d.message||'فشل'), 6000); }
    });
    Bridge.on('log', d=> dlog(d.msg||''));
    Bridge.on('postview', onPostview);
    Bridge.on('gallery', onGalleryEvent);
    Bridge.on('thumb', onThumb);
    Bridge.on('import', onImport);
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

    Object.assign(lastStatus, st);

    // شريط إعدادات الكاميرا الحيّة أعلى الشاشة + شريط التحكّم السفلي
    if(st.fnumber){ const v='F'+String(st.fnumber).replace(/^F/i,''); el.rdF.textContent=v; el.ccF.textContent=v; }
    if(st.shutter){ el.rdSS.textContent=st.shutter; el.ccSS.textContent=st.shutter; }
    if(st.iso){ const v=String(st.iso).replace(/^ISO\s*/i,''); el.rdISO.textContent='ISO '+v; el.ccISO.textContent=v; }
    if(st.whiteBalance || st.colorTemp){ const w=wbLabel(); el.rdWB.textContent=w; el.ccWB.textContent=w; }
    if(st.focusMode) el.rdFocus.textContent = st.focusMode;
    if(st.exposureMode) el.rdMode.textContent = shortMode(st.exposureMode);
    if(st.exposureCompIndex!=null){ const step=(st.exposureCompStep===1)?0.5:(1/3); const ev=st.exposureCompIndex*step; el.ccEV.textContent=(ev>0?'+':'')+ev.toFixed(1).replace('.0',''); }

    // تحديث القيم الظاهرة في لوحة التحكم (القيمة الحالية فقط — تأكيد من الكاميرا)
    fillSelectCurrent('setIso', st.iso, st.isoCandidates);
    fillSelectCurrent('setShutter', st.shutter, st.shutterCandidates);
    fillSelectCurrent('setF', st.fnumber, st.fnumberCandidates);
  }
  function wbLabel(){
    const w=lastStatus.whiteBalance||'';
    if(/color\s*temp/i.test(w) && lastStatus.colorTemp>0) return lastStatus.colorTemp+'K';
    return shortWB(w);
  }
  function shortWB(w){
    const s=String(w);
    if(/auto/i.test(s)) return 'AWB';
    if(/color\s*temp/i.test(s)) return 'K';
    if(/daylight|sunny/i.test(s)) return '☀';
    if(/cloud/i.test(s)) return '☁';
    if(/shade/i.test(s)) return 'Shade';
    if(/incand|tungsten/i.test(s)) return 'Tung';
    if(/fluor/i.test(s)) return 'Fluo';
    if(/flash/i.test(s)) return 'Flash';
    return s.length>6 ? s.slice(0,6) : s;
  }
  function shortMode(m){
    const s=String(m);
    if(/manual/i.test(s)) return 'M';
    if(/aperture/i.test(s)) return 'A';
    if(/shutter/i.test(s)) return 'S';
    if(/program/i.test(s)) return 'P';
    if(/intelligent|auto/i.test(s)) return 'AUTO';
    if(/movie/i.test(s)) return 'MOV';
    return s.length>4 ? s.slice(0,4) : s;
  }

  function setRecording(on){
    el.recGroup.classList.toggle('hidden', !on);
    el.btnRecDock.classList.toggle('recording', on);
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
    if(active){ try { activeLut = LutParser.fromStorable(active.lut); } catch(e){ activeLut = null; } }
    else { activeLut = null; }
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
    el.menu.querySelectorAll('button[data-panel]').forEach(b=>b.classList.toggle('active', b.dataset.panel===name));
    el.panelTitle.textContent = ({scopes:'أدوات المراقبة',lut:'LUT للمعاينة',focus:'التركيز والتأطير',tele:'التيليبرومتر',control:'التحكم بالكاميرا',files:'الملفات والمشاريع',settings:'الإعدادات'})[name]||'لوحة';
    ({scopes:wireScopes,lut:wireLut,focus:wireFocus,tele:wireTele,control:wireControl,files:wireFiles,settings:wireSettings})[name]();
  }

  function wireChrome(){
    el.menuBtn.onclick = ()=> el.menu.classList.toggle('hidden');
    [...el.menu.querySelectorAll('button[data-panel]')].forEach(b=> b.onclick = ()=>{ el.menu.classList.add('hidden'); openPanel(b.dataset.panel); });
    $('#menuHome').onclick = ()=>{ el.menu.classList.add('hidden'); goHome(); };
    el.panelClose.onclick = ()=> el.panelHost.classList.add('hidden');
    el.hideUiBtn.onclick = ()=> document.body.classList.toggle('hiddenUi');
    window.addEventListener('resize', ()=> setTimeout(drawGuides, 60));
    window.addEventListener('orientationchange', ()=> setTimeout(drawGuides, 120));
    el.stage.addEventListener('click', (e)=>{
      if(!el.menu.classList.contains('hidden')){ el.menu.classList.add('hidden'); return; }
      if(document.body.classList.contains('hiddenUi')){ document.body.classList.remove('hiddenUi'); return; }
      if(!el.valuePicker.classList.contains('hidden')){ el.valuePicker.classList.add('hidden'); return; }
      // نقرة على الصورة = نقل التركيز لتلك النقطة (إن دعمت الكاميرا)
      if(connected && !testMode) focusAtEvent(e);
    });

    // الشريط السفلي: توغلات سريعة + أزرار التصوير
    document.querySelectorAll('.qbtn').forEach(b=> b.onclick = ()=> toggleQuick(b.dataset.q));
    refreshQuick();
    el.btnPhoto.onclick = ()=>{ toast('جارٍ الالتقاط…'); Bridge.cmd.takePicture(); };
    el.btnRecDock.onclick = ()=>{ if(el.btnRecDock.classList.contains('recording')) Bridge.cmd.stopMovieRec(); else Bridge.cmd.startMovieRec(); };
    el.filesBtn.onclick = ()=> openGallery();
    el.teleBtn.onclick = ()=>{ S.teleOn=!S.teleOn; persist(); applyTele(); };
    // منتقي القيمة من شريط التحكّم السفلي وشريط الإعدادات العلوي
    document.querySelectorAll('.cchip[data-ctl], #readout .rd[data-ctl]').forEach(b=> b.onclick = ()=> openValuePicker(b.dataset.ctl));
    $('#vpClose').onclick = ()=> el.valuePicker.classList.add('hidden');
    // سحب شريط مقارنة LUT
    wireSplitDrag();
    wireGallery();
    if(window.ResizeObserver){ try{ new ResizeObserver(()=>{ drawGuides(); updateSplitHandle(); }).observe(el.view); }catch(e){} }

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

  // توغلات الشريط السفلي السريعة
  function toggleQuick(q){
    const map = { hist:'hist', wave:'wave', 'false':'falseColor', peak:'peaking', zebra:'zebra', grid:'gThirds', lut:'lutOn' };
    const key = map[q]; if(!key) return;
    S[key] = !S[key]; persist();
    if(q==='hist' || q==='wave') Scopes.setEnabled({ hist:S.hist, wave:S.wave });
    applyParamsToGL(); drawGuides(); refreshQuick();
  }
  function refreshQuick(){
    const st = { hist:S.hist, wave:S.wave, 'false':S.falseColor, peak:S.peaking, zebra:S.zebra, grid:S.gThirds, lut:S.lutOn };
    document.querySelectorAll('.qbtn').forEach(b=> b.classList.toggle('on', !!st[b.dataset.q]));
  }

  // منتقي قيمة الإعداد (يفتح من الشريط السفلي/العلوي)
  function openValuePicker(kind){
    if(!connected){ toast('اتصل بالكاميرا أولًا'); return; }
    const info = {
      iso:      { title:'ISO', cand:lastStatus.isoCandidates, cur:lastStatus.iso },
      shutter:  { title:'سرعة الغالق', cand:lastStatus.shutterCandidates, cur:lastStatus.shutter },
      fnumber:  { title:'فتحة العدسة', cand:lastStatus.fnumberCandidates, cur:lastStatus.fnumber },
      whitebalance:{ title:'توازن الأبيض', cand:(caps&&caps.wbCandidates)||[], cur:lastStatus.whiteBalance },
      exposure: { title:'تعويض التعريض', cand:exposureCandidates(), cur:(lastStatus.exposureCompIndex||0) }
    }[kind];
    if(!info){ return; }
    const list = Array.isArray(info.cand) ? info.cand : [];
    const kelvin = kind==='whitebalance' && kelvinAvailable();
    el.vpKelvin.classList.toggle('hidden', !kelvin);
    if(kelvin) setupKelvin();
    if(!list.length && !kelvin){ toast('لا خيارات متاحة الآن — قد يكون الإعداد مقفولًا على الكاميرا'); return; }
    el.vpTitle.textContent = info.title;
    el.vpList.innerHTML = '';
    list.forEach(v=>{
      const b=document.createElement('button'); b.className='vpitem'+(String(v)===String(info.cur)?' cur':'');
      b.textContent = kind==='exposure' ? evLabel(v) : v;
      b.onclick = ()=>{ Bridge.cmd.setSetting(kind, v); toast('أُرسل — بانتظار تأكيد الكاميرا…'); el.valuePicker.classList.add('hidden'); };
      el.vpList.appendChild(b);
    });
    el.valuePicker.classList.remove('hidden');
  }
  // ---- حرارة اللون (كلفن): كتابة يدوية + سحب يمين/يسار ----
  function kelvinAvailable(){
    if(!caps || caps.canSetWhiteBalance===false) return false;
    return !!caps.colorTempRange || (caps.wbCandidates||[]).some(w=>/color\s*temp/i.test(w));
  }
  function kRange(){ const r=(caps&&caps.colorTempRange)||{}; return { min:r.min||2500, max:r.max||9900, step:r.step||100 }; }
  function kClamp(v){ const r=kRange(); v=Math.round((+v||5600)/r.step)*r.step; return Math.min(r.max, Math.max(r.min, v)); }
  let kTimer=null, kWired=false;
  function setupKelvin(){
    const r=kRange();
    [el.kSlider, el.kInput].forEach(x=>{ x.min=r.min; x.max=r.max; x.step=r.step; });
    const cur = kClamp(lastStatus.colorTemp>0 ? lastStatus.colorTemp : 5600);
    el.kSlider.value=cur; el.kInput.value=cur;
    const sc=el.vpKelvin.querySelector('.vpk-scale'); if(sc) sc.innerHTML=`<span>${r.min}K</span><span>☀ 5600K</span><span>${r.max}K</span>`;
    if(kWired) return; kWired=true;
    const send=(v, delay)=>{ v=kClamp(v); el.kInput.value=v; el.kSlider.value=v; clearTimeout(kTimer);
      kTimer=setTimeout(()=>Bridge.cmd.setSetting('colortemp', v), delay); };
    el.kSlider.addEventListener('input', ()=>{ el.kInput.value=el.kSlider.value; send(el.kSlider.value, 450); });
    el.kSlider.addEventListener('change', ()=> send(el.kSlider.value, 0));
    el.kInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){ send(el.kInput.value, 0); el.kInput.blur(); } });
    $('#kApply').onclick = ()=> send(el.kInput.value, 0);
    $('#kMinus').onclick = ()=> send((+el.kInput.value||5600) - kRange().step, 500);
    $('#kPlus').onclick  = ()=> send((+el.kInput.value||5600) + kRange().step, 500);
  }
  function exposureCandidates(){
    const mn = lastStatus.exposureCompMin, mx = lastStatus.exposureCompMax;
    if(mn==null||mx==null) return [];
    const out=[]; for(let i=mn;i<=mx;i++) out.push(i); return out;
  }
  function evLabel(i){ const step=(lastStatus.exposureCompStep===1)?0.5:(1/3); const ev=i*step; return (ev>0?'+':'')+ev.toFixed(1).replace('.0',''); }

  // ---- النقر للتركيز ----
  let focusMarkTimer=null;
  function focusAtEvent(e){
    const cr=el.view.getBoundingClientRect();
    let x=(e.clientX-cr.left)/cr.width, y=(e.clientY-cr.top)/cr.height;
    if(x<0||x>1||y<0||y>1) return;
    if(S.flipH) x=1-x;
    const sr=el.stage.getBoundingClientRect();
    el.focusMark.style.left=(e.clientX-sr.left)+'px'; el.focusMark.style.top=(e.clientY-sr.top)+'px';
    markFocus(''); el.focusMark.classList.remove('hidden'); el.focusMark.style.animation='none'; void el.focusMark.offsetWidth; el.focusMark.style.animation='';
    clearTimeout(focusMarkTimer); focusMarkTimer=setTimeout(()=>el.focusMark.classList.add('hidden'),3200);
    Bridge.cmd.touchFocus(Math.round(x*100), Math.round(y*100));
  }

  let focusNoteShown=false;
  function markFocus(state){
    el.focusMark.style.borderColor = state==='ok' ? '#22c55e' : state==='fail' ? '#ef4444' : '';
  }
  function onFocusResult(d){
    const fs=(d.focusStatus||'').toLowerCase();
    markFocus(fs==='focused'?'ok':fs==='failed'?'fail':'');
    if(d.mode==='halfpress'){
      if(!focusNoteShown){ focusNoteShown=true;
        toast('هذه الكاميرا لا تسمح باختيار نقطة التركيز من الهاتف؛ نفّذنا تركيزًا تلقائيًا (ضغط نصفي) على منطقة التركيز المضبوطة في الكاميرا'+(fs?(' — '+(fs==='focused'?'تم التركيز ✓':fs==='failed'?'فشل التركيز':fs)):''), 7000);
      } else toast(fs==='focused'?'تم التركيز ✓':fs==='failed'?'تعذّر التركيز':'أُرسل أمر التركيز');
    }
  }

  // ---- لقطات الجلسة + معرض الكاميرا ----
  const sessionShots=[]; let galleryItems=[]; const thumbCache={}; let gKind='photo'; let viewerItem=null;
  function onPostview(d){
    const src='data:image/jpeg;base64,'+d.b64;
    sessionShots.unshift({ id:'pv'+d.ts, url:d.url, src, ts:d.ts, title:'IMG_'+new Date(d.ts).toISOString().replace(/[-:T]/g,'').slice(0,14)+'.jpg', kind:'photo', mime:'image/jpeg', size:0, session:true });
    if(sessionShots.length>60) sessionShots.pop();
    el.pvThumb.querySelector('img').src=src; el.pvThumb.classList.remove('hidden');
    if(!el.gallery.classList.contains('hidden')) renderGallery();
  }
  function openGallery(kind){
    gKind = kind || ((lastStatus.shootMode==='movie' || el.btnRecDock.classList.contains('recording')) ? 'video' : 'photo');
    el.gallery.classList.remove('hidden');
    renderGallery();
    if(!galleryItems.length && !el.gStatus.textContent)
      el.gStatus.textContent='ملفات البطاقة: اضغط «تحميل من البطاقة». ملاحظة: a7 III لا تتيح ملفات البطاقة أثناء التحكّم عن بُعد — يلزم وضع «إرسال إلى الهاتف الذكي» في الكاميرا.';
  }
  function closeGallery(){ el.gallery.classList.add('hidden'); el.gViewer.classList.add('hidden'); }
  function renderGallery(){
    document.querySelectorAll('.gtab').forEach(b=>b.classList.toggle('on', b.dataset.gk===gKind));
    el.gSessionWrap.classList.toggle('hidden', gKind!=='photo' || !sessionShots.length);
    el.gSession.innerHTML=''; sessionShots.forEach(it=> el.gSession.appendChild(galleryCell(it)));
    el.gGrid.innerHTML='';
    const list=galleryItems.filter(it=>it.kind===gKind);
    list.forEach(it=> el.gGrid.appendChild(galleryCell(it)));
    if(galleryItems.length && !list.length){ const p=document.createElement('div'); p.className='g-status'; p.textContent= gKind==='video'?'لا مقاطع فيديو على البطاقة (أو أن الكاميرا لا تشاركها في هذا الوضع).':'لا صور على البطاقة.'; el.gGrid.appendChild(p); }
  }
  function galleryCell(it){
    const b=document.createElement('button'); b.className='g-cell'; b.dataset.id=it.id;
    const img=document.createElement('img'); img.loading='lazy';
    if(it.src) img.src=it.src;
    else if(thumbCache[it.id]) img.src=thumbCache[it.id];
    else if(it.thumb) Bridge.cmd.getThumb(it.id, it.thumb);
    b.appendChild(img);
    const n=document.createElement('span'); n.className='gname'; n.textContent=it.title; b.appendChild(n);
    if(it.kind==='video'){ const v=document.createElement('span'); v.className='gbadge'; v.textContent='▶ فيديو'; b.appendChild(v); }
    if(it.imported){ const k=document.createElement('span'); k.className='gok'; k.textContent='✓'; b.appendChild(k); }
    b.onclick=()=>openViewer(it);
    return b;
  }
  function onThumb(d){
    if(!d.b64) return;
    const src='data:image/jpeg;base64,'+d.b64; thumbCache[d.id]=src;
    document.querySelectorAll('.g-cell').forEach(c=>{ if(c.dataset.id===d.id){ const i=c.querySelector('img'); if(i) i.src=src; } });
    if(viewerItem && viewerItem.id===d.id) el.gvImg.src=src;
  }
  function onGalleryEvent(d){
    dlog('المعرض: '+d.state+(d.message?(' — '+d.message):'')+(d.items?(' عناصر='+d.items.length):''));
    if(d.state==='searching') el.gStatus.textContent='جارٍ البحث عن خادم ملفات الكاميرا…';
    else if(d.state==='listing') el.gStatus.textContent='جارٍ قراءة قائمة الملفات من '+(d.server||'الكاميرا')+'…';
    else if(d.state==='error') el.gStatus.textContent=d.message||'تعذّر الاستعراض';
    else if(d.state==='done'){
      galleryItems=d.items||[];
      const ph=galleryItems.filter(i=>i.kind==='photo').length, vd=galleryItems.filter(i=>i.kind==='video').length;
      el.gStatus.textContent=(d.server||'الكاميرا')+': '+ph+' صورة، '+vd+' فيديو. الأصل يُنسخ كما هو دون تعديل، ولا يُحذف شيء من البطاقة.';
      renderGallery();
    }
  }
  function openViewer(it){
    viewerItem=it;
    el.gvImg.src = it.src || thumbCache[it.id] || '';
    el.gvInfo.textContent = it.title + (it.size?(' — '+fmtBytes(it.size)):'') + (it.session?' (معاينة)':'');
    el.gvProg.classList.add('hidden'); el.gvProg.firstElementChild.style.width='0';
    el.gvOpen.classList.toggle('hidden', !it.imported);
    el.gvImport.textContent = it.session ? 'حفظ المعاينة' : (it.kind==='video'?'استيراد الفيديو':'استيراد الأصل');
    el.gvImport.disabled=false;
    el.gViewer.classList.remove('hidden');
  }
  function onImport(d){
    const it = viewerItem && viewerItem.id===d.id ? viewerItem : (galleryItems.find(x=>x.id===d.id) || sessionShots.find(x=>x.id===d.id));
    if(d.pct!=null && !d.done && viewerItem && viewerItem.id===d.id){ el.gvProg.classList.remove('hidden'); el.gvProg.firstElementChild.style.width=(d.pct<0?50:d.pct)+'%'; }
    if(!d.done) return;
    if(viewerItem && viewerItem.id===d.id){ el.gvImport.disabled=false; el.gvProg.firstElementChild.style.width=d.ok?'100%':'0'; }
    if(d.ok){
      if(it){ it.imported=d.uri; }
      if(viewerItem && viewerItem.id===d.id) el.gvOpen.classList.remove('hidden');
      toast(d.dup?'موجود في الهاتف مسبقًا (لم يُكرَّر)':'حُفظ في معرض الهاتف ✓ (SonyMonitor)');
      renderGallery();
    } else toast('✗ الاستيراد: '+(d.message||'فشل'), 6000);
  }
  function fmtBytes(n){ if(n>1e9) return (n/1e9).toFixed(2)+' GB'; if(n>1e6) return (n/1e6).toFixed(1)+' MB'; return Math.round(n/1e3)+' KB'; }
  function wireGallery(){
    $('#gClose').onclick=closeGallery;
    $('#gRefresh').onclick=()=>{ el.gStatus.textContent='…'; Bridge.cmd.browseMedia(); };
    document.querySelectorAll('.gtab').forEach(b=> b.onclick=()=>{ gKind=b.dataset.gk; renderGallery(); });
    $('#gvClose').onclick=()=>{ el.gViewer.classList.add('hidden'); viewerItem=null; };
    el.gvImport.onclick=()=>{
      const it=viewerItem; if(!it) return;
      el.gvImport.disabled=true; el.gvProg.classList.remove('hidden');
      Bridge.cmd.importMedia(it.id, it.url, it.title, it.mime||'image/jpeg', it.size||0);
    };
    el.gvOpen.onclick=()=>{ const it=viewerItem; if(it && it.imported) Bridge.cmd.openMedia(it.imported, it.mime||''); };
    el.pvThumb.onclick=()=> openGallery('photo');
    // سحب يمينًا على المونيتور = فتح المعرض
    let sx=0, sy=0, st=0, ok=false;
    el.stage.addEventListener('touchstart', e=>{ const t=e.touches[0]; ok = e.touches.length===1 && !e.target.closest('#splitHandle'); if(t){ sx=t.clientX; sy=t.clientY; st=Date.now(); } }, {passive:true});
    el.stage.addEventListener('touchend', e=>{
      if(!ok) return; ok=false;
      const t=e.changedTouches[0]; if(!t) return;
      const dx=t.clientX-sx, dy=t.clientY-sy;
      if(dx>80 && Math.abs(dy)<60 && Date.now()-st<700) openGallery();
    }, {passive:true});
  }

  // ---- سحب شريط مقارنة LUT ----
  function wireSplitDrag(){
    const sh=document.getElementById('splitHandle'); if(!sh) return;
    let dragging=false;
    const move=(cx)=>{ const cr=el.view.getBoundingClientRect(); splitX=Math.min(0.98,Math.max(0.02,(cx-cr.left)/cr.width)); updateSplitHandle(); };
    const start=e=>{ dragging=true; e.stopPropagation(); };
    sh.addEventListener('touchstart',start,{passive:true}); sh.addEventListener('mousedown',start);
    window.addEventListener('touchmove',e=>{ if(dragging&&e.touches[0]) move(e.touches[0].clientX); },{passive:true});
    window.addEventListener('mousemove',e=>{ if(dragging) move(e.clientX); });
    window.addEventListener('touchend',()=>dragging=false); window.addEventListener('mouseup',()=>dragging=false);
  }

  // ---- التيليبرومتر ----
  let teleY=0, teleRAF=null, teleLastT=0;
  function applyTele(){
    const tp=el.teleprompter;
    tp.classList.toggle('hidden', !S.teleOn);
    tp.classList.remove('pos-center','pos-top','pos-bottom'); tp.classList.add('pos-'+(S.telePos||'center'));
    tp.classList.toggle('mirror', !!S.teleMirror);
    tp.style.background='rgba(0,0,0,'+((S.teleBg||0)/100)+')';
    el.teleText.style.fontSize=(S.teleSize||34)+'px';
    el.teleText.textContent=S.teleTextContent||'';
    if(S.teleOn && S.teleRun) startTele(); else stopTele();
  }
  function startTele(){ if(teleRAF) return; teleLastT=performance.now(); teleRAF=requestAnimationFrame(teleStep); }
  function stopTele(){ if(teleRAF){ cancelAnimationFrame(teleRAF); teleRAF=null; } }
  function teleStep(t){
    const dt=(t-teleLastT)/1000; teleLastT=t;
    teleY -= (S.teleSpeed||40)*dt;
    const tp=el.teleprompter, contentH=el.teleText.scrollHeight, wrapH=tp.clientHeight;
    if(teleY < -(contentH+wrapH)) teleY=0;
    el.teleText.style.top=(wrapH+teleY)+'px';
    teleRAF=requestAnimationFrame(teleStep);
  }

  // زر الرجوع من الأصل: يغلق القائمة/اللوحة/يُظهر الواجهة قبل الخروج
  window.__onBackPressed = function(){
    if(!el.valuePicker.classList.contains('hidden')){ el.valuePicker.classList.add('hidden'); return true; }
    if(!el.gViewer.classList.contains('hidden')){ el.gViewer.classList.add('hidden'); viewerItem=null; return true; }
    if(!el.gallery.classList.contains('hidden')){ closeGallery(); return true; }
    if(!el.menu.classList.contains('hidden')){ el.menu.classList.add('hidden'); return true; }
    if(!el.diag.classList.contains('hidden')){ el.diag.classList.add('hidden'); return true; }
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
    Scopes.setEnabled({hist:S.hist,histRGB:S.histRGB,wave:S.wave,parade:S.parade});
    bindChk('#scHist','hist', v=>{Scopes.setEnabled({hist:v}); refreshQuick();});
    bindChk('#scHistRGB','histRGB', v=>Scopes.setEnabled({histRGB:v}));
    bindChk('#scWave','wave', v=>{Scopes.setEnabled({wave:v}); refreshQuick();});
    bindChk('#scParade','parade', v=>Scopes.setEnabled({parade:v}));
    bindChk('#scZebra','zebra', ()=>{applyParamsToGL(); refreshQuick();});
    bindChk('#scFalse','falseColor', ()=>{applyParamsToGL(); refreshQuick();});
    bindChk('#scClip','clipWarn', ()=>applyParamsToGL());
    bindRange('#zebraTh','#zebraThV','zebraTh', v=>v, ()=>applyParamsToGL());
    bindRange('#crushTh','#crushThV','crushTh', v=>v, ()=>applyParamsToGL());
    const src=$('#scopeSource'); if(src){ src.value=S.scopeSource; src.onchange=()=>{ S.scopeSource=src.value; persist(); }; }
    const host = $('#scopeCanvases');
    if(host){
      host.innerHTML = '<b>دليل False Color:</b><br>' + Scopes.falseColorLegend.map(([c,t])=>`<span style="display:inline-block;width:11px;height:11px;background:${c};margin-inline-end:5px;border-radius:2px;vertical-align:middle"></span>${t}`).join('<br>');
      host.className = 'note small';
    }
  }

  // -------- لوحة LUT --------
  function wireLut(){
    $('#lutOn').checked = S.lutOn;
    $('#lutOn').onchange = e=>{ S.lutOn=e.target.checked; persist(); refreshQuick(); };
    $('#lutSplit').checked = S.lutSplit;
    $('#lutSplit').onchange = e=>{ S.lutSplit=e.target.checked; persist(); updateSplitHandle(); };
    bindRange('#lutIntensity','#lutIntensityV','lutIntensity', v=>v+'%', ()=>{});
    const cmp=$('#btnLutCompare');
    let prev=false;
    const down=()=>{ prev=S.lutOn; S.lutOn=false; }; const up=()=>{ S.lutOn=prev; };
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
    bindChk('#peakOn','peaking', ()=>{applyParamsToGL(); refreshQuick();});
    const pc=$('#peakColor'); pc.value=S.peakColor; pc.onchange=()=>{ S.peakColor=pc.value; persist(); };
    bindRange('#peakStr','#peakStrV','peakStr', v=>v, ()=>{});
    bindChk('#gThirds','gThirds', ()=>{drawGuides(); refreshQuick();});
    bindChk('#gCenter','gCenter', drawGuides);
    const ga=$('#gAspect'); ga.value=S.gAspect; ga.onchange=()=>{ S.gAspect=ga.value; persist(); drawGuides(); };
    bindChk('#gSafe','gSafe', drawGuides);
    bindRange('#gOpacity','#gOpacityV','gOpacity', v=>v+'%', drawGuides);
    bindChk('#flipH','flipH', ()=>applyParamsToGL());
    $('#btnSetRef').onclick = ()=>{ let url=null; try{ url=el.view.toDataURL('image/jpeg',0.9); }catch(e){} if(url){ refImageURL=url; el.refOverlay.src=url; S.refOn=true; persist(); applyParamsToGL(); $('#refOn').checked=true; toast('حُفظت صورة معاينة مرجعية (ليست ملف الكاميرا)'); } };
    bindChk('#refOn','refOn', ()=>applyParamsToGL());
    bindRange('#refOpacity','#refOpacityV','refOpacity', v=>v+'%', ()=>applyParamsToGL());
  }

  // -------- لوحة التيليبرومتر --------
  function wireTele(){
    $('#teleOn').checked=S.teleOn; $('#teleOn').onchange=e=>{ S.teleOn=e.target.checked; persist(); applyTele(); };
    $('#teleRun').checked=S.teleRun; $('#teleRun').onchange=e=>{ S.teleRun=e.target.checked; persist(); applyTele(); };
    const ta=$('#teleTextInput'); ta.value=S.teleTextContent||''; ta.oninput=()=>{ S.teleTextContent=ta.value; persist(); el.teleText.textContent=ta.value; };
    $('#btnTeleImport').onclick=()=> $('#teleFile').click();
    $('#teleFile').onchange=e=>{ const f=e.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ S.teleTextContent=String(rd.result||''); persist(); ta.value=S.teleTextContent; el.teleText.textContent=S.teleTextContent; toast('استُورد النص ✓'); }; rd.readAsText(f); };
    bindRange('#teleSpeed','#teleSpeedV','teleSpeed', v=>v, ()=>{});
    bindRange('#teleSize','#teleSizeV','teleSize', v=>v, ()=>applyTele());
    bindRange('#teleBg','#teleBgV','teleBg', v=>v+'%', ()=>applyTele());
    const tp=$('#telePos'); tp.value=S.telePos||'center'; tp.onchange=()=>{ S.telePos=tp.value; persist(); applyTele(); };
    $('#teleMirror').checked=!!S.teleMirror; $('#teleMirror').onchange=e=>{ S.teleMirror=e.target.checked; persist(); applyTele(); };
    $('#teleReset').onclick=()=>{ teleY=0; };
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
    // أزرار الشريط السفلي — نُفعّلها عند الاتصال (التوفّر يعتمد على وضع الكاميرا وقت الضغط)
    if(el.btnPhoto) el.btnPhoto.disabled = false;
    if(el.btnRecDock) el.btnRecDock.disabled = false;
    setSel('setIso', d.canSetIso); setSel('setShutter', d.canSetShutter); setSel('setF', d.canSetFNumber); setSel('setWB', d.canSetWhiteBalance);
    const wbSel=$('#setWB');
    if(wbSel && Array.isArray(d.wbCandidates) && d.wbCandidates.length){
      wbSel.innerHTML=''; d.wbCandidates.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; wbSel.appendChild(o); });
      if(lastStatus.whiteBalance) wbSel.value=lastStatus.whiteBalance;
    }
    const cc=$('#controlCaps'); if(cc) cc.textContent = 'مفعّل حسب قدرات '+(d.model||'الكاميرا')+': التقاط='+yn(d.hasTakePicture)+'، فيديو='+yn(d.hasMovieRec)+'، ISO='+yn(d.canSetIso)+'، غالق='+yn(d.canSetShutter)+'، فتحة='+yn(d.canSetFNumber)+'.';
  }
  function setSel(id, on){ const s=$('#'+id); if(s) s.disabled=!on; }
  function yn(b){ return b?'نعم':'لا'; }
  function disableControls(){ ['btnShot','btnRec','setIso','setShutter','setF','setWB'].forEach(id=>{ const e=document.getElementById(id); if(e) e.disabled=true; }); if(el.btnPhoto) el.btnPhoto.disabled=true; if(el.btnRecDock) el.btnRecDock.disabled=true; }
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
    const mq=$('#setMovieQuality');
    if(mq){
      const cand = (caps && caps.movieQualityCandidates) || [];
      if(cand.length){ mq.innerHTML=''; cand.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; mq.appendChild(o); }); mq.disabled=false; mq.onchange=()=>{ Bridge.cmd.setSetting('moviequality', mq.value); toast('أُرسل وضع التسجيل — بانتظار الكاميرا'); }; }
      else { mq.innerHTML='<option>غير متاح (اتصل بالكاميرا)</option>'; mq.disabled=true; }
    }
    $('#btnSaveLayout').onclick=()=>{ persist(); toast('حُفظ توزيع الأدوات'); };
    $('#btnResetLayout').onclick=()=>{ S=Object.assign({}, defaults); persist(); applyParamsToGL(); drawGuides(); toast('استُرجعت الإعدادات الافتراضية'); openPanel('settings'); };
    $('#about').innerHTML = 'مونيتور Sony — النسخة 0.2. الاتصال عبر Sony ScalarWebAPI (Camera Remote API) بعد الانضمام لشبكة الكاميرا (QR أو يدوي). البث الحي والالتقاط مبنيان على البروتوكول ويحتاجان تأكيدًا على a7 III؛ التفاصيل في COMPATIBILITY.md.';
  }

  // ============ أدلة التأطير (SVG) ============
  function drawGuides(){
    const svg=el.guides;
    // اضبط SVG فوق مستطيل عرض لوح العرض المرئي
    const cr=el.view.getBoundingClientRect(), sr=el.stage.getBoundingClientRect();
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
    const cw=el.view.width, ch=el.view.height; if(!cw||!ch) return '';
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
  function toast(msg, ms){ el.toast.textContent=msg; el.toast.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.toast.classList.add('hidden'), ms||3200); }

  document.addEventListener('DOMContentLoaded', boot);
})();
