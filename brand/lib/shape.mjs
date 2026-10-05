// تشكيل النص العربي بـ HarfBuzz وتحويله إلى مسارات SVG (y للأسفل، بوحدات الخط)
import fs from 'node:fs'
import * as hb from 'harfbuzzjs'

export function shapeToContours(fontPath, text, { wght, features, direction } = {}) {
  const data = fs.readFileSync(fontPath)
  const blob = new hb.Blob(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
  const face = new hb.Face(blob)
  const font = new hb.Font(face)
  if (wght) font.setVariations([hb.Variation.fromString('wght=' + wght)])
  const buf = new hb.Buffer()
  buf.addText(text)
  buf.guessSegmentProperties()
  if (direction) buf.setDirection(direction === 'ltr' ? hb.Direction.LTR : hb.Direction.RTL)
  hb.shape(font, buf, features)
  const infos = buf.getGlyphInfos(), pos = buf.getGlyphPositions()
  let x = 0
  const glyphs = []
  // RTL: HarfBuzz يعيد الحروف بترتيب العرض من اليسار لليمين
  for (let i = 0; i < infos.length; i++) {
    const gid = infos[i].codepoint, p = pos[i]
    glyphs.push({ gid, cluster: infos[i].cluster, x: x + p.xOffset, y: p.yOffset, path: font.glyphToPath(gid) })
    x += p.xAdvance
  }
  return { glyphs, advance: x, upem: face.upem }
}

// يحوّل مسار SVG (أوامر M L Q C Z مطلقة) إلى قائمة كنتورات منقولة ومقلوبة المحور y
export function pathToContours(d, dx, dy) {
  const toks = d.match(/[MLQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) || []
  const contours = []; let cur = null, i = 0, cmd
  const pt = () => { const X = +toks[i++] + dx, Y = -(+toks[i++]) + dy; return [X, Y] }
  while (i < toks.length) {
    if (/[MLQCZ]/i.test(toks[i])) cmd = toks[i++].toUpperCase()
    if (cmd === 'M') { cur = { segs: [{ c: 'M', p: [pt()] }] }; contours.push(cur); cmd = 'L' }
    else if (cmd === 'L') cur.segs.push({ c: 'L', p: [pt()] })
    else if (cmd === 'Q') cur.segs.push({ c: 'Q', p: [pt(), pt()] })
    else if (cmd === 'C') cur.segs.push({ c: 'C', p: [pt(), pt(), pt()] })
    else if (cmd === 'Z') { cur.closed = true; cmd = null }
  }
  for (const c of contours) {
    const pts = c.segs.flatMap(s => s.p)
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
    c.bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    // مساحة تقريبية بإشارة الاتجاه (لتمييز الثقوب)
    const ends = c.segs.map(s => s.p[s.p.length - 1]); let a = 0
    for (let k = 0; k < ends.length; k++) { const [x1, y1] = ends[k], [x2, y2] = ends[(k + 1) % ends.length]; a += x1 * y2 - x2 * y1 }
    c.area = a / 2
  }
  return contours
}

export const contourD = (c, f = n => +n.toFixed(2)) =>
  c.segs.map(s => s.c + s.p.map(([x, y]) => f(x) + ' ' + f(y)).join(' ')).join(' ') + 'Z'
