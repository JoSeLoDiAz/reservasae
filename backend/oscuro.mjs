import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://127.0.0.1:3200';
const valor = fs.readFileSync('.cookie-capturas', 'utf8').trim();
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addCookies([{ name: 'convoca_sesion', value: valor, url: BASE }]);
const p = await ctx.newPage();
await p.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
await p.evaluate(() => localStorage.setItem('convoca:modo', 'oscuro'));
for (const ruta of ['/admin', '/admin/control', '/admin/reservas']) {
  const n = ruta.replace(/^\/admin\/?/, '') || 'tablero';
  await p.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 45000 });
  await p.waitForFunction(() => !document.body.innerText.trim().startsWith('Cargando'), { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `osc-${n}.png` });
  console.log('  ' + n);
}
await nav.close();
