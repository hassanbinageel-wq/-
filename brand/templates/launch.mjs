// حملة إطلاق حساب إنستغرام «غيمة»: 9 منشورات تكوّن شبكة الحساب، ستوريات العد والتشويق، أغلفة الريلز
// كل النصوص طبقات نص قابلة للتعديل. لا أسعار ولا آراء ولا أرقام مبيعات في هذه التصاميم.
import { L, page, photo } from '../lib/tpl.mjs'
import { C } from '../lib/palette.mjs'
import * as E from '../lib/elements.mjs'
import { iconSVG } from '../lib/icons.mjs'

export const SLOGAN = 'نعومة البدايات'
export const HANDLE = '@ghayma'
const PW = 1080, PH = 1350, M = 80
const SW = 1080, SH = 1920, ST = 250, SB = 340

const svgw = (w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>`
const sky = (w, h, a = C.mist, b = C.cotton, name = 'السماء (تدرج)') => L.rect(name, 0, 0, w, h, `linear-gradient(180deg, ${a} 0%, ${b} 100%)`)
// غيمة كبيرة كطبقة مستقلة (dx لإزاحة اللوحة في المنشورات المتصلة)
const cloudL = (name, cx, base, s, fill, w, h, op = 1, dx = 0) => L.svg(name, svgw(w, h, E.cloud(cx - dx, base, s, fill, op)), 0, 0, w, h)
const dot = (name, cx, cy, r, fill = C.apricot) => L.svg(name, svgw(r * 2, r * 2, `<circle cx="${r}" cy="${r}" r="${r}" fill="${fill}"/>`), cx - r, cy - r, r * 2, r * 2)
const ltr = (html) => html.replace('style="', 'style="direction:ltr;unicode-bidi:isolate;')
const handle = (W, H, color = C.muted, y) => ltr(L.text('اسم الحساب', HANDLE, M, y ?? H - 74, W - 2 * M, 'sub', 26, { align: 'left', color }))
const kicker = (s, x, y, w, color = C.sageDeep, align = 'right') => L.text('عنوان صغير', s, x, y, w, 'sub', 30, { color, align })
const center = (name, s, y, size, cls = 'display', opts = {}) => L.text(name, s, M, y, PW - 2 * M, cls, size, { align: 'center', ...opts })

// ===== المنشورات المتصلة (3 منشورات = صف واحد في الحساب) =====
// اللوحة 3240×1350: يسار | وسط | يمين. في الحساب يظهر الأحدث يساراً، لذلك يُنشر الأيمن أولاً.
const PANO_W = PW * 3
function panoLayers(dx) {
  const vis = (x0, x1) => x1 > dx && x0 < dx + PW
  let b = sky(PW, PH, C.mist, C.cotton)
  const clouds = [
    ['غيمة كبيرة', 1620, 980, 300, C.milk, 1],
    ['غيمة صغيرة', 1080, 520, 80, C.milk, 0.95],
    ['غيمة صغيرة', 2160, 400, 66, C.milk, 0.95],
    ['غيمة سفلية', 420, 1230, 170, C.sand, 1],
    ['غيمة سفلية', 2820, 1290, 190, C.milk, 1],
    ['غيمة بعيدة', 2700, 260, 52, C.milk, 0.8],
    ['غيمة بعيدة', 560, 330, 46, C.milk, 0.8],
  ]
  for (const [n, cx, base, s, f, op] of clouds) if (vis(cx - 1.7 * s, cx + 1.7 * s)) b += cloudL(n, cx, base, s, f, PW, PH, op, dx)
  // نقطة الغيمة المشمشية فوق الغيمة الكبيرة (رمز الهوية)
  if (vis(1700, 1900)) b += L.svg('نقطة الغيمة', svgw(PW, PH, E.cloud(1800 - dx, 520, 46, C.apricot)), 0, 0, PW, PH)
  return b
}
export const PANO = [
  // يمين اللوحة: أول ما يُقرأ
  ['01_Teaser_Right', () => {
    const dx = PW * 2
    let b = panoLayers(dx)
    b += L.text('العنوان', 'شيء ناعم', M, 230, PW - 2 * M, 'display', 150, { lh: 1.15 })
    b += L.text('السطر الثاني', 'في الطريق إليكم…', M, 430, PW - 2 * M, 'title', 64, { color: C.muted })
    b += L.text('ترقيم السلسلة', '١ من ٣', M, PH - 110, PW - 2 * M, 'sub', 30, { color: C.muted })
    return page(b, PW, PH)
  }],
  ['02_Teaser_Middle', () => {
    const dx = PW
    let b = panoLayers(dx)
    b += L.text('ترقيم السلسلة', '٢ من ٣', M, PH - 110, PW - 2 * M, 'sub', 30, { color: C.muted, align: 'center' })
    return page(b, PW, PH)
  }],
  ['03_Teaser_Left', () => {
    const dx = 0
    let b = panoLayers(dx)
    b += L.text('العنوان', 'قريباً', M, 640, PW - 2 * M, 'display', 210, { align: 'left', lh: 1.1 })
    b += L.text('السطر الثاني', 'تابعونا حتى ما يفوتكم الافتتاح', M, 900, PW - 2 * M, 'bodyM', 40, { align: 'left', color: C.muted })
    b += L.text('ترقيم السلسلة', '٣ من ٣', M, PH - 110, PW - 2 * M, 'sub', 30, { color: C.muted, align: 'left' })
    return page(b, PW, PH)
  }],
]
// معاينة الصف كاملاً كما سيظهر في الحساب
export const panoFull = () => {
  let b = ''
  for (let i = 0; i < 3; i++) b += `<div style="position:absolute;left:${i * PW}px;top:0;width:${PW}px;height:${PH}px;overflow:hidden">${PANO[2 - i][1]().match(/<div id="cv"[^>]*>([\s\S]*)<\/div><script>/)[1]}</div>`
  return page(b, PANO_W, PH)
}

// ===== منشورات الكشف والتعريف =====
export function reveal() {
  let b = L.bg(PW, PH, C.ink) + L.pattern('ink', 0, 0, PW, PH, 0.55)
  b += cloudL('غيمة ناعمة', PW / 2, 1420, 420, '#4A3F55', PW, PH)
  b += L.badge(PW / 2 - 190, 250, 380, 'reverse', 'شارة الشعار')
  b += L.logo(PW / 2 - 200, 700, 400, 'reverse')
  b += center('السلوقن', SLOGAN, 930, 76, 'title', { color: C.apricot })
  b += center('سطر التعريف', 'ملابس وهدايا المواليد', 1050, 40, 'bodyM', { color: C.sand })
  b += handle(PW, PH, C.sand)
  return page(b, PW, PH, C.ink)
}
export function story() {
  let b = L.bg(PW, PH, C.cotton)
  b += cloudL('غيمة', 260, 330, 110, C.mist, PW, PH)
  b += dot('نقطة مشمشية', 330, 170, 20)
  b += kicker('لماذا «غيمة»؟', M, 170, PW - 2 * M)
  b += L.text('العنوان', 'لأن أول الأيام\nتستحق شيئاً خفيفاً\nوناعماً كالغيمة', M, 250, PW - 2 * M, 'display', 84, { lh: 1.3, id: 'tt' })
  b += L.svg('فاصل', E.DIVIDERS.cloudLine(400, C.ink), PW - M - 400, 0, 400, 40).replace('class="L"', 'class="L" data-follow="tt" data-gap="50"')
  b += L.text('النص', 'وعند العرب الغيمة بشارة خير.\nلذلك اخترنا لكل مولود قطعاً هادئة الألوان، مريحة على جلده، وجميلة في صوره الأولى… ومعها هدايا تليق بفرحة أهله.', M, 0, PW - 2 * M, 'body', 40, { lh: 1.75, follow: 'tt', gap: 130, color: C.ink })
  b += L.text('التوقيع', `غيمة | ${SLOGAN}`, M, PH - 170, PW - 2 * M, 'title', 40, { color: C.sageDeep })
  b += handle(PW, PH)
  return page(b, PW, PH)
}

// كاروسيل: «وش تلقون عندنا»
const OFFER = [
  ['hanger', 'ملابس المواليد', 'قطع يومية بألوان هادئة\nللأشهر الأولى', C.mist],
  ['bag', 'أطقم الاستقبال', 'كل ما يحتاجه يوم الخروج\nفي طقم متناسق', C.sand],
  ['gift', 'هدايا جاهزة', 'تغليف هدية وبطاقة إهداء\nبكلماتكم', '#E6ECE2'],
  ['heart', 'إكسسوارات ناعمة', 'قبعات وجوارب ومرايل\nتكمّل الإطلالة', '#F7DCCB'],
]
export const OFFER_SLIDES = [
  ['06_Carousel_WhatWeOffer_01_Cover', () => {
    let b = L.bg(PW, PH, C.sand) + L.pattern('cotton', 0, 0, PW, PH, 0.6)
    b += cloudL('غيمة', PW / 2, 1080, 330, C.milk, PW, PH)
    b += center('عنوان صغير', 'غيمة', 260, 40, 'sub', { color: C.sageDeep })
    b += center('العنوان', 'وش تلقون\nعندنا؟', 340, 130, 'display', { lh: 1.15 })
    b += center('تلميح السحب', 'اسحبوا ←', 960, 40, 'sub', { color: C.ink })
    b += handle(PW, PH)
    return page(b, PW, PH, C.sand)
  }],
  ...OFFER.map(([ic, t, d, bg], i) => [`06_Carousel_WhatWeOffer_0${i + 2}_${['Clothes', 'Sets', 'Gifts', 'Accessories'][i]}`, () => {
    let b = L.bg(PW, PH, bg)
    b += L.rect('دائرة الأيقونة', PW / 2 - 230, 230, 460, 460, C.milk, 230)
    b += L.icon(ic, PW / 2 - 130, 330, 260, C.ink, `أيقونة: ${t}`)
    b += L.text('الرقم', `0${i + 1}`, M, 150, 200, 'display', 64, { color: C.apricot })
    b += center('العنوان', t, 790, 96)
    b += center('الوصف', d, 940, 44, 'body', { lh: 1.6, color: C.ink })
    b += handle(PW, PH)
    return page(b, PW, PH, bg)
  }]),
  ['06_Carousel_WhatWeOffer_06_End', () => {
    let b = L.bg(PW, PH, C.ink)
    b += L.badge(PW / 2 - 150, 300, 300, 'reverse', 'شارة الشعار')
    b += center('العنوان', 'احفظوا المنشور\nوتابعونا للافتتاح', 690, 76, 'display', { color: C.cotton, lh: 1.3 })
    b += center('السلوقن', SLOGAN, 960, 48, 'title', { color: C.apricot })
    b += handle(PW, PH, C.sand)
    return page(b, PW, PH, C.ink)
  }],
]

// كاروسيل: «كيف تطلبون» — خطوات الطلب كما تعمل في المتجر فعلياً
const STEPS = [
  ['bag', 'اختاروا القطع', 'من المتجر عبر الرابط في الحساب،\nوأضيفوها إلى السلة'],
  ['check', 'أكّدوا الطلب', 'اكتبوا بيانات التوصيل وراجعوا الطلب\nقبل التأكيد'],
  ['receipt', 'حوّلوا المبلغ', 'إلى أحد حساباتنا التي تظهر لكم\nبعد تأكيد الطلب'],
  ['chat', 'أرسلوا السند', 'عبر واتساب مع رقم الطلب،\nونؤكد طلبكم بعد مراجعة التحويل'],
]
export const ORDER_SLIDES = [
  ['07_Carousel_HowToOrder_01_Cover', () => {
    let b = L.bg(PW, PH, C.cotton)
    b += cloudL('غيمة', 300, 1260, 200, C.mist, PW, PH) + cloudL('غيمة', 860, 1330, 150, C.sand, PW, PH)
    b += kicker('دليل سريع', M, 230, PW - 2 * M)
    b += L.text('العنوان', 'كيف\nتطلبون\nمن غيمة؟', M, 300, PW - 2 * M, 'display', 140, { lh: 1.1 })
    b += L.text('الوصف', '4 خطوات بسيطة ← اسحبوا', M, 820, PW - 2 * M, 'bodyM', 44, { color: C.muted })
    b += handle(PW, PH)
    return page(b, PW, PH)
  }],
  ...STEPS.map(([ic, t, d], i) => [`07_Carousel_HowToOrder_0${i + 2}_Step${i + 1}`, () => {
    let b = L.bg(PW, PH, C.cotton)
    b += L.text('رقم الخطوة', String(i + 1), M, 120, 400, 'display', 380, { color: C.apricot, lh: 1 })
    b += L.rect('خلفية الأيقونة', PW - M - 220, 200, 220, 220, C.sand, 110)
    b += L.icon(ic, PW - M - 170, 250, 120, C.ink, `أيقونة: ${t}`)
    b += L.text('العنوان', t, M, 640, PW - 2 * M, 'display', 100)
    b += L.text('الوصف', d, M, 800, PW - 2 * M, 'body', 46, { lh: 1.65 })
    // شريط التقدم
    for (let k = 0; k < 4; k++) b += L.rect(`مؤشر الخطوة ${k + 1}`, M + k * 120, PH - 160, 96, 12, k <= i ? C.ink : C.line, 6)
    b += handle(PW, PH)
    return page(b, PW, PH)
  }]),
]

export function gifts() {
  let b = L.bg(PW, PH, '#E6ECE2') + L.pattern('sage', 0, 0, PW, PH, 0.35)
  b += L.sticker('newbornGift', PW / 2 - 130, 150, 190)
  b += center('العنوان', 'تهدون مولوداً؟', 380, 104)
  b += center('الوصف', 'اختاروا الهدية… والباقي علينا', 520, 46, 'bodyM', { color: C.sageDeep })
  const items = [['gift', 'تغليف هدية'], ['quote', 'بطاقة بكلماتكم'], ['van', 'توصيل للمستلم مباشرة'], ['receipt', 'إخفاء الأسعار']]
  items.forEach(([ic, t], i) => {
    const col = i % 2, row = Math.floor(i / 2), cw = (PW - 2 * M - 40) / 2
    const x = PW - M - cw - col * (cw + 40), y = 680 + row * 250
    b += L.rect(`بطاقة: ${t}`, x, y, cw, 210, C.milk, 36)
    b += L.icon(ic, x + cw - 120, y + 60, 80, C.ink, `أيقونة: ${t}`)
    b += L.text(`ميزة: ${t}`, t, x + 30, y + 72, cw - 170, 'title', 38, { fit: 2, lh: 1.3 })
  })
  b += center('ملاحظة', 'خيارات الهدية تظهر لكم عند إتمام الطلب', 1200, 32, 'body', { color: C.muted })
  b += handle(PW, PH)
  return page(b, PW, PH, '#E6ECE2')
}
export function launch() {
  let b = sky(PW, PH, C.apricot, '#F7DCCB', 'خلفية الافتتاح')
  b += cloudL('غيمة', 250, 1350, 260, C.cotton, PW, PH) + cloudL('غيمة', 900, 1350, 220, C.milk, PW, PH)
  b += cloudL('غيمة صغيرة', 880, 300, 70, C.milk, PW, PH, 0.9)
  b += center('عنوان صغير', 'وصلت الغيمة', 250, 48, 'title', { color: C.ink })
  b += center('العنوان', 'افتتحنا!', 330, 200, 'display', { lh: 1.15 })
  b += center('الوصف', 'المتجر مفتوح الآن\nالرابط في الحساب', 620, 58, 'title', { lh: 1.45 })
  b += `<div class="L" style="left:50%;transform:translateX(-50%);top:860px;height:104px">${L.button('تسوّقوا الآن', 0, 0, 104, 'primary', 'زر بصري — ليس رابطاً').replace('right:0px;', 'left:0px;')}</div>`
  b += handle(PW, PH, C.ink)
  return page(b, PW, PH)
}

export const FEED = [
  ...PANO.map(([id, fn]) => [id, fn]),
  ['04_Reveal_Logo', reveal],
  ['05_Our_Story', story],
  ...OFFER_SLIDES,
  ...ORDER_SLIDES,
  ['08_Launch_Day', launch],
  ['09_Newborn_Gifts', gifts],
]

// ===== الستوري =====
const sBase = (bg = C.cotton) => L.bg(SW, SH, bg) + L.safeZones(SW, SH, ST, SB)
const slot = (y, h, label) => `<div class="L" data-layer="مكان ملصق إنستغرام — احذفه بعد إضافة الملصق" style="left:${M + 40}px;top:${y}px;width:${SW - 2 * M - 80}px;height:${h}px;border:3px dashed ${C.muted};border-radius:40px;display:flex;align-items:center;justify-content:center;color:${C.muted};font:500 30px 'Readex Pro';direction:rtl;text-align:center;padding:20px">${label}</div>`
const sCenter = (name, s, y, size, cls = 'display', opts = {}) => L.text(name, s, M, y, SW - 2 * M, cls, size, { align: 'center', ...opts })
const ltrC = (...a) => ltr(sCenter(...a))
const sLogo = (cw = 'color') => L.logo(SW / 2 - 90, ST + 30, 180, cw)
const sPage = (b, bg = C.cotton) => page(b, SW, SH, bg)

export const STORIES = [
  ['S01_Coming_Soon', () => {
    let b = sky(SW, SH, C.mist, C.cotton) + L.safeZones(SW, SH, ST, SB)
    b += cloudL('غيمة', SW / 2, 1200, 270, C.milk, SW, SH) + L.svg('نقطة الغيمة', svgw(SW, SH, E.cloud(SW / 2 + 110, 930, 46, C.apricot)), 0, 0, SW, SH)
    b += sCenter('العنوان', 'شيء ناعم\nفي الطريق…', 330, 110, 'display', { lh: 1.2 })
    b += slot(1260, 200, 'ضعوا هنا ملصق «العد التنازلي» من إنستغرام\nبتاريخ الافتتاح الفعلي')
    b += ltrC('اسم الحساب', HANDLE, 1500, 34, 'sub', { color: C.muted })
    return sPage(b)
  }],
  ['S02_Guess_Poll', () => {
    let b = sBase(C.sand) + L.pattern('cotton', 0, 0, SW, SH, 0.5)
    b += sLogo()
    b += sCenter('العنوان', 'خمّنوا…\nوش نجهّز لكم؟', 520, 104, 'display', { lh: 1.25 })
    b += cloudL('غيمة', SW / 2, 1050, 130, C.milk, SW, SH)
    b += slot(1120, 260, 'ضعوا هنا ملصق «تصويت»\nمثلاً: ملابس مواليد / هدايا مواليد')
    return sPage(b, C.sand)
  }],
  ['S03_Sneak_Peek', () => {
    let b = sBase(C.ink)
    b += sCenter('عنوان صغير', 'لمحة أولى', ST + 60, 44, 'sub', { color: C.apricot })
    b += L.frame('arch', M + 60, 430, SW - 2 * M - 120, 900, '#4A3F55')
    b += L.placeholder('arch', M + 60, 430, SW - 2 * M - 120, 900, 'ضعوا صورة قطعة حقيقية هنا\n(طبّقوا عليها تمويه Blur خفيف)')
    b += sCenter('العنوان', 'تعرفونها قريباً', 1390, 84, 'display', { color: C.cotton })
    b += ltrC('اسم الحساب', HANDLE, 1530, 34, 'sub', { color: C.sand })
    return sPage(b, C.ink)
  }],
  ['S04_Question_Box', () => {
    let b = sBase('#E6ECE2') + L.pattern('sage', 0, 0, SW, SH, 0.35)
    b += sLogo()
    b += sCenter('العنوان', 'سؤال للأمهات', 500, 60, 'title', { color: C.sageDeep })
    b += sCenter('السؤال', 'وش أهم شي تدورونه\nفي ملابس المولود؟', 600, 88, 'display', { lh: 1.3 })
    b += slot(950, 330, 'ضعوا هنا ملصق «اسألوني / سؤال»')
    b += sCenter('تلميح', 'إجاباتكم تساعدنا نختار لكم الأفضل', 1380, 36, 'body', { color: C.ink })
    return sPage(b, '#E6ECE2')
  }],
  ['S05_Countdown_Days', () => {
    let b = sky(SW, SH, C.cotton, C.sand) + L.safeZones(SW, SH, ST, SB)
    b += sLogo()
    b += sCenter('عنوان صغير', 'باقي على الافتتاح', 520, 60, 'title', { color: C.muted })
    b += sCenter('عدد الأيام (عدّلوه)', '3', 600, 420, 'display', { color: C.apricot, lh: 1.05 })
    b += sCenter('الوحدة (أيام / يومين / يوم)', 'أيام', 1060, 96, 'display')
    b += cloudL('غيمة', SW / 2, 1580, 160, C.milk, SW, SH)
    return sPage(b)
  }],
  ['S06_Launch_Link', () => {
    let b = sky(SW, SH, C.apricot, '#F7DCCB', 'خلفية الافتتاح') + L.safeZones(SW, SH, ST, SB)
    b += cloudL('غيمة', 300, 1920, 300, C.cotton, SW, SH) + cloudL('غيمة', 860, 1920, 250, C.milk, SW, SH)
    b += sLogo()
    b += sCenter('العنوان', 'افتتحنا!', 520, 190, 'display', { lh: 1.15 })
    b += sCenter('الوصف', 'المتجر مفتوح الآن', 800, 66, 'title')
    b += slot(960, 200, 'ضعوا هنا ملصق «الرابط» لرابط المتجر')
    b += sCenter('السلوقن', SLOGAN, 1240, 50, 'title', { color: C.ink })
    return sPage(b)
  }],
  ['S07_How_To_Order', () => {
    let b = sBase() + sLogo()
    b += sCenter('العنوان', 'كيف تطلبون؟', 470, 96)
    STEPS.forEach(([ic, t, d], i) => {
      const y = 640 + i * 205
      b += L.rect(`بطاقة الخطوة ${i + 1}`, M, y, SW - 2 * M, 180, i % 2 ? C.sand : C.milk, 40)
      b += L.text(`رقم الخطوة ${i + 1}`, String(i + 1), SW - M - 120, y + 34, 90, 'display', 90, { color: C.apricot, align: 'center', lh: 1.2 })
      b += L.text(`الخطوة ${i + 1}`, t, M + 40, y + 28, SW - 2 * M - 200, 'title', 46)
      b += L.text(`شرح الخطوة ${i + 1}`, d.replace('\n', ' '), M + 40, y + 96, SW - 2 * M - 200, 'body', 28, { fit: 2, lh: 1.4, color: C.muted })
    })
    return sPage(b)
  }],
  ['S08_Gifts', () => {
    let b = sBase('#E6ECE2') + L.pattern('sage', 0, 0, SW, SH, 0.35)
    b += L.sticker('newbornGift', SW / 2 - 140, ST + 60, 200)
    b += sCenter('العنوان', 'تهدون مولوداً؟', 560, 110)
    b += sCenter('الوصف', 'نغلّف الهدية،\nونكتب بطاقتكم،\nونوصلها للمستلم مباشرة', 760, 64, 'title', { lh: 1.5 })
    b += sCenter('ملاحظة', 'تختارون ذلك عند إتمام الطلب', 1230, 38, 'body', { color: C.sageDeep })
    return sPage(b, '#E6ECE2')
  }],
  ['S09_Share_With_Us', () => {
    let b = sBase(C.ink) + L.pattern('ink', 0, 0, SW, SH, 0.5)
    b += sLogo('reverse')
    b += sCenter('العنوان', 'شاركونا الفرحة', 520, 104, 'display', { color: C.cotton })
    b += sCenter('الوصف', 'صوّروا طلبكم أو صغيركم بقطعة من غيمة\nوأشيروا لنا في الستوري', 720, 50, 'bodyM', { color: C.sand, lh: 1.6 })
    b += ltrC('اسم الحساب', HANDLE, 960, 90, 'display', { color: C.apricot })
    b += sCenter('ملاحظة', 'ننشر مشاركاتكم بعد إذنكم', 1120, 36, 'body', { color: C.sand })
    return sPage(b, C.ink)
  }],
]

// ===== أغلفة الريلز =====
const cover = (bg, inner) => page(L.bg(SW, SH, bg) + inner + `<div class="L" data-layer="حدود القص: شبكة الحساب 3:4 (مخفية)" data-hidden="1" style="left:0;top:${(SH - 1440) / 2}px;width:${SW}px;height:1440px;border:6px dashed rgba(176,80,58,.8);visibility:hidden"></div>`, SW, SH, bg)
export const REEL_COVERS = [
  ['R01_Cover_Teaser', () => cover(C.mist, sky(SW, SH, C.mist, C.cotton) + cloudL('غيمة', SW / 2, 1420, 300, C.milk, SW, SH) + L.svg('نقطة الغيمة', svgw(SW, SH, E.cloud(SW / 2 + 130, 1110, 50, C.apricot)), 0, 0, SW, SH) + sCenter('العنوان', 'شيء ناعم\nقادم…', 500, 130, 'display', { lh: 1.15 }) + ltrC('اسم الحساب', HANDLE, 1500, 40, 'sub', { color: C.muted }))],
  ['R02_Cover_Meet_Ghayma', () => cover(C.ink, L.pattern('ink', 0, 0, SW, SH, 0.55) + sCenter('عنوان صغير', 'تعرّفوا على', 560, 64, 'title', { color: C.sand }) + L.logo(SW / 2 - 260, 680, 520, 'reverse') + sCenter('السلوقن', SLOGAN, 1060, 70, 'title', { color: C.apricot }))],
  ['R03_Cover_How_To_Order', () => cover(C.cotton, cloudL('غيمة', 260, 1500, 200, C.mist, SW, SH) + cloudL('غيمة', 860, 1560, 160, C.sand, SW, SH) + sCenter('العنوان', 'كيف تطلبون\nفي دقيقة؟', 560, 120, 'display', { lh: 1.2 }) + sCenter('الوصف', '4 خطوات فقط', 900, 56, 'title', { color: C.sageDeep }))],
  ['R04_Cover_Packing_Order', () => cover(C.sand, L.pattern('cotton', 0, 0, SW, SH, 0.5) + sCenter('العنوان', 'جهّزنا\nأول طلب', 520, 130, 'display', { lh: 1.15 }) + L.placeholder('rounded', 190, 880, 700, 560, 'ضعوا لقطة من الفيديو هنا') + L.logo(SW / 2 - 90, 1500, 180))],
]

// إعادة استخدام: صورة توضيحية (للمعاينة فقط)
export const previewPhoto = (k) => photo(k)
export const ICON = iconSVG
