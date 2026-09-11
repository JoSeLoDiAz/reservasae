/** Si un negocio está atendido, en un solo dato. */

/**
 * ESTA ES LA PIEZA QUE HACE QUE UN TABLERO SE ENTIENDA MIRÁNDOLO.
 *
 * Mauricio pidió «el CRM más sencillo de entender» y la respuesta
 * fue Pipedrive. Lo que hace a Pipedrive legible en tres segundos
 * no es su color ni su tipografía: es que cada tarjeta lleva UN
 * punto que dice si alguien va a hacer algo con ese negocio.
 *
 * Uno mira una columna y ve, **sin leer una palabra**, cuáles
 * negocios están abandonados. Es toda la diferencia entre un
 * tablero que informa y uno que dirige.
 *
 * El que importa es `NINGUNA` —el gris—. Un negocio sin próxima
 * gestión no está en riesgo de morirse: ya se está muriendo, y no
 * hay nada en el sistema que vaya a evitarlo. Los otros tres
 * estados solo existen para que el gris se note.
 *
 * Módulo puro —ni Nest ni Prisma— para poder fijar los bordes de
 * medianoche sin levantar nada, igual que `gestiones/agenda.ts`,
 * de donde salen las reglas de día de Bogotá que aquí se reusan
 * en vez de volver a escribirse.
 */

import { cuboSegun, type Limites } from '../gestiones/agenda';

/**
 * El semáforo de un negocio.
 *
 * En el orden en que se leen, que es el de la urgencia. `NINGUNA`
 * va al final y no es «lo menos urgente»: es lo único que no se
 * arregla solo con el tiempo.
 */
export type Semaforo = 'VENCIDA' | 'HOY' | 'AGENDADA' | 'NINGUNA';

/// Lo mínimo que hace falta saber de una gestión para clasificarla.
export type GestionPendiente = {
  venceEn: Date | null;
  hechaEn: Date | null;
};

/**
 * En qué color queda un negocio, mirando sus gestiones.
 *
 * Manda la MÁS URGENTE de las pendientes: un negocio con una
 * llamada vencida y una reunión el viernes está en rojo. Pintarlo
 * verde porque «algo tiene agendado» sería exactamente la mentira
 * que este semáforo existe para no contar.
 *
 * Las gestiones ya hechas no cuentan, y las pendientes SIN FECHA
 * tampoco: una tarea sin vencimiento no es un próximo paso, es una
 * nota con buenas intenciones. Que eso pinte verde es cómo un
 * tablero acaba todo en verde y deja de mirarse.
 */
export function semaforoDe(
  gestiones: GestionPendiente[],
  limites: Limites,
): Semaforo {
  let hayAgendada = false;

  for (const g of gestiones) {
    if (g.hechaEn !== null) continue;
    if (g.venceEn === null) continue;

    const cubo = cuboSegun(g.venceEn, limites);
    /// Se sale en cuanto aparece una vencida: es el peor estado
    /// posible y nada de lo que venga después puede mejorarlo.
    if (cubo === 'VENCIDA') return 'VENCIDA';
    if (cubo === 'HOY') return 'HOY';
    hayAgendada = true;
  }

  return hayAgendada ? 'AGENDADA' : 'NINGUNA';
}

/**
 * Cuánto se ha enfriado, de 0 a 1.
 *
 * Pipedrive apaga las tarjetas que llevan días sin moverse en vez
 * de marcarlas con un aviso, y esa es la decisión buena: un aviso
 * más es una cosa más que leer, y apagarse se ve sin leer nada.
 *
 * Se devuelve un número y no una clase de CSS a propósito: el
 * backend dice CUÁNTO frío tiene, y el panel decide cómo se pinta.
 * Meter `opacity-60` aquí sería que el servidor opine de diseño.
 *
 * Catorce días para llegar al frío del todo. Sale de la forma del
 * embudo de empresas —ciclo de semanas— y es un supuesto, como las
 * probabilidades: se ajusta cuando se sepa cuánto dura de verdad
 * una venta aquí.
 */
export const DIAS_HASTA_FRIO = 14;

export function frialdadDe(ultimoToqueEn: Date, ahora: Date): number {
  const dias = (ahora.getTime() - ultimoToqueEn.getTime()) / 86_400_000;
  if (dias <= 1) return 0;
  return Math.min(1, (dias - 1) / (DIAS_HASTA_FRIO - 1));
}
