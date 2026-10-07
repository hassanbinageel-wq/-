// حزمة إطلاق حساب إنستغرام: منشورات + ستوري + أغلفة ريلز (PSD) + فيديوهان جاهزان + خطة وكابشن (PDF/TXT)
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { exportDesign } from '../lib/design.mjs'
import { closeBrowser, renderToFile, renderPdf, openPage, doc, ROOT } from '../lib/browser.mjs'
import { CSS, uri, showHidden } from '../lib/tpl.mjs'
import { C } from '../lib/palette.mjs'
import * as Mk from '../lib/marks.mjs'
import * as E from '../lib/elements.mjs'
import { iconSVG } from '../lib/icons.mjs'
import { FEED, STORIES, REEL_COVERS, panoFull, SLOGAN, HANDLE } from '../templates/launch.mjs'
import { HIGHLIGHTS } from '../templates/highlights.mjs'
import * as T from '../templates/launch-content.mjs'

const DIST = path.join(ROOT, 'dist', 'Ghayma_Launch_Kit')
const O = (...p) => { const d = path.join(DIST, ...p); fs.mkdirSync(d, { recursive: true }); return d }
const only = process.argv[2]
const run = (k) => !only || only === k
const jpgOf = {}

// ===== 1) المنشورات =====
if (run('feed')) {
  const P = O('01_Feed_Posts', 'PSD_Editable'), V = O('01_Feed_Posts', 'Previews_JPG')
  for (const [id, fn] of FEED) {
    const html = fn()
    await exportDesign({ html, w: 1080, h: 1350, psd: path.join(P, `Post_${id}.psd`), jpg: path.join(V, `Post_${id}.jpg`), guides: { v: [80, 1000, 540], h: [80, 1270] } })
  }
  await renderToFile(panoFull(), 3240, 1350, path.join(V, 'Posts_01-03_Teaser_Row_Full.jpg'))
  console.log('feed done')
}

// ===== 2) الستوري =====
if (run('stories')) {
  const P = O('02_Stories', 'PSD_Editable'), V = O('02_Stories', 'Previews_JPG')
  for (const [id, fn] of STORIES) {
    const html = fn()
    await exportDesign({ html, w: 1080, h: 1920, psd: path.join(P, `Story_${id}.psd`), jpg: path.join(V, `Story_${id}.jpg`), guides: { v: [80, 1000, 540], h: [250, 1580] } })
    await exportDesign({ html: showHidden(html), w: 1080, h: 1920, jpg: path.join(V, `Story_${id}_SafeZones.jpg`) })
  }
  console.log('stories done')
}

// ===== 3) أغلفة الريلز =====
if (run('reels')) {
  const P = O('03_Reels', 'Covers_PSD_Editable'), V = O('03_Reels', 'Covers_Previews_JPG')
  for (const [id, fn] of REEL_COVERS) {
    const html = fn()
    await exportDesign({ html, w: 1080, h: 1920, psd: path.join(P, `${id}.psd`), jpg: path.join(V, `${id}.jpg`), guides: { v: [90, 990], h: [240, 1680] } })
  }
  console.log('reel covers done')
}

// ===== 4) فيديوهات جاهزة =====
const FPS = 30, W = 1080, H = 1920
async function video(html, dur, setter, out) {
  const TMP = path.join(DIST, '_frames'); fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true })
  const page = await openPage(html, W, H)
  const n = Math.round(dur * FPS)
  for (let i = 0; i < n; i++) { await page.evaluate(setter, i / FPS); await page.screenshot({ path: path.join(TMP, `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 95 }) }
  await page.close()
  execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(TMP, 'f%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', out], { stdio: 'ignore' })
  fs.rmSync(TMP, { recursive: true, force: true })
}
const cl = (id, cx, base, s, fill, op = 1) => `<svg id="${id}" style="position:absolute;left:0;top:0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${E.cloud(cx, base, s, fill, op)}</svg>`
const line = (id, txt, top, size, cls = 'display', color = C.ink) => `<div id="${id}" class="t c ${cls}" style="${txt.startsWith('@') ? 'direction:ltr;' : ''}position:absolute;left:60px;right:60px;top:${top}px;font-size:${size}px;line-height:1.2;color:${color};opacity:0">${txt}</div>`
const logoW = (id, top, width, cw = 'color') => `<img id="${id}" style="position:absolute;left:${(W - width) / 2}px;top:${top}px;width:${width}px;opacity:0" src="${uri(Mk.wordmarkSVG(Mk.COLORWAYS[cw]))}">`

if (run('video')) {
  const V = O('03_Reels', 'Ready_Videos_MP4')
  // ريل التشويق — 10 ثوانٍ
  const teaser = doc(`<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:linear-gradient(180deg,${C.mist},${C.cotton})">
${cl('c1', 300, 1500, 260, C.milk)}${cl('c2', 820, 1720, 300, C.sand)}${cl('c3', 760, 520, 90, C.milk, 0.9)}${cl('c4', 240, 380, 60, C.milk, 0.85)}
${line('t1', 'شيء ناعم…', 760, 130)}${line('t2', 'في الطريق إليكم', 800, 96, 'title', C.muted)}
${logoW('lg', 700, 560)}${line('sl', SLOGAN, 1010, 76, 'title', C.sageDeep)}
${line('t3', 'قريباً', 720, 220)}${line('hd', HANDLE, 1010, 56, 'sub', C.muted)}</div>`, CSS)
  const teaserSet = (t) => {
    const e = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3), win = (a, b, f = 0.5) => e((t - a) / f) * (1 - e((t - b + f) / f))
    const g = (id) => document.getElementById(id)
    g('c1').style.transform = `translateX(${t * 14}px)`; g('c2').style.transform = `translateX(${-t * 10}px)`
    g('c3').style.transform = `translateX(${-t * 22}px)`; g('c4').style.transform = `translateX(${t * 18}px)`
    const show = (id, a, b) => { const v = win(a, b); g(id).style.opacity = v; g(id).style.transform = `translateY(${(1 - v) * 30}px)` }
    show('t1', 0.2, 2.6); show('t2', 2.6, 5.0); show('lg', 5.0, 8.0); show('sl', 5.5, 8.0); show('t3', 8.0, 10.6); show('hd', 8.4, 10.6)
  }
  await video(teaser, 10, teaserSet, path.join(V, 'Reel_01_Teaser_Ready_10s.mp4'))

  // ريل الافتتاح — 8 ثوانٍ
  const items = ['ملابس المواليد', 'أطقم الاستقبال', 'هدايا جاهزة ومغلفة', 'إكسسوارات ناعمة']
  const launch = doc(`<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:linear-gradient(180deg,${C.apricot},#F7DCCB)">
${cl('c1', 280, 1960, 300, C.cotton)}${cl('c2', 860, 1960, 250, C.milk)}
${line('a1', 'افتتحنا!', 700, 210)}
${items.map((s, i) => line('i' + i, '☁︎ ' + s, 560 + i * 150, 76, 'title')).join('')}
${logoW('lg', 620, 520)}${line('sl', SLOGAN, 900, 70, 'title')}${line('cta', 'الرابط في الحساب', 1060, 64, 'title')}${line('hd', HANDLE, 1170, 50, 'sub', C.ink)}</div>`, CSS)
  const launchSet = (t) => {
    const e = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3), win = (a, b, f = 0.45) => e((t - a) / f) * (1 - e((t - b + f) / f))
    const g = (id) => document.getElementById(id)
    g('c1').style.transform = `translateY(${-e(t / 2) * 60}px)`; g('c2').style.transform = `translateY(${-e((t - 0.2) / 2) * 50}px)`
    const a = win(0.1, 2.2); g('a1').style.opacity = a; g('a1').style.transform = `scale(${0.85 + 0.15 * a})`
    for (let i = 0; i < 4; i++) { const v = win(2.3 + i * 0.35, 5.0); g('i' + i).style.opacity = v; g('i' + i).style.transform = `translateX(${(1 - v) * 60}px)` }
    for (const [id, s] of [['lg', 5.1], ['sl', 5.4], ['cta', 5.8], ['hd', 6.1]]) { const v = win(s, 8.6); g(id).style.opacity = v; g(id).style.transform = `translateY(${(1 - v) * 24}px)` }
  }
  await video(launch, 8, launchSet, path.join(V, 'Reel_02_Launch_Ready_8s.mp4'))
  // صورة مصغرة من كل فيديو للمعاينة
  for (const [f, s] of [['Reel_01_Teaser_Ready_10s', 6.2], ['Reel_02_Launch_Ready_8s', 3.6]]) {
    execFileSync('ffmpeg', ['-y', '-ss', String(s), '-i', path.join(V, f + '.mp4'), '-frames:v', '1', '-q:v', '3', path.join(V, f + '_frame.jpg')], { stdio: 'ignore' })
  }
  console.log('videos done')
}

// ===== 5) معاينة شكل الحساب =====
const feedJpg = (id) => path.join(DIST, '01_Feed_Posts', 'Previews_JPG', `Post_${id}.jpg`)
const b64 = (p) => 'data:image/jpeg;base64,' + fs.readFileSync(p).toString('base64')
// ترتيب الشبكة بعد نشر المنشورات 1←9: الأحدث أعلى اليسار
const GRID = [['09_Newborn_Gifts', '08_Launch_Day', '07_Carousel_HowToOrder_01_Cover'], ['06_Carousel_WhatWeOffer_01_Cover', '05_Our_Story', '04_Reveal_Logo'], ['03_Teaser_Left', '02_Teaser_Middle', '01_Teaser_Right']]
if (run('grid')) {
  const PW = 1170, cell = (PW - 8) / 3, ch = cell * 4 / 3
  const hl = HIGHLIGHTS.slice(0, 6).map(([, label, icon, circle]) => `<div style="width:150px;text-align:center"><div style="width:130px;height:130px;margin:0 auto;border-radius:50%;border:3px solid ${C.line};display:grid;place-items:center"><div style="width:112px;height:112px;border-radius:50%;background:${circle};display:grid;place-items:center"><img style="width:58px" src="${uri(iconSVG(icon, { color: C.ink, size: 58 }))}"></div></div><div class="t c body" style="font-size:24px;margin-top:10px">${label}</div></div>`).join('')
  const rows = GRID.map((r) => `<div style="display:flex;gap:4px;margin-bottom:4px;direction:ltr">${r.map((id) => `<div style="width:${cell}px;height:${ch}px;overflow:hidden;background:#eee"><img src="${b64(feedJpg(id))}" style="width:${cell}px;height:${ch}px;object-fit:cover"></div>`).join('')}</div>`).join('')
  const bio = T.BIO[0].split('\n').map((l) => `<div>${l}</div>`).join('')
  const html = doc(`<div style="width:${PW}px;background:#fff;padding-top:40px">
  <div style="display:flex;align-items:center;gap:50px;padding:0 50px">
    <img style="width:230px;height:230px;border-radius:50%;border:2px solid ${C.line}" src="${uri(Mk.avatarSVG('light'))}">
    <div style="flex:1;display:flex;justify-content:space-around;text-align:center" class="t">${[['9', 'منشورات'], ['—', 'متابِعون'], ['—', 'يتابِع']].map(([a, b]) => `<div><div class="title" style="font-size:44px">${a}</div><div class="body" style="font-size:28px">${b}</div></div>`).join('')}</div>
  </div>
  <div class="t" style="padding:26px 50px 0;font-size:32px;line-height:1.5"><div class="title">غيمة</div><div class="body">${bio}</div><div class="body" style="color:#2a5db0">رابط المتجر</div></div>
  <div style="display:flex;gap:16px;padding:34px 40px;direction:rtl;overflow:hidden">${hl}</div>
  <div style="border-top:1px solid #ddd;padding-top:4px">${rows}</div></div>`, CSS, { bg: '#fff' })
  const Hh = Math.round(40 + 230 + 260 + 230 + 3 * (ch + 4) + 20)
  await renderToFile(html, PW, Hh, path.join(O('00_Preview'), 'Profile_Grid_Preview.jpg'))
  console.log('grid preview done')
}

// ===== 6) خطة النشر والكابشن =====
if (run('plan')) {
  const D = O('04_Content_Plan')
  // ملف نصي للنسخ واللصق من الجوال
  let txt = `حملة إطلاق حساب «غيمة» على إنستغرام\n${'='.repeat(40)}\n\nالسلوقن: ${SLOGAN}\nاسم الحساب في التصاميم: ${HANDLE} (عدّلوه إن اخترتم اسماً آخر)\n\n`
  txt += 'البايو (اختاروا واحداً)\n----------------------\n' + T.BIO.map((b, i) => `${i + 1})\n${b}`).join('\n\n') + '\n\n'
  txt += 'الجدول\n------\n' + T.PLAN.map(([d, w]) => `• ${d}: ${w}`).join('\n') + '\n\n'
  txt += 'المنشورات والكابشن\n------------------\n' + T.POSTS.map((p) => `منشور ${p.n} — ${p.day}\nالملفات: ${p.files.map((f) => 'Post_' + f).join(' ، ')}${p.note ? `\nملاحظة: ${p.note}` : ''}\n\n${p.caption}\n\n${'-'.repeat(30)}`).join('\n\n') + '\n\n'
  txt += 'الستوري\n-------\n' + T.STORIES.map((s) => `Story_${s.f} — ${s.day}\n${s.how}`).join('\n\n') + '\n\n'
  txt += 'الريلز\n------\n' + T.REELS.map((r) => `${r.title} — ${r.day}\nالغلاف: ${r.f}${r.video ? `\nالفيديو: ${r.video}` : ''}\n${r.script.map((s) => '- ' + s).join('\n')}\n\nالكابشن:\n${r.caption}\n\n${'-'.repeat(30)}`).join('\n\n') + '\n\n'
  txt += 'الهاشتاقات\n----------\n' + Object.values(T.HASHTAGS).join('\n') + '\n\n'
  txt += 'نصائح\n-----\n' + T.TIPS.map((t) => '• ' + t).join('\n') + '\n'
  fs.writeFileSync(path.join(D, 'Captions_and_Plan_Copy_Paste_AR.txt'), '﻿' + txt)

  // PDF مصمم مع صور مصغرة
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
  const img = (p, w) => fs.existsSync(p) ? `<img src="${b64(p)}" style="width:${w}px;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.12)">` : ''
  const css = `@page{size:210mm 297mm;margin:0}.pg{width:210mm;min-height:297mm;padding:16mm 15mm;page-break-after:always;background:${C.cotton};position:relative}
  h1{font:600 30pt 'Readex Pro';color:${C.ink}}h2{font:600 18pt 'Readex Pro';color:${C.ink};margin:0 0 6mm}h3{font:600 12.5pt 'Readex Pro';color:${C.ink};margin:0 0 2mm}
  .k{font:500 11pt 'Readex Pro';color:${C.sageDeep};margin-bottom:2mm}p,li,.cap{font:400 10.5pt/1.75 'IBM Plex Sans Arabic';color:${C.ink}}
  .cap{background:${C.milk};border:1px solid ${C.line};border-radius:10px;padding:3mm 4mm;margin-top:2mm}
  .row{display:flex;gap:6mm;margin-bottom:7mm;break-inside:avoid}.tb{width:100%;border-collapse:collapse}.tb td{border-bottom:1px solid ${C.line};padding:2.5mm 1mm;vertical-align:top;font:400 10.5pt/1.6 'IBM Plex Sans Arabic'}.tb td:first-child{font:600 10.5pt 'Readex Pro';width:42mm;color:${C.sageDeep}}
  .pill{display:inline-block;background:${C.sand};border-radius:20px;padding:1mm 4mm;font:500 9pt 'Readex Pro';margin-inline-start:2mm}`
  const V = path.join(DIST, '01_Feed_Posts', 'Previews_JPG'), SV = path.join(DIST, '02_Stories', 'Previews_JPG'), RV = path.join(DIST, '03_Reels', 'Covers_Previews_JPG')
  let pages = `<section class="pg" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:${C.ink}"><img style="width:70mm" src="${uri(Mk.badgeSVG(Mk.COLORWAYS.reverse))}"><h1 style="color:${C.cotton};margin-top:10mm">حملة إطلاق الحساب</h1><p style="color:${C.sand};font-size:14pt">${SLOGAN} — خطة 8 أيام: منشورات، ستوري، ريلز، وكابشن جاهز</p></section>`
  pages += `<section class="pg"><div class="k">نظرة عامة</div><h2>الجدول</h2><table class="tb">${T.PLAN.map(([d, w]) => `<tr><td>${d}</td><td>${esc(w)}</td></tr>`).join('')}</table></section><section class="pg"><div class="k">نظرة عامة</div><h2>شكل الحساب بعد المنشورات التسعة</h2><p>المنشورات 1 و2 و3 تكوّن الصف السفلي المتصل، والأحدث يظهر أعلى اليسار.</p><div style="text-align:center;margin-top:5mm">${img(path.join(DIST, '00_Preview', 'Profile_Grid_Preview.jpg'), 400)}</div></section>`
  pages += `<section class="pg"><div class="k">الحساب</div><h2>البايو</h2>${T.BIO.map((b, i) => `<div class="cap"><b>${i + 1})</b><br>${esc(b)}</div>`).join('')}<h2 style="margin-top:8mm">الهاشتاقات</h2>${Object.entries(T.HASHTAGS).map(([k, v]) => `<div class="cap">${esc(v)}</div>`).join('')}<h2 style="margin-top:8mm">نصائح</h2><ul style="padding-inline-start:6mm">${T.TIPS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>`
  // المنشورات: منشوران في كل صفحة
  for (let i = 0; i < T.POSTS.length; i += 2) {
    pages += `<section class="pg"><div class="k">المنشورات</div>${T.POSTS.slice(i, i + 2).map((p) => `<div class="row"><div>${img(path.join(V, `Post_${p.files[0]}.jpg`), 200)}${p.files.length > 1 ? `<div class="k" style="text-align:center;margin-top:2mm">كاروسيل: ${p.files.length} صور</div>` : ''}</div><div style="flex:1"><h3>منشور ${p.n}<span class="pill">${p.day}</span></h3>${p.note ? `<p><b>ملاحظة:</b> ${esc(p.note)}</p>` : ''}<div class="cap">${esc(p.caption)}</div></div></div>`).join('')}</section>`
  }
  for (let i = 0; i < T.STORIES.length; i += 3) {
    pages += `<section class="pg"><div class="k">الستوري</div>${T.STORIES.slice(i, i + 3).map((s) => `<div class="row">${img(path.join(SV, `Story_${s.f}.jpg`), 140)}<div style="flex:1"><h3>${s.f}<span class="pill">${s.day}</span></h3><p>${esc(s.how)}</p></div></div>`).join('')}</section>`
  }
  for (let i = 0; i < T.REELS.length; i += 2) {
    pages += `<section class="pg"><div class="k">الريلز</div>${T.REELS.slice(i, i + 2).map((r) => `<div class="row">${img(path.join(RV, `${r.f}.jpg`), 150)}<div style="flex:1"><h3>${r.title}<span class="pill">${r.day}</span></h3><ul style="padding-inline-start:6mm">${r.script.map((s) => `<li>${esc(s)}</li>`).join('')}</ul><div class="cap">${esc(r.caption)}</div></div></div>`).join('')}</section>`
  }
  // الخطة الآن صفحة HTML: scripts/build-launch-html.mjs
  console.log('plan done')
}

if (run('readme')) {
  const r = `حزمة إطلاق حساب «غيمة» على إنستغرام — ابدأ هنا
=============================================

00_Preview          شكل الحساب بعد نشر المنشورات التسعة
01_Feed_Posts       9 منشورات (منها كاروسيلان) 1080×1350 — PSD قابل للتعديل + JPG جاهز للنشر
02_Stories          9 ستوريات 1080×1920 — PSD + JPG + نسخة توضح مناطق واجهة إنستغرام
03_Reels            4 أغلفة ريلز PSD + JPG، وفيديوهان جاهزان للنشر MP4 (تشويق 10 ثوانٍ + افتتاح 8 ثوانٍ)
                    نسخة Premiere Pro القابلة للتعديل في ملف مستقل: Ghayma_Reels_Premiere.zip
04_Content_Plan     الخطة والجدول والكابشن: صفحة HTML (تفتح في أي متصفح، بزر نسخ لكل كابشن) + ملف نصي
05_Fonts            الخطوط المستخدمة (مجانية، رخصة OFL) — ثبّتوها قبل فتح ملفات PSD

طريقة الاستخدام السريعة
-----------------------
1) افتحوا 04_Content_Plan/Launch_Plan_AR.html في المتصفح واتبعوا الجدول يوماً بيوم.
2) الصور الجاهزة للنشر في مجلدات Previews_JPG — انشروها كما هي.
3) للتعديل (اسم الحساب، عدد الأيام، النصوص): افتحوا ملف PSD المقابل في فوتوشوب، الطبقات بأسماء عربية واضحة.
4) المنشورات 1 و2 و3 صف واحد متصل: انشروها بالترتيب 1 ثم 2 ثم 3 حتى يكتمل الشكل في الحساب.

ملاحظات صادقة
-------------
- اسم الحساب في التصاميم ${HANDLE} مؤقت؛ غيّروه في طبقة «اسم الحساب» إذا اخترتم اسماً آخر.
- السلوقن «${SLOGAN}» طبقة نص قابلة للتعديل.
- لا توجد في التصاميم أسعار أو آراء عملاء أو أرقام مبيعات. أضيفوها فقط عندما تكون حقيقية.
- ستوري «لمحة أولى» وغلاف «تغليف أول طلب» يحتاجان صورة حقيقية من منتجاتكم (المكان محدد في الملف).
- الفيديوهات بدون صوت؛ أضيفوا موسيقى من مكتبة إنستغرام عند النشر (حقوقها مضمونة داخل التطبيق).
- ملصقات إنستغرام التفاعلية (العد التنازلي، التصويت، السؤال، الرابط) تُضاف من داخل التطبيق؛ أماكنها محددة بإطار منقط في الستوري، احذفوا الإطار بعد إضافة الملصق.
- الخطوط: ثبّتوا Readex Pro وIBM Plex Sans Arabic من مجلد 05_Fonts قبل فتح ملفات PSD، وفعّلوا محرك النصوص العربية في فوتوشوب:
  Edit > Preferences > Type > Middle Eastern and South Asian.
- الملفات فُحصت آلياً (تُفتح وطبقاتها سليمة) لكنها لم تُجرَّب داخل فوتوشوب نفسه.
`
  fs.writeFileSync(path.join(DIST, '00_ابدأ_هنا_START_HERE.txt'), '﻿' + r)
}
await closeBrowser()
