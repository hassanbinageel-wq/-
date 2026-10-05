// 10_Brand_Guidelines: دليل الهوية العربي المصور (PDF) + لوحة التوجه البصري (PNG)
import fs from 'node:fs'
import path from 'node:path'
import { OUT, DIST } from '../lib/out.mjs'
import { C, PALETTE, rgb, contrast } from '../lib/palette.mjs'
import { renderPdf, renderToFile, closeBrowser, doc } from '../lib/browser.mjs'
import { CSS, uri } from '../lib/tpl.mjs'
import * as M from '../lib/marks.mjs'
import * as E from '../lib/elements.mjs'
import { ICONS, iconSVG } from '../lib/icons.mjs'
import { thumb } from '../lib/thumb.mjs'
import { POSTS } from '../templates/posts.mjs'
import { STORIES } from '../templates/stories.mjs'
import { HIGHLIGHTS } from '../templates/highlights.mjs'
import { ITEMS } from '../templates/packaging.mjs'
import * as P from '../templates/posts.mjs'
import { exportDesign } from '../lib/design.mjs'
import { EX, BLANK } from '../templates/common.mjs'

const G = OUT('10_Brand_Guidelines')
const d = (...p) => path.join(DIST, ...p)
const im = (p, w = 900, fmt = 'jpg') => thumb(p, w, fmt)
const sv = (s) => uri(s)
const cmyk = (hex) => { const [r, g, b] = rgb(hex).map((v) => v / 255); const k = 1 - Math.max(r, g, b); return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map((v) => Math.round(v * 100)) }

let n = 0
const pages = []
const pg = (title, kicker, body, { bg = C.cotton, dark = false } = {}) => {
  n++
  pages.push(`<section class="pg" style="background:${bg};color:${dark ? C.cotton : C.ink}">
  ${title ? `<header class="ph"><div><div class="kick">${kicker || ''}</div><h2>${title}</h2></div><img src="${sv(M.symbolSVG(dark ? M.COLORWAYS.reverse : M.COLORWAYS.color))}" class="pmark"></header>` : ''}
  <div class="pb">${body}</div><footer class="pf" style="color:${dark ? C.sand : C.muted}">دليل هوية غيمة · ${n}</footer></section>`)
}
const GUIDE_CSS = CSS + `
@page{size:297mm 210mm;margin:0}
body{background:#fff}
.pg{width:297mm;height:210mm;position:relative;overflow:hidden;page-break-after:always;padding:14mm 16mm 12mm;direction:rtl;font-family:'IBM Plex Sans Arabic'}
.ph{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6mm}
.ph h2{font:600 26px/1.25 'Readex Pro';margin:0}.kick{font:500 12px 'Readex Pro';color:${C.clay};margin-bottom:2px}
.pmark{height:14mm}
.pf{position:absolute;bottom:6mm;left:16mm;font:400 10px 'Readex Pro'}
.pb{font-size:12.5px;line-height:1.8}
.pb h3{font:600 15px/1.4 'Readex Pro';margin:0 0 2mm}
.pb p{margin:0 0 2.4mm}
.cols{display:grid;gap:7mm}.c2{grid-template-columns:1fr 1fr}.c3{grid-template-columns:1fr 1fr 1fr}.c4{grid-template-columns:repeat(4,1fr)}.c5{grid-template-columns:repeat(5,1fr)}
.card{background:${C.milk};border-radius:5mm;padding:5mm;border:1px solid ${C.line}}
.tile{border-radius:4mm;overflow:hidden;background:${C.milk};border:1px solid ${C.line}}
.lbl{font:500 11px 'Readex Pro';margin-top:1.5mm;text-align:center}
.small{font-size:10.5px;color:${C.muted};line-height:1.6}
.ok,.no{display:inline-block;font:600 11px 'Readex Pro';padding:1px 9px;border-radius:20px;margin-bottom:1.5mm}.ok{background:#E3ECE1;color:${C.sageDeep}}.no{background:#F6E1DA;color:${C.clay}}
table{width:100%;border-collapse:collapse;font-size:11px}th{font:600 11px 'Readex Pro';text-align:right;background:${C.sand};padding:2mm}td{padding:1.6mm 2mm;border-bottom:1px solid ${C.line};vertical-align:top}
.num{display:inline-flex;width:8mm;height:8mm;border-radius:50%;background:${C.apricot};align-items:center;justify-content:center;font:600 13px 'Readex Pro';margin-left:2mm}
.step{display:flex;gap:3mm;align-items:flex-start;margin-bottom:3mm}
ul{margin:0;padding-right:5mm}li{margin-bottom:1mm}
.ltr{direction:ltr;display:inline-block}
.sw{height:22mm;border-radius:4mm 4mm 0 0}
`
const ok = (t = 'صحيح') => `<span class="ok">✓ ${t}</span>`
const no = (t = 'تجنّبوا') => `<span class="no">✕ ${t}</span>`
const wm = (cw = 'color') => sv(M.wordmarkSVG(M.COLORWAYS[cw]))

// ===== 1 الغلاف =====
pg('', '', `<div style="position:absolute;inset:0;background:${C.cotton}"><img src="${sv(E.patternSheet('cotton', 1123, 794, { size: 300 }))}" style="position:absolute;inset:0;width:100%;height:100%;opacity:.8">
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8mm"><img src="${wm()}" style="width:120mm"><div style="font:500 22px 'Readex Pro'">دليل الهوية البصرية</div><div style="font:400 14px 'IBM Plex Sans Arabic';color:${C.muted}">الشعار · الألوان · الخطوط · العناصر · القوالب · التغليف · المتجر الإلكتروني</div></div></div>`)

// ===== 2 المحتويات =====
const toc = [['1', 'فكرة الهوية وشخصيتها'], ['2', 'لوحة التوجه البصري'], ['3', 'الشعار: الفكرة والإصدارات ومتى تُستخدم'], ['4', 'مساحة الأمان والحد الأدنى والخلفيات والأخطاء'], ['5', 'الألوان ونسبها ووظائفها'], ['6', 'الخطوط والأوزان والأحجام'], ['7', 'العناصر المساندة'], ['8', 'أسلوب الصور ونبرة الكتابة'], ['9', 'القوالب: أيها لأي محتوى'], ['10', 'الستوري والريلز والهايلايت وشكل الحساب'], ['11', 'التغليف والمتجر الإلكتروني'], ['12', 'دليل عملي: من القالب الفارغ إلى منشور جاهز'], ['13', 'التصدير والأخطاء الشائعة وفهرس الملفات']]
pg('المحتويات', 'دليل هوية غيمة', `<div class="cols c2">${[toc.slice(0, 7), toc.slice(7)].map((c) => `<div>${c.map(([a, b]) => `<div style="display:flex;gap:4mm;align-items:center;padding:2.6mm 0;border-bottom:1px solid ${C.line};font:500 15px 'Readex Pro'"><span class="num">${a}</span>${b}</div>`).join('')}</div>`).join('')}</div>
<div class="card" style="margin-top:8mm"><h3>كيف تستخدمون هذا الدليل</h3><p>كل ما في الدليل له ملف جاهز في المجلد المرفق (الشعار والقوالب والعناصر). اقرؤوا الأقسام 1–8 مرة واحدة لفهم الهوية، ثم ارجعوا إلى القسم 12 كلما صممتم منشوراً جديداً.</p></div>`)

// ===== 3 الفكرة والشخصية =====
pg('فكرة الهوية وشخصيتها', '1 · الفكرة', `<div class="cols c2"><div>
<h3>«غيمة»: نعومة تحتضن</h3><p>الغيمة خفيفة وناعمة، تظلّل وتحتضن دون أن تُثقل. هذه هي العلاقة التي نريدها مع العائلة: هدوء ودفء واهتمام بالتفاصيل الصغيرة التي تخص المولود.</p>
<p>العنصر الذي يميز الهوية هو <b>«نقطة الغيمة»</b>: نقطة حرف الغين في الشعار تحولت إلى غيمة صغيرة. يتكرر هذا العنصر بهدوء في النمط والملصقات والفواصل والحركة، فيصبح توقيعاً يمكن تذكره دون مبالغة.</p>
<h3 style="margin-top:4mm">الجمهور</h3><p>الأمهات والعائلات، ومن يبحث عن هدية مولود أنيقة وجاهزة. الهوية تناسب المواليد من الجنسين؛ لا نعتمد على الوردي والأزرق كحل تقليدي.</p></div>
<div><h3>شخصية العلامة</h3><table><tr><th>نحن</th><th>ولسنا</th></tr>
<tr><td>ناعمة ودافئة</td><td>طفولية أو صاخبة</td></tr><tr><td>راقية وبسيطة</td><td>فخمة متكلفة أو مزدحمة</td></tr><tr><td>مطمئنة وواضحة</td><td>مبالغة في الوعود</td></tr><tr><td>محايدة بين الجنسين</td><td>وردي/أزرق تقليدي</td></tr><tr><td>هادئة الحركة</td><td>سريعة ومشتتة</td></tr></table>
<h3 style="margin-top:5mm">كلمات تصف الإحساس</h3><div style="display:flex;flex-wrap:wrap;gap:2mm">${['نعومة', 'دفء', 'احتواء', 'خفة', 'هدوء', 'عناية', 'ثقة'].map((w) => `<span style="background:${C.sand};border-radius:20px;padding:1mm 4mm;font:500 13px 'Readex Pro'">${w}</span>`).join('')}</div></div></div>`)

// ===== 4 لوحة التوجه البصري =====
const photos = ['ph01-onesie', 'ph02-jacket', 'ph03-romper', 'ph07-set'].map((k) => im(path.join(process.cwd(), 'assets/illustrated', k + '-sq.jpg'), 400))
const moodBody = `<div style="display:grid;grid-template-columns:1.25fr 1fr 1fr;grid-template-rows:62mm 62mm;gap:4mm;height:128mm">
<div class="tile" style="grid-row:span 2;position:relative;background:${C.sand}"><img src="${photos[3]}" style="width:100%;height:100%;object-fit:cover"><div style="position:absolute;bottom:4mm;right:4mm;background:${C.milk};padding:2mm 4mm;border-radius:20px;font:500 11px 'Readex Pro'">صور هادئة بخلفيات قطنية وإضاءة ناعمة</div></div>
<div class="tile" style="display:flex;align-items:center;justify-content:center;background:${C.cotton}"><img src="${wm()}" style="width:60%"></div>
<div class="tile" style="display:grid;grid-template-columns:repeat(3,1fr)">${['ink', 'apricot', 'sage', 'cotton', 'sand', 'mist'].map((k) => `<div style="background:${C[k]}"></div>`).join('')}</div>
<div class="tile" style="padding:4mm;background:${C.milk}"><div style="font:600 34px/1.2 'Readex Pro'">غيمة</div><div style="font:500 15px 'Readex Pro';margin-top:1mm">Readex Pro للعناوين</div><div style="font:400 12.5px/1.7 'IBM Plex Sans Arabic';color:${C.muted};margin-top:1mm">IBM Plex Sans Arabic للنصوص: واضح ومريح للقراءة الطويلة.</div><div style="font:600 24px 'Readex Pro';margin-top:2mm">89 ر.س</div></div>
<div class="tile" style="position:relative"><img src="${sv(E.patternSheet('sage', 400, 240, { size: 120 }))}" style="width:100%;height:100%;object-fit:cover"><div style="position:absolute;inset:0;display:flex;gap:3mm;align-items:center;justify-content:center"><img src="${sv(E.STICKERS.new.svg())}" style="height:9mm"><img src="${sv(E.STICKERS.newbornGift.svg())}" style="height:20mm"><img src="${sv(E.STICKERS.special.svg())}" style="height:20mm"></div></div>
</div>
<div class="cols c4" style="margin-top:4mm;gap:4mm">${['hanger', 'gift', 'van', 'care'].map((k, i) => `<div class="tile" style="display:flex;align-items:center;gap:3mm;padding:3mm"><img src="${photos[i]}" style="width:14mm;height:14mm;border-radius:50% 50% 2mm 2mm;object-fit:cover"><img src="${sv(iconSVG(k))}" style="width:9mm"><span class="small">${['أقواس وإطارات ناعمة', 'تغليف هدايا أنيق', 'أيقونات خطية هادئة', 'عناية وتفاصيل'][i]}</span></div>`).join('')}</div>`
pg('لوحة التوجه البصري', '2 · التوجه', moodBody)

// ===== 5 الشعار: الفكرة =====
const wp = M.wordmarkParts()
pg('الشعار: حروف خاصة و«نقطة الغيمة»', '3 · الشعار', `<div class="cols c2"><div class="card" style="display:flex;align-items:center;justify-content:center;height:110mm;position:relative">
<svg viewBox="-60 -140 ${wp.w + 120} ${wp.h + 280}" style="width:100%"><g transform="translate(${wp.tx} ${wp.ty})"><path d="${wp.letters}" fill="${C.ink}"/><path d="${wp.cloud}" fill="${C.apricot}"/></g>
<line x1="-40" x2="${wp.w + 40}" y1="${wp.ty - 0}" y2="${wp.ty - 0}" stroke="${C.clay}" stroke-dasharray="10 8" stroke-width="3"/>
<circle cx="${wp.w * 0.86}" cy="${wp.h * 0.1}" r="130" fill="none" stroke="${C.clay}" stroke-width="4" stroke-dasharray="12 8"/></svg>
<div class="small" style="position:absolute;bottom:4mm;right:5mm">الخط المتقطع: خط الأساس · الدائرة: «نقطة الغيمة»</div></div>
<div><h3>كيف بُني الشعار</h3><p>الاسم مكتوب بحروف عربية مستديرة الأطراف ومتصلة بشكل صحيح، مبنية على هيكل خط Baloo Bhaijaan 2 (رخصة مفتوحة تسمح بالاستخدام التجاري)، ثم عُدّلت ووُحِّدت كمسارات (رسم) وليست خطاً مكتوباً.</p>
<p>التعديل الأساسي: <b>نقطة الغين أصبحت غيمة صغيرة</b> بثلاثة أقواس وقاعدة مستوية. تحافظ على قراءة «غ» وتضيف المعنى بذكاء وبساطة، وتبقى واضحة في الأحجام الصغيرة.</p>
<p>في النسخة الملونة: الحروف بلون «حبر الغسق» والغيمة بلون «شفق المشمش».</p>
<h3>تنبيه</h3><p>لا تكتبوا كلمة «غيمة» بأي خط بديلاً عن الشعار. استخدموا ملفات الشعار الجاهزة فقط. الخط المستخدم في المحتوى (Readex Pro) مختلف عن رسم حروف الشعار.</p></div></div>`)

// ===== 6 الإصدارات =====
const ver = [['الشعار الأساسي', M.wordmarkSVG(M.COLORWAYS.color), 'الاستخدام الافتراضي: الموقع، المنشورات، التغليف.'], ['أفقي', M.horizontalSVG(M.COLORWAYS.color), 'الأشرطة العريضة: رأس الموقع، الفواتير، البريد.'], ['مكدّس', M.stackedSVG(M.COLORWAYS.color), 'المساحات المربعة والعمودية: الأكياس، البطاقات.'], ['الرمز', M.symbolSVG(M.COLORWAYS.color), 'عندما يكون الاسم ظاهراً في مكان آخر قريب.'], ['الرمز داخل دائرة', M.badgeSVG(M.COLORWAYS.color), 'الأختام والملصقات ونهاية الفيديو.'], ['صورة الحساب', M.avatarSVG('light'), 'إنستغرام وواتساب: الرمز في المنتصف داخل إطار دائري.'], ['أيقونة الموقع', M.faviconSVG(), 'متصفح الويب وشاشة الجوال (16 حتى 512 بكسل).'], ['مع العبارة الوصفية (اختياري)', M.wordmarkWithTaglineSVG(M.COLORWAYS.color), 'للتعريف في الإعلانات الأولى فقط، ليس بديلاً عن الشعار.']]
pg('إصدارات الشعار ومتى يُستخدم كل إصدار', '3 · الشعار', `<div class="cols c4" style="gap:5mm">${ver.map(([t, s, u]) => `<div><div class="tile" style="height:40mm;display:flex;align-items:center;justify-content:center;padding:5mm"><img src="${sv(s)}" style="max-width:100%;max-height:100%"></div><div class="lbl">${t}</div><div class="small" style="text-align:center">${u}</div></div>`).join('')}</div>
<p class="small" style="margin-top:4mm">الملفات: 01_Logos — SVG (للطباعة والتكبير) وPNG بخلفية شفافة بعدة مقاسات، ومجلد صورة الحساب، وأيقونات الموقع، والعبارة الوصفية الاختيارية (نسخة نص قابلة للتعديل ونسخة محولة إلى مسارات).</p>`)

// ===== 7 الألوان الخمسة للشعار =====
const cws = [['ملون', 'color', C.cotton], ['ملون على داكن', 'reverse', C.ink], ['لون واحد (حبر)', 'mono', C.sand], ['أسود (طباعة بلون واحد/أختام)', 'black', '#FFFFFF'], ['أبيض (على الخلفيات الداكنة والصور)', 'white', C.sageDeep]]
pg('نسخ الألوان واختيار الخلفية', '4 · الاستخدام', `<div class="cols c5" style="gap:4mm">${cws.map(([t, k, bg]) => `<div><div class="tile" style="height:34mm;background:${bg};display:flex;align-items:center;justify-content:center"><img src="${wm(k)}" style="width:70%"></div><div class="lbl">${t}</div></div>`).join('')}</div>
<h3 style="margin-top:6mm">اختيار الخلفية المناسبة</h3>
<div class="cols c4" style="gap:4mm">${[[C.cotton, 'color', 'قطن · حليب · رمل', true], [C.sage, 'mono', 'المريمية: نسخة الحبر', true], [C.ink, 'reverse', 'الحبر: النسخة الملونة على داكن', true], ['photo', 'white', 'صورة بمنطقة هادئة: الأبيض', true]].map(([bg, k, t]) => `<div><div class="tile" style="height:30mm;background:${bg === 'photo' ? C.sageDeep : bg};position:relative;display:flex;align-items:center;justify-content:center">${bg === 'photo' ? `<img src="${photos[1]}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.55)">` : ''}<img src="${wm(k)}" style="width:60%;position:relative"></div><div class="lbl">${ok()} ${t}</div></div>`).join('')}</div>
<div class="cols c3" style="gap:4mm;margin-top:4mm">${[[C.apricot, 'color', 'الشعار الملون فوق المشمش: الغيمة تختفي'], ['busy', 'color', 'فوق جزء مزدحم من الصورة'], [C.muted, 'color', 'تباين ضعيف']].map(([bg, k, t]) => `<div><div class="tile" style="height:24mm;background:${bg === 'busy' ? C.sand : bg};position:relative;display:flex;align-items:center;justify-content:center">${bg === 'busy' ? `<img src="${sv(E.patternSheet('apricot', 400, 200, { size: 60 }))}" style="position:absolute;inset:0;width:100%;height:100%">` : ''}<img src="${wm(k)}" style="width:50%;position:relative"></div><div class="lbl">${no()} ${t}</div></div>`).join('')}</div>`)

// ===== 8 مساحة الأمان والحد الأدنى =====
const cloudH = 0.19 // ارتفاع الغيمة نسبة لارتفاع الكلمة تقريباً
pg('مساحة الأمان والحد الأدنى للحجم', '4 · الاستخدام', `<div class="cols c2"><div class="card" style="height:115mm;display:flex;align-items:center;justify-content:center">
<svg viewBox="${-wp.h * 0.5} ${-wp.h * 0.5} ${wp.w + wp.h} ${wp.h * 2}" style="width:100%"><rect x="${-wp.h * 0.36}" y="${-wp.h * 0.36}" width="${wp.w + wp.h * 0.72}" height="${wp.h * 1.72}" fill="${C.sand}" stroke="${C.clay}" stroke-dasharray="14 10" stroke-width="4"/><rect x="0" y="0" width="${wp.w}" height="${wp.h}" fill="${C.milk}"/><g transform="translate(${wp.tx} ${wp.ty})"><path d="${wp.letters}" fill="${C.ink}"/><path d="${wp.cloud}" fill="${C.apricot}"/></g>
${[[-wp.h * 0.36, wp.h * 0.4], [wp.w, wp.h * 0.4]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="${E.cloud(wp.h * 0.18, wp.h * 0.25, wp.h * 0.11, C.apricot).match(/d="([^"]+)"/)[1]}" fill="${C.apricot}" opacity=".9"/><text x="${wp.h * 0.18}" y="${wp.h * 0.45}" font-family="Readex Pro" font-size="${wp.h * 0.16}" text-anchor="middle" fill="${C.clay}">X</text></g>`).join('')}</svg></div>
<div><h3>مساحة الأمان</h3><p>اتركوا حول الشعار مساحة فارغة لا تقل عن <b>X</b>، وX تساوي ارتفاع «نقطة الغيمة» مضروباً في 2 (حوالي ثلث ارتفاع الشعار). لا يدخل هذه المساحة نص أو صورة أو حافة الصفحة.</p>
<h3>الحد الأدنى للحجم</h3><table><tr><th>الإصدار</th><th>على الشاشة</th><th>في الطباعة</th></tr>
<tr><td>الشعار الأساسي</td><td>عرض 90 بكسل</td><td>عرض 22 ملم</td></tr><tr><td>الأفقي</td><td>عرض 140 بكسل</td><td>عرض 35 ملم</td></tr><tr><td>المكدّس</td><td>عرض 80 بكسل</td><td>عرض 20 ملم</td></tr><tr><td>الرمز / داخل دائرة</td><td>24 بكسل</td><td>8 ملم</td></tr><tr><td>مع العبارة الوصفية</td><td>عرض 180 بكسل</td><td>عرض 45 ملم</td></tr></table>
<p class="small" style="margin-top:3mm">أصغر من ذلك: استخدموا الرمز، أو أيقونة الموقع للأحجام 16–32 بكسل.</p>
<h3>العبارة الوصفية «للمواليد والهدايا»</h3><p>عنصر اختياري منفصل. تُوضع تحت الشعار في المنتصف بالمسافة الموجودة في ملف «Logo_With_Tagline» فقط، ولا تُستخدم وحدها كبديل للشعار.</p></div></div>`)

// ===== 9 الأخطاء =====
const misuse = [
  ['التمديد أو تغيير النسب', `<img src="${wm()}" style="width:80%;height:30%;object-fit:fill;transform:scaleX(1.5)">`],
  ['الإمالة أو التدوير', `<img src="${wm()}" style="width:60%;transform:rotate(-14deg)">`],
  ['ألوان غير معتمدة', `<img src="${sv(M.wordmarkSVG({ letters: '#E24D8A', cloud: '#3BA7E0' }))}" style="width:60%">`],
  ['إضافة ظل أو حد', `<img src="${wm()}" style="width:60%;filter:drop-shadow(5px 5px 0 #b0503a)">`],
  ['تحريك الغيمة أو تكبيرها', `<svg viewBox="0 0 ${wp.w} ${wp.h * 1.4}" style="width:60%"><g transform="translate(${wp.tx} ${wp.ty + wp.h * 0.3})"><path d="${wp.letters}" fill="${C.ink}"/><path d="${wp.cloud}" fill="${C.apricot}" transform="translate(-900 -150) scale(1.6)"/></g></svg>`],
  ['كتابة الاسم بخط آخر', `<div style="font:700 44px Arial, sans-serif;color:${C.ink}">غيمة</div>`],
  ['وضعه على خلفية مزدحمة', `<div style="position:absolute;inset:0;background:url('${sv(E.patternSheet('apricot', 300, 200, { size: 50 }))}')"></div><img src="${wm()}" style="width:60%;position:relative">`],
  ['تغيير ترتيب العناصر', `<div style="display:flex;align-items:center;gap:6px"><img src="${wm()}" style="width:45%"><img src="${sv(M.badgeSVG(M.COLORWAYS.color))}" style="width:22%"></div>`],
]
pg('الاستخدامات الخاطئة', '4 · الاستخدام', `<div class="cols c4" style="gap:5mm">${misuse.map(([t, h]) => `<div><div class="tile" style="height:40mm;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">${h}<div style="position:absolute;top:2mm;left:2mm;width:7mm;height:7mm;border-radius:50%;background:${C.clay};color:#fff;font:700 13px/7mm 'Readex Pro';text-align:center">✕</div></div><div class="lbl">${t}</div></div>`).join('')}</div>
<p style="margin-top:5mm">القاعدة: الشعار يُستخدم كما هو في الملفات. للتكبير أو التصغير اسحبوا من الزاوية مع الحفاظ على النسب. للأختام بلون واحد استخدموا النسخة السوداء أو البيضاء، وللخلفيات الداكنة استخدموا «الملون على داكن» أو الأبيض.</p>`)

// ===== 10 الألوان =====
const ratio = { ink: 18, cotton: 40, apricot: 8, sage: 8, sageDeep: 2, mist: 4, sand: 12, milk: 4, clay: 2, muted: 1, line: 1 }
const pairs = { ink: 'قطن، حليب، رمل، مشمش، مريمية', cotton: 'حبر، مشمش، مريمية', apricot: 'حبر، قطن', sage: 'حبر، قطن، حليب', sageDeep: 'حليب، قطن', mist: 'حبر، حليب', sand: 'حبر، مشمش، مريمية', milk: 'حبر، طين', clay: 'حليب، قطن', muted: 'قطن، حليب', line: 'حدود على القطن والحليب' }
const fn = { ink: 'الأساسي: الشعار والعناوين والنصوص والأزرار الأساسية', cotton: 'خلفية أساسية', apricot: 'الإبراز: «نقطة الغيمة»، شارات «جديد»، أزرار ثانوية', sage: 'ثانوي: أقسام هادئة وشارات الهدايا', sageDeep: 'مساعد: «متوفر» ورسائل النجاح', mist: 'مساعد: خلفيات النصائح والمعلومات', sand: 'خلفية بديلة وخلفيات الصور', milk: 'البطاقات والحقول', clay: 'السعر المخفض والعروض والأخطاء', muted: 'النصوص الثانوية', line: 'الحدود والفواصل' }
const ex = { ink: 'عنوان المنتج، زر «اطلبوا الآن»', cotton: 'خلفية المنشور والموقع', apricot: 'ملصق «جديد»', sage: 'خلفية «وصل حديثاً»', sageDeep: 'ملصق «متوفر مجدداً»', mist: 'منشور النصائح', sand: 'خلفية الأطقم والهدايا', milk: 'بطاقة المنتج', clay: 'السعر بعد الخصم', muted: 'وصف المنتج', line: 'حدود الحقول' }
pg('نظام الألوان', '5 · الألوان', `<table><tr><th></th><th>الاسم</th><th>HEX</th><th>RGB</th><th>CMYK مقترح*</th><th>الوظيفة</th><th>النسبة</th><th>يُدمج مع</th><th>مثال</th></tr>
${PALETTE.map((p) => `<tr><td><div style="width:9mm;height:9mm;border-radius:2mm;background:${p.hex};border:1px solid ${C.line}"></div></td><td><b>${p.name}</b><br><span class="small">${p.en}</span></td><td class="ltr">${p.hex}</td><td><span class="ltr">${rgb(p.hex).join(', ')}</span></td><td><span class="ltr">${cmyk(p.hex).join(', ')}</span></td><td>${fn[p.key]}</td><td>${ratio[p.key]}٪</td><td>${pairs[p.key]}</td><td>${ex[p.key]}</td></tr>`).join('')}</table>
<p class="small" style="margin-top:2mm">* قيم CMYK محسوبة كاقتراح أولي، ويجب مراجعتها مع المطبعة حسب ملف تعريف الألوان ونوع الورق وبروفة مطبوعة. ملف الألوان لفوتوشوب: 02_Colors_Fonts/Colors/Ghayma_Swatches.ase</p>`)

// ===== 11 النسب والاستخدام والتباين =====
const order = ['cotton', 'sand', 'ink', 'apricot', 'sage', 'mist', 'milk', 'sageDeep', 'clay', 'muted', 'line']
const use = [['العناوين', 'حبر الغسق', C.ink], ['النصوص الثانوية', 'رمادي الغيم', C.muted], ['الأسعار', 'حبر الغسق', C.ink], ['السعر بعد الخصم', 'طين دافئ', C.clay], ['الزر الأساسي', 'خلفية حبر + نص قطن', C.ink], ['الزر الثانوي/الإبراز', 'خلفية مشمش + نص حبر', C.apricot], ['الخلفيات', 'قطن، رمل، حليب', C.sand], ['العروض', 'شريط طين + ملصق «عرض خاص»', C.clay], ['الجديد', 'ملصق مشمش', C.apricot], ['الهدايا', 'مريمية', C.sage]]
const cpairs = [['ink', 'cotton'], ['ink', 'apricot'], ['ink', 'sage'], ['muted', 'cotton'], ['clay', 'milk'], ['milk', 'sageDeep'], ['cotton', 'ink']]
pg('النسب والوظائف ووضوح القراءة', '5 · الألوان', `<div style="display:flex;height:14mm;border-radius:4mm;overflow:hidden;margin-bottom:5mm">${order.map((k) => `<div style="flex:${ratio[k]};background:${C[k]};border-left:1px solid #fff"></div>`).join('')}</div>
<div class="cols c2"><div><h3>أي لون لأي شيء</h3><table>${use.map(([a, b, c]) => `<tr><td style="width:40%"><b>${a}</b></td><td><span style="display:inline-block;width:4mm;height:4mm;border-radius:1mm;background:${c};vertical-align:middle;margin-left:2mm"></span>${b}</td></tr>`).join('')}</table></div>
<div><h3>وضوح النصوص (معيار WCAG)</h3><table><tr><th>النص</th><th>الخلفية</th><th>نسبة التباين</th><th></th></tr>${cpairs.map(([a, b]) => { const r = contrast(C[a], C[b]); return `<tr><td>${PALETTE.find((p) => p.key === a).name}</td><td>${PALETTE.find((p) => p.key === b).name}</td><td class="ltr">${r.toFixed(1)}:1</td><td>${r >= 4.5 ? ok('مناسب للنصوص') : r >= 3 ? ok('عناوين كبيرة فقط') : no()}</td></tr>` }).join('')}</table>
<p class="small" style="margin-top:3mm">لا تضعوا نصاً بلون المشمش أو المريمية أو الرمل على خلفية فاتحة؛ هذه ألوان خلفيات وعناصر وليست ألوان نصوص. النص الأبيض فوق المشمش غير واضح.</p></div></div>`)

// ===== 12 الخطوط =====
pg('نظام الخطوط', '6 · الخطوط', `<div class="cols c2"><div class="card"><div class="small">العناوين · الأسعار · الأزرار</div><div style="font:600 46px/1.2 'Readex Pro'">Readex Pro</div><div style="font:400 26px/1.5 'Readex Pro'">أ ب ت ث ج ح خ · 0123456789</div><div style="display:flex;gap:5mm;margin-top:2mm">${[400, 500, 600, 700].map((w) => `<span style="font:${w} 18px 'Readex Pro'">وزن ${w}</span>`).join('')}</div><p class="small" style="margin-top:2mm">رخصة SIL OFL 1.1 — مجاني للاستخدام التجاري. المصدر: <span class="ltr">fonts.google.com/specimen/Readex+Pro</span></p></div>
<div class="card"><div class="small">النصوص والوصف</div><div style="font:500 40px/1.25 'IBM Plex Sans Arabic'">IBM Plex Sans Arabic</div><div style="font:400 18px/1.8 'IBM Plex Sans Arabic'">بدلة قطنية بأزرار أمامية سهلة، متوفرة من عمر الولادة حتى 6 أشهر.</div><div style="display:flex;gap:5mm;margin-top:2mm">${[400, 500, 600].map((w) => `<span style="font:${w} 18px 'IBM Plex Sans Arabic'">وزن ${w}</span>`).join('')}</div><p class="small" style="margin-top:2mm">رخصة SIL OFL 1.1 — مجاني للاستخدام التجاري. المصدر: <span class="ltr">fonts.google.com/specimen/IBM+Plex+Sans+Arabic</span></p></div></div>
<table style="margin-top:5mm"><tr><th>الاستخدام</th><th>الخط والوزن</th><th>منشور 1080</th><th>ستوري 1080×1920</th><th>الموقع (جوال / كمبيوتر)</th><th>تباعد الأسطر</th></tr>
<tr><td>عنوان رئيسي</td><td>Readex Pro 600</td><td>60–84 بكسل</td><td>72–96</td><td>28 / 44</td><td>1.25</td></tr>
<tr><td>عنوان فرعي</td><td>Readex Pro 500</td><td>40–56</td><td>48–62</td><td>20 / 28</td><td>1.3</td></tr>
<tr><td>نص ووصف</td><td>IBM Plex Sans Arabic 400</td><td>28–34</td><td>34–40</td><td>16 / 16</td><td>1.6–1.75</td></tr>
<tr><td>الأسعار والأرقام</td><td>Readex Pro 600 بأرقام 0–9</td><td>56–76</td><td>72–80</td><td>20 / 22</td><td>1.2</td></tr>
<tr><td>الأزرار والعبارات القصيرة</td><td>Readex Pro 500</td><td>28–32</td><td>32–36</td><td>16</td><td>1</td></tr>
<tr><td>ملاحظات صغيرة</td><td>IBM Plex Sans Arabic 400</td><td>22–24 (لا أقل)</td><td>26–28</td><td>13–14</td><td>1.6</td></tr></table>
<p class="small" style="margin-top:2mm">رسم حروف الشعار ليس خطاً للكتابة. الخطوط أعلاه للمحتوى فقط. لا تستخدموا أكثر من وزنين في التصميم الواحد.</p>`)

// ===== 13 نماذج الخطوط =====
pg('نماذج تطبيقية للخطوط', '6 · الخطوط', `<div class="cols c2"><div class="card" style="height:120mm"><img src="${wm()}" style="height:16mm"><div class="small" style="margin:1mm 0 5mm">رسم الشعار (مسارات — لا يُكتب)</div>
<div style="font:600 40px/1.25 'Readex Pro'">هدية مولود جاهزة</div><div class="small">عنوان إعلان — Readex Pro 600</div>
<div style="font:400 17px/1.75 'IBM Plex Sans Arabic';margin-top:4mm">طقم من ثلاث قطع بألوان هادئة، يصل في صندوق هدية مع بطاقة باسم المولود عند الطلب.</div><div class="small">وصف منتج — IBM Plex Sans Arabic 400</div>
<div style="display:flex;gap:6mm;align-items:baseline;margin-top:4mm"><span style="font:600 38px 'Readex Pro';color:${C.clay}">55 ر.س</span><s style="font:400 22px 'Readex Pro';color:${C.muted}">69 ر.س</s></div><div class="small">السعر — Readex Pro 600 (والسابق مشطوب بالرمادي)</div></div>
<div><h3>قواعد عملية</h3><ul><li>العنوان سطران كحد أقصى. إن طال: اختصروه أولاً، ثم صغّروا الحجم حتى 75٪ من الأصل كحد أدنى.</li><li>الوصف ثلاثة أسطر كحد أقصى في المنشور.</li><li>الأرقام بالأرقام 0–9 مع «ر.س» بعد الرقم، ومسافة بينهما.</li><li>لا تستخدموا الخط العريض المصطنع أو المائل أو التمديد.</li><li>لا تباعد أحرف في العربية؛ التباعد يكسر الاتصال.</li><li>المحاذاة لليمين في الفقرات، والوسط في العناوين القصيرة والستوري.</li></ul>
<h3 style="margin-top:4mm">التثبيت</h3><p>ثبتوا الخطوط من مجلد 02_Colors_Fonts/Fonts قبل فتح القوالب، ثم أعيدوا تشغيل البرنامج.</p></div></div>`)

// ===== 14 العناصر المساندة 1 =====
pg('العناصر المساندة: النمط والإطارات والفواصل', '7 · العناصر', `<div class="cols c4" style="gap:4mm">${Object.entries(E.PATTERNS).map(([k, p]) => `<div><div class="tile" style="height:30mm"><img src="${sv(E.patternSheet(k, 400, 220, { size: 110 }))}" style="width:100%;height:100%;object-fit:cover"></div><div class="lbl">النمط ${p.label}</div></div>`).join('')}</div>
<p class="small" style="margin:2mm 0 4mm">النمط مبني من «نقطة الغيمة» ونقاط ناعمة. يُستخدم خلفية هادئة بشفافية 40–100٪ بعيداً عن النصوص الصغيرة، ولا يوضع فوق صورة المنتج.</p>
<div class="cols c5" style="gap:4mm">${Object.entries(E.FRAMES).map(([k, t]) => `<div><div class="tile" style="height:36mm;display:flex;align-items:center;justify-content:center;background:${C.cotton}"><img src="${sv(E.frameSVG(k, 200, k === 'circle' ? 200 : 250, C.sand))}" style="height:30mm"></div><div class="lbl">إطار ${t}</div></div>`).join('')}</div>
<div class="cols c4" style="gap:4mm;margin-top:4mm">${Object.entries(E.DIVIDERS).map(([k, f]) => `<div class="tile" style="height:14mm;display:flex;align-items:center;justify-content:center;padding:3mm"><img src="${sv(f())}" style="width:100%"></div>`).join('')}</div>`)

// ===== 15 العناصر المساندة 2 =====
pg('الملصقات والأيقونات والأزرار وبطاقات الأسعار', '7 · العناصر', `<div style="display:flex;gap:5mm;align-items:center;flex-wrap:wrap">${Object.values(E.STICKERS).map((s) => `<img src="${sv(s.svg())}" style="height:${s.ar.includes('هدية') || s.ar.includes('عرض') ? 24 : 11}mm">`).join('')}</div>
<p class="small" style="margin:2mm 0 4mm">ملصق واحد في التصميم كحد أقصى، في زاوية الصورة، بميل لا يتجاوز 8 درجات. «عرض خاص» للعروض فقط، «هدية مولود» لمحتوى الهدايا.</p>
<div style="display:grid;grid-template-columns:repeat(8,1fr);gap:3mm">${Object.entries(ICONS).map(([k, v]) => `<div class="tile" style="padding:2mm;text-align:center"><img src="${sv(iconSVG(k))}" style="width:10mm"><div class="small">${v.ar}</div></div>`).join('')}</div>
<p class="small" style="margin:2mm 0 4mm">أيقونات خطية على شبكة 48، بسماكة موحدة وأطراف دائرية. لا تخلطوها بأيقونات بأسلوب آخر.</p>
<div style="display:flex;gap:6mm;align-items:center;flex-wrap:wrap">${['primary', 'accent', 'secondary', 'light'].map((k) => `<img src="${sv(E.buttonSVG(k))}" style="height:10mm">`).join('')}<img src="${sv(E.priceCardSVG({ price: '89' }))}" style="height:24mm"><img src="${sv(E.priceCardSVG({ price: '55', old: '69', name: 'بيجامة الضباب' }))}" style="height:28mm"></div>`)

// ===== 16 أسلوب الصور =====
pg('أسلوب تصوير وعرض المنتجات', '8 · الصور', `<div class="cols c2"><div><table>
<tr><td><b>الخلفيات</b></td><td>أسطح قطنية أو كتانية بألوان القطن والرمل والحليب، أو جدار فاتح. خلفية واحدة لكل مجموعة تصوير.</td></tr>
<tr><td><b>الإضاءة</b></td><td>ضوء نهار ناعم من نافذة جانبية، بلا فلاش مباشر. ظلال ناعمة وقصيرة.</td></tr>
<tr><td><b>الزوايا</b></td><td>من الأعلى (فلات لاي) للقطع المفردة والأطقم؛ زاوية 45° للمكدس والصناديق؛ مستوى العين للمعلق على الشماعة.</td></tr>
<tr><td><b>الاقتصاص والمساحة</b></td><td>المنتج في المنتصف ويشغل 60–70٪ من الصورة، مع مساحة فارغة حوله تسمح بالقص 4:5 و1:1 و9:16 دون قطع المنتج.</td></tr>
<tr><td><b>الإكسسوارات المساندة</b></td><td>قطعة أو قطعتان بحد أقصى: شريطة، بطاقة فارغة، غصن جاف، مكعب خشبي. لا تطغى على المنتج ولا تحمل شعارات أخرى.</td></tr>
<tr><td><b>معالجة موحدة</b></td><td>تعديل السطوع والتباين وتوازن الأبيض فقط لتطابق الواقع. لا فلاتر ملونة، ولا تغيير للون الحقيقي للقطعة، ولا تنعيم يخفي الخامة.</td></tr></table></div>
<div><div class="cols c2" style="gap:3mm">${[['ph01-onesie', ok('مساحة حول المنتج')], ['ph07-set', ok('طقم على خلفية واحدة')]].map(([k, t]) => `<div><div class="tile"><img src="${im(path.join(process.cwd(), 'assets/illustrated', k + '-sq.jpg'), 400)}" style="width:100%;display:block"></div><div class="lbl">${t}</div></div>`).join('')}
<div><div class="tile" style="height:36mm;overflow:hidden"><img src="${photos[2]}" style="width:220%;margin:-30% -60%;display:block;filter:saturate(2.2) hue-rotate(-25deg)"></div><div class="lbl">${no('قص المنتج وفلتر يغير اللون')}</div></div>
<div><div class="tile" style="height:36mm;position:relative;background:#ddd"><img src="${sv(E.patternSheet('apricot', 300, 300, { size: 40 }))}" style="position:absolute;inset:0;width:100%;height:100%"><img src="${photos[0]}" style="position:absolute;width:40%;left:30%;top:20%"></div><div class="lbl">${no('خلفية مزدحمة تنافس المنتج')}</div></div></div>
<p class="small" style="margin-top:3mm">الصور في هذا الدليل والقوالب رسوم توضيحية؛ استبدلوها بصور منتجاتكم الحقيقية.</p></div></div>`)

// ===== 17 نبرة الكتابة =====
pg('نبرة الكتابة', '8 · الكتابة', `<div class="cols c2"><div><h3>المبادئ</h3><ul><li><b>دافئة وبسيطة:</b> جمل قصيرة وكلمات مألوفة.</li><li><b>مخاطبة الجمع:</b> «اطلبوا، تسوّقوا، احفظوا» تشمل الأم والأب ومن يبحث عن هدية.</li><li><b>صادقة:</b> نذكر الخامة والمقاس كما يحددها المورد أو بطاقة المنتج فقط.</li><li><b>بلا مبالغة:</b> لا «الأفضل» ولا «الأكثر أماناً» ولا «طبي» ولا «عضوي 100٪» دون شهادة موثقة.</li><li><b>بلا ضغط مزيف:</b> لا عدادات أو كميات وهمية؛ اذكروا مدة العرض الحقيقية فقط.</li><li><b>آراء حقيقية:</b> رأي العميل كما وصل وبإذنه، دون تقييمات أو أعداد مصطنعة.</li></ul></div>
<div><table><tr><th>النوع</th><th>أمثلة</th></tr>
<tr><td>عناوين المنتجات</td><td>بدلة قطنية للمولود · طقم الاستقبال · بيجامة الضباب</td></tr>
<tr><td>العروض</td><td>خصم 20٪ على البيجامات حتى نهاية الأسبوع · سعر خاص للأطقم هذا الشهر</td></tr>
<tr><td>بطاقات الشكر</td><td>شكراً لأنكم اخترتم غيمة · نتمنى لمولودكم أياماً دافئة وهادئة</td></tr>
<tr><td>عبارات الطلب</td><td>اطلبوا الآن · تسوّقوا الجديد · للطلب: الرابط في الحساب · اسألونا عن المقاس</td></tr>
<tr><td>الدفع بالتحويل</td><td>بعد التحويل أرسلوا صورة السند عبر واتساب مع رقم الطلب، ونؤكد طلبكم بعد مراجعة التحويل</td></tr>
<tr><td>تجنّبوا</td><td>«مضمون 100٪» · «آمن طبياً» · «آخر قطعة!» إن لم تكن حقيقية · «تم الدفع» قبل المراجعة</td></tr></table></div></div>`)

// ===== 18 خريطة القوالب =====
const tmap = [['منتج جديد أو مفرد', 'منشور 01 منتج واحد · ستوري 01'], ['طقم أو مجموعة', 'منشور 02 مجموعة'], ['تخفيض', 'منشور 03 تخفيض · ستوري 03 عرض مؤقت'], ['دفعة منتجات جديدة', 'منشور 04 وصل حديثاً · ستوري 02'], ['هدايا وتغليف', 'منشور 05 هدية مولود'], ['رأي عميل', 'منشور 06 · ستوري 07'], ['نصائح ومعلومات', 'منشور 07 نصائح · كاروسيل 09'], ['تعريف بالمتجر', 'منشور 08 إعلان عام'], ['شرح متسلسل', 'كاروسيل 09: غلاف + صفحات + ختام'], ['عودة منتج', 'ستوري 04 متوفر مجدداً'], ['تفاعل', 'ستوري 05 اختيار · 06 أسئلة · 10 رابط/تصويت'], ['طريقة الطلب والدفع', 'ستوري 08 خطوات الطلب'], ['أوقات العمل والتوصيل', 'ستوري 09 تنويه']]
pg('اختيار القالب المناسب لكل نوع محتوى', '9 · القوالب', `<table><tr><th>المحتوى</th><th>القالب</th></tr>${tmap.map(([a, b]) => `<tr><td><b>${a}</b></td><td>${b}</td></tr>`).join('')}</table>
<p class="small" style="margin-top:3mm">كل قالب منشور متوفر بمقاسين: رأسي 1080×1350 (المفضل للظهور الأكبر) ومربع 1080×1080. لكل قالب نسخة فارغة للتعديل ونسخة مثال توضح الاستخدام، ومعاينة بنص طويل.</p>`)

// ===== 19-20 معاينة قوالب المنشورات =====
const postThumb = (id, sz = '4x5_1080x1350') => im(d('04_Post_Templates', 'Previews', `Post_${id}_${sz}_Example.jpg`), 420)
pg('قوالب المنشورات — رأسي 4:5', '9 · القوالب', `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3mm">${POSTS.map(([id, ar]) => `<div><div class="tile"><img src="${postThumb(id)}" style="width:100%;display:block"></div><div class="small" style="text-align:center">${id.slice(0, 3)} ${ar}</div></div>`).join('')}</div>`)
pg('قوالب المنشورات — مربع، والنصوص الطويلة', '9 · القوالب', `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3mm">${POSTS.slice(0, 6).map(([id, ar]) => `<div><div class="tile"><img src="${postThumb(id, '1x1_1080x1080')}" style="width:100%;display:block"></div><div class="small" style="text-align:center">${ar}</div></div>`).join('')}</div>
<h3 style="margin-top:4mm">معالجة النص القصير والطويل</h3><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3mm">${POSTS.slice(0, 6).map(([id]) => `<div class="tile"><img src="${im(d('04_Post_Templates', 'Previews', `Post_${id}_4x5_1080x1350_LongText_Example.jpg`), 420)}" style="width:100%;display:block"></div>`).join('')}</div>`)

// ===== 21 الشبكة والهوامش =====
pg('الشبكة والهوامش الموحدة', '9 · القوالب', `<div class="cols c3"><div class="tile"><img src="${im(d('04_Post_Templates', 'Previews', 'Post_01_Product_4x5_1080x1350_Grid.jpg'), 500)}" style="width:100%;display:block"></div><div class="tile"><img src="${im(d('04_Post_Templates', 'Previews', 'Post_01_Product_1x1_1080x1080_Grid.jpg'), 500)}" style="width:100%;display:block"></div>
<div><h3>القواعد الثابتة في كل المنشورات</h3><ul><li>هامش 72 بكسل من كل جانب (الخط الأحمر المتقطع).</li><li>شبكة 6 أعمدة بفاصل 24 بكسل (المناطق المشمشية).</li><li>الشعار ثابت أعلى اليمين بعرض 168 بكسل.</li><li>اسم الحساب أسفل اليسار.</li><li>الصورة داخل إطار من إطارات الهوية.</li><li>الترتيب: الصورة ← الاسم ← الوصف ← السعر ← الزر.</li></ul><p class="small">في ملفات PSD: طبقة «شبكة المحاذاة والهوامش» مخفية، أظهروها عند التعديل. والأدلة (Guides) مضافة على الهوامش.</p></div></div>`)

// ===== 22 الستوري =====
pg('قوالب الستوري ومناطق الأمان', '10 · الستوري', `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3mm">${STORIES.slice(0, 5).map(([id, ar]) => `<div><div class="tile"><img src="${im(d('05_Story_Templates', 'Previews', `Story_${id}_Example.jpg`), 300)}" style="width:100%;display:block"></div><div class="small" style="text-align:center">${ar}</div></div>`).join('')}<div><div class="tile"><img src="${im(d('05_Story_Templates', 'Previews', 'Story_01_Product_Price_CTA_SafeZones.jpg'), 300)}" style="width:100%;display:block"></div><div class="small" style="text-align:center">مناطق الأمان</div></div></div>
<div class="cols c2" style="margin-top:3mm"><p><b>مناطق الأمان:</b> أعلى 250 بكسل وأسفل 340 بكسل تغطيها واجهة إنستغرام (الاسم، الرد، الأزرار). لا تضعوا فيها معلومات أساسية. المناطق موجودة كطبقة مخفية قابلة للتعديل إذا تغيرت الواجهة.</p><p><b>الأزرار المرسومة</b> في الستوري بصرية فقط وليست روابط. للرابط أو التصويت أو العد التنازلي أضيفوا ملصقات إنستغرام من داخل التطبيق في المساحة المخصصة لها.</p></div>`)

// ===== 23 الريلز =====
pg('نظام الريلز: الأغلفة والعناصر والحركة', '10 · الريلز', `<div class="cols c2"><div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3mm">${['Reel_Cover_A_Photo_Title', 'Reel_Cover_B_Text_Pattern', 'Reel_Cover_C_Arch', 'Reel_Layout_Product_Showcase'].map((id) => `<div class="tile"><img src="${im(d('06_Reels_Templates', 'Previews', `${id}_Example.jpg`), 300)}" style="width:100%;display:block"></div>`).join('')}</div>
<div class="tile" style="margin-top:3mm"><img src="${im(d('06_Reels_Templates', 'Previews', 'Reel_Cover_Crop_Preview.jpg'), 700)}" style="width:100%;display:block"></div></div>
<div><h3>أسلوب الحركة</h3><p>هادئة وناعمة: ظهور تدريجي وانزلاق قصير (20–60 بكسل) بمنحنى تباطؤ. لا قفزات ولا اهتزاز ولا انتقالات دوّارة.</p>
<table><tr><th>العنصر</th><th>الظهور</th><th>المدة</th></tr><tr><td>مقدمة الشعار</td><td>الغيمة تهبط 0–0.7ث، الحروف تظهر من اليمين 0.35–1.35ث، العبارة 1.35–1.95ث</td><td>3 ث</td></tr><tr><td>الشعار الصغير</td><td>ظهور تدريجي</td><td>0.4 ث</td></tr><tr><td>شريط العنوان</td><td>انزلاق من الأعلى + ظهور</td><td>0.4 ث، يبقى 4–5 ث</td></tr><tr><td>بطاقة السعر</td><td>انزلاق من الأسفل بعد ثانية من العنوان</td><td>0.5 ث، تبقى 3–4 ث</td></tr><tr><td>انتقال للختام</td><td>تلاشي متقاطع</td><td>0.6 ث</td></tr><tr><td>الشاشة الختامية</td><td>الشارة ثم الدعوة ثم اسم الحساب</td><td>3 ث</td></tr></table>
<p class="small" style="margin-top:2mm">الملفات: مقدمة الشعار MP4 وبخلفية شفافة (MOV/WebM)، الشاشة الختامية MP4، مثال ريل 9 ثوانٍ يوضح التوقيت، وعناصر PNG شفافة للتركيب في CapCut أو InShot أو أي برنامج مونتاج. ضعوا العنوان داخل المنطقة الوسطى (بين 420 و1500 بكسل) ليبقى ظاهراً عند القص.</p></div></div>`)

// ===== 24 الهايلايت وشكل الحساب =====
pg('أغلفة الهايلايت وشكل الحساب', '10 · الحساب', `<div class="cols c2"><div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4mm">${HIGHLIGHTS.map(([id, label]) => `<div style="text-align:center"><img src="${im(d('07_Highlights', 'PNG_Square_1080x1080', `Highlight_${id}.png`), 200)}" style="width:100%;border-radius:50%;border:1px solid ${C.line}"><div class="lbl">${label}</div></div>`).join('')}</div>
<p style="margin-top:4mm">صورة الحساب: الرمز داخل الدائرة على خلفية القطن (أو الحبر). الهايلايت: أيقونة الهوية داخل دائرة ملونة، والأيقونة في المنتصف لأن إنستغرام يقص دائرة من الوسط.</p>
<p>الشبكة: نوّعوا بين القوالب (منتج، نصائح، عرض، رأي) مع الحفاظ على الخلفيات الفاتحة غالباً وخلفية داكنة كل عدة منشورات. كل منشور مستقل ولا نقسّم صورة كبيرة على عدة منشورات.</p></div>
<div class="tile"><img src="${im(d('07_Highlights', 'Instagram_Profile_Preview', 'Instagram_Profile_Preview.jpg'), 520)}" style="width:62%;display:block;margin:auto"></div></div>`)

// ===== 25 التغليف =====
pg('تطبيق الهوية على التغليف', '11 · التغليف', `<div class="cols c2"><div class="tile"><img src="${im(d('08_Packaging', 'Mockup_Previews', 'Packaging_Set_Preview.jpg'), 900)}" style="width:100%;display:block"></div>
<div><table><tr><th>العنصر</th><th>المقاس المقترح</th></tr>${ITEMS.map((i) => `<tr><td><b>${i.ar}</b></td><td>${i.size}</td></tr>`).join('')}</table>
<p class="small" style="margin-top:3mm"><b>مهم قبل الطباعة:</b> الملفات بمقاس حقيقي مع نزف 3 ملم وعلامات قص، وخطوط القص والطي للتوضيح فقط. اطلبوا من المطبعة قالب القص المعتمد (Die-line) والمقاسات النهائية وطابقوا التصميم عليه، واطلبوا بروفة ألوان.</p></div></div>`)

// ===== 26 المتجر الإلكتروني =====
pg('تطبيق الهوية على المتجر الإلكتروني', '11 · المتجر', `<div class="cols c2"><div class="tile" style="height:150mm;overflow:hidden"><img src="${im(d('09_Web_Identity', 'Web_Identity_Preview_Desktop.jpg'), 900)}" style="width:100%;display:block"></div>
<div><h3>القيم المنظمة (CSS)</h3><p>الملف <span class="ltr">ghayma-tokens.css</span> يحتوي متغيرات الألوان والخطوط والأحجام والمسافات والحواف والظلال. انسخوه في المتجر واستخدموا المتغيرات بدل القيم المباشرة.</p>
<table><tr><td>الحواف</td><td>10 / 16 / 24 بكسل، والأزرار بيضاوية بالكامل</td></tr><tr><td>المسافات</td><td>مضاعفات 4: 4، 8، 12، 16، 24، 32، 48، 64</td></tr><tr><td>بطاقة المنتج</td><td>خلفية حليب، صورة 4:5، اسم Readex 500، سعر Readex 600</td></tr><tr><td>السعر المخفض</td><td>طين دافئ، والسابق مشطوب رمادي</td></tr><tr><td>زر الشراء</td><td>حبر بنص قطن، وتركيز بحد مشمشي</td></tr><tr><td>الحقول</td><td>خلفية قطن وحد «خيط»؛ الخطأ بحد ونص «طين»</td></tr><tr><td>الرسائل</td><td>نجاح مريمية عميقة، خطأ طين، معلومة ضباب</td></tr></table>
<p class="small" style="margin-top:2mm">الملف النموذجي <span class="ltr">Ghayma_Web_Identity_Sample.html</span> يعرض الرأس والبانر وبطاقات المنتجات والأقسام والحقول والرسائل والتذييل (نموذج تطبيق وليس متجراً كاملاً).</p></div></div>`)

// ===== 27-31 الدليل العملي =====
const TUT = OUT('10_Brand_Guidelines', '_tutorial')
const W = 1080, H = 1350
await exportDesign({ html: P.product({ W, H, blank: true }), w: W, h: H, jpg: path.join(TUT, 's1.jpg') })
await exportDesign({ html: P.product({ W, H, blank: false, d: { ...BLANK, img: 'ph01-onesie' } }).replace(/data-layer="علامة «مثال»[^>]*>[^<]*<\/div>/, ''), w: W, h: H, jpg: path.join(TUT, 's2.jpg') })
await exportDesign({ html: P.product({ W, H, blank: false }).replace(/data-layer="علامة «مثال»[^>]*>[^<]*<\/div>/, ''), w: W, h: H, jpg: path.join(TUT, 's3.jpg') })
await exportDesign({ html: P.product({ W, H, blank: false, d: { ...EX.p1, price: '69' } }).replace(/data-layer="علامة «مثال»[^>]*>[^<]*<\/div>/, '').replace('</div><script>', `<img class="L" style="left:690px;top:180px;height:190px;transform:rotate(8deg)" src="${sv(E.STICKERS.special.svg())}"><div class="L t muted" style="left:72px;top:1123px;width:470px;font-size:40px;text-align:right;text-decoration:line-through">89 ر.س</div></div><script>`), w: W, h: H, jpg: path.join(TUT, 's4.jpg') })
const layersPanel = (names) => `<div style="background:#2b2b2b;color:#ddd;border-radius:3mm;padding:2mm;font:11px 'Readex Pro';direction:rtl"><div style="font-weight:600;padding:1mm 2mm;border-bottom:1px solid #444;margin-bottom:1mm">لوحة الطبقات (Layers)</div>${names.map(([t, hl]) => `<div style="padding:1.2mm 2mm;border-radius:1.5mm;${hl ? 'background:#3d5a80;color:#fff' : ''}">${t}</div>`).join('')}</div>`
const lp = [['علامة «مثال» — احذفها قبل النشر'], ['اسم الحساب'], ['زر الطلب (اختياري) — النص'], ['زر الطلب (اختياري) — الشكل'], ['السعر'], ['وصف قصير'], ['اسم المنتج'], ['الشعار (لا تعدّله)'], ['ملصق: جديد'], ['صورة المنتج — ضع صورتك هنا ↲'], ['إطار الصورة'], ['شبكة المحاذاة والهوامش (مخفية)'], ['الخلفية']]
pg('دليل عملي ١: قبل البدء', '12 · من القالب إلى المنشور', `<div class="cols c2"><div>
<div class="step"><span class="num">1</span><div><b>ثبّتوا الخطوط</b> من 02_Colors_Fonts/Fonts (Readex Pro وIBM Plex Sans Arabic)، ثم أعيدوا تشغيل البرنامج.</div></div>
<div class="step"><span class="num">2</span><div><b>فعّلوا دعم العربية في فوتوشوب:</b> Edit ← Preferences ← Type ← Choose Text Engine Options: <b>Middle Eastern and South Asian</b>، ثم أعيدوا التشغيل.</div></div>
<div class="step"><span class="num">3</span><div><b>افتحوا القالب الفارغ</b> من 04_Post_Templates/PSD_Editable (مثلاً Post_01_Product_4x5_1080x1350_Blank.psd). إذا ظهرت رسالة تحديث طبقات النص اختاروا <b>Update</b>.</div></div>
<div class="step"><span class="num">4</span><div><b>تحققوا من النص العربي:</b> إن ظهر مفككاً أو معكوساً بعد التحديث: حددوا طبقة النص ← لوحة Paragraph ← الاتجاه من اليمين لليسار، واختاروا من قائمة اللوحة <b>Middle Eastern Every-line Composer</b>. قارنوا دائماً بصورة المعاينة في مجلد Previews.</div></div>
<div class="step"><span class="num">5</span><div><b>احفظوا نسخة باسم جديد</b> (File ← Save As) حتى يبقى القالب الفارغ نظيفاً.</div></div>
<p class="small">بديل مجاني: يمكن فتح الملفات في Photopea عبر المتصفح بنفس أسماء الطبقات؛ وإن واجهتم مشكلة في النص العربي فاستخدموا فوتوشوب.</p></div>
<div class="cols c2" style="gap:4mm"><div class="tile"><img src="${im(path.join(TUT, 's1.jpg'), 420)}" style="width:100%;display:block"></div>${layersPanel(lp.map((t) => [t[0], false]))}</div></div>`)
pg('دليل عملي ٢: استبدال صورة المنتج دون تشويهها', '12 · من القالب إلى المنشور', `<div class="cols c2"><div>
<div class="step"><span class="num">1</span><div>في لوحة الطبقات حددوا طبقة <b>«صورة المنتج — ضع صورتك هنا»</b>. هذه الطبقة مقصوصة (Clipping Mask) على شكل «إطار الصورة» تحتها.</div></div>
<div class="step"><span class="num">2</span><div>File ← <b>Place Embedded</b> واختاروا صورة المنتج. ستظهر فوق الطبقة المحددة.</div></div>
<div class="step"><span class="num">3</span><div>اضغطوا <b>Alt+Ctrl+G</b> (ماك: Option+Cmd+G) أو Layer ← Create Clipping Mask لتدخل الصورة داخل الإطار.</div></div>
<div class="step"><span class="num">4</span><div>كبّروا أو صغّروا بالسحب من <b>الزاوية فقط</b> (التحجيم متناسب افتراضياً في فوتوشوب الحديث؛ إن لم يكن فاضغطوا Shift). لا تسحبوا من الجوانب حتى لا يتمدد المنتج.</div></div>
<div class="step"><span class="num">5</span><div>اجعلوا المنتج في منتصف الإطار مع مساحة حوله، ثم احذفوا أو أخفوا الطبقة القديمة.</div></div></div>
<div class="cols c2" style="gap:4mm"><div class="tile"><img src="${im(path.join(TUT, 's2.jpg'), 420)}" style="width:100%;display:block"></div>${layersPanel(lp.map((t, i) => [t[0], i === 9]))}</div></div>`)
pg('دليل عملي ٣: الاسم والسعر والوصف والعناوين الطويلة', '12 · من القالب إلى المنشور', `<div class="cols c2"><div>
<div class="step"><span class="num">1</span><div>اختاروا أداة النص <b>(T)</b> واضغطوا مرتين على صورة طبقة <b>«اسم المنتج»</b> المصغرة لتحديد كل النص، واكتبوا الاسم الجديد.</div></div>
<div class="step"><span class="num">2</span><div>كرروا مع <b>«وصف قصير»</b> و<b>«السعر»</b>. اكتبوا السعر بالأرقام 0–9 ثم مسافة ثم «ر.س».</div></div>
<div class="step"><span class="num">3</span><div><b>العنوان الطويل:</b> سطران كحد أقصى. اختصروه أولاً؛ وإن احتجتم فصغّروا الخط من لوحة Character حتى 46 بكسل كحد أدنى في المنشور (56 الأصل). الوصف ثلاثة أسطر كحد أقصى.</div></div>
<div class="step"><span class="num">4</span><div>إذا زاد طول النص فحرّكوا طبقات الوصف والسعر والزر للأسفل معاً (حددوها واضغطوا السهم مع Shift) مع إبقاء الهامش السفلي 72 بكسل.</div></div>
<div class="step"><span class="num">5</span><div>زر الطلب اختياري: أخفوا طبقتي «زر الطلب» إن لم تحتاجوه.</div></div></div>
<div class="cols c2" style="gap:4mm"><div class="tile"><img src="${im(path.join(TUT, 's3.jpg'), 420)}" style="width:100%;display:block"></div><div class="tile"><img src="${im(d('04_Post_Templates', 'Previews', 'Post_01_Product_4x5_1080x1350_LongText_Example.jpg'), 420)}" style="width:100%;display:block"></div></div></div>`)
pg('دليل عملي ٤: إضافة تخفيض أو عرض والحفاظ على المحاذاة', '12 · من القالب إلى المنشور', `<div class="cols c2"><div>
<div class="step"><span class="num">1</span><div>للعروض الكاملة استخدموا قالب <b>03 تخفيض</b> مباشرة: فيه السعر السابق مشطوب والسعر الجديد بلون «طين دافئ».</div></div>
<div class="step"><span class="num">2</span><div>لإضافة عرض على قالب المنتج: Place Embedded للملصق <b>Sticker_special.png</b> من 03_Graphic_Elements/Stickers وضعوه في زاوية الصورة بميل خفيف.</div></div>
<div class="step"><span class="num">3</span><div>انسخوا طبقة السعر (Ctrl+J) واجعلوا النسخة «السعر السابق» بلون رمادي الغيم مع Strikethrough من لوحة Character، والسعر الجديد بلون الطين.</div></div>
<div class="step"><span class="num">4</span><div><b>المحاذاة:</b> أظهروا الأدلة (View ← Show ← Guides) وطبقة «شبكة المحاذاة». ابقوا داخل الهامش، ولا تحركوا طبقة الشعار.</div></div>
<div class="step"><span class="num">5</span><div>احذفوا طبقة «علامة مثال» إن كنتم تعدلون نسخة المثال، وأخفوا الشبكة قبل التصدير.</div></div></div>
<div class="cols c2" style="gap:4mm"><div class="tile"><img src="${im(path.join(TUT, 's4.jpg'), 420)}" style="width:100%;display:block"></div><div><div class="ok">✓ المنشور جاهز للنشر</div><p class="small">انتقل القالب من فارغ ← صورة ← نصوص ← عرض، دون تغيير الشعار أو الهوامش أو الألوان.</p></div></div></div>`)
pg('دليل عملي ٥: الستوري وغلاف الريلز والتصدير', '12 · من القالب إلى المنشور', `<div class="cols c2"><div><h3>الستوري</h3><ul><li>افتحوا القالب من 05_Story_Templates، وأظهروا طبقة «مناطق واجهة إنستغرام» للتحقق ثم أخفوها.</li><li>بعد التصدير أضيفوا ملصق الرابط أو التصويت أو الأسئلة من داخل إنستغرام فوق المساحة المنقطة.</li></ul>
<h3 style="margin-top:3mm">غلاف الريلز</h3><ul><li>افتحوا غلافاً من 06_Reels_Templates/PSD_Editable وأظهروا طبقة «حدود القص» للتأكد أن العنوان داخل المنطقة الوسطى.</li><li>صدّروا JPG بمقاس 1080×1920، وارفعوه كغلاف من إعدادات الريل، ثم عدّلوا معاينة الشبكة.</li></ul></div>
<div><h3>صيغ التصدير</h3><table><tr><th>الاستخدام</th><th>الصيغة والمقاس</th></tr>
<tr><td>منشور</td><td>File ← Export ← Export As: JPG جودة 85–90٪، 1080×1350 أو 1080×1080، sRGB</td></tr>
<tr><td>ستوري وغلاف ريلز</td><td>JPG أو PNG بمقاس 1080×1920</td></tr>
<tr><td>عناصر فوق الفيديو</td><td>PNG بخلفية شفافة</td></tr>
<tr><td>الموقع</td><td>الشعار SVG، الصور JPG/WebP، الأيقونات SVG</td></tr>
<tr><td>الطباعة</td><td>PDF بمقاس حقيقي ونزف 3 ملم بعد اعتماد قالب المطبعة، وتحويل الألوان CMYK بالتنسيق مع المطبعة</td></tr></table></div></div>`)

// ===== 32 الأخطاء الشائعة =====
const mk = (src, t, good) => `<div><div class="tile" style="height:52mm;position:relative;overflow:hidden">${src}</div><div class="lbl">${good ? ok() : no()} ${t}</div></div>`
const base = im(d('04_Post_Templates', 'Previews', 'Post_01_Product_4x5_1080x1350_Example.jpg'), 420)
pg('أخطاء شائعة مع أمثلة صحيحة وخاطئة', '13 · المراجعة', `<div class="cols c5" style="gap:4mm">
${mk(`<img src="${base}" style="width:100%">`, 'الصورة داخل الإطار ومتناسبة', true)}
${mk(`<img src="${base}" style="width:100%;height:100%;object-fit:fill;transform:scaleY(1.25)">`, 'تمديد الصورة أو القالب', false)}
${mk(`<div style="position:absolute;inset:0;background:${C.apricot}"></div><img src="${base}" style="width:100%;opacity:.25;position:relative"><div style="position:absolute;top:40%;width:100%;text-align:center;font:600 22px 'Readex Pro';color:#fff">خصم كبير جداً!!!</div>`, 'نص أبيض على مشمش وعبارات مبالغة', false)}
${mk(`<img src="${base}" style="width:100%"><img src="${sv(E.STICKERS.new.svg())}" style="position:absolute;height:9mm;top:6mm;left:4mm"><img src="${sv(E.STICKERS.special.svg())}" style="position:absolute;height:16mm;top:16mm;left:20mm"><img src="${sv(E.STICKERS.newbornGift.svg())}" style="position:absolute;height:16mm;top:30mm;left:2mm"><img src="${sv(E.STICKERS.bestseller.svg())}" style="position:absolute;height:8mm;top:4mm;right:4mm">`, 'ملصقات كثيرة في تصميم واحد', false)}
${mk(`<img src="${base}" style="width:100%;filter:hue-rotate(120deg) saturate(1.6)">`, 'تغيير ألوان الهوية أو الفلاتر', false)}</div>
<div class="card" style="margin-top:5mm"><h3>قائمة مراجعة قبل النشر</h3><div class="cols c2"><ul><li>«غيمة» من ملف الشعار، غير ممدد، في مكانه.</li><li>الاسم والسعر صحيحان ومقروءان.</li><li>العنوان سطران كحد أقصى.</li><li>الصورة حقيقية للمنتج ولونها طبيعي.</li></ul><ul><li>لا ادعاءات عن الخامة أو السلامة أو بلد الصنع غير موثقة.</li><li>لا عدادات أو تقييمات أو كميات وهمية.</li><li>حذف «علامة مثال» وإخفاء الشبكة.</li><li>التصدير بالمقاس الصحيح.</li></ul></div></div>`)

// ===== 33 فهرس الملفات =====
const idx = [['01_Logos', 'الشعار بكل إصداراته: SVG وPNG شفاف، صورة الحساب، أيقونات الموقع، العبارة الوصفية الاختيارية'], ['02_Colors_Fonts', 'لوحة الألوان (PNG/CSS/JSON) وملف Swatches لفوتوشوب، والخطوط مع رخصها وروابطها الرسمية'], ['03_Graphic_Elements', 'النمط، الإطارات، الفواصل، الملصقات، الأيقونات، الأزرار وبطاقات الأسعار (SVG وPNG)'], ['04_Post_Templates', '9 قوالب منشورات (والكاروسيل 3 صفحات) بمقاسين: PSD فارغ ومثال + معاينات'], ['05_Story_Templates', '10 قوالب ستوري: PSD فارغ ومثال + معاينات ومناطق الأمان'], ['06_Reels_Templates', '3 أغلفة، تخطيطات العرض والتغليف، عناصر PNG شفافة، شاشة ختامية، حركة الشعار (MP4/MOV/WebM) ومثال ريل'], ['07_Highlights', '8 أغلفة هايلايت (PSD/PNG) ومعاينة شكل الحساب'], ['08_Packaging', '8 تطبيقات تغليف: PDF للطباعة، PSD، PNG مسطح، ومعاينات'], ['09_Web_Identity', 'متغيرات CSS وJSON، وصفحة نموذجية ولقطات للكمبيوتر والجوال'], ['10_Brand_Guidelines', 'هذا الدليل ولوحة التوجه البصري']]
pg('فهرس الملفات وبرامج التعديل', '13 · الملفات', `<table><tr><th>المجلد</th><th>المحتوى</th></tr>${idx.map(([a, b]) => `<tr><td class="ltr" style="font-weight:600">${a}</td><td>${b}</td></tr>`).join('')}</table>
<div class="cols c2" style="margin-top:4mm"><div class="card"><h3>برامج التعديل</h3><p><b>PSD</b>: Adobe Photoshop (2021 أو أحدث مع تفعيل محرك الشرق الأوسط). يمكن تعديل: النصوص، استبدال الصور داخل الإطارات، الألوان الخلفية، إخفاء/إظهار العناصر. الشعار والملصقات طبقات صور يُفضّل عدم تعديلها.</p><p><b>SVG</b>: Illustrator أو Figma أو Inkscape. <b>PDF</b>: للطباعة. <b>MP4/MOV/PNG</b>: أي برنامج مونتاج مثل CapCut.</p></div>
<div class="card"><h3>ملاحظات صادقة</h3><p>الصور داخل القوالب رسوم توضيحية وليست صوراً لمنتجات حقيقية. القوالب أُنتجت برمجياً وتم التحقق من بنية ملفات PSD وطبقاتها آلياً، لكن لم تُختبر داخل فوتوشوب نفسه؛ إن ظهرت مشكلة في عرض النص العربي اتبعوا خطوات الصفحة «دليل عملي ١».</p></div></div>`)

// ===== الختام =====
pg('', '', `<div style="position:absolute;inset:0;background:${C.ink}"><img src="${sv(E.patternSheet('ink', 1123, 794, { size: 300 }))}" style="position:absolute;inset:0;width:100%;height:100%"><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6mm"><img src="${sv(M.badgeSVG(M.COLORWAYS.reverse))}" style="width:40mm"><img src="${wm('reverse')}" style="width:70mm"><div style="font:500 16px 'Readex Pro';color:${C.sand}">بلطف، في كل تفصيل</div></div></div>`, { bg: C.ink, dark: true })

const html = doc(pages.join(''), GUIDE_CSS, { bg: '#fff' })
await renderPdf(html, path.join(G, 'Ghayma_Brand_Guidelines_AR.pdf'), { width: '297mm', height: '210mm' })
// لوحة التوجه البصري كصورة مستقلة
await renderToFile(doc(`<section class="pg" style="background:${C.cotton};width:1123px;height:794px"><header class="ph"><div><div class="kick">غيمة</div><h2>لوحة التوجه البصري</h2></div></header><div class="pb">${moodBody}</div></section>`, GUIDE_CSS), 1123, 794, path.join(G, 'Ghayma_Visual_Direction_Board.png'), { scale: 2 })
fs.rmSync(TUT, { recursive: true, force: true })
await closeBrowser()
console.log('guide pages', n)
