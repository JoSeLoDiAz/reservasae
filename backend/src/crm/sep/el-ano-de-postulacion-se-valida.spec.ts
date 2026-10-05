/** El año de postulación que se le manda al SENA es un año. */

/**
 * ERA `Number(ano) || añoActual`, Y ESE `||` SOLO ATRAPA TRES COSAS:
 * el 0, la cadena vacía y el `NaN`.
 *
 * `?ano=12` pasaba limpio y escribía **12** en la columna «POSTULACION
 * 2025» de las 800 filas del cargue. Y esta descarga va por
 * NAVEGACIÓN ---es lo que hace que el navegador gestione el archivo y
 * que la cookie viaje sola---, así que basta pegar la URL: no hay
 * formulario que acote el parámetro.
 *
 * El error no se ve al abrir el archivo ---una columna entre 54, con
 * el mismo número en todas--- y de ahí no sale un rechazo: sale un
 * cargue imputado a un año que no existe.
 *
 * Lo encontró una auditoría del 5 oct 2026.
 */

import { ANO_MINIMO_DE_POSTULACION, anoDePostulacion } from './sep.controller';

const ACTUAL = new Date().getFullYear();

describe('qué año se escribe en el cargue', () => {
  it('un año del rango se respeta, que es para lo que está el parámetro', () => {
    expect(anoDePostulacion(String(ACTUAL - 1))).toBe(ACTUAL - 1);
    expect(anoDePostulacion(String(ANO_MINIMO_DE_POSTULACION))).toBe(
      ANO_MINIMO_DE_POSTULACION,
    );
  });

  /// El techo es el año que viene, no el de hoy: el cargue de la
  /// siguiente convocatoria se prepara en diciembre.
  it('el año que viene también, porque el cargue se prepara antes', () => {
    expect(anoDePostulacion(String(ACTUAL + 1))).toBe(ACTUAL + 1);
  });

  /**
   * EL CASO QUE SE COLABA. `Number('12')` es 12, que es un número y
   * no es falsy, así que el `||` no lo veía.
   */
  it('un «12» NO se escribe: cae al año actual', () => {
    expect(Number('12') || ACTUAL).toBe(12);
    expect(anoDePostulacion('12')).toBe(ACTUAL);
  });

  it('ni un año de más, ni uno de antes de que hubiera PFCE', () => {
    expect(anoDePostulacion(String(ACTUAL + 2))).toBe(ACTUAL);
    expect(anoDePostulacion(String(ANO_MINIMO_DE_POSTULACION - 1))).toBe(
      ACTUAL,
    );
    // `1e4` es un número perfectamente válido para `Number()`
    expect(anoDePostulacion('1e4')).toBe(ACTUAL);
  });

  /// `Number.isInteger` y no `isNaN`: «2025,5» se parte en «2025» con
  /// `parseInt` pero no es un año, y «2025.0001» tampoco.
  it('ni algo que tenga decimales', () => {
    expect(anoDePostulacion(`${ACTUAL}.0001`)).toBe(ACTUAL);
    expect(anoDePostulacion(`${ACTUAL},5`)).toBe(ACTUAL);
  });

  it('y lo de siempre sigue cayendo al año actual', () => {
    expect(anoDePostulacion(undefined)).toBe(ACTUAL);
    expect(anoDePostulacion('')).toBe(ACTUAL);
    expect(anoDePostulacion('el año pasado')).toBe(ACTUAL);
  });

  /**
   * NO REVIENTA LA DESCARGA, cae al año actual.
   *
   * Un 400 aquí sería la página de error en lugar del archivo por un
   * parámetro que la pantalla no deja escribir. El panel manda
   * siempre el año actual.
   */
  it('nunca lanza: lo malo se sustituye, no se rechaza', () => {
    for (const malo of ['12', '-2025', 'NaN', 'Infinity', '0']) {
      expect(() => anoDePostulacion(malo)).not.toThrow();
      expect(anoDePostulacion(malo)).toBe(ACTUAL);
    }
  });
});
