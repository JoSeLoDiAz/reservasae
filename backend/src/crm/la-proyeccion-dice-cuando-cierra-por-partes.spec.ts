/** La proyección avisa cuando una acción no cierra entera. */

/**
 * «LAS AF NO CIERRAN COMO TAL UNA COMPLETA SINO POR PARTES» (cliente,
 * 2 oct 2026).
 *
 * La columna «Fecha de cierre» de Proyección Inscripciones enseña UNA
 * fecha por acción: la más próxima de sus grupos. De ella salen «# días
 * para el cierre» y la META DIARIA de los asesores.
 *
 * Esa fecha sigue siendo la que manda, y hace bien: en cuanto la
 * primera puerta se cierra ya hay gente a la que no se puede meter ahí.
 * Lo que faltaba era PODER DECIR QUE HAY MÁS. En el cronograma de
 * ADECOPRIA, seis de las siete acciones cierran en dos o más fechas y
 * AF3 en cinco, así que el asesor de los grupos que cierran después
 * leía una fecha que no era la suya sin tener cómo saberlo.
 *
 * Aquí se fija que la fila lleve la lista entera, y que una acción que
 * cierra entera NO lleve nada que avisar: un aviso que sale siempre se
 * deja de leer a la semana.
 */

import { cierresPorAccion } from './asesores-datos';
import type { Modalidad } from '../../generated/prisma';

const d = (iso: string) => new Date(iso + 'T05:00:00.000Z');

const grupo = (
  accionFormacionId: string,
  cierre: string | null,
  inicio: string | null = null,
) => ({
  accionFormacionId,
  fechaInicio: inicio ? d(inicio) : null,
  modalidad: 'VIRTUAL' as Modalidad,
  cierreInscripciones: cierre ? d(cierre) : null,
});

/// Cómo se lleva a la fila, igual que en `proyeccionDeInscripciones`.
const comoLaFila = (fechas: Date[] | undefined) =>
  (fechas ?? []).map((x) => x.toISOString().slice(0, 10));

describe('qué lleva la fila de cada acción', () => {
  /**
   * AF1 TAL COMO ESTÁ EN EL CRONOGRAMA: cuatro grupos que cierran el 8
   * de octubre y cuatro que cierran el 16.
   */
  it('una acción que cierra en dos tandas lleva las dos fechas', () => {
    const af1 = [
      ...[1, 2, 3, 4].map(() => grupo('af1', '2026-10-08', '2026-10-19')),
      ...[5, 6, 7, 8].map(() => grupo('af1', '2026-10-16', '2026-10-26')),
    ];
    expect(comoLaFila(cierresPorAccion(af1).get('af1'))).toEqual([
      '2026-10-08',
      '2026-10-16',
    ]);
  });

  /**
   * Y UNA QUE CIERRA ENTERA LLEVA UNA SOLA, que es lo que apaga el
   * aviso en la pantalla. Si aquí salieran dos iguales, AF4 ---que
   * tiene un único grupo--- diría «cierra por partes» y el aviso
   * perdería todo su valor en las que sí lo necesitan.
   */
  it('una que cierra entera lleva una sola fecha', () => {
    const af4 = [grupo('af4', '2026-11-04', '2026-11-11')];
    expect(comoLaFila(cierresPorAccion(af4).get('af4'))).toEqual([
      '2026-11-04',
    ]);
  });

  it('y ocho grupos que cierran el mismo día son una sola fecha', () => {
    const iguales = Array.from({ length: 8 }, () =>
      grupo('af9', '2026-10-08', '2026-10-19'),
    );
    expect(comoLaFila(cierresPorAccion(iguales).get('af9'))).toHaveLength(1);
  });

  /**
   * AF3 ES EL CASO QUE MÁS DAÑO HACE: cinco grupos presenciales en
   * cinco ciudades, con cinco fechas distintas. Enseñar solo la del 13
   * le mete prisa a cuatro asesores que todavía tienen días, o les da
   * por cerrado lo que sigue abierto.
   */
  it('AF3 lleva sus cinco, en orden', () => {
    const af3 = [
      '2026-10-27',
      '2026-10-13',
      '2026-10-22',
      '2026-10-15',
      '2026-10-20',
    ].map((f) => grupo('af3', f));
    expect(comoLaFila(cierresPorAccion(af3).get('af3'))).toEqual([
      '2026-10-13',
      '2026-10-15',
      '2026-10-20',
      '2026-10-22',
      '2026-10-27',
    ]);
  });

  /**
   * LA PRIMERA DE LA LISTA ES LA QUE MANDA, y por eso van ordenadas:
   * la pantalla cuenta los días contra `cierre`, que es esa misma.
   * Si la lista empezara por otra, el aviso y la cuenta dirían cosas
   * distintas en la misma celda.
   */
  it('la primera de la lista es contra la que se cuentan los días', () => {
    const af2 = [
      grupo('af2', '2026-10-26', '2026-11-09'),
      grupo('af2', '2026-10-19', '2026-11-03'),
    ];
    const fechas = comoLaFila(cierresPorAccion(af2).get('af2'));
    expect(fechas[0]).toBe('2026-10-19');
  });
});

describe('la pantalla no avisa cuando no hay nada que avisar', () => {
  /// `OtrosCierres` se calla con menos de dos fechas. Se fija aquí
  /// porque es lo que separa un aviso útil de uno que sale siempre.
  it('el umbral del aviso son dos fechas', () => {
    const t = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '..',
        '..',
        '..',
        'frontend',
        'src',
        'components',
        'admin',
        'panel-asesores.tsx',
      ),
      'utf8',
    ) as string;
    expect(t).toContain('if (fechas.length < 2) return null;');
  });
});
