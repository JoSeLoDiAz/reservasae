/** A qué ritmo entran los cupos. */

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
  ritmo7: number;
  ritmo14: number;
  /** Días hasta llegar a la meta. */
  diasEstimados: number | null;
  fechaEstimada: string | null;
};

const DIA_MS = 24 * 60 * 60 * 1000;
const MAXIMO_DIAS = 365;

function aDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Neto por día de calendario. */
export function ritmoPorDia(serie: PuntoNeto[], dias: number, hasta: Date): number {
  if (dias <= 0) return 0;

  const desde = new Date(hasta.getTime() - (dias - 1) * DIA_MS);
  const limite = aDia(desde);
  const tope = aDia(hasta);

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

  const ritmoDiario = ritmoPorDia(serie, dias, hoy);
  const ritmo7 = ritmoPorDia(serie, 7, hoy);
  const ritmo14 = ritmoPorDia(serie, 14, hoy);
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
    fechaEstimada: aDia(new Date(hoy.getTime() + diasEstimados * DIA_MS)),
  };
}
