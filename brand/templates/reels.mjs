// نظام الريلز: أغلفة 1080×1920، عناصر فوق الفيديو بخلفية شفافة، شاشة ختامية
import { L, page, photo, uri } from '../lib/tpl.mjs'
import { C } from '../lib/palette.mjs'
import * as E from '../lib/elements.mjs'
import * as Mk from '../lib/marks.mjs'

export const W = 1080, H = 1920
// منطقة العنوان الآمنة: تبقى ظاهرة عند قص الغلاف 3:4 في شبكة الحساب و4:5 في الصفحة الرئيسية
export const TITLE_SAFE = { top: 420, bottom: 1500, side: 90 }
const ph = (blank, key, kind, x, y, w, h, sq = false) => (blank ? L.placeholder(kind, x, y, w, h, 'ضع لقطة من الفيديو أو صورة المنتج هنا') : L.photo(photo(key, sq), kind, x, y, w, h))
const cropGuides = () => `<div class="L" data-layer="حدود القص: شبكة الحساب 3:4 والرئيسية 4:5 (مخفية)" data-hidden="1" style="left:0;top:0;width:${W}px;height:${H}px;visibility:hidden"><div style="position:absolute;left:0;right:0;top:${(H - 1440) / 2}px;height:1440px;border:6px dashed rgba(176,80,58,.8)"></div><div style="position:absolute;left:0;right:0;top:${(H - 1350) / 2}px;height:1350px;border:4px dotted rgba(61,51,71,.7)"></div><div style="position:absolute;left:${TITLE_SAFE.side}px;right:${TITLE_SAFE.side}px;top:${TITLE_SAFE.top}px;height:${TITLE_SAFE.bottom - TITLE_SAFE.top}px;background:rgba(169,191,163,.18)"></div></div>`
const ex = (blank) => (blank ? '' : L.exampleTag(W, H, 1.3))

export function coverA({ blank }) { // صورة كاملة + عنوان في بطاقة
  let b = L.bg(W, H, C.sand) + (blank ? L.placeholder('rounded', 0, 0, W, H, 'ضع لقطة الغلاف هنا') : L.photo(photo('ph07-set'), 'rounded', -40, 0, W + 80, H, 'صورة الغلاف'))
  b += L.rect('بطاقة العنوان', 110, 1080, W - 220, 330, 'rgba(255,253,249,.94)', 56)
  b += L.text('العنوان', blank ? 'عنوان الريل في سطرين' : 'جهّزنا هدية مولود معاً', 150, 1130, W - 300, 'display', 74, { align: 'center', fit: 2, h: 230 }).replace('style="', 'style="display:flex;align-items:center;justify-content:center;')
  b += L.logo(W / 2 - 90, 1440, 180)
  return page(b + cropGuides() + ex(blank), W, H, C.sand)
}
export function coverB({ blank }) { // نصي على نمط الهوية
  let b = L.bg(W, H, C.ink) + L.pattern('ink', 0, 0, W, H, 0.7)
  b += L.text('تصنيف السلسلة', blank ? 'اسم السلسلة' : 'نصائح غيمة', 0, 560, W, 'sub', 42, { align: 'center', color: C.apricot })
  b += L.text('العنوان', blank ? 'عنوان الريل هنا' : 'كيف تختارون مقاس المولود؟', 120, 650, W - 240, 'display', 104, { align: 'center', color: C.cotton, fit: 3, lh: 1.2 })
  b += L.svg('غيمة', E.DIVIDERS.cloudLine(500, C.cotton), W / 2 - 250, 1180, 500, 50)
  b += L.logo(W / 2 - 100, 1300, 200, 'reverse')
  return page(b + cropGuides() + ex(blank), W, H, C.ink)
}
export function coverC({ blank }) { // قوس وعنوان
  let b = L.bg(W, H, '#E6ECE2') + L.pattern('sage', 0, 0, W, H, 0.4)
  b += L.text('العنوان', blank ? 'عنوان الريل' : 'تغليف هدية خطوة بخطوة', 100, 440, W - 200, 'display', 86, { align: 'center', fit: 2 })
  b += L.frame('arch', 190, 680, 700, 820, C.cotton) + ph(blank, 'ph07-set', 'arch', 190, 680, 700, 820, false)
  b += L.logo(W / 2 - 80, 1560, 160)
  return page(b + cropGuides() + ex(blank), W, H, '#E6ECE2')
}
// إطار فيديو تجريبي (يمثل الفيديو في ملفات التخطيط)
const videoFrame = (blank, key = 'ph01-onesie') => (blank ? `<div class="L" data-layer="مكان الفيديو (احذفها في برنامج المونتاج)" style="left:0;top:0;width:${W}px;height:${H}px;background:repeating-linear-gradient(135deg,#D9CFC2 0 40px,#E3DACE 40px 80px);display:flex;align-items:center;justify-content:center;font:600 44px 'Readex Pro';color:${C.muted}">مكان الفيديو</div>` : L.photo(photo(key), 'rounded', -60, 0, W + 120, H, 'لقطة الفيديو (للمعاينة فقط)'))

// عناصر فوق الفيديو (كل عنصر يُصدَّر أيضاً PNG شفافاً مستقلاً)
export const OVERLAYS = {
  priceCard: (v = { name: 'بدلة قطنية للمولود', price: '89' }) => `<div class="L" data-layer="بطاقة السعر — الخلفية" style="left:90px;top:1310px;width:${W - 180}px;height:200px;background:rgba(255,253,249,.96);border-radius:48px;box-shadow:0 20px 50px rgba(61,51,71,.18)"></div>${L.text('اسم المنتج', v.name, 140, 1345, W - 280, 'title', 46, { fit: 1 })}${L.text('السعر', v.price + ' ر.س', 140, 1415, W - 280, 'price', 56)}`,
  titleBar: (t = 'هدية مولود جاهزة') => `<div class="L" data-layer="شريط العنوان — الخلفية" style="left:0;top:330px;width:${W}px;height:150px;background:${C.ink}"></div>${L.text('نص الشريط', t, 90, 362, W - 180, 'display', 60, { align: 'center', color: C.cotton, fit: 1 })}`,
  logoBug: (cw = 'white') => L.logo(W - 90 - 150, 290, 150, cw, 'شعار صغير على الفيديو'),
  number: (n = 1, name = 'جاكيت محبوك') => `${L.text('رقم المنتج', String(n), W - 90 - 110, 1290, 110, 'display', 60, { align: 'center', lh: 1.83 }).replace('style="', `style="background:${C.apricot};border-radius:50%;height:110px;`)}<div class="L" data-layer="اسم المنتج — الخلفية" style="right:220px;top:1300px;height:90px;width:560px;background:rgba(255,253,249,.95);border-radius:45px"></div>${L.text('اسم المنتج', name, 320, 1315, 520, 'title', 44, { fit: 1 })}`,
  step: (n = 1, t = 'نختار القطع بعناية') => `<div class="L" data-layer="خطوة التجهيز — الخلفية" style="left:90px;top:1360px;width:${W - 180}px;height:140px;background:rgba(61,51,71,.9);border-radius:70px"></div>${L.text('رقم الخطوة', String(n), W - 90 - 130, 1380, 100, 'display', 52, { align: 'center', lh: 1.92 }).replace('style="', `style="background:${C.apricot};border-radius:50%;height:100px;`)}${L.text('نص الخطوة', t, 150, 1402, W - 420, 'title', 48, { color: C.cotton, fit: 1 })}`,
}
export function overlayLayout({ blank, kind }) {
  let b = L.bg(W, H, '#000', 'خلفية (للمعاينة فقط)') + videoFrame(blank, kind === 'multi' ? 'ph02-jacket' : kind === 'packing' ? 'ph07-set' : 'ph01-onesie')
  b += L.safeZones(W, H, 250, 420, 'مناطق واجهة الريلز — تجنبوا النص فيها (مخفية)')
  b += OVERLAYS.logoBug()
  if (kind === 'product') b += OVERLAYS.titleBar(blank ? 'عنوان قصير' : 'وصل حديثاً') + OVERLAYS.priceCard(blank ? { name: 'اسم المنتج', price: '00' } : undefined)
  if (kind === 'multi') b += OVERLAYS.titleBar(blank ? 'عنوان قصير' : '3 قطع للأيام الأولى') + OVERLAYS.number(1, blank ? 'اسم المنتج' : 'جاكيت محبوك')
  if (kind === 'packing') b += OVERLAYS.titleBar(blank ? 'عنوان قصير' : 'نجهّز طلبكم') + OVERLAYS.step(1, blank ? 'نص الخطوة' : 'نختار القطع بعناية')
  return page(b + ex(blank), W, H, '#000')
}
export function endScreen({ blank }) {
  let b = L.bg(W, H, C.cotton) + L.pattern('cotton', 0, 0, W, H, 0.8)
  b += L.badge(W / 2 - 170, 560, 340)
  b += L.logo(W / 2 - 170, 980, 340)
  b += L.text('دعوة للطلب', blank ? 'دعوة قصيرة للطلب' : 'للطلب: الرابط في الحساب', 90, 1300, W - 180, 'title', 56, { align: 'center' })
  b += L.text('اسم الحساب', blank ? '@اسم_الحساب' : '@ghayma', 90, 1390, W - 180, 'sub muted', 40, { align: 'center' })
  return page(b + ex(blank), W, H)
}
// عنصر شفاف مستقل للتصدير PNG
export const overlayOnly = (html) => page(html, W, H, 'transparent')

export const REELS = [
  ['Reel_Cover_A_Photo_Title', 'غلاف بصورة كاملة وعنوان', coverA],
  ['Reel_Cover_B_Text_Pattern', 'غلاف نصي على نمط الهوية', coverB],
  ['Reel_Cover_C_Arch', 'غلاف بقوس وعنوان', coverC],
  ['Reel_Layout_Product_Showcase', 'تخطيط عرض منتج', (o) => overlayLayout({ ...o, kind: 'product' })],
  ['Reel_Layout_Multiple_Products', 'تخطيط عرض عدة منتجات', (o) => overlayLayout({ ...o, kind: 'multi' })],
  ['Reel_Layout_Packing_Order', 'تخطيط تجهيز وتغليف طلب', (o) => overlayLayout({ ...o, kind: 'packing' })],
  ['Reel_End_Screen', 'الشاشة الختامية', endScreen],
]
