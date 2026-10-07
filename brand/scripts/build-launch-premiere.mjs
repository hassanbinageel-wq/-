// نسخة Premiere Pro من ريلز الإطلاق: كل عنصر صورة PNG شفافة بمقاس الشاشة + Sequence بصيغة XML
// (Final Cut Pro 7 XML — يستوردها Premiere عبر File > Import) فيها المسارات والتوقيتات وظهور/اختفاء العناصر.
import fs from 'node:fs'
import path from 'node:path'
import { exportDesign } from '../lib/design.mjs'
import { closeBrowser, renderToFile, ROOT } from '../lib/browser.mjs'
import { L, page } from '../lib/tpl.mjs'
import { C } from '../lib/palette.mjs'
import * as E from '../lib/elements.mjs'
import { OVERLAYS } from '../templates/reels.mjs'
import { SLOGAN, HANDLE } from '../templates/launch.mjs'
import { VIDEOS } from '../templates/launch-video.mjs'
import { openPage } from '../lib/browser.mjs'
import { execFileSync } from 'node:child_process'

const W = 1080, H = 1920, FPS = 30
const KIT = path.join(ROOT, 'dist', 'Ghayma_Launch_Kit')
const BRAND = path.join(ROOT, 'dist', 'Ghayma_Brand_Identity')
const R = path.join(ROOT, 'dist', 'Ghayma_Reels_Premiere')
fs.rmSync(R, { recursive: true, force: true })
const mk = (...p) => { const d = path.join(R, ...p); fs.mkdirSync(d, { recursive: true }); return d }

const svgw = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${inner}</svg>`
const cloud = (name, cx, base, s, fill, op = 1) => L.svg(name, svgw(E.cloud(cx, base, s, fill, op)), 0, 0, W, H)
const txt = (name, s, top, size, cls = 'display', color = C.ink) =>
  L.text(name, s, 60, top, W - 120, cls, size, { align: 'center', color, lh: 1.2 }).replace('style="', s.startsWith('@') ? 'style="direction:ltr;' : 'style="')
const grad = (a, b) => L.rect('الخلفية', 0, 0, W, H, `linear-gradient(180deg,${a},${b})`)

// كل طبقة: [اسم الملف, HTML, بداية (ث), نهاية (ث), ظهور تدريجي (ث), اختفاء تدريجي (ث)]
const PROJECTS = [
  {
    id: 'Reel_01_Teaser_10s', title: 'ريل التشويق — 10 ثوانٍ', dur: 10, ref: 'Reel_01_Teaser_Ready_10s.mp4', baked: VIDEOS[0],
    layers: [
      ['01_Background', grad(C.mist, C.cotton), 0, 10, 0, 0],
      ['02_Cloud_Small_A', cloud('غيمة صغيرة', 240, 380, 60, C.milk, 0.85), 0, 10, 0, 0],
      ['03_Cloud_Small_B', cloud('غيمة صغيرة', 760, 520, 90, C.milk, 0.9), 0, 10, 0, 0],
      ['04_Cloud_Big_Left', cloud('غيمة كبيرة', 300, 1500, 260, C.milk), 0, 10, 0, 0],
      ['05_Cloud_Big_Right', cloud('غيمة كبيرة', 820, 1720, 300, C.sand), 0, 10, 0, 0],
      ['06_Text_Something_Soft', txt('نص: شيء ناعم', 'شيء ناعم…', 760, 130), 0.2, 2.6, 0.5, 0.5],
      ['07_Text_On_The_Way', txt('نص: في الطريق إليكم', 'في الطريق إليكم', 800, 96, 'title', C.muted), 2.6, 5.0, 0.5, 0.5],
      ['08_Logo', L.logo((W - 560) / 2, 700, 560), 5.0, 8.0, 0.5, 0.5],
      ['09_Text_Slogan', txt('نص: السلوقن', SLOGAN, 1010, 76, 'title', C.sageDeep), 5.5, 8.0, 0.5, 0.5],
      ['10_Text_Coming_Soon', txt('نص: قريباً', 'قريباً', 720, 220), 8.0, 10, 0.5, 0],
      ['11_Text_Handle', txt('نص: اسم الحساب', HANDLE, 1010, 56, 'sub', C.muted), 8.4, 10, 0.5, 0],
    ],
  },
  {
    id: 'Reel_02_Launch_8s', title: 'ريل الافتتاح — 8 ثوانٍ', dur: 8, ref: 'Reel_02_Launch_Ready_8s.mp4', baked: VIDEOS[1],
    layers: [
      ['01_Background', grad(C.apricot, '#F7DCCB'), 0, 8, 0, 0],
      ['02_Cloud_Left', cloud('غيمة', 280, 1900, 300, C.cotton), 0, 8, 0, 0],
      ['03_Cloud_Right', cloud('غيمة', 860, 1900, 250, C.milk), 0, 8, 0, 0],
      ['04_Text_We_Are_Open', txt('نص: افتتحنا', 'افتتحنا!', 700, 210), 0.1, 2.2, 0.45, 0.45],
      ...['ملابس المواليد', 'أطقم الاستقبال', 'هدايا جاهزة ومغلفة', 'إكسسوارات ناعمة'].map((s, i) => [`0${5 + i}_Text_Item_${i + 1}`, txt(`نص: ${s}`, '☁︎ ' + s, 560 + i * 150, 76, 'title'), 2.3 + i * 0.35, 5.0, 0.45, 0.45]),
      ['09_Logo', L.logo((W - 520) / 2, 620, 520), 5.1, 8, 0.45, 0],
      ['10_Text_Slogan', txt('نص: السلوقن', SLOGAN, 900, 70, 'title'), 5.4, 8, 0.45, 0],
      ['11_Text_Link_In_Bio', txt('نص: الرابط في الحساب', 'الرابط في الحساب', 1060, 64, 'title'), 5.8, 8, 0.45, 0],
      ['12_Text_Handle', txt('نص: اسم الحساب', HANDLE, 1170, 50, 'sub'), 6.1, 8, 0.45, 0],
    ],
  },
  {
    id: 'Reel_03_How_To_Order_30s', title: 'كيف تطلبون في دقيقة — قالب لتسجيل الشاشة', dur: 30, endScreen: 27,
    layers: [
      ['01_PLACEHOLDER_Put_Screen_Recording_Here', `<div class="L" data-layer="مكان الفيديو" style="left:0;top:0;width:${W}px;height:${H}px;background:repeating-linear-gradient(135deg,#D9CFC2 0 40px,#E3DACE 40px 80px)"></div>` + txt('تعليمات', 'ضعوا تسجيل شاشة الجوال هنا\nفي المسار السفلي مكان هذا المقطع', 860, 52, 'title', C.muted), 0, 27, 0, 0],
      ['02_Logo_Bug', OVERLAYS.logoBug('color'), 0, 27, 0.3, 0],
      ['03_Title_Bar', OVERLAYS.titleBar('كيف تطلبون من غيمة؟'), 0.3, 4, 0.3, 0.3],
      ['04_Step_1', OVERLAYS.step(1, 'اختاروا القطعة وأضيفوها للسلة'), 4, 10.5, 0.3, 0.3],
      ['05_Step_2', OVERLAYS.step(2, 'اكتبوا بياناتكم وأكّدوا الطلب'), 10.5, 17, 0.3, 0.3],
      ['06_Step_3', OVERLAYS.step(3, 'حوّلوا المبلغ لأحد حساباتنا'), 17, 23.5, 0.3, 0.3],
      ['07_Step_4', OVERLAYS.step(4, 'أرسلوا السند على واتساب'), 23.5, 27, 0.3, 0.3],
    ],
  },
  {
    id: 'Reel_04_Packing_First_Order_20s', title: 'تغليف أول طلب — قالب للتصوير', dur: 20, endScreen: 17,
    layers: [
      ['01_PLACEHOLDER_Put_Your_Video_Here', `<div class="L" data-layer="مكان الفيديو" style="left:0;top:0;width:${W}px;height:${H}px;background:repeating-linear-gradient(135deg,#D9CFC2 0 40px,#E3DACE 40px 80px)"></div>` + txt('تعليمات', 'ضعوا فيديو التغليف هنا\nفي المسار السفلي مكان هذا المقطع', 860, 52, 'title', C.muted), 0, 17, 0, 0],
      ['02_Logo_Bug', OVERLAYS.logoBug('white'), 0, 17, 0.3, 0],
      ['03_Title_Bar', OVERLAYS.titleBar('جهّزنا أول طلب'), 0.3, 3, 0.3, 0.3],
      ['04_Step_1', OVERLAYS.step(1, 'نختار القطع بعناية'), 3, 6.5, 0.3, 0.3],
      ['05_Step_2', OVERLAYS.step(2, 'نغلّفها بورق غيمة'), 6.5, 10, 0.3, 0.3],
      ['06_Step_3', OVERLAYS.step(3, 'نضيف بطاقة الإهداء'), 10, 13.5, 0.3, 0.3],
      ['07_Step_4', OVERLAYS.step(4, 'جاهز للتوصيل'), 13.5, 17, 0.3, 0.3],
    ],
  },
]

// ===== كاتب XML (xmeml v4) =====
const fr = (s) => Math.round(s * FPS)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const rate = `<rate><timebase>${FPS}</timebase><ntsc>FALSE</ntsc></rate>`
function fileEl(f, first) {
  if (!first) return `<file id="${f.id}"/>`
  return `<file id="${f.id}"><name>${esc(f.name)}</name><pathurl>${esc(f.url)}</pathurl>${rate}<duration>${f.dur}</duration><media><video><samplecharacteristics>${rate}<width>${W}</width><height>${H}</height><pixelaspectratio>square</pixelaspectratio></samplecharacteristics></video></media></file>`
}
function opacity(len, fi, fo) {
  if (!fi && !fo) return ''
  const k = []
  if (fi) k.push([0, 0], [fr(fi), 100]); else k.push([0, 100])
  if (fo) k.push([len - fr(fo), 100], [len, 0]); else k.push([len, 100])
  return `<filter><effect><name>Opacity</name><effectid>opacity</effectid><effectcategory>motion</effectcategory><effecttype>motion</effecttype><mediatype>video</mediatype><parameter authoringApp="PremierePro"><parameterid>opacity</parameterid><name>opacity</name><valuemin>0</valuemin><valuemax>100</valuemax><value>100</value>${k.map(([w, v]) => `<keyframe><when>${w}</when><value>${v}</value></keyframe>`).join('')}</parameter></effect></filter>`
}
function sequenceXML(p, clips) {
  const seen = new Set()
  let n = 0
  const tracks = clips.map((tr) => `<track>${tr.map((c) => {
    const len = fr(c.end) - fr(c.start), first = !seen.has(c.file.id); seen.add(c.file.id)
    return `<clipitem id="clip-${++n}"><name>${esc(c.name)}</name><enabled>${c.enabled === false ? 'FALSE' : 'TRUE'}</enabled><duration>${c.file.dur}</duration>${rate}<start>${fr(c.start)}</start><end>${fr(c.end)}</end><in>0</in><out>${len}</out>${fileEl(c.file, first)}${opacity(len, c.fi, c.fo)}</clipitem>`
  }).join('')}<enabled>${tr.enabled === false ? 'FALSE' : 'TRUE'}</enabled><locked>FALSE</locked></track>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="4"><sequence id="seq-${p.id}"><name>${esc(p.id)}</name><duration>${fr(p.dur)}</duration>${rate}<timecode>${rate}<string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode><media><video><format><samplecharacteristics>${rate}<width>${W}</width><height>${H}</height><anamorphic>FALSE</anamorphic><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance></samplecharacteristics></format>${tracks}</video><audio><numOutputChannels>2</numOutputChannels><format><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics></format><track><enabled>TRUE</enabled><locked>FALSE</locked></track></audio></media></sequence></xmeml>\n`
}

const shared = mk('_Shared')
fs.copyFileSync(path.join(BRAND, '06_Reels_Templates', 'Animation', 'Ghayma_End_Screen_3s_1080x1920.mp4'), path.join(shared, 'Ghayma_End_Screen_3s_1080x1920.mp4'))
fs.copyFileSync(path.join(BRAND, '06_Reels_Templates', 'Animation', 'Ghayma_Logo_Intro_3s_1080x1920_Transparent.mov'), path.join(shared, 'Ghayma_Logo_Intro_3s_Transparent_ProRes4444.mov'))


// ===== تصدير كل عنصر فيديو شفافاً بنفس حركة الريل الأصلي إطاراً بإطار =====
// QuickTime Animation (qtrle، بدون فقد، بقناة شفافية) — المقطع يغطي فقط الفترة التي يظهر فيها العنصر
async function bake(v, dir) {
  const Md = path.join(dir, 'Layers_MOV_Alpha'), TMP = path.join(dir, '_frames')
  fs.mkdirSync(Md, { recursive: true })
  fs.rmSync(TMP, { recursive: true, force: true })
  const ids = v.layers.map(([id]) => id)
  for (const id of ids) fs.mkdirSync(path.join(TMP, id), { recursive: true })
  const pg = await openPage(v.html, W, H)
  // الخلفية: صورة ثابتة
  await pg.evaluate((ids) => { for (const id of ids) document.getElementById(id).style.visibility = 'hidden' }, ids)
  await pg.screenshot({ path: path.join(Md, '01_Background.png') })
  await pg.evaluate(() => { document.documentElement.style.background = document.body.style.background = 'transparent'; document.getElementById('stage').style.background = 'transparent' })
  const n = fr(v.dur), vis = Object.fromEntries(ids.map((id) => [id, []]))
  for (let i = 0; i < n; i++) {
    await pg.evaluate(v.setter, i / FPS)
    const op = await pg.evaluate((ids) => Object.fromEntries(ids.map((id) => [id, +getComputedStyle(document.getElementById(id)).opacity])), ids)
    for (const id of ids) {
      if (op[id] <= 0.001) continue
      vis[id].push(i)
      await pg.evaluate(([ids, show]) => { for (const x of ids) document.getElementById(x).style.visibility = x === show ? 'visible' : 'hidden' }, [ids, id])
      await pg.screenshot({ path: path.join(TMP, id, `f${String(i).padStart(4, '0')}.png`), omitBackground: true })
    }
  }
  await pg.close()
  const out = []
  for (const [id, name] of v.layers) {
    const fs0 = vis[id]
    if (!fs0.length) continue
    const a = fs0[0], b = fs0[fs0.length - 1] + 1
    // إطارات مخفية داخل الفترة (نادر): نملؤها بإطار شفاف
    for (let i = a; i < b; i++) { const f = path.join(TMP, id, `f${String(i).padStart(4, '0')}.png`); if (!fs.existsSync(f)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=black@0.0:s=${W}x${H},format=rgba`, '-frames:v', '1', f]) }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-start_number', String(a), '-i', path.join(TMP, id, 'f%04d.png'), '-frames:v', String(b - a), '-c:v', 'qtrle', '-pix_fmt', 'argb', path.join(Md, `${name}.mov`)])
    out.push({ name, a, b })
  }
  fs.rmSync(TMP, { recursive: true, force: true })
  return out
}

let fid = 0
for (const p of PROJECTS) {
  const dir = mk(p.id)
  const clips = []
  if (p.baked) {
    const parts = await bake(p.baked, dir)
    clips.push([{ name: '01_Background', start: 0, end: p.dur, file: { id: `file-${++fid}`, name: '01_Background.png', url: 'Layers_MOV_Alpha/01_Background.png', dur: fr(p.dur) } }])
    for (const c of parts) clips.push([{ name: c.name, start: c.a / FPS, end: c.b / FPS, file: { id: `file-${++fid}`, name: c.name + '.mov', url: `Layers_MOV_Alpha/${c.name}.mov`, dur: c.b - c.a } }])
    p.timing = parts.map((c) => `${c.name.padEnd(30)} ${(c.a / FPS).toFixed(2)}s → ${(c.b / FPS).toFixed(2)}s`).join('\n')
  }
  const Ld = p.baked ? null : mk(p.id, 'Layers_PNG')
  for (const [name, html, a, b, fi, fo] of p.baked ? [] : p.layers) {
    await renderToFile(page(html, W, H, 'transparent'), W, H, path.join(Ld, name + '.png'), { transparent: true })
    clips.push([{ name, start: a, end: b, fi, fo, file: { id: `file-${++fid}`, name: name + '.png', url: `Layers_PNG/${name}.png`, dur: fr(p.dur) } }])
  }
  if (p.endScreen) {
    clips.push([{ name: 'End_Screen', start: p.endScreen, end: p.dur, file: { id: `file-${++fid}`, name: 'Ghayma_End_Screen_3s_1080x1920.mp4', url: '../_Shared/Ghayma_End_Screen_3s_1080x1920.mp4', dur: fr(3) } }])
  }
  if (p.ref) {
    fs.copyFileSync(path.join(KIT, '03_Reels', 'Ready_Videos_MP4', p.ref), path.join(dir, 'Reference_' + p.ref))
    const t = [{ name: 'REFERENCE (disabled)', start: 0, end: p.dur, enabled: false, file: { id: `file-${++fid}`, name: 'Reference_' + p.ref, url: 'Reference_' + p.ref, dur: fr(p.dur) } }]
    t.enabled = false
    clips.push(t)
  }
  fs.writeFileSync(path.join(dir, `${p.id}_Premiere.xml`), sequenceXML(p, clips))
  // مصدر الطبقات للتعديل في فوتوشوب (نفس أسماء ملفات PNG)
  if (!p.baked) {
  const all = p.layers.map(([name, html]) => html.replace(/data-layer="([^"]*)"/g, `data-layer="${name} — $1"`)).join('')
  await exportDesign({ html: page(all, W, H, 'transparent'), w: W, h: H, psd: path.join(dir, `${p.id}_Layers_Source.psd`), jpg: path.join(dir, `${p.id}_All_Layers_Preview.jpg`) })
  }
  // جدول التوقيت للقراءة
  const t = p.timing || p.layers.map(([n, , a, b]) => `${n.padEnd(42)} ${a.toFixed(2)}s → ${b.toFixed(2)}s`).join('\n') + (p.endScreen ? `\n${'End_Screen (_Shared)'.padEnd(42)} ${p.endScreen.toFixed(2)}s → ${p.dur.toFixed(2)}s` : '')
  fs.writeFileSync(path.join(dir, 'Timing.txt'), `${p.title}\n${'-'.repeat(40)}\n${t}\n`)
  console.log(p.id)
}

// إعادة استخدام أغلفة الريلز
const cov = mk('_Covers')
for (const d of ['Covers_PSD_Editable', 'Covers_Previews_JPG']) for (const f of fs.readdirSync(path.join(KIT, '03_Reels', d))) fs.copyFileSync(path.join(KIT, '03_Reels', d, f), path.join(cov, f))

fs.writeFileSync(path.join(R, '00_ابدأ_هنا_START_HERE.txt'), '﻿' + `ريلز إطلاق «غيمة» — نسخة Adobe Premiere Pro
==============================================

المحتوى
-------
Reel_01_Teaser_10s               ريل التشويق — كل عنصر فيديو شفاف مستقل بنفس الحركة الأصلية بالضبط
Reel_02_Launch_8s                ريل الافتتاح — كل عنصر فيديو شفاف مستقل بنفس الحركة الأصلية بالضبط
Reel_03_How_To_Order_30s         قالب: ضعوا تسجيل شاشة الجوال، والعناوين والخطوات جاهزة فوقه
Reel_04_Packing_First_Order_20s  قالب: ضعوا فيديو التغليف، والعناوين والخطوات جاهزة فوقه
_Shared                          الشاشة الختامية MP4 + مقدمة الشعار بخلفية شفافة (ProRes 4444)
_Covers                          أغلفة الريلز (PSD قابل للتعديل + JPG)

الريلزان 01 و02 (مطابقان للفيديو الجاهز بكل تفصيل)
--------------------------------------------------
- Layers_MOV_Alpha: كل عنصر (كل غيمة، كل نص، الشعار) ملف فيديو MOV بخلفية شفافة،
  والحركة فيه محفوظة إطاراً بإطار: نفس السرعة والانسياب والظهور والاختفاء. الخلفية صورة PNG.
  الصيغة: QuickTime Animation (بدون فقد في الجودة، مع شفافية) بمقاس 1080×1920 و30 إطاراً/ث.
- كل مقطع يبدأ في الـ Timeline في نفس لحظته في الفيديو الأصلي (التوقيتات في Timing.txt).
- تأكدنا آلياً: تركيب الطبقات فوق بعض يعطي نفس الفيديو الجاهز (تطابق PSNR أعلى من 52 dB).
- تقدرون: تحريك أي عنصر في الوقت، تقديمه أو تأخيره، حذفه، تغيير مكانه أو حجمه (Motion)،
  أو إضافة عناصر وصوت فوقه — وتبقى حركة كل عنصر كما هي.

طريقة الفتح في Premiere Pro
--------------------------
1) فكّوا الضغط واحتفظوا بالمجلدات كما هي (لا تفصلوا ملف XML عن مجلد الطبقات).
2) File > Import ← اختاروا ملف ‎*_Premiere.xml ← يظهر Sequence بمقاس 1080×1920 و30 إطاراً/ث.
3) إذا ظهرت الملفات «Offline»: اضغطوا Locate على أول ملف وحدّدوه من مجلده، وفعّلوا
   «Relink others automatically» فيربط Premiere الباقي تلقائياً.
4) بديل بدون XML: أنشئوا Sequence بمقاس 1080×1920 / 30fps، ضعوا 01_Background.png في المسار السفلي،
   ثم كل ملف MOV في مسار فوقه بالترتيب الرقمي، وابدؤوه عند الثانية المكتوبة في Timing.txt.
5) الصوت: أضيفوا موسيقى مرخّصة، أو انشروا بدون صوت وأضيفوا الصوت من مكتبة إنستغرام.
6) التصدير: File > Export > Media ← H.264 ← Match Source.

تعديل النصوص
------------
- في الريلزين 01 و02 النص جزء من فيديو العنصر (حتى تبقى الحركة مطابقة)، فتغيير الكلمات نفسها
  يحتاج إعادة تصدير ذلك العنصر: أرسلوا لي النص الجديد وأصدّر لكم ملف MOV بنفس الحركة.
  (أو اكتبوا النص بأداة النص في Premiere وطبّقوا عليه حركة Opacity وPosition بأنفسكم.)
- في القالبين 03 و04 النصوص صور PNG ومعها ملف ‎*_Layers_Source.psd: عدّلوا النص في فوتوشوب
  وصدّروا الطبقة PNG بالمقاس الكامل وبنفس الاسم داخل Layers_PNG، فيحدّثها Premiere تلقائياً.
  ظهورها واختفاؤها التدريجي مضبوط في الـ Sequence (Effect Controls > Opacity).

ملاحظات صادقة
-------------
- ملفات XML بصيغة Final Cut Pro 7 XML التي يستوردها Premiere Pro. لم أستطع تجربتها داخل Premiere نفسه هنا؛
  إن واجهتكم مشكلة في الاستيراد فالخطوة 4 أعلاه تركّبها يدوياً في دقائق وبنفس النتيجة.
- مسار «REFERENCE» في الـ Sequence معطّل: هو الفيديو الجاهز للمقارنة فقط.
- اسم الحساب ${HANDLE} مؤقت؛ إن غيّرتموه أرسلوه لي لأعيد تصدير طبقته.
`)
await closeBrowser()
console.log('done', R)
