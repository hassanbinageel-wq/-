// قوالب منشورات إنستغرام: 1080×1350 (رأسي) و1080×1080 (مربع)
import { L, page, photo } from '../lib/tpl.mjs'
import { C } from '../lib/palette.mjs'
import { BLANK, EX } from './common.mjs'
import * as E from '../lib/elements.mjs'

export const M = 72
const frameOrPh = (blank, key, kind, x, y, w, h, sq) => (blank ? L.placeholder(kind, x, y, w, h) : L.photo(photo(key, sq), kind, x, y, w, h))
const footer = (W, H, handle, s = 1) => L.text('اسم الحساب', handle, M, H - 64 * s, 400, 'sub muted', 24 * s, { align: 'left' })
const logoTop = (W) => L.logo(W - M - 168, 58, 168)

// 1) منتج واحد مع الاسم والسعر
export function product({ W, H, blank, d = EX.p1, long }) {
  const v = blank ? { ...BLANK } : long ? EX.p1long : d
  const sq = H === W
  let b = L.bg(W, H) + L.grid(W, H, M)
  if (!sq) {
    const fy = 150, fh = 720
    b += L.frame('arch', M, fy, W - 2 * M, fh) + frameOrPh(blank, v.img, 'arch', M, fy, W - 2 * M, fh)
    b += blank ? '' : L.sticker('new', M + 24, fy + 330, 64, -6)
    b += logoTop(W)
    b += L.text('اسم المنتج', v.name, M, fy + fh + 44, W - 2 * M, 'title', 56, { id: 'nm', fit: 2, lh: 1.3 })
    b += L.text('وصف قصير', v.desc, M, 0, W - 2 * M - 40, 'body muted', 30, { id: 'ds', follow: 'nm', gap: 12, fit: 2, lh: 1.55 })
    b += L.text('السعر', `${v.price} ر.س`, W - M - 420, 0, 420, 'price', 64, { id: 'pr', follow: 'ds', gap: 26, lh: 1.25 })
    b += `<div class="L" data-follow="ds" data-gap="30" style="left:${M}px;top:0;height:84px">${L.button(v.cta || BLANK.cta, 0, 0, 84, 'primary').replace('right:0px;', 'left:0px;')}</div>`
  } else {
    const fx = M, fw = 470, fy = 150, fh = H - fy - M
    b += L.frame('arch', fx, fy, fw, fh) + frameOrPh(blank, v.img, 'arch', fx, fy, fw, fh)
    b += logoTop(W)
    const tx = fx + fw + 56, tw = W - M - tx
    b += L.text('اسم المنتج', v.name, tx, 300, tw, 'title', 52, { id: 'nm', fit: 3, lh: 1.3 })
    b += L.text('وصف قصير', v.desc, tx, 0, tw, 'body muted', 28, { id: 'ds', follow: 'nm', gap: 14, fit: 4, lh: 1.55 })
    b += L.text('السعر', `${v.price} ر.س`, tx, 0, tw, 'price', 60, { id: 'pr', follow: 'ds', gap: 30, lh: 1.25 })
    b += `<div class="L" data-follow="pr" data-gap="26" style="right:${M}px;top:0;height:80px;width:${tw}px">${L.button(v.cta || BLANK.cta, 0, 0, 80, 'primary')}</div>`
    b += blank ? '' : L.sticker('new', fx + 18, fy + 250, 58, -6)
  }
  b += footer(W, H, blank ? BLANK.handle : EX.handle)
  if (!blank) b += L.exampleTag(W, H)
  return page(b, W, H)
}

const btnAt = (label, x, y, h, kind = 'primary', anchor = 'left', follow) =>
  `<div class="L"${follow ? ` data-follow="${follow}" data-gap="28"` : ''} style="${anchor === 'left' ? `left:${x}px;` : `right:${x}px;`}top:${y}px;height:${h}px">${L.button(label, 0, 0, h, kind).replace('right:0px;', anchor === 'left' ? 'left:0px;' : 'right:0px;')}</div>`
const head = (W, cw = 'color') => L.logo(W - M - 168, 58, 168, cw)
const end = (W, H, blank, dark = false) => L.text('اسم الحساب', blank ? BLANK.handle : EX.handle, M, H - 64, 400, 'sub', 24, { align: 'left', color: dark ? C.sand : C.muted }) + (blank ? '' : L.exampleTag(W, H))
const ph = (blank, key, kind, x, y, w, h, sq) => (blank ? L.placeholder(kind, x, y, w, h) : L.photo(photo(key, sq), kind, x, y, w, h))

// 2) مجموعة منتجات أو طقم مواليد
export function collection({ W, H, blank, long }) {
  const v = blank ? { name: 'اسم الطقم', items: ['القطعة الأولى', 'القطعة الثانية', 'القطعة الثالثة'], price: '00', img: [] } : long ? { ...EX.set, name: 'طقم الاستقبال الكامل للأيام الأولى في صندوق هدية', items: ['بدلة قطنية بأزرار أمامية', 'مريلة ناعمة بلون المريمية', 'سالوبيت مشمشي بحمالات'] } : EX.set
  const sq = W === H
  let b = L.bg(W, H, C.sand) + L.grid(W, H, M) + head(W)
  if (!sq) {
    b += L.frame('rounded', M, 160, W - 2 * M, 520, C.cotton) + ph(blank, v.img[0], 'rounded', M, 160, W - 2 * M, 520)
    b += L.frame('circle', M + 20, 600, 210, 210, C.cotton) + ph(blank, v.img[1], 'circle', M + 20, 600, 210, 210, true)
    b += L.frame('circle', M + 250, 640, 170, 170, C.cotton) + ph(blank, v.img[2], 'circle', M + 250, 640, 170, 170, true)
    b += L.text('عنوان الطقم', v.name, W - M - 520, 720, 520, 'title', 54, { id: 'nm', fit: 2, lh: 1.3 })
    b += L.text('قائمة القطع', v.items.map((i) => '• ' + i).join('\n'), W - M - 520, 0, 520, 'body', 30, { id: 'it', follow: 'nm', gap: 16, lh: 1.6 })
    b += L.text('السعر', (blank ? '' : 'سعر الطقم ') + v.price + ' ر.س', W - M - 520, 0, 520, 'price', 52, { id: 'pr', follow: 'it', gap: 24 })
    b += btnAt(BLANK.cta, M, 0, 84, 'primary', 'left', 'it')
  } else {
    b += L.frame('rounded', M, 150, 480, H - 150 - M, C.cotton) + ph(blank, v.img[0], 'rounded', M, 150, 480, H - 150 - M)
    const tx = M + 480 + 50, tw = W - M - tx
    b += L.text('عنوان الطقم', v.name, tx, 190, tw, 'title', 50, { id: 'nm', fit: 3, lh: 1.3 })
    b += L.text('قائمة القطع', v.items.map((i) => '• ' + i).join('\n'), tx, 0, tw, 'body', 28, { id: 'it', follow: 'nm', gap: 16, lh: 1.6 })
    b += L.text('السعر', v.price + ' ر.س', tx, 0, tw, 'price', 52, { id: 'pr', follow: 'it', gap: 24 })
    b += `<div class="L" data-follow="pr" data-gap="24" style="right:${M}px;top:0;height:80px">${L.button(BLANK.cta, 0, 0, 80, 'primary')}</div>`
  }
  return page(b + end(W, H, blank), W, H)
}

// 3) تخفيض: السعر السابق والجديد
export function sale({ W, H, blank, long }) {
  const v = blank ? { name: 'اسم المنتج', price: '00', old: '00', pct: '00', note: 'مدة العرض أو شروطه هنا' } : { ...EX.sale, name: long ? 'بيجامة الضباب القطنية بأزرار أمامية وأكمام طويلة' : EX.sale.name, note: 'العرض حتى نفاد الكمية المخصصة' }
  const sq = W === H
  let b = L.bg(W, H) + L.grid(W, H, M)
  b += L.rect('شريط العرض', 0, 0, sq ? 420 : W, sq ? H : 150, C.clay)
  b += sq ? head(W) : L.logo(W - M - 168, 46, 168, 'white', 'الشعار (لا تعدّله)')
  if (!sq) {
    b += L.text('عنوان العرض', `خصم ${v.pct}٪`, M, 34, 600, 'display', 66, { color: C.milk, align: 'left', lh: 1.2 })
    b += L.frame('rounded', M + 120, 210, W - 2 * M - 120, 560) + ph(blank, v.img, 'rounded', M + 120, 210, W - 2 * M - 120, 560)
    b += L.sticker('special', M - 10, 196, 190, -8)
    b += L.text('اسم المنتج', v.name, M, 820, W - 2 * M, 'title', 54, { id: 'nm', fit: 2 })
    b += L.text('السعر الجديد', v.price + ' ر.س', W - M - 400, 0, 400, 'price', 76, { id: 'pr', follow: 'nm', gap: 20, color: C.clay })
    b += `<div class="L t muted" data-layer="السعر السابق (مشطوب)" data-kind="text" data-follow="nm" data-gap="44" style="left:${M}px;top:0;width:${W - 2 * M - 420}px;font-size:40px;line-height:1.2;text-align:right;text-decoration:line-through;text-decoration-thickness:3px">${v.old} ر.س</div>`
    b += L.text('شروط العرض', v.note, M, 0, W - 2 * M, 'body muted', 28, { follow: 'pr', gap: 18 })
  } else {
    b += L.text('عنوان العرض', `خصم\n${v.pct}٪`, 40, 120, 340, 'display', 96, { color: C.milk, align: 'center', lh: 1.15 })
    b += L.sticker('special', 110, 470, 200, -8)
    b += L.text('شروط العرض', v.note, 40, 760, 340, 'body', 26, { color: C.milk, align: 'center' })
    const tx = 470, tw = W - M - tx
    b += L.frame('rounded', tx, 150, tw, 520) + ph(blank, v.img, 'rounded', tx, 150, tw, 520, true)
    b += L.text('اسم المنتج', v.name, tx, 700, tw, 'title', 44, { id: 'nm', fit: 2 })
    b += L.text('السعر الجديد', v.price + ' ر.س', tx + tw - 300, 0, 300, 'price', 64, { id: 'pr', follow: 'nm', gap: 14, color: C.clay })
    b += `<div class="L t muted" data-layer="السعر السابق (مشطوب)" data-kind="text" data-follow="nm" data-gap="34" style="left:${tx}px;top:0;width:${tw - 320}px;font-size:36px;line-height:1.2;text-align:right;text-decoration:line-through;text-decoration-thickness:3px">${v.old} ر.س</div>`
  }
  return page(b + end(W, H, blank), W, H)
}

// 4) وصول منتجات جديدة
export function arrivals({ W, H, blank, long }) {
  const names = blank ? ['اسم المنتج', 'اسم المنتج', 'اسم المنتج'] : [EX.p2.name.split(' ').slice(0, 2).join(' '), EX.p3.name, EX.p4.name]
  const imgs = [EX.p2.img, EX.p3.img, EX.p4.img]
  const sq = W === H
  let b = L.bg(W, H, '#E6ECE2') + L.pattern('sage', 0, 0, W, H, 0.35) + L.grid(W, H, M) + head(W)
  b += L.svg('غيمة صغيرة', E.DIVIDERS.cloudLine(600), (W - 600) / 2, sq ? 150 : 170, 600, 60)
  b += L.text('العنوان', blank ? 'عنوان الإعلان هنا' : long ? 'وصلت تشكيلة الخريف الهادئة لأيام المولود الأولى' : 'وصل حديثاً', M, sq ? 220 : 250, W - 2 * M, 'display', sq ? 72 : 84, { align: 'center', fit: 2, id: 'tt' })
  b += L.text('سطر تمهيدي', blank ? 'سطر قصير يشرح ما الجديد' : 'قطع جديدة بألوان هادئة تناسب الجنسين', M, 0, W - 2 * M, 'body muted', 32, { align: 'center', follow: 'tt', gap: 6 })
  const fw = (W - 2 * M - 2 * 36) / 3, fh = sq ? 380 : 520, fy = sq ? 470 : 560
  for (let i = 0; i < 3; i++) {
    const x = W - M - fw - i * (fw + 36)
    b += L.frame('arch', x, fy, fw, fh, C.cotton, `إطار الصورة ${i + 1}`) + (blank ? L.placeholder('arch', x, fy, fw, fh, 'صورة') : L.photo(photo(imgs[i], true), 'arch', x, fy, fw, fh, `صورة المنتج ${i + 1} — ضع صورتك هنا`))
    b += L.text(`اسم المنتج ${i + 1}`, names[i], x, fy + fh + 18, fw, 'sub', 28, { align: 'center' })
  }
  b += `<div class="L" style="left:50%;transform:translateX(-50%);top:${sq ? 960 : 1180}px;height:80px">${L.button('تسوّقوا الجديد', 0, 0, 80, 'primary').replace('right:0px;', 'left:0px;')}</div>`
  return page(b + end(W, H, blank), W, H, '#E6ECE2')
}

// 5) هدية مولود مع خيارات التغليف
export function gift({ W, H, blank, long }) {
  const sq = W === H
  const opts = blank ? ['خيار التغليف الأول', 'خيار التغليف الثاني', 'خيار التغليف الثالث'] : ['صندوق هدية بشريطة', 'ورق تغليف بنقشة غيمة', 'بطاقة إهداء باسم المولود']
  let b = L.bg(W, H, C.sand) + L.grid(W, H, M) + head(W)
  const fx = M, fy = sq ? 150 : 160, fw = sq ? 470 : W - 2 * M, fh = sq ? H - 150 - M : 560
  b += L.frame(sq ? 'arch' : 'cloud', fx, fy, fw, fh, C.cotton) + ph(blank, 'ph07-set', sq ? 'arch' : 'cloud', fx, fy, fw, fh, sq)
  if (!blank) b += L.sticker('newbornGift', sq ? fx + 20 : W - M - 230, sq ? fy + 40 : fy + 60, 170, 6)
  const tx = sq ? fx + fw + 50 : M, tw = sq ? W - M - tx : W - 2 * M, ty = sq ? 190 : fy + fh + 40
  b += L.text('العنوان', blank ? 'عنوان الهدية' : long ? 'هدية استقبال المولود جاهزة للإهداء مباشرة' : 'هدية مولود جاهزة', tx, ty, tw, 'title', sq ? 50 : 56, { id: 'tt', fit: 2 })
  b += L.text('السعر', blank ? 'تبدأ من 00 ر.س' : 'تبدأ من 149 ر.س', tx, 0, tw, 'price', sq ? 40 : 44, { id: 'pr', follow: 'tt', gap: 10, color: C.ink })
  for (let i = 0; i < 3; i++) {
    const icon = ['gift', 'box', 'quote'][i]
    b += `<div class="L" data-follow="${i ? 'o' + (i - 1) : 'pr'}" data-gap="${i ? 14 : 26}" id="o${i}" style="right:${W - tx - tw}px;top:0;width:${tw}px;height:${sq ? 70 : 76}px">${L.rect(`خلفية الخيار ${i + 1}`, 0, 0, tw, sq ? 70 : 76, C.milk, 40).replace('class="L"', 'class="L" ')}${L.icon(icon, tw - 70, 13, sq ? 44 : 50, C.ink, `أيقونة الخيار ${i + 1}`)}${L.text(`الخيار ${i + 1}`, opts[i], 24, sq ? 15 : 17, tw - 110, 'bodyM', sq ? 26 : 28)}</div>`
  }
  return page(b + end(W, H, blank), W, H, C.sand)
}

// 6) رأي عميل (نص تجريبي واضح)
export function review({ W, H, blank, long }) {
  const sq = W === H
  const q = blank ? 'اكتبوا هنا رأي العميل كما وصلكم، بعد أخذ إذنه للنشر.' : long ? '(نص تجريبي) وصلت الهدية مرتبة جداً، والتغليف أنيق، والمقاس كان مناسباً تماماً لعمر طفلتنا. شكراً على سرعة الرد وتعاونكم أثناء الطلب.' : '(نص تجريبي) وصل الطقم مرتباً والتغليف جميل جداً. شكراً لكم.'
  let b = L.bg(W, H) + L.pattern('cotton', 0, 0, W, H, 0.6) + L.grid(W, H, M) + head(W)
  const cx = M, cy = sq ? 200 : 260, cw = W - 2 * M
  b += L.rect('بطاقة الرأي', cx, cy, cw, sq ? 600 : 760, C.milk, 56, 'box-shadow:0 30px 60px rgba(61,51,71,.08)')
  b += L.svg('علامة اقتباس — غيمة', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><path d="${E.cloud(100, 112, 46, C.apricot).match(/d="([^"]+)"/)[1]}" fill="${C.apricot}"/><text x="100" y="98" text-anchor="middle" font-family="Readex Pro" font-weight="700" font-size="90" fill="${C.ink}">”</text></svg>`, cx + cw / 2 - 90, cy - 60, 180, 108)
  b += L.text('نص الرأي', q, cx + 70, cy + 100, cw - 140, 'sub', sq ? 44 : 50, { align: 'center', lh: 1.6, fit: sq ? 4 : 6, id: 'q', h: sq ? 340 : 480 }).replace('style="', 'style="display:flex;align-items:center;justify-content:center;')
  b += L.svg('فاصل', E.DIVIDERS.dots(300), cx + cw / 2 - 150, cy + (sq ? 470 : 610), 300, 30)
  b += L.text('اسم العميل', blank ? 'اسم العميل أو المدينة' : '— أم سارة، الرياض (مثال)', cx, cy + (sq ? 510 : 650), cw, 'bodyM muted', 28, { align: 'center' })
  b += L.text('تنويه', 'نشارك آراء عملائنا كما وصلتنا وبإذنهم', M, H - 120, W - 2 * M, 'body muted', 22, { align: 'center' })
  return page(b + end(W, H, blank), W, H)
}

// 7) نصائح ومعلومات مفيدة
export function tips({ W, H, blank, long }) {
  const sq = W === H
  const title = blank ? 'عنوان النصيحة' : long ? '3 نصائح بسيطة للعناية بملابس المولود قبل أول استخدام وبعده' : '3 نصائح للعناية بملابس المولود'
  const items = blank ? ['النقطة الأولى في سطر أو سطرين', 'النقطة الثانية في سطر أو سطرين', 'النقطة الثالثة في سطر أو سطرين'] : ['اغسلوا القطع الجديدة قبل أول استخدام.', 'اتبعوا تعليمات العناية المرفقة مع كل قطعة.', 'استخدموا منظفاً لطيفاً وتجنبوا المنعّمات القوية.']
  let b = L.bg(W, H, C.mist) + L.grid(W, H, M) + head(W)
  b += L.icon('care', M, 64, 80, C.ink, 'أيقونة الموضوع')
  b += L.text('العنوان', title, M, sq ? 180 : 220, W - 2 * M, 'display', sq ? 60 : 68, { id: 'tt', fit: 2, lh: 1.25 })
  const gap = sq ? 22 : 30
  for (let i = 0; i < 3; i++) {
    const h = sq ? 150 : 190
    b += `<div class="L" id="tp${i}" data-follow="${i ? 'tp' + (i - 1) : 'tt'}" data-gap="${i ? gap : 40}" style="left:${M}px;top:0;width:${W - 2 * M}px;height:${h}px">${L.rect(`خلفية النقطة ${i + 1}`, 0, 0, W - 2 * M, h, C.milk, 40)}${L.text(`رقم ${i + 1}`, String(i + 1), W - 2 * M - 110, (h - 76) / 2, 76, 'display', 40, { align: 'center', color: C.ink, lh: 1.9 }).replace('style="', `style="background:${C.apricot};border-radius:50%;height:76px;`)}${L.text(`النقطة ${i + 1}`, items[i], 34, 0, W - 2 * M - 180, 'bodyM', sq ? 30 : 34, { lh: 1.5 }).replace('top:0px;', `top:${h / 2 - (sq ? 23 : 26)}px;`)}</div>`
  }
  b += L.text('دعوة', blank ? 'دعوة قصيرة (اختياري)' : 'احفظوا المنشور للرجوع إليه', M, H - 130, W - 2 * M, 'sub', 28, { align: 'center' })
  return page(b + end(W, H, blank), W, H, C.mist)
}

// 8) إعلان عام للمتجر
export function brand({ W, H, blank, long }) {
  const sq = W === H
  let b = L.bg(W, H, C.ink) + L.pattern('ink', 0, 0, W, H, 0.6) + L.grid(W, H, M)
  b += L.logo(W / 2 - 200, sq ? 150 : 210, 400, 'reverse')
  b += L.text('العنوان', blank ? 'جملة الإعلان الرئيسية' : long ? 'كل ما يحتاجه مولودكم في مكان واحد: ملابس، أطقم، إكسسوارات وهدايا' : 'كل ما يحتاجه مولودكم، بلطف', M, sq ? 420 : 520, W - 2 * M, 'display', sq ? 62 : 70, { align: 'center', color: C.cotton, fit: 2, id: 'tt' })
  const feats = blank ? ['ميزة أولى', 'ميزة ثانية', 'ميزة ثالثة'] : ['توصيل للمدن', 'تغليف هدايا', 'دليل مقاسات']
  const ic = ['van', 'gift', 'ruler']; const fw = (W - 2 * M) / 3, fy = sq ? 640 : 790
  for (let i = 0; i < 3; i++) {
    const x = W - M - fw * (i + 1)
    b += L.icon(ic[i], x + fw / 2 - 40, fy, 80, C.apricot, `أيقونة ${i + 1}`) + L.text(`الميزة ${i + 1}`, feats[i], x, fy + 100, fw, 'sub', 30, { align: 'center', color: C.cotton })
  }
  b += `<div class="L" style="left:50%;transform:translateX(-50%);top:${sq ? 880 : 1080}px;height:84px">${L.button('تسوّقوا الآن', 0, 0, 84, 'accent').replace('right:0px;', 'left:0px;')}</div>`
  return page(b + end(W, H, blank, true), W, H, C.ink)
}

// 9) كاروسيل: غلاف، صفحة محتوى، صفحة ختامية
export function carousel({ W, H, blank, part = 'cover', n = 1, long }) {
  const sq = W === H
  let b = ''
  if (part === 'cover') {
    b += L.bg(W, H, C.sand) + L.grid(W, H, M) + head(W)
    b += L.frame('arch', W / 2 - (sq ? 230 : 300), sq ? 400 : 480, sq ? 460 : 600, sq ? 520 : 700) + ph(blank, 'ph08-trio', 'arch', W / 2 - (sq ? 230 : 300), sq ? 400 : 480, sq ? 460 : 600, sq ? 520 : 700, true)
    b += L.text('عنوان السلسلة', blank ? 'عنوان الكاروسيل' : long ? 'دليلكم المختصر لاختيار مقاس ملابس المولود في الأشهر الأولى' : 'دليل مقاسات المولود', M, 170, W - 2 * M, 'display', sq ? 66 : 76, { align: 'center', fit: 2, id: 'tt' })
    b += L.text('سطر تمهيدي', blank ? 'سطر تمهيدي قصير' : 'اسحبوا لتعرفوا المقاس المناسب', M, 0, W - 2 * M, 'body muted', 30, { align: 'center', follow: 'tt', gap: 6 })
    b += L.text('إشارة السحب', 'اسحبوا ←', M, H - 140, 300, 'sub', 30, { align: 'left' })
  } else if (part === 'content') {
    b += L.bg(W, H) + L.grid(W, H, M) + L.symbol(W - M - 70, 64, 60)
    b += L.text('رقم الصفحة', String(n).padStart(2, '0'), M, 70, 200, 'display', 44, { align: 'left', color: C.apricot })
    b += L.icon('ruler', W / 2 - 60, sq ? 200 : 260, 120, C.ink, 'أيقونة الصفحة')
    b += L.text('عنوان الصفحة', blank ? 'عنوان الفقرة' : long ? 'من الولادة حتى 3 أشهر: اختاروا مقاساً أكبر قليلاً لأن الطفل ينمو بسرعة' : 'من الولادة حتى 3 أشهر', M, sq ? 380 : 460, W - 2 * M, 'title', sq ? 56 : 62, { align: 'center', fit: 2, id: 'tt' })
    b += L.text('نص الصفحة', blank ? 'نص الفقرة هنا في ثلاثة أسطر كحد أقصى للحفاظ على وضوح القراءة.' : 'راجعوا جدول المقاسات في صفحة كل منتج، فالمقاسات تختلف بين المصنّعين. وإن كنتم بين مقاسين فاختاروا الأكبر.', M + 40, 0, W - 2 * M - 80, 'body', sq ? 32 : 36, { align: 'center', follow: 'tt', gap: 20, lh: 1.65, fit: 5 })
    b += L.svg('نقاط التقدم', E.DIVIDERS.dots(300), W / 2 - 150, H - 150, 300, 30)
  } else {
    b += L.bg(W, H, C.ink) + L.pattern('ink', 0, 0, W, H, 0.5) + L.grid(W, H, M)
    b += L.badge(W / 2 - 130, sq ? 200 : 260, 260, 'reverse')
    b += L.text('الرسالة الختامية', blank ? 'رسالة ختامية قصيرة' : 'احفظوا الدليل وشاركوه مع من ينتظر مولوداً', M, sq ? 520 : 620, W - 2 * M, 'display', sq ? 56 : 62, { align: 'center', color: C.cotton, fit: 3, id: 'tt' })
    b += `<div class="L" data-follow="tt" data-gap="50" style="left:50%;transform:translateX(-50%);top:0;height:84px">${L.button('للطلب: الرابط في الحساب', 0, 0, 84, 'accent').replace('right:0px;', 'left:0px;')}</div>`
  }
  return page(b + end(W, H, blank, part === 'end'), W, H, part === 'end' ? C.ink : C.cotton)
}

export const POSTS = [
  ['01_Product', 'منتج واحد مع الاسم والسعر', product],
  ['02_Collection_Set', 'مجموعة منتجات أو طقم مواليد', collection],
  ['03_Sale', 'تخفيض بالسعر السابق والجديد', sale],
  ['04_New_Arrivals', 'وصول منتجات جديدة', arrivals],
  ['05_Newborn_Gift', 'هدية مولود مع خيارات التغليف', gift],
  ['06_Customer_Review', 'رأي عميل', review],
  ['07_Tips', 'نصائح ومعلومات مفيدة', tips],
  ['08_Store_Announcement', 'إعلان عام للمتجر', brand],
  ['09a_Carousel_Cover', 'كاروسيل — الغلاف', (o) => carousel({ ...o, part: 'cover' })],
  ['09b_Carousel_Content', 'كاروسيل — صفحة محتوى', (o) => carousel({ ...o, part: 'content', n: 1 })],
  ['09c_Carousel_End', 'كاروسيل — الصفحة الختامية', (o) => carousel({ ...o, part: 'end' })],
]
