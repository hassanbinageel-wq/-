const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport:{width:1600,height:900}, deviceScaleFactor:3, colorScheme:'light' });
  const p = await ctx.newPage(); await p.goto('file:///home/user/-/lessons/infant-feeding-lesson.html#2'); await p.waitForTimeout(500);
  await p.addStyleTag({ content: '.ctl3d,.hint3d,.slider3d{display:none!important} .stage3d{border:0!important;border-radius:0!important;background:#eef3f3!important}' });
  const A = __dirname + '/assets/';
  const go = async (n, w) => { await p.evaluate(n => { location.hash = '#' + n; }, n); await p.waitForTimeout(w); };
  await go(1, 4000); await (await p.$('.slide.active .stage3d')).screenshot({ path: A + 'hero3d.png' });
  await go(21, 12000); await (await p.$('.slide.active .stage3d')).screenshot({ path: A + 'ng3d.png' });
  await go(17, 3000); await (await p.$('.slide.active .stage3d')).screenshot({ path: A + 'bottle-ok.png' });
  await p.evaluate(() => document.querySelector('[data-tilt="-6"]').click()); await p.waitForTimeout(2500);
  await (await p.$('.slide.active .stage3d')).screenshot({ path: A + 'bottle-flat.png' });
  await b.close();
})();
