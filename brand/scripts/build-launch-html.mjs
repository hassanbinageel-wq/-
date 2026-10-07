// خطة المحتوى كصفحة HTML واحدة مستقلة: الجدول + الكابشن بزر نسخ + صور مصغرة مضمّنة + قائمة مهام تُحفظ في المتصفح
import fs from 'node:fs'
import path from 'node:path'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { ROOT } from '../lib/browser.mjs'
import { uri } from '../lib/tpl.mjs'
import { C } from '../lib/palette.mjs'
import * as Mk from '../lib/marks.mjs'
import { SLOGAN, HANDLE } from '../templates/launch.mjs'
import * as T from '../templates/launch-content.mjs'

const KIT = path.join(ROOT, 'dist', 'Ghayma_Launch_Kit')
const OUTD = path.join(KIT, '04_Content_Plan')
fs.mkdirSync(OUTD, { recursive: true })
for (const f of fs.readdirSync(OUTD)) if (f.endsWith('.pdf')) fs.rmSync(path.join(OUTD, f))

async function thumb(p, w) {
  if (!fs.existsSync(p)) return ''
  const img = await loadImage(fs.readFileSync(p))
  const h = Math.round((img.height / img.width) * w)
  const c = createCanvas(w, h); c.getContext('2d').drawImage(img, 0, 0, w, h)
  return 'data:image/jpeg;base64,' + (await c.encode('jpeg', 82)).toString('base64')
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const FV = path.join(KIT, '01_Feed_Posts', 'Previews_JPG'), SV = path.join(KIT, '02_Stories', 'Previews_JPG'), RV = path.join(KIT, '03_Reels', 'Covers_Previews_JPG')
let cid = 0
const capBlock = (text, label = 'الكابشن') => { const id = 'c' + ++cid; return `<div class="cap"><div class="cap-h"><span>${label}</span><button class="copy" data-copy="${id}">نسخ</button></div><pre id="${id}">${esc(text)}</pre></div>` }

const grid = await thumb(path.join(KIT, '00_Preview', 'Profile_Grid_Preview.jpg'), 520)
let posts = ''
for (const p of T.POSTS) {
  const thumbs = await Promise.all(p.files.slice(0, 6).map((f) => thumb(path.join(FV, `Post_${f}.jpg`), 220)))
  posts += `<article class="card" id="post-${p.n}"><div class="card-h"><h3>منشور ${p.n}</h3><span class="pill">${esc(p.day)}</span>${p.files.length > 1 ? `<span class="pill pill--alt">كاروسيل · ${p.files.length} صور</span>` : ''}</div>
  <div class="thumbs ${p.files.length > 1 ? 'thumbs--row' : ''}">${thumbs.map((t) => `<img loading="lazy" src="${t}" alt="">`).join('')}</div>
  <p class="files">الملفات: ${p.files.map((f) => `<code>Post_${f}</code>`).join(' ')}</p>${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}${capBlock(p.caption)}</article>`
}
let stories = ''
for (const s of T.STORIES) stories += `<article class="card card--row"><img class="story" loading="lazy" src="${await thumb(path.join(SV, `Story_${s.f}.jpg`), 200)}" alt=""><div><div class="card-h"><h3>${s.f.replace(/_/g, ' ')}</h3><span class="pill">${esc(s.day)}</span></div><p>${esc(s.how)}</p><p class="files"><code>Story_${s.f}</code></p></div></article>`
let reels = ''
for (const r of T.REELS) reels += `<article class="card card--row"><img class="story" loading="lazy" src="${await thumb(path.join(RV, `${r.f}.jpg`), 200)}" alt=""><div style="flex:1;min-width:0"><div class="card-h"><h3>${esc(r.title)}</h3><span class="pill">${esc(r.day)}</span>${r.ready ? '<span class="pill pill--ok">جاهز للنشر</span>' : '<span class="pill pill--alt">يحتاج تصوير</span>'}</div><ul>${r.script.map((s) => `<li>${esc(s)}</li>`).join('')}</ul><p class="files">الغلاف: <code>${r.f}</code>${r.video ? ` · الفيديو: <code>${r.video}</code>` : ''}</p>${capBlock(r.caption)}</div></article>`
const plan = T.PLAN.map(([d, w], i) => `<label class="day"><input type="checkbox" data-k="day${i}"><span class="day-n">${esc(d)}</span><span class="day-w">${esc(w)}</span></label>`).join('')
const bios = T.BIO.map((b, i) => capBlock(b, `البايو ${i + 1}`)).join('')
const tags = Object.entries(T.HASHTAGS).map(([k, v]) => capBlock(v, { core: 'هاشتاقات أساسية', yemen: 'اليمن', saudi: 'السعودية' }[k])).join('')

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>خطة إطلاق غيمة</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Readex+Pro:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--ink:${C.ink};--cotton:${C.cotton};--milk:${C.milk};--sand:${C.sand};--mist:${C.mist};--sage:${C.sage};--sageDeep:${C.sageDeep};--apricot:${C.apricot};--muted:${C.muted};--line:${C.line}}
*{box-sizing:border-box}body{margin:0;background:var(--cotton);color:var(--ink);font:16px/1.75 'IBM Plex Sans Arabic',system-ui,sans-serif}
h1,h2,h3,.pill,.tabs a,button{font-family:'Readex Pro','IBM Plex Sans Arabic',system-ui,sans-serif}
.hero{background:var(--ink);color:var(--cotton);padding:48px 16px 40px;text-align:center}.hero img{width:120px}.hero h1{margin:18px 0 4px;font-size:clamp(26px,5vw,40px);font-weight:600}.hero p{margin:0;color:var(--sand)}
.tabs{position:sticky;top:0;z-index:5;background:rgba(251,246,239,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);display:flex;gap:6px;overflow-x:auto;padding:10px 16px;scrollbar-width:none}
.tabs a{flex:none;text-decoration:none;color:var(--ink);background:var(--milk);border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:14px;font-weight:500}
main{max-width:980px;margin:0 auto;padding:8px 16px 80px}section{padding-top:28px}h2{font-size:24px;font-weight:600;margin:0 0 14px}
.card{background:var(--milk);border:1px solid var(--line);border-radius:18px;padding:16px;margin-bottom:14px}.card--row{display:flex;gap:16px;align-items:flex-start}
.card-h{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}.card-h h3{margin:0;font-size:18px;font-weight:600}
.pill{background:var(--sand);border-radius:999px;padding:2px 12px;font-size:13px;font-weight:500}.pill--alt{background:var(--mist)}.pill--ok{background:#DDE8D9;color:var(--sageDeep)}
.thumbs img{width:220px;max-width:100%;border-radius:12px;box-shadow:0 4px 14px rgba(61,51,71,.12)}.thumbs--row{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px}.thumbs--row img{width:150px;flex:none}
.story{width:120px;flex:none;border-radius:12px;box-shadow:0 4px 14px rgba(61,51,71,.12)}
.cap{margin-top:10px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff}.cap-h{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--cotton);font-size:13px;color:var(--muted)}
.cap pre{margin:0;padding:12px 14px;white-space:pre-wrap;word-break:break-word;font:15px/1.8 'IBM Plex Sans Arabic',system-ui,sans-serif}
.copy{border:0;background:var(--ink);color:var(--cotton);border-radius:999px;padding:5px 16px;font-size:13px;cursor:pointer;min-height:32px}.copy.done{background:var(--sageDeep)}
.files{font-size:13px;color:var(--muted);margin:8px 0 0}code{font-family:ui-monospace,monospace;font-size:12px;background:var(--cotton);border-radius:6px;padding:1px 6px;direction:ltr;display:inline-block}
.note{background:#FCEBDD;border-radius:10px;padding:6px 10px;font-size:14px;margin:8px 0 0}
.day{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:start;background:var(--milk);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:8px;cursor:pointer}
.day input{width:20px;height:20px;margin-top:4px;accent-color:var(--sageDeep);grid-row:span 2}.day-n{font-family:'Readex Pro',sans-serif;font-weight:600;color:var(--sageDeep)}.day-w{font-size:15px}.day:has(input:checked){opacity:.55}.day:has(input:checked) .day-w{text-decoration:line-through}
.grid-prev{text-align:center}.grid-prev img{width:min(100%,360px);border-radius:16px;box-shadow:0 8px 30px rgba(61,51,71,.15)}
ul{margin:6px 0;padding-inline-start:20px}.tips li{margin-bottom:6px}
.progress{height:8px;background:var(--line);border-radius:99px;overflow:hidden;margin:0 0 14px}.progress i{display:block;height:100%;width:0;background:var(--sageDeep);transition:width .3s}
@media (max-width:640px){.card--row{flex-direction:column}.story{width:140px}}
</style></head><body>
<header class="hero"><img src="${uri(Mk.badgeSVG(Mk.COLORWAYS.reverse))}" alt="غيمة"><h1>خطة إطلاق حساب غيمة</h1><p>${esc(SLOGAN)} · 8 أيام · منشورات وستوري وريلز مع كابشن جاهز</p></header>
<nav class="tabs"><a href="#plan">الجدول</a><a href="#grid">شكل الحساب</a><a href="#bio">البايو</a><a href="#posts">المنشورات</a><a href="#stories">الستوري</a><a href="#reels">الريلز</a><a href="#tags">الهاشتاقات</a><a href="#tips">نصائح</a></nav>
<main>
<section id="plan"><h2>الجدول يوماً بيوم</h2><div class="progress"><i id="pg"></i></div>${plan}<p class="files">علّموا كل يوم بعد إنجازه — يُحفظ في هذا المتصفح.</p></section>
<section id="grid"><h2>شكل الحساب بعد المنشورات التسعة</h2><div class="grid-prev"><img src="${grid}" alt="معاينة شبكة الحساب"></div><p class="note">المنشورات 1 و2 و3 تكوّن الصف السفلي المتصل؛ انشروها بالترتيب 1 ثم 2 ثم 3. الأحدث يظهر أعلى اليسار.</p></section>
<section id="bio"><h2>البايو (اختاروا واحداً)</h2>${bios}<p class="files">اسم الحساب في التصاميم ${esc(HANDLE)} — عدّلوه في طبقة «اسم الحساب» إذا اخترتم اسماً آخر.</p></section>
<section id="posts"><h2>المنشورات</h2>${posts}</section>
<section id="stories"><h2>الستوري</h2>${stories}</section>
<section id="reels"><h2>الريلز</h2>${reels}</section>
<section id="tags"><h2>الهاشتاقات</h2>${tags}</section>
<section id="tips"><h2>نصائح</h2><div class="card"><ul class="tips">${T.TIPS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div></section>
</main>
<script>
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.copy'); if (!b) return
  const t = document.getElementById(b.dataset.copy).innerText
  try { await navigator.clipboard.writeText(t) } catch { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove() }
  b.textContent = 'تم النسخ ✓'; b.classList.add('done'); setTimeout(() => { b.textContent = 'نسخ'; b.classList.remove('done') }, 1600)
})
const boxes = [...document.querySelectorAll('.day input')]
const upd = () => { document.getElementById('pg').style.width = (boxes.filter((x) => x.checked).length / boxes.length * 100) + '%' }
for (const x of boxes) { try { x.checked = localStorage.getItem('gh_plan_' + x.dataset.k) === '1' } catch {} x.addEventListener('change', () => { try { localStorage.setItem('gh_plan_' + x.dataset.k, x.checked ? '1' : '0') } catch {} upd() }) }
upd()
</script></body></html>`
fs.writeFileSync(path.join(OUTD, 'Launch_Plan_AR.html'), html)
console.log('html', (html.length / 1024 / 1024).toFixed(2), 'MB')
