/** «No entró» y «no se sabe» no son lo mismo. */

/**
 * «EL 13 DE OCTUBRE ARRANCAN LOS CUATRO PRIMEROS GRUPOS DE AF1: 116
 * PERSONAS PASAN SOLAS A EN FORMACIÓN Y, CON CERO ACTIVIDADES
 * CARGADAS, EL TABLERO LAS VA A DAR TODAS POR "NUNCA ENTRÓ AL AULA",
 * DE FORMA PERMANENTE» (Josse, 6 oct 2026).
 *
 * El tablero decía las dos cosas con la misma palabra y pintaba la
 * segunda del rojo de PERDIDO: el día que un grupo empieza, sus
 * inscritos salían señalados por algo que no habían hecho.
 *
 * Esto se prueba EJERCITANDO LA REGLA y no leyendo el fuente, que es
 * la lección que me dejó hoy la corrección de `acreditar-gestion.ts`:
 * un spec que comprueba que el servicio «contiene cierta cadena» no
 * puede ver la única decisión que importa, y de hecho no la vio.
 */

import { accionesSinDatosDelAula } from './sin-datos-del-aula';

const AYER = new Date('2026-10-05T15:00:00.000Z');

describe('una acción de la que el aula no ha dicho nada', () => {
  it('sin actividades publicadas y sin un solo acceso, no se sabe', () => {
    const sin = accionesSinDatosDelAula(
      [],
      [
        { accionFormacionId: 'af1', ultimoAcceso: null },
        { accionFormacionId: 'af1', ultimoAcceso: null },
      ],
    );
    expect([...sin]).toEqual(['af1']);
  });

  /**
   * Y SE APAGA SOLO, que es lo que hace que esto no se pudra: en
   * cuanto llega lo primero, la acción sale de la lista y vuelve a
   * mandar la regla de siempre. Nadie tiene que acordarse de quitarlo.
   */
  it('basta UNA actividad publicada para que vuelva a juzgarse', () => {
    const sin = accionesSinDatosDelAula(
      [{ accionFormacionId: 'af1' }],
      [{ accionFormacionId: 'af1', ultimoAcceso: null }],
    );
    expect(sin.has('af1')).toBe(false);
  });

  it('y basta UN acceso de una sola persona', () => {
    const sin = accionesSinDatosDelAula(
      [],
      [
        { accionFormacionId: 'af1', ultimoAcceso: AYER },
        /// Los otros ciento quince siguen sin entrar, y de esos sí se
        /// puede decir que no entraron: el aula ya está hablando.
        { accionFormacionId: 'af1', ultimoAcceso: null },
      ],
    );
    expect(sin.has('af1')).toBe(false);
  });
});

describe('cada acción por su cuenta', () => {
  it('una acción en marcha no tapa a la que acaba de arrancar', () => {
    const sin = accionesSinDatosDelAula(
      [{ accionFormacionId: 'af3' }],
      [
        { accionFormacionId: 'af3', ultimoAcceso: AYER },
        { accionFormacionId: 'af1', ultimoAcceso: null },
      ],
    );
    expect([...sin]).toEqual(['af1']);
  });

  /// Sin acción no hay aula de la que hablar. Importa porque la
  /// primera versión usaba `?? ''` y metía a toda esa gente en el
  /// mismo saco, con una acción que no existe.
  it('las fichas sin acción no entran en el conjunto', () => {
    const sin = accionesSinDatosDelAula(
      [],
      [{ accionFormacionId: null, ultimoAcceso: null }],
    );
    expect([...sin]).toEqual([]);
  });

  /// Una acción con actividades y sin nadie no se juzga: no hay a
  /// quién marcar, y meterla solo serviría para que alguien la
  /// contara.
  it('una acción sin gente no sale, aunque no tenga nada', () => {
    expect([...accionesSinDatosDelAula([], [])]).toEqual([]);
  });
});
