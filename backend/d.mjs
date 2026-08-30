import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:3200';
const r = await fetch(`${BASE}/api/admin/sesion`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ correo: 'ana.jaramillo@ejemplo.test', clave: 'Prueba2026*' }) });
const g = (r.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('convoca_sesion='));
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1630, height: 900 } });
await ctx.addCookies([{ name: 'convoca_sesion', value: g.split(';')[0].slice('convoca_sesion='.length), url: BASE }]);
const p = await ctx.newPage();
for (const ruta of process.argv.slice(2)) {
  const n = ruta.replace(/^\/admin\/?/, '').replace(/\//g, '-') || 'tablero';
  await p.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await p.waitForFunction(() => !document.body.innerText.trim().startsWith('Cargando'), { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1700);
  await p.screenshot({ path: `d-${n}.png` });
  console.log('  ' + n);
}
await nav.close();
