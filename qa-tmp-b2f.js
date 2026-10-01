const { chromium } = require('./node_modules/.pnpm/playwright@1.62.1/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport:{width:1600,height:900} })).newPage();
  const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200));}); page.on('pageerror',e=>errs.push('PAGINA: '+e.message.slice(0,200)));
  await page.goto('http://localhost:3100/admin',{waitUntil:'domcontentloaded'});
  await page.waitForSelector("input[type=password]",{timeout:60000}); await page.waitForTimeout(1200);
  await page.locator('input[type=email], input[name=email]').first().fill('ana.jaramillo@ejemplo.test');
  await page.locator('input[type=password]').first().fill('Prueba2026*');
  await page.locator('input[type=password]').first().press('Enter');
  await page.waitForTimeout(7000);
  // vista guardada ANTIGUA: orden viejo + columnas que ya no existen
  await page.evaluate(()=>{
    localStorage.setItem('tabla:asesores-inscripciones', JSON.stringify({
      visibles:["nombre","metaGlobal","total","antiguedadMedia","gestionados","inscritos","descartados","cierre","exigido","estado"],
      vistas:[], anchos:{}, conocidas:["nombre","metaGlobal","total","antiguedadMedia","gestionados","inscritos","descartados","cierre","exigido","estado"]
    }));
  });
  errs.length=0;
  await page.goto('http://localhost:3100/admin/participantes/academico/asesores',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(11000);
  const th = await page.evaluate(()=>[...document.querySelectorAll('table thead th')].map(x=>x.innerText.replace(/\s+/g,' ').trim()));
  console.log('CON VISTA GUARDADA ANTIGUA, cabeceras:', JSON.stringify(th));
  console.log('errores:', JSON.stringify([...new Set(errs)].slice(0,5)));
  await browser.close();
})().catch(e=>{console.error('FALLO',e);process.exit(1);});
