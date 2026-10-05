// تطبيقات التغليف بمقاسات مقترحة (ملم). كل عنصر يُرسم بمقياس k (بكسل لكل ملم) مع نزف 3 ملم.
import { L, uri, page } from '../lib/tpl.mjs'
import { C } from '../lib/palette.mjs'
import * as E from '../lib/elements.mjs'
import * as M from '../lib/marks.mjs'
import { iconSVG } from '../lib/icons.mjs'

export const BLEED = 3
const T = (k, name, s, xmm, ymm, wmm, cls, ptMm, opts = {}) => L.text(name, s, xmm * k, ymm * k, wmm * k, cls, ptMm * k, opts)
const die = (k, w, h, lines, extra = '') => `<div class="L" data-layer="خطوط القص والطي — للتوضيح فقط (اعتمدوا قالب المطبعة)" data-hidden="1" style="left:0;top:0;width:${w * k}px;height:${h * k}px;visibility:hidden"><svg width="${w * k}" height="${h * k}" viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0"><rect x="${BLEED}" y="${BLEED}" width="${w - 2 * BLEED}" height="${h - 2 * BLEED}" fill="none" stroke="#E0007A" stroke-width=".4"/>${lines.map(([x1, y1, x2, y2]) => `<line x1="${x1 + BLEED}" y1="${y1 + BLEED}" x2="${x2 + BLEED}" y2="${y2 + BLEED}" stroke="#00A0E0" stroke-width=".4" stroke-dasharray="2 1.5"/>`).join('')}${extra}</svg></div>`

export const ITEMS = [
  {
    id: 'Shopping_Bag_Flat', ar: 'كيس المتجر (مخطط مسطح)', trim: [720, 430], dpi: 150, size: 'العرض 250 × الارتفاع 320 × العمق 100 ملم — طية علوية 40 وقاعدة 70 ملم ولسان لصق 20 ملم',
    sides: { flat: (k, W, H) => {
      const x = (mm) => (mm + BLEED) * k, y = x
      let b = L.bg(W, H, C.cotton, 'الخلفية')
      // الترتيب من اليسار: لسان اللصق، الخلف، الجانب، الأمام، الجانب
      b += L.rect('لسان اللصق', 0, 0, x(20), H, C.sand)
      b += L.pattern('cotton', x(20), 0, 250 * k, H, 1, 'الوجه الخلفي — النمط', 60 * k)
      b += L.rect('الجانب الأيسر', x(270), 0, 100 * k, H, C.sage) + L.symbol(x(270) + 35 * k, y(80), 30 * k, 'mono', 'رمز على الجانب')
      b += L.rect('الوجه الأمامي', x(370), 0, 250 * k, H, C.cotton)
      b += L.logo(x(370) + 55 * k, y(170), 140 * k)
      b += L.svg('غيمة صغيرة', E.DIVIDERS.dots(300), x(370) + 75 * k, y(260), 100 * k, 10 * k)
      b += T(k, 'اسم الحساب', '@ghayma', 370 + BLEED, 375, 250, 'sub muted c', 7)
      b += L.rect('الجانب الأيمن', x(620), 0, 100 * k + BLEED * k, H, C.sage) + L.symbol(x(620) + 35 * k, y(80), 30 * k, 'mono', 'رمز على الجانب')
      b += L.rect('الطية العلوية الداخلية', 0, 0, W, y(40), C.apricot)
      b += die(k, 720 + 6, 430 + 6, [[20, 0, 20, 430], [270, 0, 270, 430], [370, 0, 370, 430], [620, 0, 620, 430], [0, 40, 720, 40], [0, 360, 720, 360], [320, 360, 320, 430], [670, 360, 670, 430]])
      return b
    } },
  },
  {
    id: 'Gift_Box_Lid_Net', ar: 'صندوق هدية — غطاء (مخطط مسطح)', trim: [360, 260], dpi: 150, size: 'غطاء 300 × 200 ملم بارتفاع جوانب 30 ملم — الصندوق نفسه بلون الحبر أو أبيض',
    sides: { flat: (k, W, H) => {
      const x = (mm) => (mm + BLEED) * k
      let b = L.bg(W, H, C.ink, 'الخلفية') + L.pattern('ink', 0, 0, W, H, 0.9, 'النمط المتكرر', 50 * k)
      b += L.rect('سطح الغطاء', x(30), x(30), 300 * k, 200 * k, C.ink) + L.pattern('ink', x(30), x(30), 300 * k, 200 * k, 0.5, 'نمط سطح الغطاء', 50 * k)
      b += L.badge(x(180) - 35 * k, x(52), 70 * k, 'reverse')
      b += L.logo(x(180) - 40 * k, x(136), 80 * k, 'reverse')
      b += T(k, 'عبارة الصندوق', 'هدية بلطف', 30 + BLEED, 190, 300, 'sub c', 8, { color: C.apricot })
      b += die(k, 366, 266, [[30, 30, 330, 30], [30, 230, 330, 230], [30, 30, 30, 230], [330, 30, 330, 230], [0, 30, 30, 30], [330, 30, 360, 30], [0, 230, 30, 230], [330, 230, 360, 230]])
      return b
    } },
  },
  {
    id: 'Wrapping_Paper', ar: 'ورق تغليف بالنمط المتكرر', trim: [500, 700], dpi: 150, size: 'لوح 500 × 700 ملم (يُكرر النمط بلا فواصل)',
    sides: { cotton: (k, W, H) => L.bg(W, H, C.cotton) + L.pattern('cotton', 0, 0, W, H, 1, 'النمط المتكرر', 70 * k), sage: (k, W, H) => L.bg(W, H, C.sage) + L.pattern('sage', 0, 0, W, H, 1, 'النمط المتكرر', 70 * k) },
  },
  {
    id: 'Seal_Sticker', ar: 'ملصق إغلاق دائري', trim: [50, 50], dpi: 300, size: 'دائرة بقطر 50 ملم', round: true,
    sides: {
      ink: (k, W, H) => L.bg(W, H, C.ink) + L.symbol(W / 2 - 6 * k, 9 * k, 12 * k, 'reverse') + T(k, 'نص الملصق', 'شكراً لكم', BLEED, 37, 50, 'sub c', 5, { color: C.cotton }) + die(k, 56, 56, [], `<circle cx="28" cy="28" r="25" fill="none" stroke="#E0007A" stroke-width=".4"/>`),
      apricot: (k, W, H) => L.bg(W, H, C.apricot) + L.symbol(W / 2 - 6 * k, 9 * k, 12 * k, 'mono') + T(k, 'نص الملصق', 'بلطف', BLEED, 37, 50, 'sub c', 5) + die(k, 56, 56, [], `<circle cx="28" cy="28" r="25" fill="none" stroke="#E0007A" stroke-width=".4"/>`),
    },
  },
  {
    id: 'Thank_You_Card_A6', ar: 'بطاقة شكر', trim: [105, 148], dpi: 300, size: 'A6 — 105 × 148 ملم، وجهان',
    sides: {
      front: (k, W, H) => L.bg(W, H, C.sand) + L.pattern('cotton', 0, 0, W, H, 0.9, 'النمط المتكرر', 30 * k) + L.rect('مساحة النص', 14 * k, 44 * k, (105 - 22) * k, 62 * k, C.milk, 10 * k) + T(k, 'العنوان', 'شكراً لكم', 14 + BLEED, 56, 77, 'display c', 11) + L.svg('غيمة', E.DIVIDERS.cloudLine(600), 30 * k, 82 * k, 50 * k, 5 * k) + T(k, 'سطر', 'لأنكم اخترتم غيمة', 14 + BLEED, 89, 77, 'body c', 5),
      back: (k, W, H) => L.bg(W, H, C.milk) + L.logo(W / 2 - 18 * k, 20 * k, 36 * k) + T(k, 'الرسالة', 'نتمنى أن تحمل هذه القطع لحظات دافئة وهادئة لمولودكم. يسعدنا سماع رأيكم دائماً.', 14 + BLEED, 50, 77, 'body c', 4.6, { lh: 1.8 }) + T(k, 'التواصل', '@ghayma', BLEED, 128, 105, 'sub c muted', 4),
    },
  },
  {
    id: 'Gift_Message_Card', ar: 'بطاقة إهداء', trim: [90, 55], dpi: 300, size: '90 × 55 ملم، وجهان',
    sides: {
      front: (k, W, H) => L.bg(W, H, C.ink) + L.pattern('ink', 0, 0, W, H, 0.8, 'النمط المتكرر', 22 * k) + L.badge(W / 2 - 9 * k, 9 * k, 18 * k, 'reverse') + T(k, 'العنوان', 'هدية لمولودكم', BLEED, 33, 90, 'display c', 6.4, { color: C.cotton }),
      back: (k, W, H) => L.bg(W, H, C.milk) + [['إلى:', 12], ['من:', 22]].map(([t, y]) => T(k, `حقل ${t}`, t, 64 + BLEED, y + BLEED, 18, 'sub', 3.6) + L.rect(`سطر ${t}`, 10 * k, (y + 8) * k, 56 * k, 0.4 * k, C.muted)).join('') + T(k, 'الرسالة', 'رسالتكم:', 64 + BLEED, 32 + BLEED, 18, 'sub', 3.6) + L.rect('سطر الرسالة 1', 10 * k, 41 * k, 74 * k, 0.4 * k, C.muted) + L.rect('سطر الرسالة 2', 10 * k, 49 * k, 74 * k, 0.4 * k, C.muted) + L.symbol(8 * k, 6 * k, 6 * k, 'color'),
    },
  },
  {
    id: 'Care_Instructions_Card', ar: 'بطاقة تعليمات العناية', trim: [74, 105], dpi: 300, size: 'A7 — 74 × 105 ملم، وجهان',
    sides: {
      front: (k, W, H) => L.bg(W, H, C.mist) + L.icon('care', W / 2 - 11 * k, 22 * k, 22 * k, C.ink, 'أيقونة العناية') + T(k, 'العنوان', 'العناية بالقطعة', BLEED, 52, 74, 'display c', 7) + L.logo(W / 2 - 13 * k, 84 * k, 26 * k),
      back: (k, W, H) => {
        const rows = [['check', 'اتبعوا بطاقة العناية المخيطة في القطعة أولاً'], ['care', 'اغسلوا القطعة قبل أول استخدام'], ['heart', 'استخدموا منظفاً لطيفاً مناسباً لملابس الأطفال'], ['clock', 'جففوها بعيداً عن الحرارة المباشرة']]
        return L.bg(W, H, C.milk) + T(k, 'العنوان', 'نصائح عامة للعناية', 8 + BLEED, 10, 58, 'title', 4.6) + rows.map(([ic, t], i) => L.icon(ic, (74 - 16 + BLEED) * k, (24 + i * 18 + BLEED) * k, 8 * k, C.ink, `أيقونة ${i + 1}`) + T(k, `تعليمة ${i + 1}`, t, 8 + BLEED, 23 + i * 18, 48, 'body', 3.5, { lh: 1.5 })).join('') + T(k, 'تنويه', 'تعليمات عامة؛ المرجع النهائي بطاقة الشركة المصنعة', 6 + BLEED, 96, 62, 'body muted c', 2.6)
      },
    },
  },
  {
    id: 'Product_Hang_Tag', ar: 'بطاقة تعليق على المنتج', trim: [50, 90], dpi: 300, size: '50 × 90 ملم مع ثقب 5 ملم أعلى المنتصف، وجهان',
    sides: {
      front: (k, W, H) => L.bg(W, H, C.ink) + L.pattern('ink', 0, 0, W, H, 0.6, 'النمط المتكرر', 20 * k) + L.symbol(W / 2 - 6 * k, 22 * k, 12 * k, 'reverse') + L.logo(W / 2 - 15 * k, 62 * k, 30 * k, 'reverse') + die(k, 56, 96, [], `<circle cx="28" cy="11" r="2.5" fill="none" stroke="#E0007A" stroke-width=".4"/>`),
      back: (k, W, H) => L.bg(W, H, C.milk) + ['المنتج:', 'المقاس:', 'اللون:', 'السعر:'].map((t, i) => T(k, `حقل ${t}`, t, 30 + BLEED, 20 + i * 11 + BLEED, 15, 'sub', 3.2) + L.rect(`سطر ${t}`, 7 * k, (29 + i * 11 + BLEED) * k, 30 * k, 0.35 * k, C.muted)).join('') + L.rect('مكان الباركود', 9 * k, 68 * k, 38 * k, 16 * k, C.sand, 2 * k) + T(k, 'نص الباركود', 'مكان الباركود', 9 + BLEED - 3, 74, 38, 'body c muted', 2.6) + die(k, 56, 96, [], `<circle cx="28" cy="11" r="2.5" fill="none" stroke="#E0007A" stroke-width=".4"/>`),
    },
  },
]

// صفحة طباعة: المقاس النهائي + نزف 3 ملم + علامات قص (هامش 10 ملم)
export function printPage(item, side) {
  const MARG = 10, k = 96 / 25.4
  const [tw, th] = item.trim, W = (tw + 2 * BLEED) * k, H = (th + 2 * BLEED) * k
  const pw = tw + 2 * BLEED + 2 * MARG, phh = th + 2 * BLEED + 2 * MARG
  const inner = item.sides[side](k, W, H).replace(/data-hidden="1" style="([^"]*)visibility:hidden/g, 'data-hidden="1" style="$1display:none')
  const m = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width=".25"/>`
  const a = MARG + BLEED, bx = MARG + BLEED + tw, by = MARG + BLEED + th
  const marks = [m(0, a, MARG - 1, a), m(0, by, MARG - 1, by), m(pw - MARG + 1, a, pw, a), m(pw - MARG + 1, by, pw, by), m(a, 0, a, MARG - 1), m(bx, 0, bx, MARG - 1), m(a, phh - MARG + 1, a, phh), m(bx, phh - MARG + 1, bx, phh)].join('')
  return { html: page(`<div style="position:absolute;left:${MARG}mm;top:${MARG}mm;width:${W}px;height:${H}px;overflow:hidden">${inner}</div><svg style="position:absolute;inset:0" width="${pw}mm" height="${phh}mm" viewBox="0 0 ${pw} ${phh}">${marks}</svg><div style="position:absolute;left:${MARG}mm;bottom:2mm;font:7px 'Readex Pro';color:#666;direction:rtl">غيمة — ${item.ar} — ${side} — المقاس النهائي ${tw}×${th} ملم + نزف ${BLEED} ملم. اعتمدوا قالب القص من المطبعة قبل الإنتاج.</div>`, pw * k, phh * k, '#fff').replace('<style>', `<style>@page{size:${pw}mm ${phh}mm;margin:0}`), pw, ph: phh }
}
