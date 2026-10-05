// محرك التصميم: صفحة HTML بطبقات (data-layer) → PNG/JPG + PSD بطبقات منفصلة وقابلة للتعديل
import fs from 'node:fs'
import path from 'node:path'
import { writePsdBuffer } from 'ag-psd'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { openPage } from './browser.mjs'

const PS_FONTS = {
  'Readex Pro': { 300: 'ReadexPro-Light', 400: 'ReadexPro-Regular', 500: 'ReadexPro-Medium', 600: 'ReadexPro-SemiBold', 700: 'ReadexPro-Bold' },
  'IBM Plex Sans Arabic': { 400: 'IBMPlexSansArabic-Regular', 500: 'IBMPlexSansArabic-Medium', 600: 'IBMPlexSansArabic-SemiBold', 700: 'IBMPlexSansArabic-Bold' },
}
const psFont = (family, weight) => {
  const fam = Object.keys(PS_FONTS).find((f) => family.includes(f)) || 'Readex Pro'
  const ws = PS_FONTS[fam]; const w = Object.keys(ws).map(Number).reduce((a, b) => (Math.abs(b - weight) < Math.abs(a - weight) ? b : a))
  return ws[w]
}
const rgb = (css) => { const m = css.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2] } }

async function decode(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height); const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
  const d = ctx.getImageData(0, 0, img.width, img.height)
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(d.data) }
}
// يقص الحواف الشفافة لتقليل حجم الملف
function trim(img, left, top) {
  const { width: w, height: h, data } = img
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (x1 < 0) return null
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1, out = new Uint8ClampedArray(nw * nh * 4)
  for (let y = 0; y < nh; y++) out.set(data.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + nw) * 4), y * nw * 4)
  return { img: { width: nw, height: nh, data: out }, left: left + x0, top: top + y0 }
}

/**
 * يصدّر تصميماً: { html, w, h, png?, jpg?, psd?, guides?: {v:[], h:[]} }
 * طبقات PSD: كل عنصر [data-layer] (بترتيب DOM من الأسفل للأعلى)
 *   data-kind="text" → طبقة نص قابلة للتعديل + صورتها
 *   data-clip="1"    → قناع قص على الطبقة التي تحته (لاستبدال الصورة داخل الإطار)
 *   data-hidden="1"  → طبقة مخفية (شبكة، مناطق أمان)
 *   data-group="..." → مجلد طبقات
 */
export async function exportDesign({ html, w, h, png, jpg, psd, guides, jpgQuality = 92, dpi = 72 }) {
  const page = await openPage(html, w, h)
  const full = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: w, height: h } })
  if (png) { fs.mkdirSync(path.dirname(png), { recursive: true }); fs.writeFileSync(png, full) }
  if (jpg) { fs.mkdirSync(path.dirname(jpg), { recursive: true }); await page.screenshot({ path: jpg, type: 'jpeg', quality: jpgQuality, clip: { x: 0, y: 0, width: w, height: h } }) }
  if (psd) {
    const meta = await page.evaluate(() => {
      const els = [...document.querySelectorAll('[data-layer]')]
      return els.map((el, i) => {
        el.dataset.li = i
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el)
        const o = { i, name: el.dataset.layer, kind: el.dataset.kind || 'pixel', clip: el.dataset.clip === '1', hidden: el.dataset.hidden === '1', group: el.dataset.group || '', x: r.left, y: r.top, w: r.width, h: r.height }
        if (o.kind === 'text') {
          const t = el.querySelector('[data-text]') || el
          const tr = t.getBoundingClientRect(); const ts = getComputedStyle(t)
          o.text = { str: t.innerText, family: ts.fontFamily, weight: +ts.fontWeight, size: parseFloat(ts.fontSize), color: ts.color, lh: parseFloat(ts.lineHeight) || parseFloat(ts.fontSize) * 1.3, align: ts.textAlign, x: tr.left, y: tr.top, w: tr.width, h: tr.height }
        }
        return o
      })
    })
    const layers = []
    for (const m of meta) {
      // عزل الطبقة: إخفاء البقية وإزالة الخلفية
      await page.evaluate(({ i, clip }) => {
        document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent'
        for (const el of document.querySelectorAll('[data-layer]')) { el.style.visibility = +el.dataset.li === i ? 'visible' : 'hidden'; if (+el.dataset.li === i && clip) { el.dataset.r = el.style.borderRadius; el.style.borderRadius = '0'; el.style.clipPath = 'none' } }
      }, { i: m.i, clip: m.clip })
      const pad = m.kind === 'text' ? 24 : 2
      const x = Math.max(0, Math.floor(m.x - pad)), y = Math.max(0, Math.floor(m.y - pad))
      const x2 = Math.min(w, Math.ceil(m.x + m.w + pad)), y2 = Math.min(h, Math.ceil(m.y + m.h + pad))
      let img = null
      if (x2 > x && y2 > y) {
        const buf = await page.screenshot({ type: 'png', omitBackground: true, clip: { x, y, width: x2 - x, height: y2 - y } })
        img = trim(await decode(buf), x, y)
      }
      await page.evaluate(({ i, clip }) => { const el = document.querySelector(`[data-li="${i}"]`); if (clip) { el.style.borderRadius = el.dataset.r || ''; el.style.clipPath = '' } }, { i: m.i, clip: m.clip })
      const L = { name: m.name, hidden: m.hidden, clipping: m.clip, opacity: 1 }
      if (img) { L.left = img.left; L.top = img.top; L.imageData = img.img } else { L.left = 0; L.top = 0; L.imageData = { width: 1, height: 1, data: new Uint8ClampedArray(4) } }
      if (m.text) {
        const t = m.text
        L.text = {
          text: t.str.replace(/\n/g, '\r'),
          transform: [1, 0, 0, 1, Math.round(t.x), Math.round(t.y)],
          shapeType: 'box', boxBounds: [0, 0, Math.ceil(t.w) + 4, Math.ceil(t.h) + Math.round(t.size * 0.4)],
          antiAlias: 'smooth',
          style: { font: { name: psFont(t.family, t.weight) }, fontSize: Math.round(t.size * 100) / 100, fillColor: rgb(t.color), autoLeading: false, leading: Math.round(t.lh), characterDirection: 2, kashida: 0 },
          paragraphStyle: { justification: t.align === 'center' ? 'center' : t.align === 'left' ? 'left' : 'right' },
        }
      }
      L._group = m.group
      layers.push(L)
    }
    // تجميع المجلدات مع الحفاظ على الترتيب
    const children = []
    for (const L of layers) {
      const g = L._group; delete L._group
      if (g) { let last = children[children.length - 1]; if (!last || last.name !== g || !last.children) { last = { name: g, opened: true, children: [] }; children.push(last) } last.children.push(L) } else children.push(L)
    }
    const comp = await decode(full)
    const doc = { width: w, height: h, imageData: comp, children }
    doc.imageResources = { resolutionInfo: { horizontalResolution: dpi, horizontalResolutionUnit: 'PPI', widthUnit: dpi > 72 ? 'Centimeters' : 'Inches', verticalResolution: dpi, verticalResolutionUnit: 'PPI', heightUnit: dpi > 72 ? 'Centimeters' : 'Inches' } }
    if (guides) doc.imageResources.gridAndGuidesInformation = { grid: { horizontal: 18 * 32, vertical: 18 * 32 }, guides: [...(guides.v || []).map((l) => ({ location: l, direction: 'vertical' })), ...(guides.h || []).map((l) => ({ location: l, direction: 'horizontal' }))] }
    fs.mkdirSync(path.dirname(psd), { recursive: true })
    fs.writeFileSync(psd, writePsdBuffer(doc, { useImageData: true, compress: false, noBackground: false }))
  }
  await page.close()
}
