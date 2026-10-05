// 02_Colors_Fonts و03_Graphic_Elements
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { OUT } from '../lib/out.mjs'
import { PALETTE, rgb, contrast, C } from '../lib/palette.mjs'
import { svgToPng, closeBrowser, ROOT, renderToFile } from '../lib/browser.mjs'
import * as E from '../lib/elements.mjs'
import { ICONS, iconSVG } from '../lib/icons.mjs'
import { page } from '../lib/tpl.mjs'

// ——— الألوان ———
const CD = OUT('02_Colors_Fonts', 'Colors')
const cmyk = (hex) => { const [r, g, b] = rgb(hex).map((v) => v / 255); const k = 1 - Math.max(r, g, b); if (k >= 1) return [0, 0, 0, 100]; return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map((v) => Math.round(v * 100)) }
export const COLORS = PALETTE.map((p) => ({ ...p, rgb: rgb(p.hex), cmyk: cmyk(p.hex) }))
fs.writeFileSync(path.join(CD, 'ghayma-colors.json'), JSON.stringify(COLORS.map(({ key, name, en, hex, rgb, cmyk, role }) => ({ key, name, en, hex, rgb, cmyk_suggested: cmyk, role })), null, 2))
fs.writeFileSync(path.join(CD, 'ghayma-colors.css'), ':root {\n' + COLORS.map((c) => `  --ghayma-${c.key}: ${c.hex}; /* ${c.name} */`).join('\n') + '\n}\n')
// ملف ASE لاستيراد الألوان في فوتوشوب/إليستريتر
function ase(colors) {
  const blocks = colors.map((c) => {
    const name = `Ghayma ${c.en}`; const nb = Buffer.alloc(2 + (name.length + 1) * 2); nb.writeUInt16BE(name.length + 1, 0)
    for (let i = 0; i < name.length; i++) nb.writeUInt16BE(name.charCodeAt(i), 2 + i * 2)
    const body = Buffer.alloc(4 + 12 + 2); body.write('RGB ', 0, 'ascii'); c.rgb.forEach((v, i) => body.writeFloatBE(v / 255, 4 + i * 4)); body.writeUInt16BE(0, 16)
    const data = Buffer.concat([nb, body]); const head = Buffer.alloc(6); head.writeUInt16BE(1, 0); head.writeUInt32BE(data.length, 2)
    return Buffer.concat([head, data])
  })
  const h = Buffer.alloc(12); h.write('ASEF', 0, 'ascii'); h.writeUInt16BE(1, 4); h.writeUInt16BE(0, 6); h.writeUInt32BE(blocks.length, 8)
  return Buffer.concat([h, ...blocks])
}
fs.writeFileSync(path.join(CD, 'Ghayma_Swatches.ase'), ase(COLORS))
// لوحة الألوان كصورة
const sw = COLORS.map((c) => `<div style="width:230px;border-radius:28px;overflow:hidden;background:#fff;box-shadow:0 2px 0 ${C.line}"><div style="height:200px;background:${c.hex};border-bottom:1px solid ${C.line}"></div><div style="padding:18px 20px" class="t"><div class="title" style="font-size:26px">${c.name}</div><div class="body muted" style="font-size:17px;direction:ltr;text-align:right">${c.en} · ${c.hex}<br>RGB ${c.rgb.join(' ')}<br>CMYK ${c.cmyk.join(' ')}*</div></div></div>`).join('')
const palHtml = page(`<div style="padding:60px"><div class="t display" style="font-size:52px">ألوان غيمة</div><div class="t body muted" style="font-size:22px;margin:8px 0 36px">* قيم CMYK مقترحة للطباعة، راجعوها مع المطبعة حسب ملف تعريف الألوان والورق.</div><div style="display:flex;flex-wrap:wrap;gap:26px;direction:rtl">${sw}</div></div>`, 1740, 1130)
await renderToFile(palHtml, 1740, 1130, path.join(CD, 'Ghayma_Color_Palette.png'))

// ——— الخطوط ———
const FD = OUT('02_Colors_Fonts', 'Fonts')
const F = path.join(ROOT, 'assets/fonts')
for (const f of ['IBMPlexSansArabic-Regular.ttf', 'IBMPlexSansArabic-Medium.ttf', 'IBMPlexSansArabic-SemiBold.ttf', 'IBMPlexSansArabic-Bold.ttf', 'ReadexPro-VF.ttf', 'OFL-ibmplexsansarabic.txt', 'OFL-readexpro.txt']) fs.copyFileSync(path.join(F, f), path.join(FD, f.replace('ReadexPro-VF', 'ReadexPro[HEXP,wght]-Variable')))
for (const [w, n] of [[400, 'Regular'], [500, 'Medium'], [600, 'SemiBold'], [700, 'Bold']]) {
  const out = path.join(FD, `ReadexPro-${n}.ttf`)
  execFileSync('python3', ['-c', `
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
f=TTFont(r'${path.join(F, 'ReadexPro-VF.ttf')}')
inst=instantiateVariableFont(f,{'wght':${w},'HEXP':0},updateFontNames=True)
inst.save(r'${out}')`])
}
fs.writeFileSync(path.join(FD, 'Fonts_Official_Links.txt'), `خطوط هوية غيمة — مجانية برخصة SIL Open Font License 1.1 (تسمح بالاستخدام التجاري وإعادة التوزيع مع الرخصة)

1) Readex Pro — العناوين والأسعار والأزرار
   الصفحة الرسمية: https://fonts.google.com/specimen/Readex+Pro
   المصدر: https://github.com/ThomasJockin/readexpro
   الملفات المرفقة: ReadexPro-Regular/Medium/SemiBold/Bold.ttf (نسخ ثابتة مستخرجة من الخط المتغير الرسمي) + الخط المتغير الأصلي.

2) IBM Plex Sans Arabic — النصوص والوصف
   الصفحة الرسمية: https://fonts.google.com/specimen/IBM+Plex+Sans+Arabic
   المصدر: https://github.com/IBM/plex

حروف الشعار «غيمة» ليست خطاً للكتابة: هي رسم خاص (مسارات) مبني على هيكل خط Baloo Bhaijaan 2 (رخصة OFL)
مع تعديل نقطة الغين إلى «نقطة الغيمة». لا تكتبوا الاسم بأي خط بدلاً من ملفات الشعار.
مصدر خط الأساس: https://fonts.google.com/specimen/Baloo+Bhaijaan+2

التثبيت: افتحوا ملف TTF ثم «تثبيت» (ويندوز/ماك). أعيدوا تشغيل فوتوشوب بعد التثبيت.
`)

// ——— العناصر المساندة ———
const G = (...p) => OUT('03_Graphic_Elements', ...p)
const both = async (dir, name, s, w) => { fs.writeFileSync(path.join(dir, name + '.svg'), s); await svgToPng(s, path.join(dir, name + '.png'), w) }
for (const v of Object.keys(E.PATTERNS)) {
  await both(G('Pattern'), `Pattern_Tile_${v}`, E.patternTile(v, { size: 360 }), 720)
  await svgToPng(E.patternSheet(v, 2160, 2160, { size: 360 }), path.join(G('Pattern'), `Pattern_Sheet_${v}_2160px.png`), 2160)
}
await both(G('Pattern'), 'Pattern_Tile_Transparent_Cotton', E.patternTile('cotton', { size: 360, bg: false }), 720)
for (const k of Object.keys(E.FRAMES)) await both(G('Photo_Frames'), `Frame_${k}`, E.frameSVG(k, 800, k === 'circle' ? 800 : 1000), 800)
for (const [k, f] of Object.entries(E.DIVIDERS)) await both(G('Dividers'), `Divider_${k}`, f(), 1200)
for (const [k, s] of Object.entries(E.STICKERS)) await both(G('Stickers'), `Sticker_${k}`, s.svg(), 600)
for (const k of Object.keys(ICONS)) {
  fs.writeFileSync(path.join(G('Icons', 'SVG'), `Icon_${k}.svg`), iconSVG(k))
  await svgToPng(iconSVG(k), path.join(G('Icons', 'PNG_Ink'), `Icon_${k}.png`), 256)
  await svgToPng(iconSVG(k, { color: '#FFFFFF' }), path.join(G('Icons', 'PNG_White'), `Icon_${k}.png`), 256)
}
for (const k of ['primary', 'accent', 'secondary', 'light']) await both(G('Buttons_Price_Cards'), `Button_${k}`, E.buttonSVG(k, 'اطلبوا الآن'), 600)
await both(G('Buttons_Price_Cards'), 'Price_Card_Regular', E.priceCardSVG({ price: '89' }), 1040)
await both(G('Buttons_Price_Cards'), 'Price_Card_Sale', E.priceCardSVG({ price: '55', old: '69', name: 'بيجامة الضباب' }), 1040)
await closeBrowser()
console.log('kit done')
