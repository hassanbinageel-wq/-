/* أدوات المراقبة كطبقات فوق الصورة الحيّة.
 * كلها تُحسب من إطار المعاينة المضغوط: قيم تقريبية (0–100%) وليست قياسًا مُعايَرًا.
 */
const Scopes = (() => {
  let histCv, waveCv, hctx, wctx, histWrap, waveWrap;
  let en = { hist:false, histRGB:false, wave:false, parade:false };

  function attach(histCanvas, waveCanvas){
    histCv = histCanvas; waveCv = waveCanvas;
    hctx = histCv.getContext('2d'); wctx = waveCv.getContext('2d');
    histWrap = histCv.parentElement; waveWrap = waveCv.parentElement;
    updateVis();
  }
  function setEnabled(e){ Object.assign(en, e); updateVis(); }
  function updateVis(){
    if(histWrap) histWrap.classList.toggle('hidden', !(en.hist||en.histRGB));
    if(waveWrap) waveWrap.classList.toggle('hidden', !(en.wave||en.parade));
  }

  function update(data){
    if(!data) return;
    if(en.hist || en.histRGB) drawHistogram(data);
    if(en.parade) drawParade(data);
    else if(en.wave) drawWaveform(data);
  }

  function drawHistogram(d){
    const px = d.pixels;
    const L=new Float32Array(256), R=new Float32Array(256), G=new Float32Array(256), B=new Float32Array(256);
    for(let i=0;i<px.length;i+=4){
      const r=px[i], g=px[i+1], b=px[i+2];
      L[(0.2126*r+0.7152*g+0.0722*b)|0]++; R[r]++; G[g]++; B[b]++;
    }
    const W=histCv.width, H=histCv.height;
    hctx.clearRect(0,0,W,H); hctx.fillStyle='#000'; hctx.fillRect(0,0,W,H);
    hctx.strokeStyle='rgba(255,255,255,0.12)'; hctx.lineWidth=1;
    [0.25,0.5,0.75].forEach(f=>{ hctx.beginPath(); hctx.moveTo(f*W,0); hctx.lineTo(f*W,H); hctx.stroke(); });
    const series = en.histRGB
      ? [{d:R,c:'rgba(255,80,80,0.95)'},{d:G,c:'rgba(80,255,120,0.95)'},{d:B,c:'rgba(90,140,255,0.95)'}]
      : [{d:L,c:'#e7e9ee'}];
    let max=1; series.forEach(s=>{ for(let i=0;i<256;i++) if(s.d[i]>max) max=s.d[i]; });
    series.forEach(s=>{
      hctx.strokeStyle=s.c; hctx.beginPath();
      for(let i=0;i<256;i++){ const x=i/255*W, y=H-(s.d[i]/max)*H; i?hctx.lineTo(x,y):hctx.moveTo(x,y); }
      hctx.stroke();
    });
  }

  function drawWaveform(d){
    const {pixels:px, width:w, height:h}=d;
    const W=waveCv.width, H=waveCv.height;
    const acc=new Float32Array(W*H);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const i=(y*w+x)*4;
      const lum=(0.2126*px[i]+0.7152*px[i+1]+0.0722*px[i+2])/255;
      const cx=(x/(w-1)*(W-1))|0, cy=((H-1)-(lum*(H-1)))|0;
      acc[cy*W+cx]+=1;
    }
    paint(wctx,W,H,acc,[180,255,180],0);
    grid(wctx,W,H);
  }

  function drawParade(d){
    const {pixels:px, width:w, height:h}=d;
    const W=waveCv.width, H=waveCv.height, third=Math.floor(W/3);
    wctx.clearRect(0,0,W,H); wctx.fillStyle='#000'; wctx.fillRect(0,0,W,H);
    [[0,[255,90,90]],[1,[90,255,120]],[2,[110,150,255]]].forEach(([o,col],idx)=>{
      const acc=new Float32Array(third*H);
      for(let y=0;y<h;y++) for(let x=0;x<w;x++){
        const i=(y*w+x)*4; const v=px[i+o]/255;
        const cx=(x/(w-1)*(third-1))|0, cy=((H-1)-(v*(H-1)))|0;
        acc[cy*third+cx]+=1;
      }
      paint(wctx,third,H,acc,col,idx*third);
    });
    grid(wctx,W,H);
  }

  function paint(ctx,W,H,acc,col,offx){
    if(offx===0){ ctx.fillStyle='#000'; ctx.fillRect(0,0,ctx.canvas.width,H); }
    const img=ctx.createImageData(W,H);
    let max=1; for(let i=0;i<acc.length;i++) if(acc[i]>max) max=acc[i];
    for(let i=0;i<acc.length;i++){ const a=Math.min(1,acc[i]/max*3);
      img.data[i*4]=col[0]; img.data[i*4+1]=col[1]; img.data[i*4+2]=col[2]; img.data[i*4+3]=a*255; }
    ctx.putImageData(img,offx,0);
  }
  function grid(ctx,W,H){
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1;
    [0.25,0.5,0.75].forEach(f=>{ ctx.beginPath(); ctx.moveTo(0,f*H); ctx.lineTo(W,f*H); ctx.stroke(); });
  }

  const falseColorLegend = [
    ['#800080','أسود مقصوص (<2%)'],['#0000cc','ظلال (2–10%)'],['#0099cc','ظلال متوسطة'],
    ['#009933','منتصف منخفض'],['#66e64d','رمادي 18% (~40%)'],['#999999','منتصف'],
    ['#f28099','بشرة (~52–56%)'],['#cccccc','منتصف فاتح'],['#f2d933','إضاءات (~90%)'],
    ['#f28c1a','إضاءات عالية'],['#f21a1a','أبيض مقصوص (>97%)']
  ];

  return { attach, setEnabled, update, falseColorLegend };
})();
