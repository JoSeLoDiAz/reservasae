/** La regla del cumplimiento vive en dos sitios y no pueden discrepar. */

/**
 * EL PANEL TIENE SU COPIA, Y ES DELIBERADO.
 *
 * La fila Total de las dos tablas no promedia porcentajes: los
 * recalcula sumando las filas. Para eso necesita la regla en el
 * navegador, así que hay dos copias --como `PERMISOS_POR_ROL`-- y lo
 * que las sujeta es este spec.
 *
 * Y HUBO DAÑO: antes de esto el panel dividía sin el guard del backend,
 * así que el Total podía imprimir una cifra mientras TODAS sus filas
 * imprimían «—». Dos verdades sobre la misma decisión.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cumplimiento } from './proyeccion-metas';

const DEL_PANEL = join(
  __dirname, '..', '..', '..', 'frontend', 'src', 'lib', 'cumplimiento.ts',
);

describe('el cumplimiento no se separa del panel', () => {
  const texto = readFileSync(DEL_PANEL, 'utf8');

  it('el panel declara la función', () => {
    expect(texto).toMatch(/export function cumplimiento\(/);
  });

  /// Se compara el CUERPO, no el fichero: los docblocks son distintos
  /// a proposito --cada uno explica por que existe su copia--.
  it('el cuerpo es el mismo que el del servidor', () => {
    const cuerpo = (t: string) =>
      (/export function cumplimiento\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(t)?.[1] ?? '')
        .replace(/\/\/.*$/gm, '')
        .replace(/\s+/g, ' ')
        .trim();

    const delServidor = cuerpo(
      readFileSync(join(__dirname, 'proyeccion-metas.ts'), 'utf8'),
    );
    expect(delServidor).not.toBe('');
    expect(cuerpo(texto)).toBe(delServidor);
  });

  /// Lo que de verdad importa que no cambie, por si alguien
  /// reescribe las dos a la vez.
  it('sin meta no hay cumplimiento, y pasarse SÍ se imprime', () => {
    expect(cumplimiento(10, 0)).toBeNull();
    expect(cumplimiento(0, 0)).toBeNull();
    expect(cumplimiento(15, 20)).toBeCloseTo(0.75, 5);
    /// 120 % es la noticia buena: esconderla seria esconder justo
    /// lo que Josse pidio ver.
    expect(cumplimiento(24, 20)).toBeCloseTo(1.2, 5);
  });
});
