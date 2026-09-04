/** Quién ocupa una silla. Una sola vez, para todo el sistema. */

/**
 * Esta lista estaba escrita CUATRO veces, con cuatro nombres:
 * `ETAPAS_VIVAS` en `crm.service.ts`, `OCUPAN_SILLA` en
 * `panel-de-cupos.ts`, `OCUPA_SILLA` en `escalera.ts` y
 * `ETAPAS_DEL_REPORTE` en `sep/sep.service.ts`. Las cuatro decían lo
 * mismo, y cada una con un comentario avisando de que la otra existía.
 *
 * Copiada cuatro veces significa que se puede corregir en tres. Y ya
 * pasó: el filtro por etapa se le puso al conteo de la oferta y no al
 * de la cobertura, así que el grupo contaba como sillas ocupadas a los
 * leads muertos y bloqueaba inscripciones con el aula medio vacía.
 *
 * Aquí vive una vez. Quien la cambie, la cambia para todos.
 */

import type { EtapaParticipante } from '../../generated/prisma';

/**
 * Ocupa silla quien está inscrito o más allá.
 *
 * Las salidas del aula NO están: al retirarse se libera la silla, así
 * que volver consume una nueva.
 *
 * Cuidado al tocarla: baja la ocupación que muestran las ofertas y
 * puede destapar sobrecupos que estaban escondidos detrás de leads que
 * nunca llegaron a inscribirse.
 */
export const OCUPAN_SILLA: EtapaParticipante[] = [
  'INSCRITO',
  'EN_FORMACION',
  'CERTIFICADO',
];

/**
 * Quién entra en el reporte al SENA.
 *
 * Hoy son los mismos que ocupan silla, y por eso esta lista se deriva
 * de la otra en vez de repetirla. Pero son DOS preguntas distintas y
 * conviene tenerlas separadas: «¿consumió el aula?» no es «¿se le
 * reporta?». Quien curse y no apruebe consumió la silla; si además hay
 * que reportarlo, aquí es donde se añade, sin tocar los cupos.
 */
export const ETAPAS_DEL_REPORTE: EtapaParticipante[] = [...OCUPAN_SILLA];

/**
 * Las seis del aula: de aquí en adelante manda el área académica.
 *
 * Incluye las salidas, porque quien se retiró estuvo dentro y su ficha
 * ya no es del asesor.
 */
export const ETAPAS_DEL_AULA: EtapaParticipante[] = [
  'EN_FORMACION',
  'CERTIFICADO',
  'NO_APROBO',
  'DESERTO',
  'ABANDONO',
  'RETIRADO',
];

/**
 * Los leads que todavia se pueden trabajar para llenar un cupo.
 *
 * No ocupan silla --no estan inscritos-- pero tampoco estan
 * muertos: son a quienes se puede llamar cuando a un grupo le
 * faltan cupos y la ventana sigue abierta. Contesta la pregunta
 * que se hace de verdad delante del tablero: «faltan 27, ¿tengo
 * con quien llenarlos?».
 *
 * Las perdidas y las salidas NO estan. A un PERDIDO o a un
 * DESERTO no se le depura: se le vuelve a captar, que es otra
 * cosa, con otro esfuerzo y otro presupuesto. Meterlos aqui
 * daria una bolsa gorda y falsa.
 */
export const POR_DEPURAR: EtapaParticipante[] = [
  'INTERESADO',
  'CONTACTADO',
  'DATOS_COMPLETOS',
];

/** Si esa etapa consume una silla del aforo. */
export function ocupaSilla(etapa: EtapaParticipante): boolean {
  return OCUPAN_SILLA.includes(etapa);
}
