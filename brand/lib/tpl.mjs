// لبنات القوالب: كل دالة تعيد عنصر HTML مطلق الموضع يمثل طبقة واحدة في ملف PSD
import fs from 'node:fs'
import path from 'node:path'
import { C } from './palette.mjs'
import { doc, ROOT } from './browser.mjs'
import * as M from './marks.mjs'
import * as E from './elements.mjs'
import { framePath } from './elements.mjs'
import { iconSVG } from './icons.mjs'

export const uri = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
const fileUri = (p) => 'data:image/jpeg;base64,' + fs.readFileSync(p).toString('base64')
export const photo = (name, sq = false) => fileUri(path.join(ROOT, 'assets/illustrated', `${name}${sq ? '-sq' : ''}.jpg`))
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const pos = (x, y, w, h) => `left:${x}px;top:${y}px;${w != null ? `width:${w}px;` : ''}${h != null ? `height:${h}px;` : ''}`

export const CSS = `
:root{--ink:${C.ink};--cotton:${C.cotton};--apricot:${C.apricot};--sage:${C.sage};--sageDeep:${C.sageDeep};--mist:${C.mist};--sand:${C.sand};--milk:${C.milk};--clay:${C.clay};--muted:${C.muted};--line:${C.line}}
body{overflow:hidden}
.L{position:absolute}
.t{font-family:'Readex Pro';color:var(--ink);direction:rtl;text-align:right;white-space:pre-wrap;overflow-wrap:break-word}
.display{font-weight:600;letter-spacing:0}
.title{font-weight:600}
.sub{font-weight:500}
.body{font-family:'IBM Plex Sans Arabic';font-weight:400}
.bodyM{font-family:'IBM Plex Sans Arabic';font-weight:500}
.price{font-weight:600}
.c{text-align:center}
.muted{color:var(--muted)}
`
// تخطيط بعد تحميل الخطوط: تصغير العناوين الطويلة (data-fit) ثم رصّ العناصر المتتالية (data-follow)
const LAYOUT = `<script>window.__layout=()=>{
  for(const el of document.querySelectorAll('[data-fit]')){const max=+el.dataset.fit;let fs=parseFloat(getComputedStyle(el).fontSize);const min=fs*(+el.dataset.min||0.7);const lh=()=>parseFloat(getComputedStyle(el).lineHeight);const ch=()=>{const r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect().height};while(ch()>lh()*max+2&&fs>min){fs-=2;el.style.fontSize=fs+'px'}}
  for(const el of document.querySelectorAll('[data-follow]')){const ref=document.getElementById(el.dataset.follow);if(!ref)continue;const cv=document.getElementById('cv').getBoundingClientRect();const r=ref.getBoundingClientRect();el.style.top=(r.bottom-cv.top+(+el.dataset.gap||0))+'px'}
  for(const el of document.querySelectorAll('[data-above]')){const ref=document.getElementById(el.dataset.above);if(!ref)continue;const cv=document.getElementById('cv').getBoundingClientRect();const r=ref.getBoundingClientRect();el.style.top=(r.top-cv.top-el.getBoundingClientRect().height-(+el.dataset.gap||0))+'px'}
}</script>`
export const page = (body, w, h, bg = C.cotton) => doc(`<div id="cv" style="position:relative;width:${w}px;height:${h}px;overflow:hidden">${body}</div>${LAYOUT}`, CSS, { bg })

export const L = {
  bg: (w, h, color = C.cotton, name = 'الخلفية') => `<div class="L" data-layer="${name}" style="${pos(0, 0, w, h)}background:${color}"></div>`,
  rect: (name, x, y, w, h, color, r = 0, extra = '') => `<div class="L" data-layer="${name}" style="${pos(x, y, w, h)}background:${color};border-radius:${r}px;${extra}"></div>`,
  pattern: (v, x, y, w, h, op = 1, name = 'النمط المتكرر', tile = 300) => `<img class="L" data-layer="${name}" style="${pos(x, y, w, h)}opacity:${op}" src="${uri(E.patternSheet(v, w, h, { size: tile, bg: false }))}">`,
  // إطار + صورة مقصوصة عليه (في PSD: الصورة بقناع قص فوق شكل الإطار)
  frame: (kind, x, y, w, h, fill = C.sand, name = 'إطار الصورة') => `<div class="L" data-layer="${name}" style="${pos(x, y, w, h)}background:${fill};clip-path:path('${framePath(kind, w, h)}')"></div>`,
  photo: (src, kind, x, y, w, h, name = 'صورة المنتج — ضع صورتك هنا', fit = 'cover') => `<img class="L" data-layer="${name}" data-clip="1" style="${pos(x, y, w, h)}object-fit:${fit};clip-path:path('${framePath(kind, w, h)}')" src="${src}">`,
  placeholder: (kind, x, y, w, h, label = 'ضع صورة المنتج هنا') => `<div class="L" data-layer="صورة المنتج — ضع صورتك هنا" data-clip="1" style="${pos(x, y, w, h)}clip-path:path('${framePath(kind, w, h)}');background:repeating-linear-gradient(135deg,${C.sand} 0 26px,#EDE1D1 26px 52px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px"><img style="width:${Math.min(w, h) * 0.16}px;opacity:.55" src="${uri(iconSVG('hanger', { color: C.muted }))}"><div class="t c sub" style="font-size:${Math.max(24, Math.min(w, h) * 0.05)}px;color:${C.muted}">${label}</div></div>`,
  text: (name, s, x, y, w, cls, size, { lh = 1.35, color, align, h, maxLines, id, fit, follow, above, gap = 0 } = {}) =>
    `<div class="L t ${cls}" data-layer="${name}" data-kind="text"${id ? ` id="${id}"` : ''}${fit ? ` data-fit="${fit}"` : ''}${follow ? ` data-follow="${follow}" data-gap="${gap}"` : ''}${above ? ` data-above="${above}" data-gap="${gap}"` : ''} style="${pos(x, y, w, h)}font-size:${size}px;line-height:${lh};${color ? `color:${color};` : ''}${align ? `text-align:${align};` : ''}${maxLines ? `display:-webkit-box;-webkit-line-clamp:${maxLines};-webkit-box-orient:vertical;overflow:hidden;` : ''}">${esc(s)}</div>`,
  logo: (x, y, width, cw = 'color', name = 'الشعار (لا تعدّله)') => `<img class="L" data-layer="${name}" style="${pos(x, y, width)}" src="${uri(M.wordmarkSVG(M.COLORWAYS[cw]))}">`,
  symbol: (x, y, width, cw = 'color', name = 'رمز الشعار') => `<img class="L" data-layer="${name}" style="${pos(x, y, width)}" src="${uri(M.symbolSVG(M.COLORWAYS[cw]))}">`,
  badge: (x, y, width, cw = 'color', name = 'شارة الشعار') => `<img class="L" data-layer="${name}" style="${pos(x, y, width)}" src="${uri(M.badgeSVG(M.COLORWAYS[cw]))}">`,
  svg: (name, svgStr, x, y, w, h, extra = '') => `<img class="L" data-layer="${name}" style="${pos(x, y, w, h)}${extra}" src="${uri(svgStr)}">`,
  icon: (key, x, y, size, color = C.ink, name) => `<img class="L" data-layer="${name || 'أيقونة'}" style="${pos(x, y, size, size)}" src="${uri(iconSVG(key, { color, size }))}">`,
  sticker: (key, x, y, h, rot = 0, name) => { const s = E.STICKERS[key].svg(); const m = s.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); const w = (h * +m[1]) / +m[2]; return `<img class="L" data-layer="${name || 'ملصق: ' + E.STICKERS[key].ar}" style="${pos(x, y, w, h)}transform:rotate(${rot}deg)" src="${uri(s)}">` },
  // زر بصري للدعوة إلى الطلب (ليس رابطاً تفاعلياً)
  button: (label, x, y, h, kind = 'primary', name = 'زر الطلب (اختياري)', anchor = 'right') => {
    const st = { primary: [C.ink, C.cotton, 'none'], accent: [C.apricot, C.ink, 'none'], light: [C.milk, C.ink, 'none'], outline: ['transparent', C.ink, `inset 0 0 0 3px ${C.ink}`] }[kind]
    const place = anchor === 'center' ? `left:${x}px;transform:translateX(-50%);` : anchor === 'left' ? `left:${x}px;` : `right:${x}px;`
    return `<div class="L" style="${place}top:${y}px;height:${h}px;display:inline-block"><div data-layer="${name} — الشكل" style="position:absolute;inset:0;border-radius:${h}px;background:${st[0]};box-shadow:${st[2]}"></div><div class="t sub c" data-layer="${name} — النص" data-kind="text" style="position:relative;height:${h}px;line-height:${h}px;padding:0 ${h * 0.55}px;color:${st[1]};font-size:${h * 0.36}px;white-space:nowrap">${esc(label)}</div></div>`
  },
  // شريط السعر: السعر الحالي (+ السابق مشطوباً)
  priceTag: (price, x, y, size, { old, cur = 'ر.س', color = C.ink, name = 'السعر' } = {}) => {
    let h = `<div class="L t price" data-layer="${name}" data-kind="text" style="${pos(x, y)}font-size:${size}px;line-height:1.2;color:${old ? C.clay : color};white-space:nowrap">${esc(price + ' ' + cur)}</div>`
    return h
  },
  oldPrice: (old, x, y, size, cur = 'ر.س') => `<div class="L t muted" data-layer="السعر السابق (مشطوب)" data-kind="text" style="${pos(x, y)}font-size:${size}px;line-height:1.2;white-space:nowrap;text-decoration:line-through;text-decoration-thickness:${Math.max(2, size * 0.07)}px">${esc(old + ' ' + cur)}</div>`,
  exampleTag: (w, h, s = 1) => `<div class="L" data-layer="علامة «مثال» — احذفها قبل النشر" style="left:50%;transform:translateX(-50%);white-space:nowrap;top:${h - 52 * s}px;padding:${6 * s}px ${14 * s}px;border-radius:${30 * s}px;background:rgba(61,51,71,.78);color:#fff;font:500 ${18 * s}px 'Readex Pro';direction:rtl">مثال توضيحي — الأسماء والأسعار ليست حقيقية</div>`,
  // شبكة المحاذاة (مخفية في PSD)
  grid: (w, h, m, { top = m, bottom = m, cols = 6, gutter = 24, name = 'شبكة المحاذاة والهوامش (مخفية)' } = {}) => {
    const cw = (w - 2 * m - gutter * (cols - 1)) / cols
    let cells = ''
    for (let i = 0; i < cols; i++) cells += `<div style="position:absolute;top:${top}px;bottom:${bottom}px;left:${m + i * (cw + gutter)}px;width:${cw}px;background:rgba(240,173,130,.13)"></div>`
    return `<div class="L" data-layer="${name}" data-hidden="1" style="${pos(0, 0, w, h)}visibility:hidden">${cells}<div style="position:absolute;left:${m}px;right:${m}px;top:${top}px;bottom:${bottom}px;border:2px dashed rgba(176,80,58,.6)"></div></div>`
  },
  safeZones: (w, h, top, bottom, name = 'مناطق واجهة إنستغرام — لا تضع فيها معلومات أساسية (مخفية)') =>
    `<div class="L" data-layer="${name}" data-hidden="1" style="${pos(0, 0, w, h)}visibility:hidden"><div style="position:absolute;left:0;right:0;top:0;height:${top}px;background:rgba(176,80,58,.28)"></div><div style="position:absolute;left:0;right:0;bottom:0;height:${bottom}px;background:rgba(176,80,58,.28)"></div><div style="position:absolute;left:0;right:0;top:${top / 2 - 20}px;text-align:center;font:600 30px 'Readex Pro';color:#fff">منطقة واجهة التطبيق — ${top}px</div><div style="position:absolute;left:0;right:0;bottom:${bottom / 2 - 20}px;text-align:center;font:600 30px 'Readex Pro';color:#fff">منطقة واجهة التطبيق — ${bottom}px</div></div>`,
}
// إظهار الطبقات المخفية في صور المعاينة الخاصة بالدليل
export const showHidden = (html) => html.replace(/visibility:hidden/g, 'visibility:visible')
