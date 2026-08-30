import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://127.0.0.1:3200';
const valor = fs.readFileSync('.cookie-capturas', 'utf8').trim();
const nav = await chromium.launch();
const ctx = await nav.newContext();
await ctx.addCookies([{ name: 'convoca_sesion', value: valor, url: BASE }]);
const p = await ctx.newPage();
for (const [lista, pref] of [['/admin/acciones', '/admin/acciones/'], ['/admin/participantes', '/admin/participantes/'], ['/admin/instituciones', '/admin/instituciones/']]) {
  await p.goto(BASE + lista, { waitUntil: 'networkidle', timeout: 45000 });
  await p.waitForTimeout(2500);
  const hrefs = await p.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
  const h = hrefs.find((x) => x && x.startsWith(pref) && x !== pref && !/nuevo|carga|academico|seguimiento|pendientes/.test(x));
  console.log(h ?? 'NADA ' + lista);
}
await nav.close();
