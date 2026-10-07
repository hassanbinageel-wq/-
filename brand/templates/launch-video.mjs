// ريلزا الإطلاق المتحركة: HTML + دالة الحركة لكل إطار. مصدر واحد للفيديو الجاهز ولطبقات Premiere
import { doc } from '../lib/browser.mjs'
import { CSS, uri } from '../lib/tpl.mjs'
import { C } from '../lib/palette.mjs'
import * as Mk from '../lib/marks.mjs'
import * as E from '../lib/elements.mjs'
import { SLOGAN, HANDLE } from './launch.mjs'

export const W = 1080, H = 1920, FPS = 30
const cl = (id, cx, base, s, fill, op = 1) => `<svg id="${id}" style="position:absolute;left:0;top:0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${E.cloud(cx, base, s, fill, op)}</svg>`
const line = (id, txt, top, size, cls = 'display', color = C.ink) => `<div id="${id}" class="t c ${cls}" style="${txt.startsWith('@') ? 'direction:ltr;' : ''}position:absolute;left:60px;right:60px;top:${top}px;font-size:${size}px;line-height:1.2;color:${color};opacity:0">${txt}</div>`
const logoW = (id, top, width, cw = 'color') => `<img id="${id}" style="position:absolute;left:${(W - width) / 2}px;top:${top}px;width:${width}px;opacity:0" src="${uri(Mk.wordmarkSVG(Mk.COLORWAYS[cw]))}">`

const teaser = doc(`<div id="stage" style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:linear-gradient(180deg,${C.mist},${C.cotton})">
${cl('c1', 300, 1500, 260, C.milk)}${cl('c2', 820, 1720, 300, C.sand)}${cl('c3', 760, 520, 90, C.milk, 0.9)}${cl('c4', 240, 380, 60, C.milk, 0.85)}
${line('t1', 'شيء ناعم…', 760, 130)}${line('t2', 'في الطريق إليكم', 800, 96, 'title', C.muted)}
${logoW('lg', 700, 560)}${line('sl', SLOGAN, 1010, 76, 'title', C.sageDeep)}
${line('t3', 'قريباً', 720, 220)}${line('hd', HANDLE, 1010, 56, 'sub', C.muted)}</div>`, CSS)
const teaserSet = (t) => {
  const e = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3), win = (a, b, f = 0.5) => e((t - a) / f) * (1 - e((t - b + f) / f))
  const g = (id) => document.getElementById(id)
  g('c1').style.transform = `translateX(${t * 14}px)`; g('c2').style.transform = `translateX(${-t * 10}px)`
  g('c3').style.transform = `translateX(${-t * 22}px)`; g('c4').style.transform = `translateX(${t * 18}px)`
  const show = (id, a, b) => { const v = win(a, b); g(id).style.opacity = v; g(id).style.transform = `translateY(${(1 - v) * 30}px)` }
  show('t1', 0.2, 2.6); show('t2', 2.6, 5.0); show('lg', 5.0, 8.0); show('sl', 5.5, 8.0); show('t3', 8.0, 10.6); show('hd', 8.4, 10.6)
}
const items = ['ملابس المواليد', 'أطقم الاستقبال', 'هدايا جاهزة ومغلفة', 'إكسسوارات ناعمة']
const launch = doc(`<div id="stage" style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:linear-gradient(180deg,${C.apricot},#F7DCCB)">
${cl('c1', 280, 1960, 300, C.cotton)}${cl('c2', 860, 1960, 250, C.milk)}
${line('a1', 'افتتحنا!', 700, 210)}
${items.map((s, i) => line('i' + i, '☁︎ ' + s, 560 + i * 150, 76, 'title')).join('')}
${logoW('lg', 620, 520)}${line('sl', SLOGAN, 900, 70, 'title')}${line('cta', 'الرابط في الحساب', 1060, 64, 'title')}${line('hd', HANDLE, 1170, 50, 'sub', C.ink)}</div>`, CSS)
const launchSet = (t) => {
  const e = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3), win = (a, b, f = 0.45) => e((t - a) / f) * (1 - e((t - b + f) / f))
  const g = (id) => document.getElementById(id)
  g('c1').style.transform = `translateY(${-e(t / 2) * 60}px)`; g('c2').style.transform = `translateY(${-e((t - 0.2) / 2) * 50}px)`
  const a = win(0.1, 2.2); g('a1').style.opacity = a; g('a1').style.transform = `scale(${0.85 + 0.15 * a})`
  for (let i = 0; i < 4; i++) { const v = win(2.3 + i * 0.35, 5.0); g('i' + i).style.opacity = v; g('i' + i).style.transform = `translateX(${(1 - v) * 60}px)` }
  for (const [id, s] of [['lg', 5.1], ['sl', 5.4], ['cta', 5.8], ['hd', 6.1]]) { const v = win(s, 8.6); g(id).style.opacity = v; g(id).style.transform = `translateY(${(1 - v) * 24}px)` }
}

// كل فيديو: الطبقات بالترتيب من الأسفل للأعلى (الخلفية = لون المسرح)
export const VIDEOS = [
  {
    id: 'Reel_01_Teaser_10s', file: 'Reel_01_Teaser_Ready_10s', title: 'ريل التشويق — 10 ثوانٍ', dur: 10, html: teaser, setter: teaserSet,
    layers: [['c1', '02_Cloud_Big_Left'], ['c2', '03_Cloud_Big_Right'], ['c3', '04_Cloud_Small_Right'], ['c4', '05_Cloud_Small_Left'], ['t1', '06_Text_Something_Soft'], ['t2', '07_Text_On_The_Way'], ['lg', '08_Logo'], ['sl', '09_Text_Slogan'], ['t3', '10_Text_Coming_Soon'], ['hd', '11_Text_Handle']],
  },
  {
    id: 'Reel_02_Launch_8s', file: 'Reel_02_Launch_Ready_8s', title: 'ريل الافتتاح — 8 ثوانٍ', dur: 8, html: launch, setter: launchSet,
    layers: [['c1', '02_Cloud_Left'], ['c2', '03_Cloud_Right'], ['a1', '04_Text_We_Are_Open'], ['i0', '05_Text_Item_1'], ['i1', '06_Text_Item_2'], ['i2', '07_Text_Item_3'], ['i3', '08_Text_Item_4'], ['lg', '09_Logo'], ['sl', '10_Text_Slogan'], ['cta', '11_Text_Link_In_Bio'], ['hd', '12_Text_Handle']],
  },
]
