// 09_Web_Identity: متغيرات CSS منظمة + صفحة نموذجية تطبق الهوية + لقطات
import fs from 'node:fs'
import path from 'node:path'
import { OUT } from '../lib/out.mjs'
import { C } from '../lib/palette.mjs'
import { ROOT, getBrowser, closeBrowser } from '../lib/browser.mjs'
import * as M from '../lib/marks.mjs'
import * as E from '../lib/elements.mjs'
import { iconSVG } from '../lib/icons.mjs'

const D = OUT('09_Web_Identity'), A = OUT('09_Web_Identity', 'assets')
const tokens = `/* هوية غيمة — متغيرات الواجهة (انسخوها إلى ملف CSS في المتجر) */
:root {
  /* الألوان */
  --g-ink: ${C.ink};          /* النصوص والعناوين والأزرار الأساسية */
  --g-cotton: ${C.cotton};       /* خلفية الصفحة */
  --g-milk: ${C.milk};         /* البطاقات والحقول */
  --g-sand: ${C.sand};         /* أقسام بديلة وخلفيات الصور */
  --g-apricot: ${C.apricot};      /* الإبراز: شارات وأزرار ثانوية وعناصر «جديد» */
  --g-sage: ${C.sage};         /* أقسام هادئة وشارات الهدايا */
  --g-sage-deep: ${C.sageDeep};    /* رسائل النجاح و«متوفر» */
  --g-mist: ${C.mist};         /* خلفيات معلوماتية */
  --g-clay: ${C.clay};         /* السعر المخفض والأخطاء */
  --g-muted: ${C.muted};        /* النصوص الثانوية */
  --g-line: ${C.line};         /* الحدود والفواصل */

  /* الخطوط */
  --g-font-head: 'Readex Pro', 'IBM Plex Sans Arabic', system-ui, sans-serif;
  --g-font-body: 'IBM Plex Sans Arabic', 'Readex Pro', system-ui, sans-serif;
  --g-fs-xs: 13px; --g-fs-sm: 14px; --g-fs-base: 16px; --g-fs-md: 18px;
  --g-fs-lg: 22px; --g-fs-xl: 28px; --g-fs-2xl: 36px; --g-fs-3xl: 44px;
  --g-lh-body: 1.75; --g-lh-head: 1.3;
  --g-w-regular: 400; --g-w-medium: 500; --g-w-semibold: 600;

  /* المسافات (مضاعفات 4) */
  --g-space-1: 4px; --g-space-2: 8px; --g-space-3: 12px; --g-space-4: 16px;
  --g-space-5: 24px; --g-space-6: 32px; --g-space-7: 48px; --g-space-8: 64px;

  /* الحواف والظلال */
  --g-radius-sm: 10px; --g-radius-md: 16px; --g-radius-lg: 24px; --g-radius-pill: 999px;
  --g-shadow-soft: 0 10px 30px rgba(61, 51, 71, .08);
  --g-container: 1200px;
}
`
fs.writeFileSync(path.join(D, 'ghayma-tokens.css'), tokens)
fs.writeFileSync(path.join(D, 'ghayma-tokens.json'), JSON.stringify({ colors: C, fonts: { heading: 'Readex Pro', body: 'IBM Plex Sans Arabic' }, radius: { sm: 10, md: 16, lg: 24, pill: 999 }, space: [4, 8, 12, 16, 24, 32, 48, 64] }, null, 2))
for (const f of fs.readdirSync(path.join(ROOT, 'assets/illustrated')).filter((f) => f.endsWith('-sq.jpg'))) fs.copyFileSync(path.join(ROOT, 'assets/illustrated', f), path.join(A, f))
fs.writeFileSync(path.join(A, 'logo.svg'), M.wordmarkSVG(M.COLORWAYS.color))
fs.writeFileSync(path.join(A, 'logo-white.svg'), M.wordmarkSVG(M.COLORWAYS.reverse))
fs.writeFileSync(path.join(A, 'pattern.svg'), E.patternTile('cotton', { size: 300, bg: false }))
for (const k of ['van', 'gift', 'ruler', 'bag', 'heart', 'check', 'chat']) fs.writeFileSync(path.join(A, `icon-${k}.svg`), iconSVG(k))

const card = (img, name, price, old, sticker) => `<article class="card"><div class="card__media"><img src="assets/${img}-sq.jpg" alt="">${sticker ? `<span class="chip chip--${sticker[0]}">${sticker[1]}</span>` : ''}<button class="fav" aria-label="المفضلة"><img src="assets/icon-heart.svg" alt=""></button></div><h3 class="card__name">${name}</h3><div class="price">${old ? `<span class="price__now price__now--sale">${price} ر.س</span><s class="price__old">${old} ر.س</s>` : `<span class="price__now">${price} ر.س</span>`}</div><button class="btn btn--primary btn--block">أضف إلى السلة</button></article>`
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>غيمة — نموذج تطبيق الهوية</title>
<link rel="stylesheet" href="ghayma-tokens.css"><style>
@font-face{font-family:'Readex Pro';src:url('../02_Colors_Fonts/Fonts/ReadexPro[HEXP,wght]-Variable.ttf');font-weight:200 700}
@font-face{font-family:'IBM Plex Sans Arabic';src:url('../02_Colors_Fonts/Fonts/IBMPlexSansArabic-Regular.ttf');font-weight:400}
@font-face{font-family:'IBM Plex Sans Arabic';src:url('../02_Colors_Fonts/Fonts/IBMPlexSansArabic-Medium.ttf');font-weight:500}
*{box-sizing:border-box}body{margin:0;background:var(--g-cotton);color:var(--g-ink);font:var(--g-w-regular) var(--g-fs-base)/var(--g-lh-body) var(--g-font-body)}
h1,h2,h3{font-family:var(--g-font-head);line-height:var(--g-lh-head);margin:0}
.wrap{max-width:var(--g-container);margin:auto;padding:0 var(--g-space-5)}
.note{background:var(--g-ink);color:var(--g-cotton);text-align:center;font-size:var(--g-fs-sm);padding:8px}
header{background:var(--g-milk);border-bottom:1px solid var(--g-line)}header .wrap{display:flex;align-items:center;gap:var(--g-space-6);height:76px}
header .logo{height:40px}nav{display:flex;gap:var(--g-space-5);font:var(--g-w-medium) var(--g-fs-base) var(--g-font-head)}nav a{color:var(--g-ink);text-decoration:none}nav a.on{border-bottom:2px solid var(--g-apricot)}
.hdr-ic{margin-inline-start:auto;display:flex;gap:var(--g-space-4)}.hdr-ic img{width:26px}
.hero{margin:var(--g-space-6) auto;border-radius:var(--g-radius-lg);background:var(--g-sand) url(assets/pattern.svg);background-size:300px;display:grid;grid-template-columns:1.1fr 1fr;align-items:center;overflow:hidden;min-height:400px}
.hero__txt{padding:var(--g-space-7)}.hero h1{font-size:var(--g-fs-3xl);font-weight:var(--g-w-semibold)}.hero p{color:var(--g-muted);font-size:var(--g-fs-md);margin:var(--g-space-3) 0 var(--g-space-5)}
.hero__img{align-self:end;justify-self:center;width:82%;height:360px;margin-top:40px;border-radius:999px 999px 0 0;overflow:hidden;background:var(--g-cotton)}.hero__img img{width:100%;height:100%;object-fit:cover}
.btn{font:var(--g-w-medium) var(--g-fs-base) var(--g-font-head);border:0;border-radius:var(--g-radius-pill);padding:13px 26px;cursor:pointer}
.btn--primary{background:var(--g-ink);color:var(--g-cotton)}.btn--accent{background:var(--g-apricot);color:var(--g-ink)}.btn--outline{background:transparent;color:var(--g-ink);box-shadow:inset 0 0 0 2px var(--g-ink)}.btn--block{width:100%}
.btn:focus-visible,.field input:focus{outline:3px solid var(--g-apricot);outline-offset:2px}
.sec-title{display:flex;align-items:baseline;justify-content:space-between;margin:var(--g-space-7) 0 var(--g-space-5)}.sec-title h2{font-size:var(--g-fs-xl)}.sec-title a{color:var(--g-muted)}
.cats{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--g-space-5)}.cat{background:var(--g-milk);border-radius:var(--g-radius-lg);padding:var(--g-space-4);text-align:center;font:var(--g-w-medium) var(--g-fs-md) var(--g-font-head)}.cat img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:999px 999px var(--g-radius-md) var(--g-radius-md);margin-bottom:var(--g-space-3)}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--g-space-5)}
.card{background:var(--g-milk);border-radius:var(--g-radius-lg);padding:var(--g-space-3);box-shadow:var(--g-shadow-soft)}
.card__media{position:relative;border-radius:var(--g-radius-md);overflow:hidden;background:var(--g-sand)}.card__media>img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block}
.chip{position:absolute;top:12px;right:12px;font:var(--g-w-medium) var(--g-fs-sm) var(--g-font-head);padding:4px 14px;border-radius:var(--g-radius-pill)}.chip--new{background:var(--g-apricot);color:var(--g-ink)}.chip--sale{background:var(--g-clay);color:var(--g-milk)}.chip--gift{background:var(--g-sage);color:var(--g-ink)}
.fav{position:absolute;top:10px;left:10px;width:40px;height:40px;border-radius:50%;border:0;background:var(--g-milk);display:grid;place-items:center}.fav img{width:22px}
.card__name{font-size:var(--g-fs-md);font-weight:var(--g-w-medium);margin:var(--g-space-3) var(--g-space-1) var(--g-space-1)}
.price{display:flex;gap:var(--g-space-3);align-items:baseline;margin:0 var(--g-space-1) var(--g-space-3)}.price__now{font:var(--g-w-semibold) var(--g-fs-lg) var(--g-font-head)}.price__now--sale{color:var(--g-clay)}.price__old{color:var(--g-muted)}
.panel{display:grid;grid-template-columns:1fr 1fr;gap:var(--g-space-6);margin:var(--g-space-7) 0}.box{background:var(--g-milk);border-radius:var(--g-radius-lg);padding:var(--g-space-6)}
.field{display:block;margin-bottom:var(--g-space-4)}.field span{display:block;font:var(--g-w-medium) var(--g-fs-sm) var(--g-font-head);margin-bottom:6px}.field input{width:100%;font:inherit;padding:12px 16px;border-radius:var(--g-radius-md);border:1.5px solid var(--g-line);background:var(--g-cotton);color:var(--g-ink)}
.field--err input{border-color:var(--g-clay)}.field small{color:var(--g-clay);font-size:var(--g-fs-sm)}
.alert{display:flex;gap:var(--g-space-3);align-items:center;padding:var(--g-space-4) var(--g-space-5);border-radius:var(--g-radius-md);margin-bottom:var(--g-space-4);font-weight:var(--g-w-medium)}.alert img{width:24px}.alert--ok{background:#E3ECE1;color:var(--g-sage-deep)}.alert--err{background:#F6E1DA;color:var(--g-clay)}.alert--info{background:var(--g-mist);color:var(--g-ink)}
.btns{display:flex;gap:var(--g-space-3);flex-wrap:wrap}
footer{background:var(--g-ink);color:var(--g-cotton);margin-top:var(--g-space-8);padding:var(--g-space-7) 0}footer .wrap{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:var(--g-space-6)}footer h4{font:var(--g-w-semibold) var(--g-fs-md) var(--g-font-head);margin:0 0 var(--g-space-3);color:var(--g-apricot)}footer a{display:block;color:var(--g-cotton);opacity:.85;text-decoration:none;line-height:2}footer p{opacity:.8}
.feat{display:flex;gap:var(--g-space-6);justify-content:center;padding:var(--g-space-5);background:var(--g-milk);border-radius:var(--g-radius-lg)}.feat div{display:flex;gap:8px;align-items:center;font:var(--g-w-medium) var(--g-fs-base) var(--g-font-head)}.feat img{width:28px}
@media(max-width:760px){header nav{display:none}.hero{grid-template-columns:1fr}.hero__txt{padding:var(--g-space-5)}.hero h1{font-size:var(--g-fs-2xl)}.hero__img{height:300px}.cats{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:repeat(2,1fr);gap:var(--g-space-3)}.panel{grid-template-columns:1fr}footer .wrap{grid-template-columns:1fr}.feat{flex-wrap:wrap;gap:var(--g-space-4)}}
</style></head><body>
<div class="note">نموذج توضيحي لتطبيق الهوية — الأسماء والأسعار أمثلة وليست منتجات حقيقية</div>
<header><div class="wrap"><img class="logo" src="assets/logo.svg" alt="غيمة"><nav><a class="on" href="#">الرئيسية</a><a href="#">الملابس</a><a href="#">الأطقم</a><a href="#">الهدايا</a><a href="#">الإكسسوارات</a></nav><div class="hdr-ic"><img src="assets/icon-heart.svg" alt=""><img src="assets/icon-bag.svg" alt=""></div></div></header>
<main class="wrap">
<section class="hero"><div class="hero__txt"><h1>كل ما يحتاجه مولودكم، بلطف</h1><p>ملابس وأطقم وهدايا بألوان هادئة تناسب الجنسين.</p><div class="btns"><button class="btn btn--primary">تسوّقوا الجديد</button><button class="btn btn--outline">هدايا المواليد</button></div></div><div class="hero__img"><img src="assets/ph08-trio-sq.jpg" alt=""></div></section>
<div class="feat"><div><img src="assets/icon-van.svg" alt="">توصيل للمدن المتاحة</div><div><img src="assets/icon-gift.svg" alt="">تغليف هدايا</div><div><img src="assets/icon-ruler.svg" alt="">دليل مقاسات</div></div>
<div class="sec-title"><h2>تسوّقوا حسب القسم</h2><a href="#">عرض الكل</a></div>
<div class="cats"><div class="cat"><img src="assets/ph01-onesie-sq.jpg" alt="">الملابس</div><div class="cat"><img src="assets/ph07-set-sq.jpg" alt="">الأطقم</div><div class="cat"><img src="assets/ph03-romper-sq.jpg" alt="">الإكسسوارات</div><div class="cat"><img src="assets/ph02-jacket-sq.jpg" alt="">الهدايا</div></div>
<div class="sec-title"><h2>وصل حديثاً</h2><a href="#">عرض الكل</a></div>
<div class="grid">${card('ph01-onesie', 'بدلة قطنية للمولود', 89, 0, ['new', 'جديد'])}${card('ph04-pajama', 'بيجامة الضباب', 55, 69, ['sale', 'خصم'])}${card('ph07-set', 'طقم الاستقبال', 219, 0, ['gift', 'هدية مولود'])}${card('ph02-jacket', 'جاكيت محبوك', 119)}</div>
<section class="panel"><div class="box"><h2 style="font-size:var(--g-fs-xl);margin-bottom:var(--g-space-5)">بيانات الطلب</h2><label class="field"><span>الاسم</span><input value="سارة أحمد"></label><label class="field field--err"><span>رقم الجوال</span><input value="05"><small>يرجى إدخال رقم جوال صحيح من 10 أرقام</small></label><button class="btn btn--primary btn--block">متابعة</button></div>
<div class="box"><h2 style="font-size:var(--g-fs-xl);margin-bottom:var(--g-space-5)">رسائل الواجهة</h2><div class="alert alert--ok"><img src="assets/icon-check.svg" alt="">تمت إضافة المنتج إلى السلة</div><div class="alert alert--err"><img src="assets/icon-chat.svg" alt="">تعذر حفظ الطلب، حاولوا مرة أخرى</div><div class="alert alert--info"><img src="assets/icon-van.svg" alt="">نراجع التحويل ونؤكد طلبكم بعد المراجعة</div><div class="btns"><button class="btn btn--primary">أساسي</button><button class="btn btn--accent">إبراز</button><button class="btn btn--outline">ثانوي</button></div></div></section>
</main>
<footer><div class="wrap"><div><img src="assets/logo-white.svg" style="height:44px" alt="غيمة"><p>ملابس وأطقم وهدايا المواليد بلطف.</p></div><div><h4>المتجر</h4><a href="#">الملابس</a><a href="#">الأطقم</a><a href="#">الهدايا</a></div><div><h4>المساعدة</h4><a href="#">دليل المقاسات</a><a href="#">الطلب والدفع</a><a href="#">التوصيل والاستبدال</a></div></div></footer>
</body></html>`
fs.writeFileSync(path.join(D, 'Ghayma_Web_Identity_Sample.html'), html)
const b = await getBrowser()
for (const [n, w, h] of [['Desktop', 1440, 900], ['Mobile', 390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: n === 'Mobile' ? 2 : 1 })
  await p.goto('file://' + path.join(D, 'Ghayma_Web_Identity_Sample.html')); await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: path.join(D, `Web_Identity_Preview_${n}.jpg`), fullPage: true, type: 'jpeg', quality: 88 })
  await p.close()
}
await closeBrowser()
console.log('web done')
