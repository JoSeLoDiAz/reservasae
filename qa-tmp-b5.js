const { chromium } = require('./node_modules/.pnpm/playwright@1.62.1/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport:{width:1600,height:900} })).newPage();
  await page.goto('http://localhost:3100/admin',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('input[type=password]',{timeout:60000}); await page.waitForTimeout(1200);
  await page.locator('input[type=email]').first().fill('ana.jaramillo@ejemplo.test');
  await page.locator('input[type=password]').first().fill('Prueba2026*');
  await page.locator('input[type=password]').first().press('Enter');
  await page.waitForTimeout(7000);
  for (const r of ['/admin/empresas','/admin/participantes','/admin/usuarios']) {
    await page.goto('http://localhost:3100'+r,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(10000);
    const basura = await page.evaluate(()=>{
      const b=document.body.innerText;
      return [...new Set((b.match(/[^\n]*\b(QA|BORRAR|NO USAR|PRUEBA)\b[^\n]*/gi)||[]).map(s=>s.trim().slice(0,110)))].slice(0,10);
    });
    console.log(`### ${r} basura de pruebas visible:`, JSON.stringify(basura,null,1));
  }
  // guardar gestion
  await page.goto('http://localhost:3100/admin/participantes/cmtjezkcf00uannxcily2wo9g',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(10000);
  await page.getByRole('button',{name:'Guardar gestión',exact:true}).click();
  await page.waitForTimeout(3000);
  const g = await page.evaluate(()=>{
    const d=[...document.querySelectorAll('[role=dialog], .fixed')].filter(x=>x.offsetParent!==null);
    const txt=d.map(x=>x.innerText.replace(/\s+/g,' ').trim().slice(0,400));
    return { txt, tieneTexto: txt.join(' ').includes('Mensaje de texto')||/\bTexto\b/.test(txt.join(' ')) };
  });
  console.log('GUARDAR GESTION:', JSON.stringify(g,null,1));
  await browser.close();
})().catch(e=>{console.error('FALLO',e);process.exit(1);});
