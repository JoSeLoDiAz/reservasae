/** Ningún aviso puede titular lo contrario de lo que cuenta. */

/**
 * EL TÍTULO ES LO ÚNICO QUE SE LEE, Y POR ESO ESTO IMPORTA.
 *
 * `campana-de-avisos.tsx` pinta `n.titulo` y NO pinta `n.detalle`,
 * así que un tipo cuya etiqueta contradiga su detalle le cuenta al
 * asesor lo contrario de lo que pasó --y el título se CONGELA en la
 * fila, o sea que corregirlo después no arregla lo ya escrito.
 *
 * Pasó: la rama de quien declara DESEMPLEADO avisaba con
 * `DATOS_DE_EMPRESA` ---«Completó los datos de su organización»---
 * llevando el detalle «declaró que no tiene organización». Fueron 44
 * de 266 avisos, y el equipo entraba a fichas vacías sin explicación.
 *
 * Recorre la SUPERFICIE y no el caso: busca todo `avisar(` del árbol.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TIPOS, ETIQUETA } from './tipos';

const RAIZ = join(__dirname, '..');

function ficherosTs(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre === 'node_modules' || nombre === 'generated') continue;
      salida.push(...ficherosTs(ruta));
    } else if (nombre.endsWith('.ts') && !nombre.endsWith('.spec.ts')) {
      salida.push(ruta);
    }
  }
  return salida;
}

/// Sin comentarios: este proyecto cita sus tipos en los docblocks
/// mas veces de las que los usa, y contarlos daria falsos.
const sinComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

type Llamada = { fichero: string; tipo: string; detalle: string };

function llamadasAAvisar(): Llamada[] {
  const fuera: Llamada[] = [];
  for (const ruta of ficherosTs(RAIZ)) {
    const texto = sinComentarios(readFileSync(ruta, 'utf8'));
    for (const m of texto.matchAll(/avisar\(\{([\s\S]{0,600}?)\}\)/g)) {
      const cuerpo = m[1];
      const tipo = /tipo:\s*'([A-Z_]+)'/.exec(cuerpo)?.[1];
      if (!tipo) continue;
      const detalle = /detalle:\s*'([^']*)'/.exec(cuerpo)?.[1] ?? '';
      fuera.push({ fichero: ruta.replace(RAIZ, ''), tipo, detalle });
    }
  }
  return fuera;
}

describe('un aviso no titula lo contrario de lo que cuenta', () => {
  const llamadas = llamadasAAvisar();

  /// Sin esto, renombrar `avisar` dejaria el spec en verde sin
  /// mirar nada. Es la leccion de `quien-crea-se-queda-la-ficha`.
  it('encuentra avisos que mirar', () => {
    expect(llamadas.length).toBeGreaterThanOrEqual(4);
  });

  it('todo tipo usado existe en el catálogo', () => {
    const malos = llamadas.filter((l) => !(TIPOS as readonly string[]).includes(l.tipo));
    expect(malos).toEqual([]);
  });

  it('todo tipo del catálogo tiene etiqueta', () => {
    for (const t of TIPOS) expect(ETIQUETA[t]).toBeTruthy();
  });

  /// EL CANDADO. Un detalle que dice que NO hay organizacion no
  /// puede ir con una etiqueta que dice que SI la completo.
  it('quien declara que no tiene organización no se anuncia como que la completó', () => {
    const contradicen = llamadas.filter(
      (l) => /no tiene organiz/i.test(l.detalle) && /complet/i.test(ETIQUETA[l.tipo as never] ?? ''),
    );
    expect(contradicen).toEqual([]);
  });

  /// La otra mitad del par: la rama que SI la completa tampoco
  /// puede acabar anunciandose como que no la tiene.
  it('quien sí la completó no se anuncia como que no la tiene', () => {
    const contradicen = llamadas.filter(
      (l) => /completó los datos de su organiz/i.test(l.detalle) && /no tiene/i.test(ETIQUETA[l.tipo as never] ?? ''),
    );
    expect(contradicen).toEqual([]);
  });
});
