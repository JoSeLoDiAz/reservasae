import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://127.0.0.1:3200';
const valor = fs.readFileSync('.cookie-capturas', 'utf8').trim();
const rutas = ['/admin','/admin/cronograma','/admin/acciones','/admin/participantes','/admin/control','/admin/reservas','/admin/instituciones','/admin/empresas','/admin/inscritos','/admin/sep','/admin/participantes/academico','/admin/participantes/academico/tablero','/admin/formularios','/admin/formularios-publicos','/admin/politicas','/admin/campanas','/admin/plantillas-correo','/admin/correo','/admin/marca','/admin/integraciones/meta','/admin/usuarios','/admin/perfil','/admin/participantes/nuevo','/admin/participantes/carga','/admin/instituciones/pendientes'];
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addCookies([{ name: 'convoca_sesion', value: valor, url: BASE }]);
const p = await ctx.newPage();
for (const ruta of rutas) {
  await p.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await p.waitForFunction(() => !document.body.innerText.trim().startsWith('Cargando'), { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const malos = await p.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return ['sin main'];
    const izq = main.getBoundingClientRect().left;
    const out = [];
    // hijos directos de la raiz de la pagina
    const raiz = main.firstElementChild;
    if (!raiz) return [];
    for (const hijo of raiz.children) {
      const r = hijo.getBoundingClientRect();
      if (r.height < 8) continue;
      // ¿tiene texto que empiece pegado al canto?
      const t = hijo.querySelector('h1,h2,h3,p,span,input,label,table');
      if (!t) continue;
      const rt = t.getBoundingClientRect();
      if (rt.left - izq < 12) out.push(`${hijo.tagName.toLowerCase()}.${(hijo.className||'').slice(0,45)}`);
    }
    return out;
  });
  if (malos.length) console.log(`${ruta}\n   ` + malos.join('\n   '));
}
await nav.close();
