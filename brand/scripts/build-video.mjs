// حركة الشعار والشاشة الختامية ومثال ريل: إطارات من المتصفح ثم ffmpeg
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { openPage, closeBrowser, doc } from '../lib/browser.mjs'
import { OUT } from '../lib/out.mjs'
import { C } from '../lib/palette.mjs'
import * as M from '../lib/marks.mjs'
import { OVERLAYS } from '../templates/reels.mjs'
import { CSS, photo, uri } from '../lib/tpl.mjs'

const D = OUT('06_Reels_Templates', 'Animation')
const TMP = path.join(D, '_frames'); 
const FPS = 30, W = 1080, H = 1920
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)
const seg = (t, a, b) => ease((t - a) / (b - a))

const wp = M.wordmarkParts(), tp = M.taglineParts()
const logoSvg = `<svg id="lg" viewBox="0 0 ${wp.w} ${wp.h}" style="width:620px;overflow:visible"><g transform="translate(${wp.tx} ${wp.ty})"><path id="letters" d="${wp.letters}" fill="${C.ink}"/><path id="cloud" d="${wp.cloud}" fill="${C.apricot}"/></g></svg>`
const tagSvg = `<svg viewBox="0 0 ${tp.w} ${tp.h}" style="width:420px"><path transform="translate(${tp.tx} ${tp.ty})" d="${tp.d}" fill="${C.muted}"/></svg>`

async function frames(html, dur, setter, name, { transparent = false } = {}) {
  fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true })
  const page = await openPage(html, W, H)
  const n = Math.round(dur * FPS)
  for (let i = 0; i < n; i++) {
    await page.evaluate(setter, i / FPS)
    await page.screenshot({ path: path.join(TMP, `f${String(i).padStart(4, '0')}.png`), omitBackground: transparent })
  }
  await page.close()
  const inp = ['-y', '-framerate', String(FPS), '-i', path.join(TMP, 'f%04d.png')]
  if (transparent) {
    execFileSync('ffmpeg', [...inp, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', path.join(D, name + '_Transparent.mov')], { stdio: 'ignore' })
    execFileSync('ffmpeg', [...inp, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '2M', path.join(D, name + '_Transparent.webm')], { stdio: 'ignore' })
  } else execFileSync('ffmpeg', [...inp, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', path.join(D, name + '.mp4')], { stdio: 'ignore' })
  fs.rmSync(TMP, { recursive: true, force: true })
}

// 1) مقدمة الشعار — 3 ثوانٍ: الغيمة تهبط بهدوء، الحروف تظهر من اليمين، ثم العبارة
const introSetter = (t) => {
  const e = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3), s = (a, b) => e((t - a) / (b - a))
  const c = document.getElementById('cloud'), l = document.getElementById('letters'), tg = document.getElementById('tg')
  const pc = s(0, 0.7); c.style.opacity = pc; c.style.transform = `translateY(${(1 - pc) * -90 + Math.sin(Math.max(0, t - 1.9) * 2.4) * 6 * (t > 1.9 ? 1 : 0)}px)`
  const pl = s(0.35, 1.35); l.style.clipPath = `inset(0 0 0 ${(1 - pl) * 100}%)`
  const pt = s(1.35, 1.95); tg.style.opacity = pt; tg.style.transform = `translateY(${(1 - pt) * 24}px)`
}
const introHtml = (bg) => doc(`<div style="width:${W}px;height:${H}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px">${logoSvg}<div id="tg" style="opacity:0">${tagSvg}</div></div>`, '', { bg })

// 2) الشاشة الختامية — 3 ثوانٍ
const endSetter = (t) => {
  const e = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3), s = (a, b) => e((t - a) / (b - a))
  const a = document.getElementById('bd'), b = document.getElementById('cta'), h = document.getElementById('hd')
  a.style.opacity = s(0, 0.6); a.style.transform = `scale(${0.92 + 0.08 * s(0, 0.6)})`
  b.style.opacity = s(0.5, 1.1); b.style.transform = `translateY(${(1 - s(0.5, 1.1)) * 30}px)`
  h.style.opacity = s(0.9, 1.5)
}
const endHtml = doc(`<div style="width:${W}px;height:${H}px;background:${C.cotton};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px"><img id="bd" style="width:300px;opacity:0" src="${uri(M.badgeSVG(M.COLORWAYS.color))}"><img style="width:340px" src="${uri(M.wordmarkSVG(M.COLORWAYS.color))}"><div id="cta" class="t c title" style="font-size:56px;opacity:0;margin-top:40px">للطلب: الرابط في الحساب</div><div id="hd" class="t c sub muted" style="font-size:40px;opacity:0">@ghayma</div></div>`, CSS)

// 3) مثال ريل عرض منتج — 9 ثوانٍ (يوضح توقيت العناصر)
const demoHtml = doc(`<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#000">
<img id="ph" src="${photo('ph01-onesie')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform-origin:50% 45%">
<div id="g1" style="opacity:0">${OVERLAYS.logoBug('color')}</div><div id="g2" style="opacity:0">${OVERLAYS.titleBar('وصل حديثاً')}</div><div id="g3" style="opacity:0">${OVERLAYS.priceCard()}</div>
<div id="tag" style="position:absolute;left:40px;top:40px;padding:10px 22px;border-radius:30px;background:rgba(61,51,71,.8);color:#fff;font:500 26px 'Readex Pro';direction:rtl">مثال توضيحي</div>
<div id="end" style="position:absolute;inset:0;opacity:0;background:${C.cotton};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px"><img style="width:300px" src="${uri(M.badgeSVG(M.COLORWAYS.color))}"><img style="width:340px" src="${uri(M.wordmarkSVG(M.COLORWAYS.color))}"><div class="t c title" style="font-size:56px;margin-top:40px">للطلب: الرابط في الحساب</div></div></div>`, CSS)
const demoSetter = (t) => {
  const e = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3), s = (a, b) => e((t - a) / (b - a))
  document.getElementById('ph').style.transform = `scale(${1 + 0.07 * Math.min(1, t / 6.5)})`
  const g1 = document.getElementById('g1'); g1.style.opacity = s(0.2, 0.6)
  const g2 = document.getElementById('g2'); const p2 = s(0.5, 0.9) * (1 - s(5.6, 6.0)); g2.style.opacity = p2; g2.style.transform = `translateY(${(1 - s(0.5, 0.9)) * -40}px)`
  const g3 = document.getElementById('g3'); const p3 = s(1.6, 2.1) * (1 - s(5.6, 6.0)); g3.style.opacity = p3; g3.style.transform = `translateY(${(1 - s(1.6, 2.1)) * 60}px)`
  document.getElementById('end').style.opacity = s(6.2, 6.8)
}

await frames(introHtml(C.cotton), 3, introSetter, 'Ghayma_Logo_Intro_3s_1080x1920')
await frames(introHtml('transparent'), 3, introSetter, 'Ghayma_Logo_Intro_3s_1080x1920', { transparent: true })
await frames(endHtml, 3, endSetter, 'Ghayma_End_Screen_3s_1080x1920')
await frames(demoHtml, 9, demoSetter, 'Example_Reel_Product_Showcase_9s')
await closeBrowser()
console.log(fs.readdirSync(D))
