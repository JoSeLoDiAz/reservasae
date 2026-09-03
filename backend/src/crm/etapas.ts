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

/** Si esa etapa consume una silla del aforo. */
export function ocupaSilla(etapa: EtapaParticipante): boolean {
  return OCUPAN_SILLA.includes(etapa);
}

/**
 * Quién RETIENE un asiento de la cohorte, aunque no ocupe silla.
 *
 * No es lo mismo que `OCUPAN_SILLA`, y la diferencia es justo lo que
 * hacía falta para poder asignar grupo por lote.
 *
 * `OCUPAN_SILLA` responde «¿consumió el aula?» — solo desde
 * `INSCRITO`. Pero a la cohorte se apunta gente mucho antes: un
 * `INTERESADO` con `coberturaId` puesto ya tiene su nombre en ese
 * grupo, y si el lote cuenta con `OCUPAN_SILLA` ve el grupo vacío y
 * mete a doscientos más encima de los doscientos que ya estaban.
 *
 * Los dos números se enseñan, porque son dos preguntas: «sillas
 * ocupadas» y «fichas apuntadas a esta cohorte». Con uno solo, o se
 * sobrevende o parece lleno lo que está libre.
 *
 * Fuera quedan las salidas —quien se retiró liberó su asiento— y
 * `PERDIDO`, que nunca llegó a tenerlo.
 */
export const RETIENEN_ASIENTO: EtapaParticipante[] = [
  'INTERESADO',
  'CONTACTADO',
  'DATOS_COMPLETOS',
  'INSCRITO',
  'EN_FORMACION',
  'CERTIFICADO',
];

/// Las que ya no reciben grupo: salieron o nunca entraron.
export const NO_RECIBEN_GRUPO: EtapaParticipante[] = [
  'PERDIDO',
  'RETIRADO',
  'NO_APROBO',
  'DESERTO',
  'ABANDONO',
];
