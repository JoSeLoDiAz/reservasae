const { chromium } = require('./node_modules/.pnpm/playwright@1.62.1/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport:{width:1600,height:900} })).newPage();
  await page.goto('http://localhost:3100/admin',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('input[type=password]',{timeout:60000}); await page.waitForTimeout(1200);
  await page.locator('input[type=email], input[name=email]').first().fill('ana.jaramillo@ejemplo.test');
  await page.locator('input[type=password]').first().fill('Prueba2026*');
  await page.locator('input[type=password]').first().press('Enter');
  await page.waitForTimeout(7000);
  await page.goto('http://localhost:3100/admin/participantes/academico/asesores',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(11000);
  const g = await page.evaluate(()=>localStorage.getItem('tabla:asesores-inscripciones'));
  console.log('localStorage escrito en una visita LIMPIA sin tocar nada:');
  console.log(g);
  await browser.close();
})().catch(e=>{console.error('FALLO',e);process.exit(1);});
