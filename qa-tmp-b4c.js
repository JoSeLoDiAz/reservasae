const { chromium } = require('./node_modules/.pnpm/playwright@1.62.1/node_modules/playwright');
const RUTAS = ['/admin','/admin/informes/trafico','/admin/informes/leads','/admin/informes/reservas','/admin/acciones','/admin/participantes','/admin/participantes/academico/tablero','/admin/participantes/academico/asesores','/admin/usuarios','/admin/sep','/admin/instituciones','/admin/empresas','/admin/participantes/carga','/admin/participantes/grupos'];
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport:{width:1600,height:900} })).newPage();
  await page.goto('http://localhost:3100/admin', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.locator('input[type=email], input[name=email]').first().fill('ana.jaramillo@ejemplo.test');
  await page.locator('input[type=password]').first().fill('Prueba2026*');
  await page.locator('input[type=password]').first().press('Enter');
  await page.waitForTimeout(7000);
  const todos = new Set();
  for (const r of RUTAS) {
    await page.goto('http://localhost:3100'+r, { waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForTimeout(6500);
    const hrefs = await page.evaluate(()=>[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')));
    hrefs.forEach(h=>todos.add(h));
    const ocup = hrefs.filter(h=>/ocupacion/i.test(h));
    if (ocup.length) console.log(`!! ${r} ENLAZA a ocupacion:`, ocup);
  }
  await page.goto('http://localhost:3100/admin', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(6500);
  const bs = await page.locator('header button, nav button').all();
  for (const b of bs) { try { await b.click({timeout:2000}); await page.waitForTimeout(400); const h = await page.evaluate(()=>[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))); h.forEach(x=>todos.add(x)); } catch(e){} }
  console.log('TOTAL hrefs distintos:', todos.size);
  console.log('ENLACES a ocupacion:', JSON.stringify([...todos].filter(h=>/ocupacion/i.test(h))));
  console.log('hrefs /admin:', JSON.stringify([...todos].filter(h=>h&&h.startsWith('/admin')).sort()));
  await browser.close();
})().catch(e=>{console.error('FALLO',e);process.exit(1);});
