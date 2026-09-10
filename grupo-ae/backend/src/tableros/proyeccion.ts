/** A qué ritmo entran los cupos, y si llegan a tiempo. */

import { aDiaBogota, aDiaDeCalendario, diaBogotaHace } from '../comun/dia-bogota';
import { cierreDeInscripciones, hoyEnColombia } from '../crm/calendario-inscripcion';

export type PuntoNeto = { dia: string; neto: number };

export type EstadoProyeccion =
  | 'CUMPLIDA'
  | 'SIN_META'
  | 'SIN_RITMO'
  | 'RETROCEDE'
  | 'MUY_LEJOS'
  | 'ESTIMADA';

/**
 * El veredicto contra el cronograma, que es la pregunta de
 * verdad.
 *
 * `estado` contesta «cuándo se llenaría si nada cambia», y eso
 * daba fechas de 2027 que no significan nada: para entonces el
 * curso ya arrancó y cerró. Lo que se quiere saber es si llega
 * ANTES de que cierre inscripción, y el cierre sale del
 * cronograma --cinco días hábiles antes de que arranque el
 * grupo, `cierreDeInscripciones`--.
 *
 * Va en un campo aparte y no dentro de `estado` porque son dos
 * preguntas distintas: una es el ritmo y la otra es el plazo.
 * Mezclarlas obligaría a repetir cada estado por dos.
 */
export type VeredictoCronograma =
  /// Ningun grupo tiene fecha de inicio. El esquema las deja
  /// opcionales --«los proyectos no traen fechas»--, asi que
  /// esto no es un error: es que nadie la ha cargado.
  | 'SIN_CRONOGRAMA'
  | 'CERRADA'
  | 'ALCANZA'
  | 'NO_ALCANZA';

export type Confianza = 'BAJA' | 'NORMAL';

export type Proyeccion = {
  estado: EstadoProyeccion;
  confianza: Confianza;
  /** De dónde salió la serie. */
  origen: 'MOVIMIENTOS' | 'APROXIMADO';
  ocupados: number;
  meta: number;
  faltan: number;
  /** Cupos netos por día de calendario. */
  ritmoDiario: number;
  /// NULL cuando la ventana pedida es mas corta que la del
  /// ritmo: decir un numero seria decir uno falso.
  ritmo7: number | null;
  ritmo14: number | null;
  /** Días hasta llegar a la meta. */
  diasEstimados: number | null;
  fechaEstimada: string | null;

  // el plazo, que es lo que manda

  /** El último día en que se puede inscribir. Del cronograma. */
  cierre: string | null;
  /** Días de calendario hasta el cierre. Negativo si ya pasó. */
  diasAlCierre: number | null;
  /** Cuántos cupos faltarían el día del cierre, al ritmo de hoy. */
  faltaranAlCierre: number | null;
  cronograma: VeredictoCronograma;
};

const DIA_MS = 24 * 60 * 60 * 1000;
const MAXIMO_DIAS = 365;

/**
 * Neto por día de calendario, en días de Bogotá.
 *
 * La serie viene agrupada por el día de Bogotá, así que la
 * ventana tiene que cortar por el mismo calendario. Con
 * `toISOString()` cortaba por UTC: a partir de las 19:00 el
 * tope era el día de mañana y la ventana entera se corría un
 * día, dejando fuera el más antiguo.
 *
 * `serieDias` es cuántos días de serie hay de verdad. Sin él,
 * `ritmo14` sobre una serie de siete sumaba siete días y
 * dividía entre catorce: la mitad del ritmo real, y sin decirlo.
 * Ahora esa ventana devuelve `null`, que es lo que significa.
 */
export function ritmoPorDia(
  serie: PuntoNeto[],
  dias: number,
  hasta: Date,
  serieDias?: number,
): number | null {
  if (dias <= 0) return 0;
  if (serieDias !== undefined && dias > serieDias) return null;

  const limite = diaBogotaHace(dias - 1, hasta);
  const tope = aDiaBogota(hasta);

  let total = 0;
  for (const punto of serie) {
    if (punto.dia >= limite && punto.dia <= tope) total += punto.neto;
  }
  return total / dias;
}

/**
 * Hasta cuándo se puede inscribir a una acción entera.
 *
 * El ÚLTIMO cierre de sus grupos, no el primero: la meta de la
 * acción se sigue llenando mientras quede un grupo abierto.
 * Los grupos sin fecha no cuentan --no restan plazo, porque no
 * se sabe el suyo--; si ninguno la tiene, no hay cierre.
 */
export function cierreDeLaAccion(fechasDeInicio: Array<Date | null>): Date | null {
  const cierres = fechasDeInicio
    .filter((f): f is Date => f instanceof Date)
    .map(cierreDeInscripciones);
  if (!cierres.length) return null;
  return cierres.reduce((a, b) => (b > a ? b : a));
}

/// El plazo, aparte del ritmo.
function contraElCronograma(
  cierre: Date | null | undefined,
  hoy: Date,
  faltan: number,
  ritmoDiario: number,
): Pick<Proyeccion, 'cierre' | 'diasAlCierre' | 'faltaranAlCierre' | 'cronograma'> {
  if (!cierre) {
    return {
      cierre: null,
      diasAlCierre: null,
      faltaranAlCierre: null,
      cronograma: 'SIN_CRONOGRAMA',
    };
  }

  /// `aDiaDeCalendario` y no `aDiaBogota`: el cierre se deriva
  /// de `Grupo.fechaInicio`, que es una fecha TECLEADA guardada
  /// a medianoche UTC. Leerla en Bogota la retrasa un dia.
  const dia = aDiaDeCalendario(cierre);
  const diasAlCierre = Math.round((cierre.getTime() - hoyEnColombia(hoy).getTime()) / DIA_MS);

  if (diasAlCierre < 0) {
    return { cierre: dia, diasAlCierre, faltaranAlCierre: faltan, cronograma: 'CERRADA' };
  }

  /// Lo que entraria de aqui al cierre al ritmo de hoy. Un
  /// ritmo negativo resta, que es lo correcto: si se cancela
  /// mas de lo que entra, el dia del cierre falta MAS.
  const entraran = ritmoDiario * diasAlCierre;
  const faltaranAlCierre = Math.max(0, Math.ceil(faltan - entraran));

  return {
    cierre: dia,
    diasAlCierre,
    faltaranAlCierre,
    cronograma: faltaranAlCierre === 0 ? 'ALCANZA' : 'NO_ALCANZA',
  };
}

export function calcularProyeccion(entrada: {
  serie: PuntoNeto[];
  ocupados: number;
  meta: number;
  dias: number;
  hoy: Date;
  origen?: 'MOVIMIENTOS' | 'APROXIMADO';
  /** Días de historia disponibles. */
  diasDeHistoria?: number;
  /** El cierre de inscripción que sale del cronograma. */
  cierre?: Date | null;
}): Proyeccion {
  const { serie, ocupados, meta, dias, hoy } = entrada;

  /// `dias` ES la cobertura de la serie: la consulta la acota
  /// justo a esa ventana.
  const ritmoDiario = ritmoPorDia(serie, dias, hoy) ?? 0;
  const ritmo7 = ritmoPorDia(serie, 7, hoy, dias);
  const ritmo14 = ritmoPorDia(serie, 14, hoy, dias);
  const faltan = Math.max(0, meta - ocupados);

  const plazo = contraElCronograma(entrada.cierre, hoy, faltan, ritmoDiario);

  const base: Omit<Proyeccion, 'estado' | 'diasEstimados' | 'fechaEstimada'> = {
    confianza: (entrada.diasDeHistoria ?? dias) < 7 ? 'BAJA' : 'NORMAL',
    origen: entrada.origen ?? 'MOVIMIENTOS',
    ocupados,
    meta,
    faltan,
    ritmoDiario,
    ritmo7,
    ritmo14,
    ...plazo,
  };

  const sinFecha = { diasEstimados: null, fechaEstimada: null };

  if (meta <= 0) return { ...base, estado: 'SIN_META', ...sinFecha };
  if (faltan === 0) return { ...base, estado: 'CUMPLIDA', ...sinFecha };
  // se cancela más de lo que entra
  if (ritmoDiario < 0) return { ...base, estado: 'RETROCEDE', ...sinFecha };
  if (ritmoDiario === 0) return { ...base, estado: 'SIN_RITMO', ...sinFecha };

  const diasEstimados = Math.ceil(faltan / ritmoDiario);
  if (diasEstimados > MAXIMO_DIAS) {
    return { ...base, estado: 'MUY_LEJOS', diasEstimados, fechaEstimada: null };
  }

  return {
    ...base,
    estado: 'ESTIMADA',
    diasEstimados,
    fechaEstimada: aDiaBogota(new Date(hoy.getTime() + diasEstimados * DIA_MS)),
  };
}
