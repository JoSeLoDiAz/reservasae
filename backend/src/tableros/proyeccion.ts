/** A qué ritmo entran los cupos. */

import { aDiaBogota, diaBogotaHace } from '../comun/dia-bogota';

export type PuntoNeto = { dia: string; neto: number };

export type EstadoProyeccion =
  | 'CUMPLIDA'
  | 'SIN_META'
  | 'SIN_RITMO'
  | 'RETROCEDE'
  | 'MUY_LEJOS'
  | 'ESTIMADA';

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

export function calcularProyeccion(entrada: {
  serie: PuntoNeto[];
  ocupados: number;
  meta: number;
  dias: number;
  hoy: Date;
  origen?: 'MOVIMIENTOS' | 'APROXIMADO';
  /** Días de historia disponibles. */
  diasDeHistoria?: number;
}): Proyeccion {
  const { serie, ocupados, meta, dias, hoy } = entrada;

  /// `dias` ES la cobertura de la serie: la consulta la acota
  /// justo a esa ventana.
  const ritmoDiario = ritmoPorDia(serie, dias, hoy) ?? 0;
  const ritmo7 = ritmoPorDia(serie, 7, hoy, dias);
  const ritmo14 = ritmoPorDia(serie, 14, hoy, dias);
  const faltan = Math.max(0, meta - ocupados);

  const base: Omit<Proyeccion, 'estado' | 'diasEstimados' | 'fechaEstimada'> = {
    confianza: (entrada.diasDeHistoria ?? dias) < 7 ? 'BAJA' : 'NORMAL',
    origen: entrada.origen ?? 'MOVIMIENTOS',
    ocupados,
    meta,
    faltan,
    ritmoDiario,
    ritmo7,
    ritmo14,
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
