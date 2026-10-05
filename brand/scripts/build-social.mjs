// 04–07: قوالب المنشورات والستوري والريلز والهايلايت + معاينة الحساب
import fs from 'node:fs'
import path from 'node:path'
import { exportDesign } from '../lib/design.mjs'
import { closeBrowser, renderToFile } from '../lib/browser.mjs'
import { OUT } from '../lib/out.mjs'
import { showHidden, page, L } from '../lib/tpl.mjs'
import { POSTS } from '../templates/posts.mjs'
import { STORIES, W as SW, H as SH, SAFE_TOP, SAFE_BOTTOM } from '../templates/stories.mjs'
import { REELS, OVERLAYS, overlayOnly, W as RW, H as RH } from '../templates/reels.mjs'
import { HIGHLIGHTS, highlight } from '../templates/highlights.mjs'

const only = process.argv[2]
const run = (k) => !only || only === k
const G = (W, H, m = 72, t = m, b = m) => ({ v: [m, W - m, W / 2], h: [t, H - b] })

if (run('posts')) {
  const P = OUT('04_Post_Templates', 'PSD_Editable'), V = OUT('04_Post_Templates', 'Previews')
  for (const [id, , fn] of POSTS) for (const [W, H, n] of [[1080, 1350, '4x5_1080x1350'], [1080, 1080, '1x1_1080x1080']]) {
    await exportDesign({ html: fn({ W, H, blank: true }), w: W, h: H, psd: path.join(P, `Post_${id}_${n}_Blank.psd`), jpg: path.join(V, `Post_${id}_${n}_Blank.jpg`), guides: G(W, H) })
    await exportDesign({ html: fn({ W, H, blank: false }), w: W, h: H, psd: path.join(P, `Post_${id}_${n}_Example.psd`), jpg: path.join(V, `Post_${id}_${n}_Example.jpg`), guides: G(W, H) })
    await exportDesign({ html: fn({ W, H, blank: false, long: true }), w: W, h: H, jpg: path.join(V, `Post_${id}_${n}_LongText_Example.jpg`) })
    await exportDesign({ html: showHidden(fn({ W, H, blank: true })), w: W, h: H, jpg: path.join(V, `Post_${id}_${n}_Grid.jpg`) })
  }
  console.log('posts done')
}
if (run('stories')) {
  const P = OUT('05_Story_Templates', 'PSD_Editable'), V = OUT('05_Story_Templates', 'Previews')
  for (const [id, , fn] of STORIES) {
    const g = G(SW, SH, 80, SAFE_TOP, SAFE_BOTTOM)
    await exportDesign({ html: fn({ blank: true }), w: SW, h: SH, psd: path.join(P, `Story_${id}_Blank.psd`), jpg: path.join(V, `Story_${id}_Blank.jpg`), guides: g })
    await exportDesign({ html: fn({ blank: false }), w: SW, h: SH, psd: path.join(P, `Story_${id}_Example.psd`), jpg: path.join(V, `Story_${id}_Example.jpg`), guides: g })
    await exportDesign({ html: showHidden(fn({ blank: true })), w: SW, h: SH, jpg: path.join(V, `Story_${id}_SafeZones.jpg`) })
  }
  console.log('stories done')
}
if (run('reels')) {
  const P = OUT('06_Reels_Templates', 'PSD_Editable'), V = OUT('06_Reels_Templates', 'Previews'), O = OUT('06_Reels_Templates', 'Overlays_Transparent_PNG')
  for (const [id, , fn] of REELS) {
    await exportDesign({ html: fn({ blank: true }), w: RW, h: RH, psd: path.join(P, `${id}_Blank.psd`), jpg: path.join(V, `${id}_Blank.jpg`), guides: { v: [90, RW - 90], h: [240, RH - 240, 285, RH - 285] } })
    await exportDesign({ html: fn({ blank: false }), w: RW, h: RH, psd: path.join(P, `${id}_Example.psd`), jpg: path.join(V, `${id}_Example.jpg`) })
    await exportDesign({ html: showHidden(fn({ blank: false })), w: RW, h: RH, jpg: path.join(V, `${id}_Guides.jpg`) })
  }
  const ov = {
    Overlay_Price_Card: OVERLAYS.priceCard(), Overlay_Price_Card_Blank: OVERLAYS.priceCard({ name: 'اسم المنتج', price: '00' }),
    Overlay_Title_Bar: OVERLAYS.titleBar(), Overlay_Logo_Bug_White: OVERLAYS.logoBug(), Overlay_Logo_Bug_Color: OVERLAYS.logoBug('color'),
    Overlay_Product_Number_1: OVERLAYS.number(1, 'جاكيت محبوك'), Overlay_Product_Number_2: OVERLAYS.number(2, 'سالوبيت مشمشي'), Overlay_Product_Number_3: OVERLAYS.number(3, 'بيجامة الضباب'),
    Overlay_Packing_Step_1: OVERLAYS.step(1, 'نختار القطع بعناية'), Overlay_Packing_Step_2: OVERLAYS.step(2, 'نغلّفها بورق غيمة'), Overlay_Packing_Step_3: OVERLAYS.step(3, 'نضيف بطاقة الإهداء'), Overlay_Packing_Step_4: OVERLAYS.step(4, 'جاهز للتوصيل'),
  }
  for (const [n, h] of Object.entries(ov)) {
    await exportDesign({ html: overlayOnly(h), w: RW, h: RH, png: path.join(O, `${n}_1080x1920.png`), psd: path.join(P, `${n}.psd`) })
  }
  // معاينة القص: الغلاف كاملاً + قص الشبكة 3:4 + قص الرئيسية 4:5
  const C3 = path.join(V, 'Reel_Cover_A_Photo_Title_Example.jpg')
  const b64 = 'data:image/jpeg;base64,' + fs.readFileSync(C3).toString('base64')
  const cell = (label, h) => `<div style="text-align:center"><div style="width:360px;height:${h}px;overflow:hidden;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.12)"><img src="${b64}" style="width:360px;margin-top:${-(640 - h) / 2}px"></div><div class="t c sub" style="margin-top:14px;font-size:24px">${label}</div></div>`
  const html = page(`<div style="padding:50px;display:flex;gap:50px;align-items:flex-end;justify-content:center">${cell('الغلاف كاملاً 9:16', 640)}${cell('في الرئيسية 4:5', 450)}${cell('في شبكة الحساب 3:4', 480)}</div><div class="t c title" style="font-size:30px;margin-top:10px">العنوان والمنتج داخل المنطقة الوسطى فيبقيان ظاهرين في كل القصّات</div>`, 1380, 900)
  await renderToFile(html, 1380, 900, path.join(V, 'Reel_Cover_Crop_Preview.jpg'))
  console.log('reels done')
}
if (run('highlights')) {
  const P = OUT('07_Highlights', 'PSD_Editable'), S1 = OUT('07_Highlights', 'PNG_Story_1080x1920'), S2 = OUT('07_Highlights', 'PNG_Square_1080x1080')
  for (const [id, label, icon, circle] of HIGHLIGHTS) {
    await exportDesign({ html: highlight({ icon, circle, label }), w: 1080, h: 1920, psd: path.join(P, `Highlight_${id}.psd`), png: path.join(S1, `Highlight_${id}.png`) })
    await exportDesign({ html: highlight({ icon, circle, label, size: 'sq' }), w: 1080, h: 1080, png: path.join(S2, `Highlight_${id}.png`) })
  }
  console.log('highlights done')
}
await closeBrowser()
