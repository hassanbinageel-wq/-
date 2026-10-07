const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:1600,height:900}, deviceScaleFactor:3, colorScheme:'light', reducedMotion:'reduce' });
  const p = await ctx.newPage();
  await p.goto('file:///home/user/-/lessons/basic-clinical-examination.html#2'); await p.waitForTimeout(400);
  await p.addStyleTag({content:'.slide,.slide.divider,body,.deck,.main,.dev,.vcard,.sys,.circ,.ecard{background:transparent!important;border-color:transparent!important;box-shadow:none!important}'});
  const A = __dirname + '/assets/';
  const list = [
    [1,'.hero-fig svg','steth'],[4,'.dev svg','thermo'],[5,'.dev svg','pulse'],[6,'.dev svg','lungs'],[7,'.dev svg','bp'],[8,'.dev svg','spo2'],
    [9,'.sys:nth-child(1) svg','heart'],[9,'.sys:nth-child(3) svg','abdomen'],[9,'.sys:nth-child(4) svg','brain'],[9,'.sys:nth-child(5) svg','bone'],
    [10,'.st:nth-child(1) svg','eye'],[10,'.st:nth-child(2) svg','hand'],[10,'.st:nth-child(3) svg','percuss'],[10,'.st:nth-child(4) svg','ausc'],
    [13,'.exam > .dev svg','valves'],[18,'.exam > .dev svg','abdmap'],[21,'.exam > .dev svg','reflex'],[21,'.dev.sm svg','gait']
  ];
  for (const [n, sel, name] of list) {
    await p.evaluate(n => { location.hash = '#' + n; }, n); await p.waitForTimeout(700);
    const el = await p.$('.slide.active ' + sel);
    await el.screenshot({ path: A + name + '.png', omitBackground: true }); console.log('ok', name);
  }
  await b.close();
})();
