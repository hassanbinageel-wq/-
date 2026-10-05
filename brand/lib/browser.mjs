// متصفح Chromium واحد لكل عمليات التصيير (PNG/JPG/PDF وطبقات PSD)
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('/opt/node22/lib/node_modules/playwright')
const here = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.join(here, '..')
let browser
// الصفحات تُفتح من ملف (لا من الذاكرة) حتى يُسمح بتحميل الخطوط المحلية
import fs from 'node:fs'
let tmpN = 0
const TMPDIR = path.join(here, '..', 'lab', 'tmp'); fs.mkdirSync(TMPDIR, { recursive: true })
function tmpFile(html) { const f = path.join(TMPDIR, `p${process.pid}_${tmpN++ % 50}.html`); fs.writeFileSync(f, html); return 'file://' + f }
export async function getBrowser() {
  if (!browser) browser = await chromium.launch()
  return browser
}
export async function closeBrowser() { if (browser) await browser.close(); browser = null }

const F = (f) => 'file://' + path.join(ROOT, 'assets/fonts', f)
export const FONT_CSS = `
@font-face{font-family:'Readex Pro';src:url('${F('ReadexPro-Regular.ttf')}');font-weight:400}
@font-face{font-family:'Readex Pro';src:url('${F('ReadexPro-Medium.ttf')}');font-weight:500}
@font-face{font-family:'Readex Pro';src:url('${F('ReadexPro-SemiBold.ttf')}');font-weight:600}
@font-face{font-family:'Readex Pro';src:url('${F('ReadexPro-Bold.ttf')}');font-weight:700}
@font-face{font-family:'Readex Pro';src:url('${F('ReadexPro-Regular.ttf')}');font-weight:300}
@font-face{font-family:'IBM Plex Sans Arabic';src:url('${F('IBMPlexSansArabic-Regular.ttf')}');font-weight:400}
@font-face{font-family:'IBM Plex Sans Arabic';src:url('${F('IBMPlexSansArabic-Medium.ttf')}');font-weight:500}
@font-face{font-family:'IBM Plex Sans Arabic';src:url('${F('IBMPlexSansArabic-SemiBold.ttf')}');font-weight:600}
@font-face{font-family:'IBM Plex Sans Arabic';src:url('${F('IBMPlexSansArabic-Bold.ttf')}');font-weight:700}
`

/** يفتح صفحة HTML بمقاس محدد ويعيدها بعد تحميل الخطوط والصور */
export async function openPage(html, w, h, { scale = 1 } = {}) {
  const b = await getBrowser()
  const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale })
  await page.goto(tmpFile(html), { waitUntil: 'load' })
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); if (window.__layout) window.__layout() })
  return page
}

export async function renderToFile(html, w, h, out, { type, transparent = false, quality = 92, scale = 1 } = {}) {
  const page = await openPage(html, w, h, { scale })
  const t = type || (out.endsWith('.jpg') ? 'jpeg' : 'png')
  await page.screenshot({ path: out, type: t, omitBackground: transparent, quality: t === 'jpeg' ? quality : undefined, clip: { x: 0, y: 0, width: w, height: h } })
  await page.close()
}

export async function renderPdf(html, out, { width, height }) {
  const b = await getBrowser()
  const page = await b.newPage()
  await page.goto(tmpFile(html), { waitUntil: 'load' })
  await page.evaluate(async () => { await document.fonts.ready })
  await page.pdf({ path: out, width, height, printBackground: true, preferCSSPageSize: true })
  await page.close()
}

export const doc = (body, css = '', { dir = 'rtl', bg = 'transparent' } = {}) =>
  `<!doctype html><html lang="ar" dir="${dir}"><head><meta charset="utf-8"><style>${FONT_CSS}*{box-sizing:border-box;margin:0;padding:0}html,body{background:${bg};-webkit-font-smoothing:antialiased}${css}</style></head><body>${body}</body></html>`

/** يحول SVG إلى PNG شفاف بعرض محدد */
export async function svgToPng(svgStr, out, width, { bg = 'transparent' } = {}) {
  const m = svgStr.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  const ratio = +m[2] / +m[1]
  const w = Math.round(width), h = Math.round(width * ratio)
  const html = doc(`<img src="data:image/svg+xml;base64,${Buffer.from(svgStr).toString('base64')}" style="display:block;width:${w}px;height:${h}px">`, '', { bg })
  await renderToFile(html, w, h, out, { transparent: bg === 'transparent' })
}
