// صور منتجات توضيحية (رسوم) بأسلوب تصوير الهوية — تُستبدل بصور المنتجات الحقيقية
import fs from 'node:fs'
import path from 'node:path'
import { garmentSvg } from '../lib/demo-art.ts'
import { renderToFile, doc, ROOT, closeBrowser } from '../lib/browser.mjs'
import { C } from '../lib/palette.mjs'

const OUT = path.join(ROOT, 'assets/illustrated')
fs.mkdirSync(OUT, { recursive: true })
const uri = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
const grain = `url("data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.24 0 0 0 0 0.2 0 0 0 0 0.28 0 0 0 0.09 0"/></filter><rect width="300" height="300" filter="url(#n)"/></svg>').toString('base64')}")`

// [ملف، القطع: [نوع، لون، إبراز، x%, y%, عرض%, دوران], الخلفية]
const SCENES = [
  ['ph01-onesie', [['onesie', '#E9DCC7', C.apricot, 50, 52, 64, 0]], [C.cotton, C.sand]],
  ['ph02-jacket', [['jacket', '#B9CBB2', '#8EA587', 50, 52, 62, 0]], [C.milk, '#EDE6DA']],
  ['ph03-romper', [['romper', '#F3C4A4', C.cotton, 50, 50, 56, 0]], [C.cotton, C.sand]],
  ['ph04-pajama', [['pajama', '#D5E0E8', '#A9BBC9', 50, 52, 60, 0]], [C.milk, C.mist]],
  ['ph05-dress', [['dress', '#EFE3D3', C.apricot, 50, 52, 58, 0]], [C.cotton, '#F1E4D2']],
  ['ph06-onesie-long', [['onesie-long', '#FBF8F2', '#D9CBB6', 50, 52, 66, 0]], [C.sand, '#E9DCCB']],
  ['ph07-set', [['onesie', '#E9DCC7', C.apricot, 36, 50, 42, -6], ['bib', '#B9CBB2', '#8EA587', 66, 40, 26, 8], ['romper', '#F3C4A4', C.cotton, 68, 72, 30, 6]], [C.cotton, C.sand]],
  ['ph08-trio', [['onesie', '#FBF8F2', '#D9CBB6', 22, 52, 34, 0], ['jacket', '#B9CBB2', '#8EA587', 50, 52, 34, 0], ['romper', '#F3C4A4', C.cotton, 78, 52, 34, 0]], [C.milk, C.sand]],
]

for (const [name, items, [bg1, bg2]] of SCENES) {
  for (const [suffix, w, h] of [['', 1600, 2000], ['-sq', 1600, 1600]]) {
    const pieces = items.map(([art, col, acc, x, y, wd, rot]) => `<img src="${uri(garmentSvg(art, col, acc))}" style="position:absolute;left:${x}%;top:${y}%;width:${wd}%;transform:translate(-50%,-50%) rotate(${rot}deg);filter:drop-shadow(0 28px 34px rgba(61,51,71,.16)) drop-shadow(0 4px 6px rgba(61,51,71,.10))">`).join('')
    const html = doc(`<div style="position:absolute;inset:0;background:radial-gradient(120% 90% at 30% 20%, ${bg1} 0%, ${bg2} 100%)"></div>
      <div style="position:absolute;inset:0;background:linear-gradient(115deg, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 45%)"></div>${pieces}
      <div style="position:absolute;inset:0;background-image:${grain};opacity:.9"></div>`)
    await renderToFile(html, w, h, path.join(OUT, name + suffix + '.jpg'), { quality: 90 })
  }
}
await closeBrowser()
console.log('photos done', fs.readdirSync(OUT).length)
