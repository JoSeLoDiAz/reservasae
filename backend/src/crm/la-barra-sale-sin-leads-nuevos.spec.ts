/** El Resumen General dibuja la acción que solo tuvo inscripciones. */

/**
 * Lo encontró el barrido del 7 oct 2026, buscando hermanos del defecto
 * de «cupos reservados», y es el mismo de siempre con otra cara: las
 * barras se arman recorriendo los leads que LLEGARON en el periodo, así
 * que una acción sin ningún lead nuevo no tenía entrada, y sus
 * inscripciones no tenían dónde salir.
 *
 * A mitad de convocatoria eso no es raro: ya no entran leads y se
 * inscribe a los que había. El Resumen General decía entonces menos
 * inscritos que la tabla de abajo de la MISMA pantalla, que sí la
 * cuenta. Ese descuadre entre las dos ya costó una semana.
 */

import { resumenGeneral } from './resumen-general';

const ROTULOS = new Map([
  ['af9', { codigo: 'AF9', nombre: 'La que no recibió leads', gremio: 'ADECOPRIA' }],
]);

describe('una acción con inscripciones y sin leads nuevos', () => {
  it('sale con su barra', () => {
    const filas = resumenGeneral([], new Map([['af9', 5]]), ROTULOS);
    expect(filas).toHaveLength(1);
    expect(filas[0].codigo).toBe('AF9');
    expect(filas[0].inscritos).toBe(5);
    /// Y sus leads en cero, que es verdad: no le llegó nadie nuevo.
    expect(filas[0].leads).toBe(0);
    expect(filas[0].gremio).toBe('ADECOPRIA');
  });

  /// Un cero no dibuja nada: llenaría el gráfico de barras vacías de
  /// acciones en las que no pasó nada ese día.
  it('pero un cero no dibuja barra', () => {
    expect(resumenGeneral([], new Map([['af9', 0]]), ROTULOS)).toEqual([]);
  });

  /**
   * Y SIN RÓTULOS NO SE INVENTA. Antes que pintar «AF?» o una barra sin
   * nombre, no se pinta: una barra que no se puede identificar no se
   * puede usar para nada y encima desordena la comparación.
   */
  it('y sin rótulos no se inventa una barra sin nombre', () => {
    expect(resumenGeneral([], new Map([['af9', 5]]), new Map())).toEqual([]);
  });

  /**
   * Y SIN PERIODO NO CAMBIA NADA. Sin ventana manda el conteo de
   * siempre, y esta rama no se toca.
   */
  it('y sin periodo el resumen es el de siempre', () => {
    expect(resumenGeneral([])).toEqual([]);
  });
});
