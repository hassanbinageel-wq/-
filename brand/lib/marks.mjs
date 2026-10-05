// تركيب نسخ الشعار من الهندسة الأساسية (SVG نقية بمسارات)
import { logoGeometry } from './logo-geometry.mjs'
import { shapeToContours, pathToContours, contourD } from './shape.mjs'
import path from 'node:path'
import { ROOT } from './browser.mjs'
import { C } from './palette.mjs'

export const COLORWAYS = {
  color: { letters: C.ink, cloud: C.apricot, badge: C.ink, badgeGlyph: C.cotton, badgeCloud: C.apricot, label: 'ملون' },
  reverse: { letters: C.cotton, cloud: C.apricot, badge: C.cotton, badgeGlyph: C.ink, badgeCloud: C.apricot, label: 'ملون على داكن' },
  mono: { letters: C.ink, cloud: C.ink, badge: C.ink, knockout: true, label: 'لون واحد' },
  black: { letters: '#000000', cloud: '#000000', badge: '#000000', knockout: true, label: 'أسود' },
  white: { letters: '#FFFFFF', cloud: '#FFFFFF', badge: '#FFFFFF', knockout: true, label: 'أبيض' },
}

const g = () => logoGeometry()
const f2 = (n) => +n.toFixed(2)

// الكلمة: بإحداثيات مطبعة تبدأ من (0,0)
export function wordmarkParts() {
  const { word } = g(); const [x0, y0, x1, y1] = word.bounds
  return { w: x1 - x0, h: y1 - y0, tx: -x0, ty: -y0, letters: word.letters, cloud: word.cloud }
}
export function symbolParts() {
  const { symbol } = g(); const [x0, y0, x1, y1] = symbol.bounds
  return { w: x1 - x0, h: y1 - y0, tx: -x0, ty: -y0, letters: symbol.letters, cloud: symbol.cloud }
}

const wordG = (cw, x = 0, y = 0, s = 1) => {
  const p = wordmarkParts()
  return `<g transform="translate(${f2(x)} ${f2(y)}) scale(${s}) translate(${f2(p.tx)} ${f2(p.ty)})"><path d="${p.letters}" fill="${cw.letters}"/><path d="${p.cloud}" fill="${cw.cloud}"/></g>`
}
const glyphG = (fillL, fillC, x, y, s) => {
  const p = symbolParts()
  return `<g transform="translate(${f2(x)} ${f2(y)}) scale(${s}) translate(${f2(p.tx)} ${f2(p.ty)})"><path d="${p.letters}" fill="${fillL}"/><path d="${p.cloud}" fill="${fillC}"/></g>`
}

// الشارة الدائرية: قطرها D، الحرف في المركز البصري
export function badgeG(cw, cx, cy, D) {
  const p = symbolParts(); const s = (D * 0.7) / p.h
  const x = cx - (p.w * s) / 2 + D * 0.015, y = cy - (p.h * s) / 2 - D * 0.005
  if (cw.knockout) {
    // لون واحد: الدائرة مثقوبة بشكل الحرف (قاعدة evenodd)
    const r = D / 2
    const circle = `M${f2(cx - r)} ${f2(cy)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(2 * r)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-2 * r)} 0Z`
    return `<path fill="${cw.badge}" fill-rule="evenodd" d="${circle}"/><g transform="translate(${f2(x)} ${f2(y)}) scale(${f2(s)}) translate(${f2(p.tx)} ${f2(p.ty)})" style="mix-blend-mode:normal"><path d="${p.letters}" fill="#000" class="ko"/><path d="${p.cloud}" fill="#000" class="ko"/></g>`
  }
  return `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(D / 2)}" fill="${cw.badge}"/>${glyphG(cw.badgeGlyph, cw.badgeCloud, x, y, s)}`
}

// للشارة أحادية اللون نستخدم قناعاً بدلاً من رسم أسود
function badgeMasked(cw, cx, cy, D, id) {
  const p = symbolParts(); const s = (D * 0.7) / p.h
  const x = cx - (p.w * s) / 2 + D * 0.015, y = cy - (p.h * s) / 2 - D * 0.005
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="${f2(cx - D)}" y="${f2(cy - D)}" width="${f2(2 * D)}" height="${f2(2 * D)}"><circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(D / 2)}" fill="#fff"/>${glyphG('#000', '#000', x, y, s)}</mask></defs><circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(D / 2)}" fill="${cw.badge}" mask="url(#${id})"/>`
}
const badge = (cw, cx, cy, D, id = 'm' + Math.round(cx) + Math.round(cy)) => (cw.knockout ? badgeMasked(cw, cx, cy, D, id) : badgeG(cw, cx, cy, D))

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f2(w)} ${f2(h)}" width="${f2(w / 4)}" height="${f2(h / 4)}"><title>${title}</title>${body}</svg>`

export function wordmarkSVG(cw, title = 'غيمة') { const p = wordmarkParts(); return svg(p.w, p.h, wordG(cw), title) }
export function symbolSVG(cw, title = 'رمز غيمة') { const p = symbolParts(); return svg(p.w, p.h, glyphG(cw.letters, cw.cloud, 0, 0, 1), title) }
export function badgeSVG(cw, title = 'شارة غيمة') { const D = 1000; return svg(D, D, badge(cw, D / 2, D / 2, D), title) }

export function horizontalSVG(cw, title = 'غيمة — أفقي') {
  const p = wordmarkParts(); const D = p.h * 1.08, gap = p.h * 0.36
  const W = D + gap + p.w, H = Math.max(D, p.h)
  // RTL: الشارة يميناً والكلمة يساراً
  return svg(W, H, badge(cw, W - D / 2, H / 2, D) + wordG(cw, 0, (H - p.h) / 2), title)
}
export function stackedSVG(cw, title = 'غيمة — مكدس') {
  const p = wordmarkParts(); const D = p.h * 1.25, gap = p.h * 0.32
  const W = Math.max(D, p.w), H = D + gap + p.h
  return svg(W, H, badge(cw, W / 2, D / 2, D) + wordG(cw, (W - p.w) / 2, D + gap), title)
}

// العبارة الوصفية الاختيارية
const TAG = 'للمواليد والهدايا'
export function taglineParts() {
  const r = shapeToContours(path.join(ROOT, 'assets/fonts/ReadexPro-VF.ttf'), TAG, { wght: 400 })
  const cs = r.glyphs.flatMap((gl) => pathToContours(gl.path, gl.x, 0))
  const b = cs.map((c) => c.bbox); const x0 = Math.min(...b.map((v) => v[0])), y0 = Math.min(...b.map((v) => v[1])), x1 = Math.max(...b.map((v) => v[2])), y1 = Math.max(...b.map((v) => v[3]))
  return { d: cs.map((c) => contourD(c)).join(' '), w: x1 - x0, h: y1 - y0, tx: -x0, ty: -y0, text: TAG }
}
export function taglineSVG(fill, { live = false } = {}) {
  const t = taglineParts()
  if (live) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f2(t.w * 1.3)} ${f2(t.h * 1.6)}" width="${f2(t.w * 1.3 / 4)}" height="${f2(t.h * 0.4)}"><text x="${f2(t.w * 0.65)}" y="${f2(t.h * 1.1)}" direction="rtl" text-anchor="middle" font-family="Readex Pro" font-weight="400" font-size="${f2(t.h * 1.25)}" fill="${fill}">${TAG}</text></svg>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f2(t.w)} ${f2(t.h)}" width="${f2(t.w / 4)}" height="${f2(t.h / 4)}"><title>${TAG}</title><path transform="translate(${f2(t.tx)} ${f2(t.ty)})" d="${t.d}" fill="${fill}"/></svg>`
}
export function wordmarkWithTaglineSVG(cw) {
  const p = wordmarkParts(), t = taglineParts(); const s = (p.w * 0.78) / t.w, gap = p.h * 0.3
  const W = p.w, H = p.h + gap + t.h * s
  return svg(W, H, wordG(cw) + `<g transform="translate(${f2((W - t.w * s) / 2)} ${f2(p.h + gap)}) scale(${f2(s)}) translate(${f2(t.tx)} ${f2(t.ty)})"><path d="${t.d}" fill="${cw.letters}"/></g>`, 'غيمة — مع العبارة الوصفية')
}

// صورة الحساب وأيقونة الموقع
export function avatarSVG(variant = 'light') {
  const S = 1080, bg = variant === 'light' ? C.cotton : C.ink
  const cw = variant === 'light' ? COLORWAYS.color : COLORWAYS.reverse
  const p = symbolParts(); const s = (S * 0.56) / p.h
  return svg(S, S, `<rect width="${S}" height="${S}" fill="${bg}"/>` + glyphG(cw.letters, cw.cloud, S / 2 - (p.w * s) / 2 + S * 0.01, S / 2 - (p.h * s) / 2 - S * 0.01, s), 'صورة حساب غيمة')
}
export function faviconSVG() {
  const S = 512, p = symbolParts(); const s = (S * 0.86) / p.h
  return svg(S, S, `<rect width="${S}" height="${S}" rx="${S * 0.22}" fill="${C.ink}"/>` + glyphG(C.cotton, C.apricot, S / 2 - (p.w * s) / 2 + S * 0.01, S / 2 - (p.h * s) / 2 - S * 0.01, s), 'أيقونة غيمة')
}
