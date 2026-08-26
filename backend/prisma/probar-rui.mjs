/** Prueba el proveedor del RUI contra el portal de verdad. */

/// Con un documento que no existe: valida que abra, elija el
/// tipo, espere a que termine la consulta y entienda la
/// respuesta, sin tocar los datos de ninguna persona.

import { chromium } from 'playwright';

const PORTAL = 'https://ventanillasocial.dnp.gov.co/';
const ESPERA = 25_000;
const CADA = 500;

const sinTildes = (t) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const navegador = await chromium.launch({ headless: true });
const contexto = await navegador.newContext();
const pagina = await contexto.newPage();

try {
  await pagina.goto(PORTAL, { timeout: 45_000, waitUntil: 'domcontentloaded' });
  await pagina.getByText('Consulta RUI', { exact: false }).first().click();
  await pagina.waitForSelector('#ruiNumDoc', { state: 'visible', timeout: 20_000 });

  // «3» es cedula de ciudadania en la numeracion del portal
  await pagina.locator('#ruiTipoDoc').selectOption({ value: '3' });
  await pagina.fill('#ruiNumDoc', '1111111111');
  await pagina.getByRole('button', { name: /consultar/i }).first().click();

  await pagina.waitForSelector('#ruiResultado', { state: 'visible', timeout: 15_000 });

  const desde = Date.now();
  const hasta = desde + ESPERA;
  let todo = '';

  while (Date.now() < hasta) {
    todo = sinTildes((await pagina.locator('#ruiResultado').innerText()).trim());
    if (!todo.includes('consultando')) break;
    await pagina.waitForTimeout(CADA);
  }

  const tardo = ((Date.now() - desde) / 1000).toFixed(1);
  console.log(`el portal contestó en ${tardo}s`);
  console.log();

  if (todo.includes('no encontrado') || todo.includes('no se encontro')) {
    console.log('  → SIN_RESULTADO, que es lo correcto para un documento inventado');
  } else if (todo.includes('consultando')) {
    console.log('  → se quedó consultando: el portal no terminó');
  } else {
    console.log('  → contestó otra cosa. Texto tal cual:');
  }

  console.log();
  console.log('  texto del recuadro:');
  console.log('  ' + (await pagina.locator('#ruiResultado').innerText()).trim().slice(0, 400).replace(/\n/g, '\n  '));
} catch (e) {
  console.error('FALLÓ:', e instanceof Error ? e.message.split('\n')[0] : e);
  process.exitCode = 1;
} finally {
  await navegador.close();
}
