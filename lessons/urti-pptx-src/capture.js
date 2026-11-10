// Captures the lesson's illustrations and 3D views as transparent PNGs for the PowerPoint version.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const A = __dirname + '/assets/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1159, height: 830 }, deviceScaleFactor: 3, colorScheme: 'light', reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.setDefaultTimeout(180000);
  const fs = require('fs'), have = n => fs.existsSync(A + n + '.png');
  await p.goto('file:///home/user/-/lessons/urti-lesson.html#2'); await p.waitForTimeout(600);
  await p.addStyleTag({ content: '.lbl3d,.hint,.seg3d,.modeTag,.dock,#prog{display:none!important} html,body,#viewport,.stage,.slide,.slide::after,.card,.v3d,.kidcard{background:transparent!important;border-color:transparent!important;box-shadow:none!important}' });
  async function go(n, wait) { await p.evaluate(n => { location.hash = '#' + n; }, n); await p.waitForTimeout(wait || 2200); }
  async function shot(sel, name) { const el = await p.$('.slide.active ' + sel); const r = await el.boundingBox(); await p.screenshot({ path: A + name + '.png', omitBackground: true, clip: r }); console.log('ok', name); }
  const svgs = [
    [2, '.anat', 'anatomy'], [3, '.trn:nth-child(1) svg', 'tr-droplets'], [3, '.trn:nth-child(2) svg', 'tr-contact'], [3, '.trn:nth-child(3) svg', 'tr-surface'],
    [4, '.kidcard svg', 'kid'], [5, '.ex:nth-child(1) > svg', 'ex-general'], [5, '.ex:nth-child(2) > svg', 'ex-nose'], [5, '.ex:nth-child(3) > svg', 'ex-throat'], [5, '.ex:nth-child(4) > svg', 'ex-chest'],
    [7, '.card.fill svg', 'pharynx'], [11, '.row > .card:first-child svg', 'tonsils'], [14, '.surg svg', 'tonsillectomy'], [16, '.cmap', 'complications'],
    [17, '.cc:nth-child(1) .ccart', 'cmp-cold'], [17, '.cc:nth-child(2) .ccart', 'cmp-phar'], [17, '.cc:nth-child(3) .ccart', 'cmp-tons'], [19, '.endart', 'end']
  ];
  for (const [n, sel, name] of svgs) { if (have(name)) continue; await go(n); await shot(sel, name); }
  // 3D: viruses, then the throat in every mode
  if (!have('viruses')) { await go(1, 6000); await shot('.v3d canvas', 'viruses'); }
  await go(18, 4000);
  for (const v of [1, 2, 3, 4]) { if (have('throat-' + v)) continue; await p.evaluate(v => document.querySelector('.slide.active [data-group] button[data-v="' + v + '"]').click(), v); await p.waitForTimeout(6000); await shot('.v3d canvas', 'throat-' + v); }
  await go(13, 4000); await p.evaluate(() => document.querySelector('.slide.active [data-group] button[data-v="0"]').click()); await p.waitForTimeout(6000); await shot('.v3d canvas', 'throat-0');
  await b.close();
})();
