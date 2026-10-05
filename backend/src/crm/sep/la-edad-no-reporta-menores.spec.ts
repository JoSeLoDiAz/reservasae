/** La edad que sale al SENA es la misma que se juzgó para dejarla salir. */

/**
 * SE PODÍA REPORTAR A UN MENOR, y sin que nada fallara.
 *
 * El archivo congela la edad contra `fechaMatricula` ---para que la
 * misma persona no cambie de rango entre dos cargues por haber cumplido
 * años--- y `fechaMatricula` la pone el cron a la `fechaInicio` del
 * grupo, que puede ser de hace meses.
 *
 * Pero la compuerta que decide si la fila entra al reporte miraba la
 * edad A HOY. Dos fechas distintas sobre el mismo dato.
 *
 * Lo encontró una auditoría del 2 oct 2026.
 */

import { EDAD_MINIMA, edadCumplida, rangoEdadSep } from '../catalogos-sep';

describe('el caso que se colaba', () => {
  /// Nacida el 1 may 2008. El grupo arrancó el 10 ene 2026 y se exporta
  /// el 2 oct 2026.
  const nacimiento = new Date('2008-05-01T00:00:00.000Z');
  const arranqueDelGrupo = new Date('2026-01-10T00:00:00.000Z');
  const diaDeLaExportacion = new Date('2026-10-02T00:00:00.000Z');

  it('la compuerta la veía con 18 y el archivo la reportaba con 17', () => {
    expect(edadCumplida(nacimiento, diaDeLaExportacion)).toBe(18);
    expect(edadCumplida(nacimiento, arranqueDelGrupo)).toBe(17);
  });

  /**
   * Y EL RANGO 1 ES EL QUE NO SE DEBE USAR NUNCA: es el de los menores
   * de 18, y el programa no admite menores. Una fila con rango 1 le
   * dice al SENA que se formó a alguien que no podía.
   */
  it('y con 17 el rango que sale es el 1', () => {
    expect(rangoEdadSep(17)).toBe(1);
    expect(rangoEdadSep(18)).toBe(2);
  });

  it('juzgada con el mismo corte, no pasa', () => {
    expect(edadCumplida(nacimiento, arranqueDelGrupo)).toBeLessThan(
      EDAD_MINIMA,
    );
  });
});

describe('las dos fechas son la misma', () => {
  const leer = (ruta: string) =>
    require('fs').readFileSync(
      require('path').join(__dirname, ruta),
      'utf8',
    ) as string;

  /**
   * EL CARGUE TIENE QUE PASAR SU CORTE. El campo es opcional ---sin él
   * se juzga a hoy, que es lo correcto para el panel--- así que si
   * alguien lo quita de esta llamada nada falla al compilar y el fallo
   * vuelve entero. Por eso se fija aquí.
   */
  it('el cargue al SENA le pasa su fecha de corte a la compuerta', () => {
    const t = leer('sep.service.ts');
    const i = t.indexOf('revisar({');
    expect(i).toBeGreaterThan(-1);
    const llamada = t.slice(i, t.indexOf('});', i));
    expect(llamada).toContain('fechaDeCorte: p.fechaMatricula ?? null');
  });

  it('y la compuerta la usa', () => {
    const t = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'completitud.ts'),
      'utf8',
    ) as string;
    expect(t).toContain(
      'edadCumplida(persona.fechaNacimiento, p.fechaDeCorte ?? undefined)',
    );
  });

  /**
   * Y EL ARCHIVO SIGUE CONGELÁNDOLA, que es lo que no hay que romper al
   * arreglar esto: si el archivo pasara a calcular a hoy, la misma
   * persona cambiaría de rango entre dos cargues y el SENA vería dos
   * verdades sobre ella.
   */
  it('y el archivo sigue congelando contra la matrícula', () => {
    const t = leer('formato-cargue-sep.ts');
    expect(t).toContain(
      'const corte = p.participante.fechaMatricula ?? new Date();',
    );
  });
});
