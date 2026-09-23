/** El tablero de seguimiento de asesores: cuánto lleva cada uno y si llega. */

/**
 * LO QUE PIDIÓ EL CLIENTE EL 23 DE SEPTIEMBRE DE 2026, en sus palabras:
 * «seguimiento de asesores, dos subvistas: asesores inscripciones y
 * asesores académicos, tres personas para cada proceso».
 *
 * Las dos subvistas miden cosas distintas pero se leen igual, y por eso
 * las cuentas que deciden el color viven aquí, una sola vez:
 *
 * - INSCRIPCIONES corre hacia el CIERRE DE INSCRIPCIONES del grupo. Lo
 *   que le queda por hacer son los leads que nadie ha tocado.
 * - ACADÉMICOS corre hacia el FIN DEL CURSO. Lo que le queda por hacer
 *   son los participantes que aún no están certificados.
 *
 * LA CUENTA QUE IMPORTA ES «CUÁNTOS POR DÍA», no el porcentaje. Un 60 %
 * no dice si se llega; «te faltan 40 y tienes 4 días, o sea 10 diarios,
 * y vienes haciendo 3» sí. Es lo que el cliente llamó «cálculo de
 * seguimiento incremental».
 *
 * Y EL RITMO SE MIDE EN DÍAS HÁBILES, no de calendario: nadie llama a
 * un colegio el domingo. Con calendario, un pendiente de viernes salía
 * repartido entre tres días de los que dos no existen, y el tablero
 * decía que iba bien el lunes por la mañana.
 */

import { habilesEntre, hoyEnColombia } from './calendario-inscripcion';

/**
 * Qué tan lejos está de cumplir, en una palabra.
 *
 * `AL_DIA` no significa «terminado»: significa que con el ritmo que
 * trae le sobra tiempo. `SIN_PLAZO` es el que no tiene fecha contra la
 * que medirse --un grupo sin fechas-- y NO se pinta en verde: no se
 * sabe si va bien, y un verde ahí es una mentira tranquilizadora.
 */
export type EstadoDeCumplimiento =
  | 'AL_DIA'
  | 'AJUSTADO'
  | 'EN_RIESGO'
  | 'VENCIDO'
  | 'SIN_PLAZO'
  | 'TERMINADO';

/**
 * A partir de qué relación entre lo exigido y lo que trae se enciende
 * cada color.
 *
 * Si le exige hasta un 20 % más de lo que viene haciendo, se considera
 * que llega apretando: es la variación normal de una semana. Del doble
 * en adelante, no llega sin ayuda --que es el «refuerzo» que pidió el
 * cliente--.
 */
export const HOLGURA_AJUSTADO = 1.2;
export const HOLGURA_EN_RIESGO = 2;

export type Carga = {
  /** Todo lo que tiene asignado. */
  total: number;
  /** Lo que ya resolvió: inscritos y descartados, o certificados. */
  resueltos: number;
  /** Lo que ya tocó al menos una vez, esté resuelto o no. */
  gestionados: number;
};

export type Ritmo = {
  /** Lo que le falta por resolver. */
  pendientes: number;
  /** Días hábiles hasta su fecha límite. Negativo si ya pasó. */
  diasHabiles: number | null;
  /** Cuántos tendría que resolver cada día hábil para llegar. */
  exigidoPorDia: number | null;
  /** Cuántos viene resolviendo al día, de lo que ya hizo. */
  realPorDia: number | null;
  estado: EstadoDeCumplimiento;
};

/**
 * El ritmo de un asesor contra su fecha.
 *
 * `diasCorridos` son los días hábiles que lleva trabajando esa carga, y
 * salen del lead más viejo: dividir por los días del periodo elegido
 * daría un ritmo inventado a quien empezó ayer.
 */
export function ritmoDe(entrada: {
  carga: Carga;
  /** La fecha contra la que corre: cierre de inscripciones o fin del curso. */
  limite: Date | null;
  hoy: Date;
  /** Días hábiles que lleva con esta carga encima. Cero el primer día. */
  diasCorridos: number;
}): Ritmo {
  const { carga, limite, hoy, diasCorridos } = entrada;
  const pendientes = Math.max(0, carga.total - carga.resueltos);

  /// Sin nada pendiente NO se mira la fecha. Quien terminó, terminó,
  /// aunque el plazo esté vencido: pintarlo en rojo por el calendario
  /// es una alarma falsa en la fila de quien hizo el trabajo.
  if (pendientes === 0) {
    return {
      pendientes: 0,
      diasHabiles: limite ? habilesEntre(hoyEnColombia(hoy), limite) : null,
      exigidoPorDia: 0,
      realPorDia: diasCorridos > 0 ? carga.resueltos / diasCorridos : null,
      estado: 'TERMINADO',
    };
  }

  if (!limite) {
    return {
      pendientes,
      diasHabiles: null,
      exigidoPorDia: null,
      realPorDia: diasCorridos > 0 ? carga.resueltos / diasCorridos : null,
      estado: 'SIN_PLAZO',
    };
  }

  const diasHabiles = habilesEntre(hoyEnColombia(hoy), limite);
  const realPorDia = diasCorridos > 0 ? carga.resueltos / diasCorridos : null;

  /// Pasado el plazo y con pendientes, no hay ritmo que calcular: ya
  /// no se llega, y dividir por cero o por un número negativo daría
  /// una cifra que parecería una meta.
  if (diasHabiles <= 0) {
    return { pendientes, diasHabiles, exigidoPorDia: null, realPorDia, estado: 'VENCIDO' };
  }

  const exigidoPorDia = pendientes / diasHabiles;

  /// Sin historia con la que comparar --primer día-- se mira solo si
  /// la exigencia es razonable para una persona. Dos por día hábil es
  /// lo que el equipo sostiene; por encima de eso ya avisa.
  if (realPorDia === null || realPorDia === 0) {
    return {
      pendientes,
      diasHabiles,
      exigidoPorDia,
      realPorDia,
      estado: exigidoPorDia > HOLGURA_EN_RIESGO ? 'EN_RIESGO' : 'AJUSTADO',
    };
  }

  /// Cuánto MÁS de lo que viene haciendo le va a tocar hacer. Uno es
  /// «al ritmo de siempre llega»; por encima, tiene que apretar.
  const cuantoMas = exigidoPorDia / realPorDia;
  const estado: EstadoDeCumplimiento =
    cuantoMas <= 1 ? 'AL_DIA' : cuantoMas <= HOLGURA_AJUSTADO ? 'AJUSTADO' : 'EN_RIESGO';

  return { pendientes, diasHabiles, exigidoPorDia, realPorDia, estado };
}

/**
 * La antigüedad media de lo que sigue sin resolver, en días.
 *
 * DE LO PENDIENTE Y NO DE TODO: la media con los ya resueltos dentro
 * baja sola cada vez que alguien cierra un lead, y entonces el número
 * mejora justo cuando el asesor deja de atender a los viejos. Lo que
 * se quiere saber es cuánto llevan esperando los que esperan.
 */
export function antiguedadMedia(llegadas: Date[], hoy: Date): number | null {
  if (llegadas.length === 0) return null;
  const dia = 86_400_000;
  const suma = llegadas.reduce((s, f) => s + Math.max(0, hoy.getTime() - f.getTime()), 0);
  return Math.round((suma / llegadas.length / dia) * 10) / 10;
}

/** ¿Hay que reforzar a este asesor? */
export function necesitaRefuerzo(r: Ritmo): boolean {
  return r.estado === 'EN_RIESGO' || r.estado === 'VENCIDO';
}
