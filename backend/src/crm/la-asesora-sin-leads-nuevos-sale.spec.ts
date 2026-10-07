/** Quien trabajó fichas viejas también tiene fila. */

/**
 * «DEBO SABER CUÁNTO HIZO CADA ASESORA AYER, ANTIER, HOY» (cliente, 7
 * oct 2026), repetido desde el 5.
 *
 * Faltaba la mitad más silenciosa del defecto. La cifra de «gestionados
 * en el periodo» se trajo el 5 de octubre precisamente para esto, y su
 * propio comentario anunciaba el problema sin darse cuenta: «quien el
 * viernes trabajó fichas de agosto no aparecería en ninguna».
 *
 * Y seguía sin aparecer, porque las FILAS se creaban recorriendo solo
 * los leads que LLEGARON en la ventana. La cifra existía y no tenía
 * dónde salir: sin lead nuevo, no había renglón donde ponerla.
 *
 * A mitad de convocatoria eso no es un caso raro, es lo normal: ya no
 * entran leads nuevos y las asesoras trabajan lo que ya tienen. Un día
 * entero de trabajo desaparecía de la tabla.
 */

import { repartirInscripciones } from './asesores-datos';

const HOY = new Date('2026-10-07T12:00:00.000Z');

/// Sin un solo lead llegado en la ventana, que es el caso.
const SIN_LEADS: Parameters<typeof repartirInscripciones>[0] = [];

const cierres = new Map<string, Date>();

describe('la asesora que solo trabajó fichas viejas', () => {
  it('tiene fila aunque no le llegara ningún lead nuevo', () => {
    const filas = repartirInscripciones(
      SIN_LEADS,
      cierres,
      HOY,
      new Map([['a1', 7]]),
      new Map([['a1', 3]]),
      new Map([['a1', 'Lucía Parra']]),
    );

    expect(filas).toHaveLength(1);
    expect(filas[0].asesorId).toBe('a1');
    expect(filas[0].nombre).toBe('Lucía Parra');
    expect(filas[0].gestionadosEnElPeriodo).toBe(7);
    expect(filas[0].inscritosEnElPeriodo).toBe(3);
  });

  /**
   * Y SU CARGA ES CERO, que es verdad y hay que decirlo: no le llegó
   * nada en el periodo. Lo que no era verdad era no estar.
   */
  it('con la carga en cero, que es lo cierto', () => {
    const filas = repartirInscripciones(
      SIN_LEADS,
      cierres,
      HOY,
      new Map([['a1', 7]]),
      undefined,
      new Map([['a1', 'Lucía Parra']]),
    );
    expect(filas[0].carga.total).toBe(0);
    expect(filas[0].carga.resueltos).toBe(0);
    expect(filas[0].carga.gestionados).toBe(0);
    expect(filas[0].porAccion).toEqual([]);
  });

  /**
   * Y NO SE INVENTAN FILAS DE QUIEN NO HIZO NADA. Un cero en el mapa
   * no es trabajo: llenaría la tabla de gente que no tocó nada ese
   * día, que es el ruido contra el que se hizo esta pantalla.
   */
  it('pero un cero no crea fila', () => {
    const filas = repartirInscripciones(
      SIN_LEADS,
      cierres,
      HOY,
      new Map([['a1', 0]]),
      new Map([['a2', 0]]),
      new Map([
        ['a1', 'Lucía Parra'],
        ['a2', 'Carlos Mesa'],
      ]),
    );
    expect(filas).toEqual([]);
  });

  /**
   * Y SIN VENTANA NO SE AÑADE NADA. Los dos mapas vienen indefinidos a
   * propósito cuando no hay periodo ---«gestionado en el periodo» no
   * quiere decir nada sin periodo--- y entonces la tabla es la de
   * siempre.
   */
  it('y sin periodo la tabla no cambia', () => {
    expect(repartirInscripciones(SIN_LEADS, cierres, HOY)).toEqual([]);
  });

  /**
   * Y A QUIEN YA TENÍA FILA NO SE LE DUPLICA. Sería peor que el
   * defecto: dos renglones con el mismo nombre y cifras distintas.
   */
  it('y a quien ya tenía fila no se le duplica', () => {
    const filas = repartirInscripciones(
      [
        {
          asesorId: 'a1',
          asesorNombre: 'Lucía Parra',
          etapa: 'INTERESADO',
          creadoEn: new Date('2026-10-06T12:00:00.000Z'),
          datosTocadosPorAsesorEn: null,
          notas: 0,
          accionFormacionId: 'af1',
          accionCodigo: 'AF1',
          accionNombre: 'Una',
        },
      ],
      cierres,
      HOY,
      new Map([['a1', 7]]),
      new Map([['a1', 3]]),
      new Map([['a1', 'Lucía Parra']]),
    );
    expect(filas.filter((f) => f.asesorId === 'a1')).toHaveLength(1);
    expect(filas[0].carga.total).toBe(1);
    expect(filas[0].gestionadosEnElPeriodo).toBe(7);
  });

  /// Y «Sin asesor» se nombra como en el resto de la tabla, no con el
  /// relleno de «Asesor»: es una fila de verdad y se lee igual.
  it('y la fila sin asesor se llama como siempre', () => {
    const filas = repartirInscripciones(
      SIN_LEADS,
      cierres,
      HOY,
      new Map([['SIN_ASESOR', 4]]),
      undefined,
      new Map(),
    );
    expect(filas[0].asesorId).toBeNull();
    expect(filas[0].nombre).toBe('Sin asesor asignado');
  });
});
