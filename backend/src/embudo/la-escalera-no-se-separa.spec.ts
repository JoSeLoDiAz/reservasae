/** La escalera del navegador dice lo mismo que la del servidor. */

/// `ESCALERA` vive dos veces: aquí y en `frontend/src/lib/visita.ts`.
/// Tiene que ser así —el navegador no puede importar del backend—,
/// pero dos verdades sin nada que las sujete acaban discrepando.
/// El síntoma sería un embudo con un peldaño que el servidor no
/// sabe colocar, o peor: uno colocado en el sitio equivocado, que
/// no falla y dibuja una caída donde no la hay.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ESCALERA,
  MARCAS,
  SEGUNDOS_PARA_CONTAR,
  VERSION_EMBUDO,
} from './escalera';

const ARCHIVO = join(__dirname, '..', '..', '..', 'frontend', 'src', 'lib', 'visita.ts');

/** Los valores del arreglo `nombre` tal como los declara el panel. */
function arregloDelPanel(texto: string, nombre: string): string[] {
  const abre = texto.indexOf(`export const ${nombre} = [`);
  if (abre < 0) throw new Error(`El panel no declara ${nombre}`);
  const cierra = texto.indexOf('] as const;', abre);
  if (cierra < 0) throw new Error(`${nombre} sin cerrar`);
  const cuerpo = texto.slice(texto.indexOf('[', abre) + 1, cierra);
  return [...cuerpo.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
}

describe('la escalera del embudo', () => {
  const texto = readFileSync(ARCHIVO, 'utf8');

  it('tiene los MISMOS peldaños y EN EL MISMO ORDEN', () => {
    expect(arregloDelPanel(texto, 'ESCALERA')).toEqual([...ESCALERA]);
  });

  it('tiene las mismas marcas fuera de la escalera', () => {
    expect(arregloDelPanel(texto, 'MARCAS')).toEqual([...MARCAS]);
  });

  /// El temporizador lo dispara el navegador y lo interpreta el
  /// servidor. Con dos números distintos, la pantalla diria
  /// «personas» de un corte que nadie aplicó.
  it('cuenta los mismos segundos en los dos lados', () => {
    const m = texto.match(/export const SEGUNDOS_PARA_CONTAR = (\d+);/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(SEGUNDOS_PARA_CONTAR);
  });

  /// Si el orden cambia y la versión no, el informe mezcla dos
  /// formularios distintos en las mismas barras.
  it('va por la misma versión en los dos lados', () => {
    const m = texto.match(/export const VERSION_EMBUDO = (\d+);/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(VERSION_EMBUDO);
  });

  /// `REGISTRADO` es el único que el navegador no puede mandar:
  /// lo escribe el servidor al crear la ficha.
  it('el navegador declara REGISTRADO pero la puerta no lo acepta', () => {
    expect(arregloDelPanel(texto, 'ESCALERA')).toContain('REGISTRADO');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DEL_NAVEGADOR } = require('./escalera') as { DEL_NAVEGADOR: string[] };
    expect(DEL_NAVEGADOR).not.toContain('REGISTRADO');
  });
});
