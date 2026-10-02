/** Una acción no cierra de un golpe: cada grupo tiene su fecha. */

/**
 * «LAS AF NO CIERRAN COMO TAL UNA COMPLETA SINO POR PARTES» (cliente,
 * 2 oct 2026).
 *
 * El cronograma de ADECOPRIA se lo da la razón: de sus siete acciones,
 * SEIS cierran en dos o más fechas, y AF3 tiene una distinta por cada
 * uno de sus cinco grupos ---13, 15, 20, 22 y 27 de octubre---.
 *
 * Hasta hoy el sistema no tenía dónde guardarlo. Derivaba el cierre de
 * la fecha de inicio del grupo ---14 días antes si es virtual, 5
 * hábiles si es presencial--- y enseñaba UNA sola fecha por acción, la
 * del grupo que cierra primero. De esa fecha salen «# días para el
 * cierre» y la META DIARIA de los asesores, así que para la mitad de
 * los grupos de AF1 y AF2 la cuenta estaba mal.
 *
 * Dos cosas se arreglan aquí y las dos se fijan abajo: que un cierre
 * escrito mande sobre el derivado, y que se pueda saber cuántas veces
 * cierra una acción.
 */

import { cierreDelGrupo, cierreDeInscripciones } from './calendario-inscripcion';
import { cierrePorAccion, cierresPorAccion } from './asesores-datos';
import type { Modalidad } from '../../generated/prisma';

const d = (iso: string) => new Date(iso + 'T00:00:00.000Z');

describe('lo fijado manda sobre lo derivado', () => {
  /**
   * EL CASO REAL. AF1.G1 arranca el 19 de octubre y el cronograma lo
   * cierra el 8. La regla del virtual ---14 días--- daría el 5: tres
   * días de inscripción que no existen, o que sobran.
   */
  it('el cierre escrito gana', () => {
    const fijado = cierreDelGrupo({
      fechaInicio: d('2026-10-19'),
      modalidad: 'VIRTUAL',
      cierreInscripciones: d('2026-10-08'),
    });
    expect(fijado).toEqual(d('2026-10-08'));

    /// Y la regla, sola, decía otra cosa.
    expect(cierreDeInscripciones(d('2026-10-19'), 'VIRTUAL')).toEqual(d('2026-10-05'));
  });

  /**
   * SIN FIJAR, LO DE SIEMPRE. Es lo que no se puede romper: hay
   * grupos que nunca tendrán fecha escrita y tienen que seguir
   * cerrando como ayer.
   */
  it('sin fijar, se sigue derivando', () => {
    expect(
      cierreDelGrupo({ fechaInicio: d('2026-10-19'), modalidad: 'VIRTUAL' }),
    ).toEqual(cierreDeInscripciones(d('2026-10-19'), 'VIRTUAL'));
  });

  /**
   * Y UN GRUPO CON CIERRE PERO SIN ARRANQUE SÍ TIENE CIERRE: es
   * justamente el orden en que llegan las cosas. En el cronograma la
   * fecha de cierre se decide antes de amarrar el calendario de
   * sesiones, y derivarla exigía tener ya la de inicio.
   */
  it('un cierre escrito vale aunque no haya fecha de inicio', () => {
    expect(
      cierreDelGrupo({ fechaInicio: null, cierreInscripciones: d('2026-10-13') }),
    ).toEqual(d('2026-10-13'));
  });

  it('y sin ninguna de las dos, no hay cierre', () => {
    expect(cierreDelGrupo({ fechaInicio: null })).toBeNull();
  });
});

/// AF1 tal como está en el cronograma: cuatro grupos que cierran el 8
/// y cuatro que cierran el 16.
const AF1 = [1, 2, 3, 4].map((n) => ({
  accionFormacionId: 'af1',
  fechaInicio: d('2026-10-19'),
  modalidad: 'VIRTUAL' as Modalidad,
  cierreInscripciones: d('2026-10-08'),
  numero: n,
})).concat(
  [5, 6, 7, 8].map((n) => ({
    accionFormacionId: 'af1',
    fechaInicio: d('2026-10-26'),
    modalidad: 'VIRTUAL' as Modalidad,
    cierreInscripciones: d('2026-10-16'),
    numero: n,
  })),
);

describe('cuántas veces cierra una acción', () => {
  it('AF1 cierra dos veces, no una', () => {
    expect(cierresPorAccion(AF1).get('af1')).toEqual([
      d('2026-10-08'),
      d('2026-10-16'),
    ]);
  });

  /**
   * Y LA QUE SE ENSEÑA SIGUE SIENDO LA PRIMERA. No es un descuido:
   * en cuanto una puerta se cierra ya hay gente a la que no se puede
   * meter ahí, y el asesor tiene que enterarse entonces. Lo que
   * faltaba no era cambiar esa fecha, era poder decir que hay otra.
   */
  it('y la que manda es la más próxima', () => {
    expect(cierrePorAccion(AF1).get('af1')).toEqual(d('2026-10-08'));
  });

  /**
   * DOS GRUPOS QUE CIERRAN EL MISMO DÍA SON UNA FECHA. Si no, AF1
   * diría que cierra ocho veces y la pantalla avisaría de un reparto
   * que no existe.
   */
  it('las fechas repetidas no se cuentan dos veces', () => {
    const fechas = cierresPorAccion(AF1).get('af1');
    expect(fechas).toHaveLength(2);
  });

  /**
   * AF3 ES EL CASO EXTREMO del cronograma: cinco grupos presenciales,
   * cinco ciudades, cinco fechas distintas. Aquí es donde enseñar una
   * sola fecha hace más daño.
   */
  it('AF3 cierra cinco veces, una por grupo', () => {
    const af3 = ['2026-10-13', '2026-10-15', '2026-10-20', '2026-10-22', '2026-10-27'].map(
      (f) => ({
        accionFormacionId: 'af3',
        fechaInicio: null,
        modalidad: 'PRESENCIAL' as Modalidad,
        cierreInscripciones: d(f),
      }),
    );
    expect(cierresPorAccion(af3).get('af3')).toHaveLength(5);
    expect(cierrePorAccion(af3).get('af3')).toEqual(d('2026-10-13'));
  });

  /**
   * Y LAS FECHAS SALEN ORDENADAS aunque los grupos no lo estén: la
   * pantalla las va a enseñar en fila y «16 oct · 8 oct» se lee como
   * un error de otra cosa.
   */
  it('salen en orden aunque los grupos lleguen desordenados', () => {
    const alreves = [...AF1].reverse();
    expect(cierresPorAccion(alreves).get('af1')).toEqual([
      d('2026-10-08'),
      d('2026-10-16'),
    ]);
  });

  /// Un grupo sin fechas no inventa un cierre ni tumba la cuenta.
  it('un grupo sin fechas no aporta cierre', () => {
    const con = [
      { accionFormacionId: 'af9', fechaInicio: null, modalidad: 'VIRTUAL' as Modalidad },
      {
        accionFormacionId: 'af9',
        fechaInicio: d('2026-11-03'),
        modalidad: 'VIRTUAL' as Modalidad,
      },
    ];
    expect(cierresPorAccion(con).get('af9')).toHaveLength(1);
  });
});
