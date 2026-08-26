/** Mira el portal del DNP por dentro, sin consultar a nadie. */

/// Antes de dar por bueno el proveedor hay que saber tres
/// cosas del portal: si abre, que tipos de documento admite y
/// como viene la respuesta. Esto lo averigua sin inventarselo.

import { chromium } from 'playwright';

const PORTAL = 'https://ventanillasocial.dnp.gov.co/';

const navegador = await chromium.launch({ headless: true });
const contexto = await navegador.newContext();
const pagina = await contexto.newPage();

try {
  console.log('abriendo el portal…');
  await pagina.goto(PORTAL, { timeout: 45_000, waitUntil: 'domcontentloaded' });
  console.log('  título:', await pagina.title());

  await pagina.getByText('Consulta RUI', { exact: false }).first().click();
  await pagina.waitForSelector('#ruiNumDoc', { state: 'visible', timeout: 20_000 });
  console.log('  el formulario de consulta existe');

  // qué tipos de documento admite de verdad
  const tipos = await pagina.locator('#ruiTipoDoc option').evaluateAll((os) =>
    os.map((o) => ({ valor: o.getAttribute('value'), etiqueta: o.textContent?.trim() })),
  );
  console.log('\nTIPOS DE DOCUMENTO QUE ADMITE:');
  for (const t of tipos) console.log(`  ${String(t.valor).padEnd(6)} ${t.etiqueta}`);

  // un documento que no existe: valida el camino sin tocar
  // datos de nadie
  console.log('\nconsultando un documento inexistente (1111111111)…');
  await pagina.locator('#ruiTipoDoc').selectOption({ index: 1 });
  await pagina.fill('#ruiNumDoc', '1111111111');
  await pagina.getByRole('button', { name: /consultar/i }).first().click();

  await pagina.waitForSelector('#ruiResultado', { state: 'visible', timeout: 30_000 });
  const texto = (await pagina.locator('#ruiResultado').innerText()).trim();
  console.log('  respondió con', texto.length, 'caracteres:');
  console.log('  ' + texto.slice(0, 300).replace(/\n/g, '\n  '));

  // y como esta armado por dentro, para elegir bien el selector
  const html = await pagina.locator('#ruiResultado').innerHTML();
  console.log('\n  primeros 400 caracteres del HTML:');
  console.log('  ' + html.slice(0, 400).replace(/\n/g, ' '));
} catch (e) {
  console.error('FALLÓ:', e instanceof Error ? e.message.split('\n')[0] : e);
  process.exitCode = 1;
} finally {
  await navegador.close();
}
