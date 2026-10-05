// أغلفة الهايلايت: الأيقونة داخل الدائرة الوسطى (إنستغرام يقص دائرة من المركز)
import { L, page } from '../lib/tpl.mjs'
import { C } from '../lib/palette.mjs'
export const HIGHLIGHTS = [
  ['01_Products', 'المنتجات', 'hanger', C.sand], ['02_New', 'جديدنا', 'sparkle', C.apricot], ['03_Gifts', 'الهدايا', 'gift', C.sage],
  ['04_Sizes', 'المقاسات', 'ruler', C.mist], ['05_Reviews', 'آراء العملاء', 'quote', C.sand], ['06_Order_Payment', 'الطلب والدفع', 'receipt', C.apricot],
  ['07_Delivery', 'التوصيل', 'van', C.sage], ['08_Care', 'العناية', 'care', C.mist],
]
export function highlight({ icon, circle, size = 'story', label }) {
  const W = 1080, H = size === 'story' ? 1920 : 1080
  const D = 640, cy = H / 2
  let b = L.bg(W, H, C.cotton) + L.rect('دائرة الخلفية', W / 2 - D / 2, cy - D / 2, D, D, circle, D / 2) + L.icon(icon, W / 2 - 170, cy - 170, 340, C.ink, `أيقونة: ${label}`)
  if (size === 'story') b += `<div class="L" data-layer="حدود القص الدائري (مخفية)" data-hidden="1" style="left:${W / 2 - 540}px;top:${cy - 540}px;width:1080px;height:1080px;border-radius:50%;border:6px dashed rgba(176,80,58,.7);visibility:hidden"></div>`
  return page(b, W, H)
}
