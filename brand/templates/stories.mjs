// قوالب الستوري 1080×1920 — المعلومات الأساسية داخل المنطقة الآمنة فقط
import { L, page, photo } from '../lib/tpl.mjs'
import { C } from '../lib/palette.mjs'
import { BLANK, EX } from './common.mjs'
import * as E from '../lib/elements.mjs'

export const W = 1080, H = 1920, SAFE_TOP = 250, SAFE_BOTTOM = 340, M = 80
const ph = (blank, key, kind, x, y, w, h, sq = true) => (blank ? L.placeholder(kind, x, y, w, h) : L.photo(photo(key, sq), kind, x, y, w, h))
const base = (bg = C.cotton, pat) => L.bg(W, H, bg) + (pat ? L.pattern(pat, 0, 0, W, H, 0.45) : '') + L.grid(W, H, M, { top: SAFE_TOP, bottom: SAFE_BOTTOM }) + L.safeZones(W, H, SAFE_TOP, SAFE_BOTTOM)
const logo = (cw = 'color') => L.logo(W / 2 - 90, SAFE_TOP + 20, 180, cw)
const centerBtn = (label, y, kind = 'primary', h = 96) => `<div class="L" style="left:50%;transform:translateX(-50%);top:${y}px;height:${h}px">${L.button(label, 0, 0, h, kind, 'زر بصري — ليس رابطاً').replace('right:0px;', 'left:0px;')}</div>`
const slot = (y, h, label) => `<div class="L" data-layer="مساحة ملصق إنستغرام (اختياري)" style="left:${M + 60}px;top:${y}px;width:${W - 2 * M - 120}px;height:${h}px;border:3px dashed ${C.muted};border-radius:40px;display:flex;align-items:center;justify-content:center;color:${C.muted};font:500 28px 'Readex Pro';direction:rtl;text-align:center;padding:20px">${label}</div>`
const ex = (blank) => (blank ? '' : L.exampleTag(W, H, 1.3))
const fin = (b, bg = C.cotton) => page(b, W, H, bg)

export function sProduct({ blank }) {
  const v = blank ? BLANK : EX.p1
  let b = base() + logo()
  b += L.frame('arch', M + 40, 380, W - 2 * M - 80, 760) + ph(blank, v.img, 'arch', M + 40, 380, W - 2 * M - 80, 760, false)
  b += L.text('اسم المنتج', v.name, M, 1180, W - 2 * M, 'title', 62, { align: 'center', fit: 2, id: 'nm' })
  b += L.text('السعر', v.price + ' ر.س', M, 0, W - 2 * M, 'price', 80, { align: 'center', follow: 'nm', gap: 8 })
  b += centerBtn('اطلبوا الآن', 1440)
  return fin(b + ex(blank))
}
export function sNew({ blank }) {
  let b = base('#E6ECE2', 'sage') + logo()
  b += L.sticker('new', W / 2 - 80, 400, 80, -4)
  b += L.text('العنوان', blank ? 'عنوان الإعلان' : 'وصل حديثاً', M, 500, W - 2 * M, 'display', 96, { align: 'center' })
  b += L.frame('rounded', M + 40, 680, W - 2 * M - 80, 700, C.cotton) + ph(blank, 'ph08-trio', 'rounded', M + 40, 680, W - 2 * M - 80, 700)
  b += L.text('سطر تمهيدي', blank ? 'سطر قصير عن المنتجات الجديدة' : 'ألوان هادئة تناسب الجنسين', M, 1420, W - 2 * M, 'body', 38, { align: 'center' })
  return fin(b + ex(blank), '#E6ECE2')
}
export function sOffer({ blank }) {
  const v = blank ? { name: 'اسم المنتج', price: '00', old: '00' } : EX.sale
  let b = base(C.cotton) + L.rect('شريط العرض', 0, SAFE_TOP, W, 200, C.clay)
  b += L.text('العنوان', 'عرض لفترة محدودة', M, SAFE_TOP + 50, W - 2 * M, 'display', 72, { align: 'center', color: C.milk })
  b += L.frame('circle', W / 2 - 300, 520, 600, 600) + ph(blank, v.img, 'circle', W / 2 - 300, 520, 600, 600)
  b += L.text('اسم المنتج', v.name, M, 1150, W - 2 * M, 'title', 56, { align: 'center' })
  b += `<div class="L t muted" data-layer="السعر السابق (مشطوب)" data-kind="text" style="left:${M}px;top:1240px;width:${W / 2 - M - 20}px;font-size:46px;line-height:1.3;text-align:left;text-decoration:line-through;text-decoration-thickness:3px">${v.old} ر.س</div>`
  b += L.text('السعر الجديد', v.price + ' ر.س', W / 2 + 20, 1225, W / 2 - M - 20, 'price', 76, { color: C.clay })
  b += L.text('مدة العرض', blank ? 'ينتهي العرض: [التاريخ]' : 'ينتهي العرض: [ضعوا التاريخ الفعلي]', M, 1350, W - 2 * M, 'bodyM', 32, { align: 'center' })
  b += slot(1420, 130, 'مكان ملصق العد التنازلي من إنستغرام (اختياري)')
  return fin(b + ex(blank))
}
export function sRestock({ blank }) {
  let b = base(C.sand) + logo()
  b += L.sticker('backInStock', W / 2 - 200, 400, 88)
  b += L.frame('arch', M + 80, 540, W - 2 * M - 160, 760, C.cotton) + ph(blank, EX.p2.img, 'arch', M + 80, 540, W - 2 * M - 160, 760, false)
  b += L.text('اسم المنتج', blank ? 'اسم المنتج' : EX.p2.name, M, 1330, W - 2 * M, 'title', 58, { align: 'center', fit: 2, id: 'nm' })
  b += L.text('المقاسات المتوفرة', blank ? 'المقاسات المتوفرة: ...' : 'المقاسات المتوفرة: 0–3 و3–6 أشهر', M, 0, W - 2 * M, 'body', 34, { align: 'center', follow: 'nm', gap: 10 })
  return fin(b + ex(blank), C.sand)
}
export function sChoice({ blank }) {
  let b = base() + logo()
  b += L.text('السؤال', blank ? 'سؤال الاختيار هنا؟' : 'أي لون تختارون للمولود؟', M, 400, W - 2 * M, 'display', 70, { align: 'center', fit: 2 })
  const fw = (W - 2 * M - 40) / 2
  for (const [i, key, lab] of [[0, EX.p2.img, 'أ'], [1, EX.p3.img, 'ب']]) {
    const x = W - M - fw - i * (fw + 40)
    b += L.frame('arch', x, 600, fw, 640, C.sand, `إطار ${lab}`) + (blank ? L.placeholder('arch', x, 600, fw, 640, 'صورة') : L.photo(photo(key, false), 'arch', x, 600, fw, 640, `صورة الخيار ${lab}`))
    b += L.text(`حرف الخيار ${lab}`, lab, x + fw / 2 - 45, 560, 90, 'display', 48, { align: 'center', color: C.ink, lh: 1.85 }).replace('style="', `style="background:${C.apricot};border-radius:50%;height:90px;`)
  }
  b += slot(1300, 240, 'مكان ملصق التصويت من إنستغرام')
  return fin(b + ex(blank))
}
export function sQA({ blank }) {
  let b = base(C.mist) + logo()
  b += L.icon('chat', W / 2 - 70, 430, 140, C.ink, 'أيقونة السؤال')
  b += L.text('العنوان', blank ? 'عنوان فقرة الأسئلة' : 'اسألونا عن المقاسات والهدايا', M, 620, W - 2 * M, 'display', 76, { align: 'center', fit: 2, id: 'tt' })
  b += L.text('سطر تمهيدي', blank ? 'سطر تمهيدي قصير' : 'نرد على أسئلتكم في ستوري قادمة', M, 0, W - 2 * M, 'body', 36, { align: 'center', follow: 'tt', gap: 16 })
  b += slot(1080, 380, 'مكان ملصق الأسئلة من إنستغرام')
  return fin(b + ex(blank), C.mist)
}
export function sReview({ blank }) {
  const q = blank ? 'اكتبوا هنا رأي العميل كما وصلكم، بعد أخذ إذنه.' : '(نص تجريبي) الطقم وصل بتغليف جميل والمقاس كان مناسباً. شكراً لكم.'
  let b = base(C.cotton, 'cotton') + logo()
  b += L.rect('بطاقة الرأي', M, 520, W - 2 * M, 840, C.milk, 60, 'box-shadow:0 30px 60px rgba(61,51,71,.08)')
  b += L.svg('علامة اقتباس — غيمة', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><path d="${E.cloud(100, 112, 46, C.apricot).match(/d="([^"]+)"/)[1]}" fill="${C.apricot}"/><text x="100" y="98" text-anchor="middle" font-family="Readex Pro" font-weight="700" font-size="90" fill="${C.ink}">”</text></svg>`, W / 2 - 100, 450, 200, 120)
  b += L.text('نص الرأي', q, M + 70, 640, W - 2 * M - 140, 'sub', 52, { align: 'center', lh: 1.6, fit: 6, h: 520 }).replace('style="', 'style="display:flex;align-items:center;justify-content:center;')
  b += L.text('اسم العميل', blank ? 'اسم العميل أو المدينة' : '— أم سارة، الرياض (مثال)', M, 1220, W - 2 * M, 'bodyM muted', 32, { align: 'center' })
  b += L.text('تنويه', 'نشارك آراء عملائنا كما وصلتنا وبإذنهم', M, 1430, W - 2 * M, 'body muted', 28, { align: 'center' })
  return fin(b + ex(blank))
}
export function sSteps({ blank }) {
  const steps = [['bag', 'اختاروا المنتج والمقاس', 'من المتجر أو عبر الرسائل'], ['receipt', 'أرسلوا الطلب', 'يصلكم رقم الطلب والمبلغ'], ['chat', 'حوّلوا المبلغ وأرسلوا صورة السند', 'عبر واتساب مع رقم الطلب'], ['check', 'نراجع التحويل ونؤكد طلبكم', 'ثم نجهّز الطلب للتوصيل']]
  let b = base(C.sand) + logo()
  b += L.text('العنوان', 'خطوات الطلب', M, 400, W - 2 * M, 'display', 80, { align: 'center' })
  steps.forEach(([ic, t, d], i) => {
    const y = 560 + i * 245
    b += L.rect(`خلفية الخطوة ${i + 1}`, M, y, W - 2 * M, 215, C.milk, 48)
    b += L.icon(ic, W - M - 140, y + 62, 90, C.ink, `أيقونة الخطوة ${i + 1}`)
    b += L.text(`رقم الخطوة ${i + 1}`, String(i + 1), M + 36, y + 70, 76, 'display', 40, { align: 'center', lh: 1.9 }).replace('style="', `style="background:${C.apricot};border-radius:50%;height:76px;`)
    b += L.text(`عنوان الخطوة ${i + 1}`, t, M + 140, y + 46, W - 2 * M - 320, 'title', 40, { lh: 1.3, fit: 2 })
    b += L.text(`شرح الخطوة ${i + 1}`, d, M + 140, y + 116, W - 2 * M - 320, 'body muted', 30)
  })
  b += L.text('تنويه', 'نؤكد الدفع بعد مراجعة التحويل يدوياً', M, 1560, W - 2 * M, 'bodyM', 28, { align: 'center' })
  return fin(b, C.sand)
}
export function sNotice({ blank }) {
  let b = base(C.ink, 'ink') + logo('reverse')
  b += L.icon('clock', W / 2 - 75, 470, 150, C.apricot, 'أيقونة التنويه')
  b += L.text('العنوان', blank ? 'عنوان التنويه' : 'أوقات العمل والتوصيل', M, 680, W - 2 * M, 'display', 76, { align: 'center', color: C.cotton, fit: 2, id: 'tt' })
  b += L.rect('بطاقة التفاصيل', M, 900, W - 2 * M, 420, '#4A3F55', 48)
  b += L.text('التفاصيل', blank ? 'السطر الأول من التفاصيل\nالسطر الثاني\nالسطر الثالث' : 'نستقبل الطلبات: [الأيام والساعات]\nالتوصيل داخل: [المدن]\nمدة التوصيل المتوقعة: [المدة]', M + 50, 960, W - 2 * M - 100, 'bodyM', 38, { align: 'center', color: C.cotton, lh: 1.9 })
  return fin(b, C.ink)
}
export function sLink({ blank }) {
  let b = base(C.cotton, 'cotton') + logo()
  b += L.text('العنوان', blank ? 'العنوان هنا' : 'تسوّقوا التشكيلة كاملة', M, 440, W - 2 * M, 'display', 80, { align: 'center', fit: 2, id: 'tt' })
  b += L.text('سطر تمهيدي', blank ? 'سطر يشرح وجهة الرابط أو موضوع التصويت' : 'من الرابط أدناه', M, 0, W - 2 * M, 'body', 38, { align: 'center', follow: 'tt', gap: 14 })
  b += L.frame('cloud', M + 60, 720, W - 2 * M - 120, 560, C.sand) + ph(blank, 'ph08-trio', 'cloud', M + 60, 720, W - 2 * M - 120, 560)
  b += slot(1340, 200, 'مكان ملصق الرابط أو التصويت من إنستغرام')
  return fin(b + ex(blank))
}

export const STORIES = [
  ['01_Product_Price_CTA', 'منتج مع السعر وزر بصري للطلب', sProduct],
  ['02_New_Arrival', 'وصول جديد', sNew],
  ['03_Limited_Offer', 'عرض مؤقت', sOffer],
  ['04_Back_In_Stock', 'متوفر مجدداً', sRestock],
  ['05_Choose_Between_Two', 'اختيار بين منتجين', sChoice],
  ['06_Questions_Answers', 'سؤال وجواب', sQA],
  ['07_Customer_Review', 'رأي عميل', sReview],
  ['08_Order_Transfer_Steps', 'خطوات الطلب والتحويل وإرسال السند', sSteps],
  ['09_Delivery_Hours_Notice', 'تنويه التوصيل وأوقات العمل', sNotice],
  ['10_Link_Poll_Space', 'مساحة لملصق الرابط أو التصويت', sLink],
]
