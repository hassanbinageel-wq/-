// Captures the Chest Trauma lesson's illustrations and 3D views (light theme) as transparent PNGs for the PowerPoint version.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const A = __dirname + '/assets/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1159, height: 830 }, deviceScaleFactor: 3, colorScheme: 'light', reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.setDefaultTimeout(180000);
  await p.goto('file:///home/user/-/lessons/chest-trauma.html#2'); await p.waitForTimeout(600);
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await p.addStyleTag({ content: '.lbl3d,.hint,.seg3d,.modeTag,.phase,.dock,#prog{display:none!important} html,body,#viewport,.stage,.slide,.slide::after,.card,.v3d{background:transparent!important;border-color:transparent!important;box-shadow:none!important}' });
  const have = n => fs.existsSync(A + n + '.png');
  async function go(n, wait) { await p.evaluate(n => { location.hash = '#' + n; }, n); await p.waitForTimeout(wait || 2200); }
  async function shot(sel, name) { const el = await p.$('.slide.active ' + sel); const r = await el.boundingBox(); await p.screenshot({ path: A + name + '.png', omitBackground: true, clip: r }); console.log('ok', name); }
  async function pick(v, wait) { await p.evaluate(v => document.querySelector('.slide.active [data-group] button[data-v="' + v + '"]').click(), v); await p.waitForTimeout(wait || 6000); }
  const svgs = [
    [2, '.ty:nth-of-type(1) svg', 'blunt'], [2, '.ty:nth-of-type(2) svg', 'penetrating'],
    [4, '.dg:nth-child(1) svg', 'dg-resp'], [4, '.dg:nth-child(2) svg', 'dg-bleed'], [4, '.dg:nth-child(3) svg', 'dg-shock'], [4, '.dg:nth-child(4) svg', 'dg-death'],
    [5, '.cl:nth-child(1) > svg', 'cl-blunt'], [5, '.cl:nth-child(2) > svg', 'cl-pen'], [13, '.card.tint svg', 'ptx-def'], [21, '.endart', 'ecg']
  ];
  for (const [n, sel, name] of svgs) { if (have(name)) continue; await go(n); await shot(sel, name); }
  if (!have('xray')) { await p.addStyleTag({ content: '.xr{background:#0b0e13!important}' }); await go(17, 3500); await shot('.xr svg', 'xray'); }
  if (!have('thorax')) { await go(1, 6000); await shot('.v3d canvas', 'thorax'); }
  if (!have('fracture')) { await go(9, 6000); await shot('.v3d canvas', 'fracture'); }
  await go(11, 4000);
  for (const [v, name] of [[1, 'flail-in'], [2, 'flail-out']]) { if (have(name)) continue; await pick(v); await shot('.v3d canvas', name); }
  await go(15, 4000);
  for (const v of [0, 1, 2, 3]) { if (have('pleura-' + v)) continue; await pick(v, 7000); await shot('.v3d canvas', 'pleura-' + v); }
  if (!have('pleura-4')) { await go(19, 8000); await shot('.v3d canvas', 'pleura-4'); }
  await go(18, 4000);
  for (const [v, name] of [[0, 'site-needle'], [1, 'site-tube']]) { if (have(name)) continue; await pick(v, 7000); await shot('.v3d canvas', name); }
  await b.close();
})();
