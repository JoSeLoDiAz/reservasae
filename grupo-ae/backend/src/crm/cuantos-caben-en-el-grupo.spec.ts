/** Cuántos cupos quedan en el grupo, medido como mide el candado. */

/**
 * Lo pidió el cliente: «cada vez que una persona se inscribe y se
 * asigna a un grupo, que nos muestre cuántos cupos quedan».
 *
 * La ficha decía «42 de 78» y eso tenía DOS defectos, los dos
 * detectados por la revisión adversarial del lote:
 *
 *   1. Contaba solo a quien CONSUME AULA (`OCUPAN_SILLA`), así que
 *      un grupo con doscientos INTERESADOS dentro se veía vacío y
 *      quien asignaba metía otros doscientos encima.
 *   2. Medía contra `cuposBase` —lo comprometido, SIN el 30 % de
 *      sobrecupo— mientras el candado del servidor mide contra
 *      `cuposMaximos`. Un grupo de 50 con 50 apuntados se leía
 *      «lleno» cuando aún caben 15.
 *
 * La pantalla y el candado tienen que medir con la MISMA columna.
 * Este spec lo fija.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cuantosCaben } from './elegibles-del-grupo';
import { OCUPAN_SILLA, RETIENEN_ASIENTO } from './etapas';

describe('el tope es cuposMaximos, no cuposBase', () => {
  it('un grupo de 50 comprometidos admite 65 con el sobrecupo', () => {
    /// `cuposMaximos` es `cuposBase` + 30 % truncado, y ya viene
    /// calculado en la base. Lo que este test fija es que la cuenta
    /// se hace contra ESE número.
    expect(cuantosCaben({ cuposMaximos: 65, apuntados: 50 })).toBe(15);
  });

  it('con el tope alcanzado, cero', () => {
    expect(cuantosCaben({ cuposMaximos: 65, apuntados: 65 })).toBe(0);
  });

  it('y con sobrecupo firmado por encima del tope, cero y no negativo', () => {
    /// El sobrecupo se permite y deja firma, así que una celda puede
    /// tener más apuntados que su tope. Devolver -5 haría que el
    /// `slice` del lote se comiera el final de la lista.
    expect(cuantosCaben({ cuposMaximos: 65, apuntados: 70 })).toBe(0);
  });
});

describe('se cuenta a quien RETIENE el asiento, no a quien ocupa silla', () => {
  it('las dos listas no son la misma, y esa es la clave', () => {
    /// Si fueran iguales, un grupo con doscientos interesados dentro
    /// se vería vacío. Es el defecto que este cambio arregla.
    expect(RETIENEN_ASIENTO.length).toBeGreaterThan(OCUPAN_SILLA.length);
  });

  it('un INTERESADO con grupo puesto YA retiene su asiento', () => {
    expect(RETIENEN_ASIENTO).toContain('INTERESADO');
    expect(OCUPAN_SILLA).not.toContain('INTERESADO');
  });

  it('y quien consume aula también retiene, claro', () => {
    /// `RETIENEN_ASIENTO` tiene que ser un superconjunto: si alguien
    /// «optimiza» quitando de ahí a los inscritos, el grupo volvería
    /// a verse vacío por el otro lado.
    expect(RETIENEN_ASIENTO).toEqual(expect.arrayContaining([...OCUPAN_SILLA]));
  });

  it('quien salió NO retiene: su asiento se liberó', () => {
    for (const e of ['RETIRADO', 'DESERTO', 'ABANDONO', 'NO_APROBO', 'PERDIDO'] as const) {
      expect(RETIENEN_ASIENTO).not.toContain(e);
    }
  });
});

describe('el aserto que protege del arreglo excesivo', () => {
  it('un grupo vacío admite a todos los del tope', () => {
    /// Si alguien «endurece» la cuenta y el grupo deja de admitir,
    /// este test cae y le obliga a mirar por qué.
    expect(cuantosCaben({ cuposMaximos: 65, apuntados: 0 })).toBe(65);
  });
});

/**
 * Y AHORA LA PARTE QUE DE VERDAD FALTABA.
 *
 * Los tests de arriba prueban `cuantosCaben`, que es pura — y al
 * mutar el SERVICIO, devolviéndolo a `cuposBase` y a las sillas, los
 * ocho seguían en verde. O sea que daban confianza sin darla, que es
 * el defecto que este proyecto lleva documentado desde la segunda
 * ronda de revisiones.
 *
 * El defecto nunca estuvo en la función: estuvo en QUÉ COLUMNAS le
 * pasa `opciones`. Así que se mira el código fuente, como ya hace
 * `caracterizacion-amparada.spec.ts` con el `include` del reporte.
 * Es lo único que distingue «mide con el tope» de «mide con lo
 * comprometido».
 */
describe('`opciones` mide con las MISMAS columnas que el candado', () => {
  const FUENTE = readFileSync(join(__dirname, 'crm.service.ts'), 'utf8');

  /// El bloque donde se arma cada grupo para la ficha.
  const bloque = (() => {
    const i = FUENTE.indexOf('etiqueta: `Grupo ${g.grupo.numero}');
    return i === -1 ? '' : FUENTE.slice(i, i + 1400);
  })();

  it('el tope sale de `cuposMaximos`, nunca de `cuposBase`', () => {
    expect(bloque).toContain('cupos: g.cuposMaximos');
    expect(bloque).not.toContain('cupos: g.cuposBase');
  });

  it('los apuntados NO son el `_count` de las sillas', () => {
    /// `_count.participantes` cuenta `ETAPAS_VIVAS`, que es
    /// `OCUPAN_SILLA`. Si «los que caben» se calculara con eso, un
    /// grupo con doscientos interesados dentro se vería vacío.
    expect(bloque).toContain('apuntados: apuntadosPorCelda.get(g.id)');
  });

  it('y «caben» se calcula con el tope y los apuntados', () => {
    expect(bloque).toContain('g.cuposMaximos - (apuntadosPorCelda.get(g.id)');
  });

  it('la consulta de apuntados filtra por RETIENEN_ASIENTO', () => {
    /// Sin esto, el groupBy contaría a todo el mundo -- incluidos
    /// los retirados, que ya liberaron su asiento.
    const i = FUENTE.indexOf('apuntadosPorCelda');
    expect(FUENTE.slice(i, i + 500)).toContain('RETIENEN_ASIENTO');
  });
});
