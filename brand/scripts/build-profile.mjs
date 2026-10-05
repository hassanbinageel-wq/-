// معاينة شكل الحساب: صورة الحساب + الهايلايت + شبكة 9 منشورات (قص 3:4 كما تعرضه الشبكة)
import fs from 'node:fs'
import path from 'node:path'
import { OUT, DIST } from '../lib/out.mjs'
import { page, uri } from '../lib/tpl.mjs'
import { renderToFile, closeBrowser } from '../lib/browser.mjs'
import { C } from '../lib/palette.mjs'
import * as M from '../lib/marks.mjs'
import { HIGHLIGHTS } from '../templates/highlights.mjs'
const D = OUT('07_Highlights', 'Instagram_Profile_Preview')
const jpg = (p) => 'data:image/jpeg;base64,' + fs.readFileSync(p).toString('base64')
const png = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')
const V = path.join(DIST, '04_Post_Templates', 'Previews')
const order = ['01_Product', '04_New_Arrivals', '07_Tips', '03_Sale', '08_Store_Announcement', '05_Newborn_Gift', '06_Customer_Review', '02_Collection_Set', '09a_Carousel_Cover']
const grid = order.map((id) => `<div style="width:356px;height:475px;overflow:hidden;background:#eee"><img src="${jpg(path.join(V, `Post_${id}_4x5_1080x1350_Example.jpg`))}" style="height:475px;width:380px;margin-right:-12px"></div>`).join('')
const hl = HIGHLIGHTS.map(([id, label]) => `<div style="text-align:center;width:116px"><div style="width:110px;height:110px;border-radius:50%;padding:4px;border:2px solid ${C.line};margin:auto"><img style="width:100%;height:100%;border-radius:50%;object-fit:cover" src="${png(path.join(DIST, '07_Highlights', 'PNG_Square_1080x1080', `Highlight_${id}.png`))}"></div><div class="t c body" style="font-size:19px;margin-top:8px">${label}</div></div>`).join('')
const html = page(`<div style="padding:40px 0 0;background:#fff;height:100%">
<div style="display:flex;align-items:center;gap:40px;padding:0 40px;direction:rtl"><img style="width:190px;height:190px;border-radius:50%;border:1px solid ${C.line}" src="${uri(M.avatarSVG('light'))}"><div class="t"><div class="title" style="font-size:40px">غيمة</div><div class="body" style="font-size:24px;line-height:1.6;margin-top:6px">ملابس وأطقم وهدايا المواليد بلطف<br>للطلب: الرابط أدناه · التوصيل داخل المدن المتاحة<br><span class="muted">(نص تعريفي تجريبي)</span></div></div></div>
<div style="display:flex;gap:18px;padding:36px 30px 30px;direction:rtl;overflow:hidden">${hl}</div>
<div style="display:grid;grid-template-columns:repeat(3,356px);gap:6px;justify-content:center;direction:rtl">${grid}</div>
<div class="t c muted body" style="font-size:20px;padding:22px">معاينة توضيحية لشكل الحساب — كل منشور مستقل ومفهوم وحده، ولا تعتمد الشبكة على صورة مقسمة</div></div>`, 1080, 2080, '#fff')
await renderToFile(html, 1080, 2080, path.join(D, 'Instagram_Profile_Preview.jpg'))
await closeBrowser()
console.log('profile done')
