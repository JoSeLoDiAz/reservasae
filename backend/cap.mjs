import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:3200';
const rutas = process.argv.slice(2);
// La cookie se guarda y se reusa: el login tiene un limite
// de 8 por ventana y capturando pantalla a pantalla se agota.
import fs from 'node:fs';
const CACHE = '.cookie-capturas';
let valor = fs.existsSync(CACHE) ? fs.readFileSync(CACHE, 'utf8').trim() : '';
if (valor) {
  const prueba = await fetch(`${BASE}/api/admin/yo`, { headers: { cookie: `convoca_sesion=${valor}` } });
  if (!prueba.ok) valor = '';
}
if (!valor) {
  const r = await fetch(`${BASE}/api/admin/sesion`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ correo: 'ana.jaramillo@ejemplo.test', clave: 'Prueba2026*' }) });
  if (!r.ok) { console.log('login', r.status, await r.text()); process.exit(1); }
  const g = (r.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('convoca_sesion='));
  valor = g.split(';')[0].slice('convoca_sesion='.length);
  fs.writeFileSync(CACHE, valor);
}
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addCookies([{ name: 'convoca_sesion', value: valor, url: BASE }]);
const p = await ctx.newPage();
for (const ruta of rutas) {
  const nombre = ruta.replace(/^\/admin\/?/, '').replace(/\//g, '-') || 'tablero';
  await p.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await p.waitForFunction(() => !document.body.innerText.trim().startsWith('Cargando'), { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `cap-${nombre}.png` });
  console.log('  ' + nombre);
}
await nav.close();
