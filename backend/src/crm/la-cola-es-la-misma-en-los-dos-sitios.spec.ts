/** La cifra del pendiente y la lista a la que lleva cuentan lo mismo. */

/**
 * El defecto que este spec existe para que no vuelva:
 *
 * Control de Inscritos enseña un pendiente —«83 personas no
 * tienen asesor asignado»— con un botón que lleva a la lista de
 * leads. Los dos lados preguntaban por poblaciones distintas: la
 * cifra excluía los desenlaces (inscrito, perdido) porque un
 * inscrito no hay que repartirlo, y la lista los incluía porque
 * su tramo es el embudo entero. Medido el 21 sep 2026: la cifra
 * decía 84 y la lista traía más.
 *
 * No fallaba nada. Se pulsaba el botón y salía otra cantidad de
 * gente que la que se acababa de leer, que es la clase de error
 * que hace desconfiar de todo el tablero.
 *
 * Lo que se fija aquí NO es «son estas tres etapas», que sería
 * arreglar el caso de hoy. Es que las dos consultas salgan de UNA
 * lista: si alguien añade una etapa al embudo, tiene que decidir
 * si es cola o es desenlace, y este test le obliga a decidirlo en
 * un solo sitio.
 */

import {
  ETAPAS_DEL_EMBUDO,
  ETAPAS_POR_TRABAJAR,
} from './metricas-inscripciones';

/// Los dos desenlaces: se cierran y se quedan fuera de la cola.
const DESENLACES = ['INSCRITO', 'PERDIDO'];

describe('la cola de lo que queda por trabajar', () => {
  it('sale de una sola lista, no de una copia en cada consulta', () => {
    /// Si esto se rompe es porque alguien volvió a teclear las
    /// etapas en `control.ts` o en el filtro de la lista. La
    /// prueba de verdad es que las dos importen de aquí; esto
    /// fija el contenido para que el fallo se lea.
    expect(ETAPAS_POR_TRABAJAR).toEqual([
      'INTERESADO',
      'CONTACTADO',
      'DATOS_COMPLETOS',
    ]);
  });

  it('es un trozo del embudo, nunca algo de fuera', () => {
    for (const etapa of ETAPAS_POR_TRABAJAR) {
      expect(ETAPAS_DEL_EMBUDO).toContain(etapa);
    }
  });

  it('deja fuera los desenlaces: un inscrito no se reparte', () => {
    for (const cerrada of DESENLACES) {
      expect(ETAPAS_POR_TRABAJAR).not.toContain(cerrada);
    }
  });

  it('el embudo entero es la cola más los desenlaces, sin sobras', () => {
    /// Si mañana se añade una etapa al embudo, este test falla y
    /// obliga a colocarla: o se trabaja, o es un desenlace. Sin
    /// esto, una etapa nueva se quedaría fuera de las dos
    /// consultas en silencio —que es exactamente cómo apareció el
    /// desajuste original—.
    expect([...ETAPAS_POR_TRABAJAR, ...DESENLACES].sort()).toEqual(
      [...ETAPAS_DEL_EMBUDO].sort(),
    );
  });
});
