// 08_Packaging: PDF للطباعة (مقاس حقيقي + نزف + علامات قص) + PSD + PNG مسطح + معاينات
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { OUT } from '../lib/out.mjs'
import { ITEMS, BLEED, printPage } from '../templates/packaging.mjs'
import { exportDesign } from '../lib/design.mjs'
import { page } from '../lib/tpl.mjs'
import { renderPdf, closeBrowser, renderToFile } from '../lib/browser.mjs'
import { C } from '../lib/palette.mjs'

const PDF = OUT('08_Packaging', 'Print_PDF'), PSD = OUT('08_Packaging', 'PSD_Editable'), FLAT = OUT('08_Packaging', 'Flat_Designs_PNG'), MOCK = OUT('08_Packaging', 'Mockup_Previews')
const flats = {}
for (const it of ITEMS) {
  const parts = []
  for (const side of Object.keys(it.sides)) {
    const k = it.dpi / 25.4, W = Math.round((it.trim[0] + 2 * BLEED) * k), H = Math.round((it.trim[1] + 2 * BLEED) * k)
    const html = page(it.sides[side](k, W, H), W, H)
    const png = path.join(FLAT, `${it.id}_${side}.png`)
    await exportDesign({ html, w: W, h: H, png, psd: path.join(PSD, `${it.id}_${side}_${it.dpi}dpi.psd`), dpi: it.dpi, guides: { v: [BLEED * k, W - BLEED * k], h: [BLEED * k, H - BLEED * k] } })
    flats[`${it.id}_${side}`] = png
    const pp = printPage(it, side); const out = path.join(PDF, `_${it.id}_${side}.pdf`)
    await renderPdf(pp.html, out, { width: pp.pw + 'mm', height: pp.ph + 'mm' })
    parts.push(out)
  }
  // دمج الأوجه في ملف واحد
  execFileSync('python3', ['-c', `
import sys
from pypdf import PdfWriter
w=PdfWriter()
for f in sys.argv[2:]: w.append(f)
w.write(sys.argv[1])`, path.join(PDF, `${it.id}.pdf`), ...parts])
  parts.forEach((p) => fs.rmSync(p))
}
fs.writeFileSync(path.join(OUT('08_Packaging'), 'Packaging_Sizes_and_Print_Notes.txt'), `مقاسات التغليف المقترحة — غيمة
${ITEMS.map((i) => `• ${i.ar}: ${i.size}`).join('\n')}

ملاحظات الطباعة (مهم):
- ملفات PDF بالمقاس الحقيقي مع نزف ${BLEED} ملم وعلامات قص. الألوان RGB؛ المطبعة تحوّلها إلى CMYK حسب ملف تعريف الورق.
- قيم CMYK المقترحة في 02_Colors_Fonts للاسترشاد فقط ويجب اعتمادها ببروفة مطبوعة.
- خطوط القص والطي في ملفات PSD (طبقة مخفية) للتوضيح فقط. قبل الإنتاج اطلبوا قالب القص (Die-line) المعتمد من المطبعة وطابقوا التصميم عليه.
- ملفات PSD للبطاقات والملصقات بدقة 300 نقطة/بوصة، وللكيس والصندوق وورق التغليف 150 نقطة/بوصة؛ للطباعة النهائية استخدموا PDF أو صدّروا من القالب المعتمد بدقة 300.
`)
// ——— معاينات (موك أب مبسط) ———
const img = (k) => 'data:image/png;base64,' + fs.readFileSync(flats[k]).toString('base64')
const scene = (inner, w, h) => page(`<div style="position:absolute;inset:0;background:radial-gradient(120% 90% at 30% 10%, ${C.milk}, ${C.sand})"></div>${inner}<div style="position:absolute;left:30px;top:24px;font:500 22px 'Readex Pro';color:${C.muted};direction:rtl">معاينة توضيحية — ليست صورة إنتاج</div>`, w, h)
const cropFront = `object-fit:cover;object-position:68.5% 60%`
const bag = `<div style="position:absolute;left:150px;top:260px;width:440px;height:600px;perspective:1600px"><div style="position:absolute;left:120px;top:-120px;width:200px;height:170px;border:14px solid ${C.ink};border-bottom:none;border-radius:100px 100px 0 0"></div><div style="position:absolute;inset:0;overflow:hidden;border-radius:6px;box-shadow:0 40px 60px rgba(61,51,71,.25);transform:rotateY(-8deg)"><img src="${img('Shopping_Bag_Flat_flat')}" style="position:absolute;height:100%;left:-${(373 / 726) * 600 * (726 / 436)}px;top:0"></div></div>`
const box = `<div style="position:absolute;left:700px;top:520px;width:600px;height:400px;transform:rotate(-4deg)"><div style="position:absolute;inset:40px 0 0 0;background:${C.ink};border-radius:8px;box-shadow:0 40px 60px rgba(61,51,71,.3)"></div><div style="position:absolute;left:-10px;top:-10px;width:620px;height:420px;overflow:hidden;border-radius:8px;box-shadow:0 20px 30px rgba(0,0,0,.2)"><img src="${img('Gift_Box_Lid_Net_flat')}" style="position:absolute;width:${620 * 366 / 300}px;left:-${620 * 33 / 300}px;top:-${420 * 33 / 200}px"></div></div>`
const cards = `<img src="${img('Thank_You_Card_A6_front')}" style="position:absolute;left:1380px;top:220px;width:300px;transform:rotate(6deg);box-shadow:0 20px 40px rgba(61,51,71,.2)"><img src="${img('Gift_Message_Card_front')}" style="position:absolute;left:1360px;top:720px;width:300px;transform:rotate(-8deg);box-shadow:0 20px 40px rgba(61,51,71,.2)"><img src="${img('Seal_Sticker_ink')}" style="position:absolute;left:1180px;top:300px;width:150px;border-radius:50%;box-shadow:0 10px 20px rgba(61,51,71,.2)"><img src="${img('Product_Hang_Tag_front')}" style="position:absolute;left:820px;top:140px;width:150px;border-radius:10px;transform:rotate(-10deg);box-shadow:0 20px 40px rgba(61,51,71,.2)"><img src="${img('Care_Instructions_Card_back')}" style="position:absolute;left:1010px;top:110px;width:210px;transform:rotate(5deg);box-shadow:0 20px 40px rgba(61,51,71,.2)">`
await renderToFile(scene(bag + box + cards, 1800, 1100), 1800, 1100, path.join(MOCK, 'Packaging_Set_Preview.jpg'))
const paper = `<div style="position:absolute;left:200px;top:150px;width:1400px;height:800px;overflow:hidden;border-radius:6px;transform:rotate(-3deg);box-shadow:0 40px 70px rgba(61,51,71,.25)"><img src="${img('Wrapping_Paper_cotton')}" style="width:100%"></div><img src="${img('Seal_Sticker_apricot')}" style="position:absolute;left:820px;top:470px;width:200px;border-radius:50%;box-shadow:0 10px 20px rgba(61,51,71,.25)">`
await renderToFile(scene(paper, 1800, 1100), 1800, 1100, path.join(MOCK, 'Wrapping_Paper_Preview.jpg'))
await closeBrowser()
console.log('packaging done')
