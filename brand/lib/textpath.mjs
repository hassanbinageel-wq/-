// نص عربي → مسار SVG (للملصقات والعناصر التي يجب ألا تعتمد على تثبيت الخط)
import path from 'node:path'
import { shapeToContours, pathToContours, contourD } from './shape.mjs'
import { ROOT } from './browser.mjs'
const FONTS = { readex: 'ReadexPro-VF.ttf', plex: 'IBMPlexSansArabic-Medium.ttf', plexBold: 'IBMPlexSansArabic-SemiBold.ttf' }
// ثنائية الاتجاه المبسطة: الأرقام واللاتينية تُشكَّل يساراً-لليمين داخل فقرة يمين-لليسار
const LTR = /([0-9٠-٩](?:[0-9٠-٩]|[.,٫٬\/:](?=[0-9٠-٩]))*[%٪]?|[A-Za-z@][A-Za-z0-9@._\-]*)/
export function textPath(text, { font = 'readex', wght = 500, size = 40 } = {}) {
  const file = path.join(ROOT, 'assets/fonts', FONTS[font])
  const runs = text.split(LTR).filter((t) => t !== '').map((t) => ({ t, ltr: LTR.test(t) && t.match(LTR)[0] === t }))
  let x = 0, upem = 1000; const cs = []
  for (const run of runs.reverse()) {
    // علامة النسبة العربية تظهر يسار الرقم كما في المتصفح
    const txt = run.ltr && run.t.endsWith('\u066A') ? '\u066A' + run.t.slice(0, -1) : run.t
    const r = shapeToContours(file, txt, { wght, direction: run.ltr ? 'ltr' : 'rtl' })
    upem = r.upem
    for (const g of r.glyphs) cs.push(...pathToContours(g.path, x + g.x, -g.y))
    x += r.advance
  }
  const r = { upem, advance: x }
  const s = size / r.upem
  // مقاييس الخط: الارتفاع من خط الأساس (ascender تقريبي 0.75em فوق، 0.25 تحت)
  const d = cs.map((c) => contourD(c)).join(' ')
  return { d, scale: s, width: r.advance * s, ascent: 0.78 * size, descent: 0.32 * size }
}
/** يضع النص في مركز (cx, cy) */
export function textPathCentered(text, cx, cy, fill, opts) {
  const t = textPath(text, opts)
  const x = cx - t.width / 2, y = cy + (t.ascent - t.descent) / 2
  return `<path transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${t.scale.toFixed(5)})" d="${t.d}" fill="${fill}"/>`
}
