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

/// Las dos etapas que significan estar dentro del aula.
const ENTRAR_AL_AULA: EtapaParticipante[] = ['INSCRITO', 'EN_FORMACION'];

/**
 * Si hay que comprobar datos, autorización, oferta y contacto.
 *
 * SIEMPRE que el destino sea estar dentro del aula, venga de
 * donde venga. Y ese «siempre» es el punto: la autorización de
 * tratamiento de datos **se puede revocar**, así que «ya la
 * pasó una vez» no dice nada sobre hoy.
 *
 * La primera versión de este módulo la eximía a quien volvía, y
 * eso dejó `INSCRITO` MÁS DÉBIL que antes de existir la
 * escalera: revocando la autorización y pasando de `RETIRADO` a
 * `INSCRITO` se volvía a matricular a alguien que había pedido
 * que no se usaran sus datos. Se vio probándolo en vivo, no
 * leyéndolo. Es la lección de siempre: el arreglo trae su
 * propio defecto.
 */
export function exigeDatosParaElAula(
  _antes: EtapaParticipante,
  despues: EtapaParticipante,
): boolean {
  return ENTRAR_AL_AULA.includes(despues);
}

/**
 * Si hay que comprobar que quepa en el grupo.
 *
 * Esto SÍ es solo para quien viene de fuera: el cupo se consume
 * una vez, y volver a exigirlo cerraría el regreso a un grupo
 * lleno — que es justo cuando se hace un regreso.
 *
 * Separar las dos comprobaciones es lo que hace correcto lo
 * anterior. Juntas, había que elegir entre bloquear regresos
 * legítimos y dejar entrar a quien revocó.
 */
export function exigeCupo(
  antes: EtapaParticipante,
  despues: EtapaParticipante,
): boolean {
  if (!ENTRAR_AL_AULA.includes(despues)) return false;
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
