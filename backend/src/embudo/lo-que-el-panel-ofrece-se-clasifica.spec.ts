/** Lo que el panel deja marcar, el servidor lo sabe clasificar. */

/// El armador de enlaces de `/admin/formularios-publicos` ofrece
/// un canal y lo escribe como `utm_source`. Si ofreciera uno que
/// `procedenciaSql()` no reconoce, ese envío caería en «Otro
/// declarado» — o sea, marcado y sin separar, que es lo mismo que
/// no marcarlo, y sin que nada falle. Dos verdades sobre la misma
/// decisión, el patrón de siempre.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DICEN_PAUTA, procedenciaSql } from './procedencia';

const ARCHIVO = join(
  __dirname,
  '..',
  '..',
  '..',
  'frontend',
  'src',
  'components',
  'admin',
  'formulario-publico.tsx',
);

/// El valor que el panel usa para «lo escribo yo». NO es un canal:
/// no viaja nunca, solo abre el campo de texto. Se descuenta de la
/// comprobacion de abajo a proposito, y se comprueba aparte que
/// siga existiendo.
const MARCADOR_PROPIO = '__propio';

/**
 * El valor de una constante del panel, `export const X = "…"`.
 *
 * Hace falta porque una de las entradas de la lista NO es un
 * literal sino `utm: CANAL_PROPIO`, y se escribe asi a proposito:
 * la palabra vive en un sitio y no en dos. Un parser que solo
 * entienda literales se la saltaria en silencio --que es lo que
 * hacia-- y esta prueba diria que todo esta bien porque no ve lo
 * que no sabe leer.
 */
function constanteDelPanel(texto: string, nombre: string): string {
  const m = new RegExp(`export const ${nombre} = "([^"]*)"`).exec(texto);
  if (!m) throw new Error(`El panel no declara ${nombre}`);
  return m[1];
}

/** Los `utm` que el panel ofrece en su desplegable. */
function canalesDelPanel(texto: string): string[] {
  const abre = texto.indexOf('export const CANALES_DEL_ENLACE = [');
  if (abre < 0) throw new Error('El panel no declara CANALES_DEL_ENLACE');
  const cierra = texto.indexOf('] as const;', abre);
  if (cierra < 0) throw new Error('CANALES_DEL_ENLACE sin cerrar');
  const cuerpo = texto.slice(abre, cierra);
  return [...cuerpo.matchAll(/utm:\s*(?:"([^"]*)"|([A-Z_][A-Z0-9_]*))/g)].map((m) =>
    m[1] !== undefined ? m[1] : constanteDelPanel(texto, m[2]),
  );
}

/// Los valores contra los que compara el `CASE`, tal como Prisma
/// los va a mandar. Se miran los PARÁMETROS y no el texto del
/// SQL, igual que en `procedencia.spec.ts`.
const RECONOCIDOS = new Set(
  (procedenciaSql().values as unknown[]).filter(
    (v): v is string => typeof v === 'string',
  ),
);

describe('los canales que ofrece el panel', () => {
  const canales = canalesDelPanel(readFileSync(ARCHIVO, 'utf8'));

  it('el panel ofrece alguno, y uno de ellos es no marcar', () => {
    expect(canales.length).toBeGreaterThan(1);
    expect(canales).toContain('');
  });

  it('todos los demás los clasifica el servidor', () => {
    const marcables = canales.filter((c) => c !== '' && c !== MARCADOR_PROPIO);
    expect(marcables.length).toBeGreaterThan(0);
    for (const c of marcables) expect(RECONOCIDOS.has(c)).toBe(true);
  });

  /// El canal escrito a mano (cliente, 24 sep 2026). Cae en «Otro
  /// declarado», y aqui eso NO es el fallo que seria en una opcion
  /// fija: quien lo escribe eligio inventarse el canal.
  it('se puede escribir un canal propio', () => {
    expect(canales).toContain(MARCADOR_PROPIO);
  });

  /// LA PUERTA DE ATRAS DEL CAMPO LIBRE. El desplegable no ofrece
  /// Meta a proposito; un campo de texto la ofreceria a todo el que
  /// sepa teclear «meta». El panel las prohibe, y esto ata que las
  /// prohiba TODAS: anadir una palabra de Meta al servidor sin
  /// anadirla alla rompe esta prueba, que es justo lo que tiene que
  /// pasar.
  it('el panel prohíbe escribir a mano todas las palabras de Meta', () => {
    const texto = readFileSync(ARCHIVO, 'utf8');
    const abre = texto.indexOf('export const PALABRAS_DE_PAUTA = [');
    expect(abre).toBeGreaterThan(-1);
    const cierra = texto.indexOf('] as const;', abre);
    expect(cierra).toBeGreaterThan(abre);
    const prohibidas = [...texto.slice(abre, cierra).matchAll(/"([^"]+)"/g)].map((m) => m[1]);

    expect(prohibidas.length).toBeGreaterThan(0);
    for (const palabra of DICEN_PAUTA) expect(prohibidas).toContain(palabra);
  });

  /// El correo es el que motivó todo esto: un mailing sin
  /// etiqueta se contaba como «otra página web».
  it('el correo está entre lo que se puede marcar', () => {
    expect(canales).toContain('correo');
  });

  /// NO se ofrecen las de Meta, y es deliberado: esas las pone
  /// Ads Manager. Un desplegable que las ofreciera dejaría marcar
  /// a mano como pauta un tráfico que no lo es.
  it('no se puede marcar tráfico como si fuera pauta', () => {
    for (const prohibido of ['fb', 'facebook', 'ig', 'instagram', 'meta']) {
      expect(canales).not.toContain(prohibido);
    }
  });
});
