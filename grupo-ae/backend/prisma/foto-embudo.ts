import { chromium } from 'playwright';
const BASE='http://localhost:3200';
const CARPETA=process.argv[2]!;
(async()=>{
  const nav=await chromium.launch();
  for(const [w,h] of [[1920,1080],[1366,768]] as const){
    const ctx=await nav.newContext({viewport:{width:w,height:h},locale:'es-CO'});
    const p=await ctx.newPage();
    await p.goto(`${BASE}/admin/login`,{waitUntil:'networkidle'});
    await p.waitForSelector('button[type="submit"]:not([disabled])',{timeout:20000});
    await p.waitForTimeout(600);
    await p.fill('input[type="email"]','ana.jaramillo@ejemplo.test');
    await p.fill('input[type="password"]','Prueba2026*');
    await p.click('button[type="submit"]');
    await p.waitForSelector('text=Resumen',{timeout:30000});
    await p.goto(`${BASE}/admin/embudo`,{waitUntil:'networkidle',timeout:30000});
    await p.waitForTimeout(1800);
    // cuanto mide de verdad el tablero
    const alto = await p.evaluate(() => {
      const el = document.querySelector('[class*="auto-cols"]') as HTMLElement | null;
      return el ? Math.round(el.getBoundingClientRect().height) : -1;
    });
    await p.screenshot({path:`${CARPETA}/embudo-${w}.png`});
    console.log(`  ${w}x${h}: el tablero mide ${alto} px de alto`);
    await ctx.close();
  }
  await nav.close();
})().catch(e=>{console.error(e.message.split('\n')[0]);process.exit(1)});
