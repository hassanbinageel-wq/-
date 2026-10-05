const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const file = 'file:///home/user/-/lessons/infant-feeding-lesson.html';
  const A = __dirname + '/assets/';
  const transparent = '.slide,.slide.divider,body,.deck,.main,.stage3d,.hero3d,.bcard,.tin{background:transparent!important;border-color:transparent!important;box-shadow:none!important} .ctl3d,.hint3d,.slider3d,.status3d,.fallback{display:none!important}';
  async function page(reduced) {
    const ctx = await b.newContext({ viewport:{width:1600,height:900}, deviceScaleFactor:3, colorScheme:'light', reducedMotion: reduced?'reduce':'no-preference' });
    const p = await ctx.newPage(); await p.goto(file + '#2'); await p.waitForTimeout(500);
    await p.addStyleTag({ content: transparent });
    return p;
  }
  async function go(p, n, wait){ await p.evaluate(n => { location.hash = '#' + n; }, n); await p.waitForTimeout(wait||1200); }
  async function shot(p, sel, name){ const el = await p.$(sel); await el.screenshot({ path: A + name + '.png', omitBackground: true }); console.log('ok', name); }
  // static illustrations (no motion)
  let p = await page(true);
  for (const [n, list] of [
    [4, [['#s-p1 .dv-art','dv1']]], [12, [['#s-p2 .dv-art','dv2']]], [20, [['#s-p3 .dv-art','dv3']]], [27, [['#s-p4 .dv-art','dv4']]],
    [7, [['.colo-fig svg','colostrum']]],
    [8, [['.align-fig figure:nth-child(1) svg','align-ok'],['.align-fig figure:nth-child(2) svg','align-bad']]],
    [9, [['.latch figure:nth-child(1) svg','latch-good'],['.latch figure:nth-child(2) svg','latch-poor']]],
    [10, [['#dial','dial'],['.burp svg','burp'],['.babies .bcard:nth-child(1) svg','baby1'],['.babies .bcard:nth-child(2) svg','baby2'],['.babies .bcard:nth-child(3) svg','baby3'],['.babies .bcard:nth-child(4) svg','baby4'],['.babies .bcard:nth-child(5) svg','baby5']]],
    [14, [['.tin:nth-child(1) svg','tin1'],['.tin:nth-child(2) svg','tin2'],['.tin:nth-child(3) svg','tin3']]],
  ]) { await go(p, n); for (const [s, nm] of list) await shot(p, '.slide.active ' + s.replace(/^#s-p\d /,''), nm); }
  // animated scenes captured mid-motion
  p = await page(false);
  await go(p, 1, 3500); await shot(p, '.slide.active .stage3d canvas', 'hero3d');
  await go(p, 21, 7500); await shot(p, '.slide.active .stage3d', 'ng3d');
  await go(p, 17, 2500); await shot(p, '.slide.active .stage3d', 'bottle-ok');
  await p.evaluate(() => document.querySelector('[data-tilt="-6"]').click()); await p.waitForTimeout(2000); await shot(p, '.slide.active .stage3d', 'bottle-flat');
  await go(p, 25, 3300); await shot(p, '.slide.active .asp svg', 'aspiration');
  await go(p, 33, 2600); await shot(p, '.slide.active .airway figure:nth-child(1) svg', 'gag'); await shot(p, '.slide.active .airway figure:nth-child(2) svg', 'choke');
  // notes: Arabic + teacher notes per slide title
  const notes = await p.evaluate(() => [...document.querySelectorAll('.slide')].map(s => {
    const t = sel => { const x = s.querySelector(sel); if (!x) return ''; const d = document.createElement('div'); d.appendChild(x.content.cloneNode(true)); d.querySelectorAll('li').forEach(li => li.prepend('• ')); d.querySelectorAll('p,li').forEach(e => e.append('\n')); return d.textContent.replace(/\n\s*\n+/g, '\n').trim(); };
    return { title: s.dataset.title, ar: t('template[data-ar]'), nt: t('template[data-notes]') };
  }));
  fs.writeFileSync(__dirname + '/notes.json', JSON.stringify(notes, null, 1));
  await b.close();
})();
