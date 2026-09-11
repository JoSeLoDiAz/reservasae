/** Fotografía el panel entero, pantalla por pantalla. */

/**
 * Existe porque «se ve crudo» no se arregla leyendo código.
 *
 * Un agente que solo lee el JSX puede jurar que una pantalla está
 * bien y estar equivocado: el desajuste entre módulos vive en el
 * espacio en blanco, en el peso del título, en si la tabla arranca
 * pegada al borde y en si el bloque de al lado usa otro margen.
 * Nada de eso se lee: se mira.
 *
 * Entra con una cuenta sembrada, recorre las rutas del panel y deja
 * un PNG por pantalla. Después esas imágenes se juzgan juntas, que
 * es la única forma de ver si el conjunto es uniforme.
 *
 * Uso:  pnpm exec ts-node prisma/capturar-panel.ts [carpeta]
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright';

/**
 * `localhost` y NUNCA `127.0.0.1`.
 *
 * Next 16 bloquea 127.0.0.1 como origen de desarrollo y la pagina
 * NO HIDRATA: se queda en «Cargando…» para siempre, sin error
 * visible. Las capturas salian en blanco y el diagnostico apuntaba
 * a todas partes menos aqui.
 */
const BASE = process.env.PANEL_URL ?? 'http://localhost:3200';
const CORREO = process.env.PANEL_CORREO ?? 'ana.jaramillo@ejemplo.test';
const CLAVE = process.env.PANEL_CLAVE ?? 'Prueba2026*';
const ANCHO = Number(process.env.PANEL_ANCHO ?? 1920);
const ALTO = Number(process.env.PANEL_ALTO ?? 1080);

/// Las rutas del panel que un usuario puede alcanzar hoy desde el
/// menú, más las públicas. Si mañana hay un módulo nuevo y no está
/// aquí, no sale en la foto y nadie lo revisa: la lista se amplía
/// con el menú, no se olvida.
const PANTALLAS: Array<{ nombre: string; ruta: string; publica?: boolean }> = [
  { nombre: '01-resumen', ruta: '/admin' },
  { nombre: '02-embudo', ruta: '/admin/embudo' },
  { nombre: '03-leads-empresas', ruta: '/admin/leads/empresas' },
  { nombre: '04-leads-personas', ruta: '/admin/leads/personas' },
  { nombre: '05-formularios-empresas', ruta: '/admin/formularios' },
  { nombre: '06-formularios-personas', ruta: '/admin/formularios-publicos' },
  { nombre: '07-habeas-data', ruta: '/admin/politicas' },
  { nombre: '08-campanas', ruta: '/admin/campanas' },
  { nombre: '09-plantillas', ruta: '/admin/plantillas-correo' },
  { nombre: '10-cuenta-de-correo', ruta: '/admin/correo' },
  { nombre: '11-apariencia', ruta: '/admin/marca' },
  { nombre: '12-usuarios', ruta: '/admin/usuarios' },
  { nombre: '13-perfil', ruta: '/admin/perfil' },
  /**
   * Las publicas son `/empresas` y `/personas`, por el SLUG DEL
   * FORMULARIO -- no `/<convenio>/preinscripcion`.
   *
   * Aqui estaban las de convenio, que pintan una pagina generica
   * («Cuentenos que necesita») igual para los dos, y por eso las dos
   * capturas salian identicas byte a byte. Resultado: NADIE habia
   * revisado nunca los formularios que se reparten de verdad, que
   * son estos dos y dicen «Contacto de empresas» y «Contacto de
   * personas».
   *
   * Fotografiar la pagina equivocada es no fotografiar.
   */
  { nombre: '20-publico-empresas', ruta: '/empresas', publica: true },
  { nombre: '21-publico-personas', ruta: '/personas', publica: true },
  { nombre: '22-publico-generico', ruta: '/grupo-ae/preinscripcion', publica: true },
];

async function main() {
  const carpeta = process.argv[2] ?? join(process.cwd(), 'capturas');
  mkdirSync(carpeta, { recursive: true });

  const navegador = await chromium.launch();
  /**
   * 1920x1080, que es la pantalla del dueño.
   *
   * Aqui decia 1440x900 «porque es la pantalla en la que se trabaja
   * de verdad», y era una suposicion mia. A 1440 una columna estrecha
   * llena el ancho y se ve bien; a 1920 deja media pantalla vacia.
   * Los agentes validaron el diseño en una resolucion que nadie usa
   * aqui, y por eso dieron por bueno lo que el dueño vio roto.
   *
   * Validar en la pantalla equivocada es no validar.
   *
   * Se puede pedir otra con PANEL_ANCHO y PANEL_ALTO --hace
   * falta para comprobar que arreglar 1920 no rompio 1440--,
   * pero la que sale por omision es la del dueño.
   */
  const contexto = await navegador.newContext({
    viewport: { width: ANCHO, height: ALTO },
    deviceScaleFactor: 1,
    locale: 'es-CO',
  });
  const pagina = await contexto.newPage();

  // ── entrar ────────────────────────────────────────────────────
  await pagina.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' });
  /**
   * Esperar a que React ENGANCHE, no solo a que la pagina cargue.
   *
   * Sin esto, el clic en Entrar llegaba antes de que el manejador
   * de React existiera y el navegador hacia un envio nativo del
   * formulario: volvia a /admin/login?, sin sesion y sin error.
   * El sintoma engaña porque la pagina se ve perfecta.
   *
   * El boton deshabilitado mientras carga es la señal de que el
   * componente ya vive.
   */
  await pagina.waitForSelector('button[type="submit"]:not([disabled])', {
    timeout: 20_000,
  });
  await pagina.waitForTimeout(600);
  await pagina.fill('input[type="email"], input[name="correo"]', CORREO);
  await pagina.fill('input[type="password"]', CLAVE);
  await pagina.click('button[type="submit"]');

  /**
   * Se espera a que aparezca el MENÚ, no a que navegue el navegador.
   *
   * `waitForURL` esperaba un evento `load`, y Next entra al panel con
   * `router.replace`: navegación del lado del cliente, sin recarga.
   * El evento nunca llegaba y el guion moría a los 20 segundos
   * habiendo entrado perfectamente.
   *
   * El rótulo «Resumen» de la barra solo existe con sesión abierta,
   * así que verlo es la prueba de que se entró — y además de que el
   * panel ya pintó, que es lo que hay que fotografiar.
   */
  await pagina.waitForSelector('text=Resumen', { timeout: 30_000 });

  const hechas: string[] = [];
  const fallidas: string[] = [];

  for (const p of PANTALLAS) {
    try {
      await pagina.goto(`${BASE}${p.ruta}`, {
        waitUntil: 'networkidle',
        timeout: 30_000,
      });
      /// Un respiro para lo que se pinta después de la primera
      /// carga: las cifras llegan por fetch y sin esto salen los
      /// esqueletos grises en vez de los datos.
      await pagina.waitForTimeout(1200);
      /**
       * LA VENTANA, NO LA PAGINA ENTERA.
       *
       * Iba `fullPage: true` y eso metia dos mentiras en la foto.
       *
       * La primera, y es la que costo dos rondas de agentes: en
       * toda pantalla mas alta que la ventana --Apariencia y
       * Usuarios-- el logotipo de la barra salia como un trazo
       * de tres pixeles donde deberia decir «Grupo AE». Se
       * diagnostico como un fallo de render del producto y se
       * «arreglo» dos veces. No lo era. Con `fullPage`, Chromium
       * captura mas alla de la ventana y al hacerlo REARRANCA
       * las animaciones CSS: la firma se estaba fotografiando en
       * su primer fotograma, cuando el arco aun no se ha
       * dibujado y el nombre sigue tapado por su mascara. El
       * mismo instante, sin `fullPage`, sale entero. El DOM lo
       * confirma: a 1500 ms y a 4000 ms la firma mide 92x17, en
       * #0f172a y con sus animaciones en `finished`.
       *
       * La segunda es de criterio: la direccion se juzga con la
       * prueba de la primera fila --«en las quince, la primera
       * fila de datos se ve sin desplazar»-- y esa prueba no se
       * puede hacer sobre una imagen que cose la pagina entera
       * en un solo lienzo. La ventana es lo que ve el dueño
       * cuando abre el panel, y es lo unico que hay que juzgar.
       *
       * Lo que quede por debajo del pliegue se mira desplazando,
       * que es como se mira de verdad.
       */
      await pagina.screenshot({
        path: join(carpeta, `${p.nombre}.png`),
        fullPage: false,
      });
      hechas.push(p.nombre);
    } catch (e) {
      fallidas.push(`${p.nombre} (${p.ruta}): ${(e as Error).message.split('\n')[0]}`);
    }
  }

  await navegador.close();

  console.log(`\n  ${hechas.length} pantallas capturadas en ${carpeta}`);
  hechas.forEach((h) => console.log(`    ✓ ${h}`));
  if (fallidas.length > 0) {
    console.log(`\n  ${fallidas.length} no se pudieron capturar:`);
    fallidas.forEach((f) => console.log(`    ✗ ${f}`));
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
