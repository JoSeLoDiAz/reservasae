/** Qué transición de etapa es posible y qué compuerta pide. */

/**
 * La escalera existe porque `cambiarEtapa` es UN solo PATCH y
 * el asesor elige la etapa de destino libremente: sin reglas de
 * transición, la etapa de llegada era lo único que se miraba y
 * la de salida no contaba para nada.
 *
 * Eso abría dos agujeros que el recorrido de pruebas reprodujo:
 *
 *  - `INTERESADO → EN_FORMACION` se saltaba la compuerta de
 *    matrícula entera —datos completos, autorización, oferta y
 *    alguna forma de contacto— porque la compuerta estaba
 *    colgada de la palabra `INSCRITO` y no del hecho de entrar
 *    al aula. Un clic dejaba a alguien «en formación» sin
 *    autorización de tratamiento de datos.
 *  - `RETIRADO → CERTIFICADO` certificaba a quien se había ido.
 *    Con avance cargado, el 80 % se cumple y la fila entra al
 *    reporte del SENA diciendo que terminó alguien que no.
 *
 * Nada queda prohibido de verdad: para certificar a quien
 * volvió se pasa primero por `EN_FORMACION`, y ese paso queda
 * en el historial. Es la diferencia entre no poder y tener que
 * decirlo.
 *
 * Va en un módulo puro y aparte porque es la única forma de
 * probarlo sin levantar la aplicación, igual que `desvio.ts` y
 * `completitud.ts`.
 */

import type { EtapaParticipante } from '../../generated/prisma';

/// Haber pisado el aula, se siga dentro o no.
const EN_EL_AULA: EtapaParticipante[] = [
  'EN_FORMACION',
  'CERTIFICADO',
  'NO_APROBO',
  'RETIRADO',
  'DESERTO',
  'ABANDONO',
];

/// Desde donde se puede dar por terminada una formación.
///
/// INSCRITO entra porque los grupos pueden no tener fechas y
/// entonces nadie pasa solo a EN_FORMACION: exigirlo dejaría
/// sin certificar a quien sí cursó.
const PUEDE_CERRAR_DESDE: EtapaParticipante[] = ['EN_FORMACION', 'INSCRITO'];

/// Las que dan por terminada la formación.
const CIERRES: EtapaParticipante[] = ['CERTIFICADO', 'NO_APROBO'];

/**
 * Si al pasar a `despues` hay que pasar la compuerta de
 * matrícula (datos, autorización, oferta, contacto y cupo).
 *
 * La compuerta es de ENTRAR AL AULA, no de una etiqueta: la
 * pide tanto `INSCRITO` como `EN_FORMACION`, y solo cuando la
 * persona viene de fuera. Quien vuelve ya la pasó, y volver a
 * exigir cupo bloquearía el regreso a un grupo lleno.
 */
export function exigeCompuertaDeMatricula(
  antes: EtapaParticipante,
  despues: EtapaParticipante,
): boolean {
  if (despues !== 'INSCRITO' && despues !== 'EN_FORMACION') return false;
  return !EN_EL_AULA.includes(antes);
}

/** Por qué no se puede pasar de `antes` a `despues`, o null. */
export function motivoDeTransicionImposible(
  antes: EtapaParticipante,
  despues: EtapaParticipante,
): string | null {
  if (CIERRES.includes(despues) && !PUEDE_CERRAR_DESDE.includes(antes)) {
    const que = despues === 'CERTIFICADO' ? 'Certificar' : 'Dar por no aprobado';
    if (EN_EL_AULA.includes(antes)) {
      return (
        `${que} a alguien que ya salió del aula no se hace de un paso. ` +
        'Si volvió, páselo primero a «En formación»: así queda dicho en el ' +
        'historial cuándo y quién lo devolvió.'
      );
    }
    return (
      `${que} exige haber estado en el aula. Esta persona está en «${antes}»: ` +
      'primero se matricula.'
    );
  }
  return null;
}
