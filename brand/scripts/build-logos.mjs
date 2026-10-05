// 01_Logos: كل نسخ الشعار SVG + PNG شفاف + صورة الحساب + أيقونات الموقع
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import * as M from '../lib/marks.mjs'
import { svgToPng, closeBrowser } from '../lib/browser.mjs'
import { OUT } from '../lib/out.mjs'
import { C } from '../lib/palette.mjs'

const D = OUT('01_Logos')
const dirs = { svg: path.join(D, 'SVG'), png: path.join(D, 'PNG_Transparent'), prof: path.join(D, 'Profile_Picture'), fav: path.join(D, 'Favicon_Website_Icon') }
Object.values(dirs).forEach((d) => fs.mkdirSync(d, { recursive: true }))
const CW = { Color: 'color', ColorOnDark: 'reverse', OneColor: 'mono', Black: 'black', White: 'white' }
const sets = [
  ['Ghayma_Logo_Primary', M.wordmarkSVG, [600, 1200, 2400]],
  ['Ghayma_Logo_Horizontal', M.horizontalSVG, [1200, 2400]],
  ['Ghayma_Logo_Stacked', M.stackedSVG, [800, 1600]],
  ['Ghayma_Symbol', M.symbolSVG, [256, 512, 1024]],
  ['Ghayma_Symbol_Circle', M.badgeSVG, [256, 512, 1024]],
]
for (const [base, fn, sizes] of sets) for (const [suffix, key] of Object.entries(CW)) {
  const s = fn(M.COLORWAYS[key])
  fs.writeFileSync(path.join(dirs.svg, `${base}_${suffix}.svg`), s)
  for (const w of sizes) await svgToPng(s, path.join(dirs.png, `${base}_${suffix}_${w}px.png`), w)
}
// العبارة الوصفية (عنصر اختياري منفصل)
const T = path.join(D, 'Optional_Tagline'); fs.mkdirSync(T, { recursive: true })
fs.writeFileSync(path.join(T, 'Ghayma_Tagline_Outlined_Ink.svg'), M.taglineSVG(C.ink))
fs.writeFileSync(path.join(T, 'Ghayma_Tagline_Outlined_White.svg'), M.taglineSVG('#FFFFFF'))
fs.writeFileSync(path.join(T, 'Ghayma_Tagline_EditableText_ReadexPro.svg'), M.taglineSVG(C.ink, { live: true }))
for (const [k, key] of [['Color', 'color'], ['White', 'white'], ['ColorOnDark', 'reverse']]) {
  const s = M.wordmarkWithTaglineSVG(M.COLORWAYS[key]); fs.writeFileSync(path.join(T, `Ghayma_Logo_With_Tagline_${k}.svg`), s)
  await svgToPng(s, path.join(T, `Ghayma_Logo_With_Tagline_${k}_1600px.png`), 1600)
}
await svgToPng(M.taglineSVG(C.ink), path.join(T, 'Ghayma_Tagline_Ink_1200px.png'), 1200)
// صورة الحساب
for (const v of ['light', 'dark']) {
  const s = M.avatarSVG(v); const n = v === 'light' ? 'Ghayma_Profile_Picture_Cotton' : 'Ghayma_Profile_Picture_Ink'
  fs.writeFileSync(path.join(dirs.prof, n + '.svg'), s)
  await svgToPng(s, path.join(dirs.prof, n + '_1080px.png'), 1080)
}
// أيقونة الموقع
const fav = M.faviconSVG(); fs.writeFileSync(path.join(dirs.fav, 'favicon.svg'), fav)
for (const w of [16, 32, 48, 180, 192, 512]) await svgToPng(fav, path.join(dirs.fav, w === 180 ? 'apple-touch-icon-180.png' : `icon-${w}.png`), w)
execFileSync('convert', ['icon-16.png', 'icon-32.png', 'icon-48.png', 'favicon.ico'], { cwd: dirs.fav })
await closeBrowser()
console.log('logos done')
