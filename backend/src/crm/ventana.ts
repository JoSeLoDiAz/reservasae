/**
 * La ventana de tiempo de los tableros, y con qué se
 * compara.
 *
 * El periodo anterior es SIEMPRE el inmediatamente previo y
 * de la misma duración: si se miran los últimos 7 días, se
 * compara con los 7 anteriores. Comparar contra un periodo
 * de otra longitud daría variaciones que no significan nada.
 *
 * Todo se calcula en la zona de Bogotá y no en UTC. El
 * servidor corre en UTC, así que «ayer» sin desplazar
 * empezaría a las 7 de la tarde del día anterior y se
 * comería cinco horas de movimiento en el corte.
 */

/** Colombia no tiene horario de verano: el offset es fijo. */
const BOGOTA = -5;
const DIA = 24 * 60 * 60 * 1000;

export type Rango =
  | 'HOY'
  | 'AYER'
  | 'SEMANA'
  | 'MES'
  | 'MES_PASADO'
  | 'TRIMESTRE'
  | 'ANO'
  | 'TODO'
  | 'PERSONALIZADO';

export type Ventana = { desde: Date; hasta: Date };

export type Comparacion = {
  rango: Rango;
  /** Null cuando el rango es TODO: no hay corte. */
  actual: Ventana | null;
  /** Null si no hay con qué comparar. */
  anterior: Ventana | null;
  etiqueta: string;
  etiquetaAnterior: string | null;
};

/** Medianoche de Bogotá, en el instante UTC que le toca. */
function inicioDeDiaBogota(d: Date): Date {
  const local = new Date(d.getTime() + BOGOTA * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const dia = local.getUTCDate();
  return new Date(Date.UTC(y, m, dia) - BOGOTA * 60 * 60 * 1000);
}

function sumarMeses(d: Date, n: number): Date {
  const local = new Date(d.getTime() + BOGOTA * 60 * 60 * 1000);
  const t = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + n, local.getUTCDate());
  return new Date(t - BOGOTA * 60 * 60 * 1000);
}

/** El primero del mes de esa fecha, hora de Bogotá. */
function inicioDeMesBogota(d: Date): Date {
  const local = new Date(d.getTime() + BOGOTA * 60 * 60 * 1000);
  const t = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1);
  return new Date(t - BOGOTA * 60 * 60 * 1000);
}

const ETIQUETA: Record<Rango, string> = {
  HOY: 'Hoy',
  AYER: 'Ayer',
  SEMANA: 'Últimos 7 días',
  MES: 'Últimos 30 días',
  MES_PASADO: 'El mes pasado',
  TRIMESTRE: 'Últimos 90 días',
  ANO: 'Últimos 12 meses',
  TODO: 'Desde el principio',
  PERSONALIZADO: 'Entre dos fechas',
};

/**
 * Resuelve el rango pedido a dos ventanas comparables.
 *
 * `ahora` entra por parámetro para poder probarlo: una
 * función que lee el reloj por su cuenta no se puede fijar
 * en un test, y estos cortes son justo lo que hay que fijar.
 */
export function resolverVentana(
  rango: Rango = 'TODO',
  desde?: string,
  hasta?: string,
  ahora: Date = new Date(),
): Comparacion {
  const hoy = inicioDeDiaBogota(ahora);
  const manana = new Date(hoy.getTime() + DIA);

  const construir = (a: Ventana): Comparacion => {
    const largo = a.hasta.getTime() - a.desde.getTime();
    const anterior: Ventana = {
      desde: new Date(a.desde.getTime() - largo),
      hasta: a.desde,
    };
    return {
      rango,
      actual: a,
      anterior,
      etiqueta: ETIQUETA[rango],
      etiquetaAnterior: 'el periodo anterior',
    };
  };

  switch (rango) {
    case 'HOY':
      return construir({ desde: hoy, hasta: manana });

    case 'AYER':
      return construir({ desde: new Date(hoy.getTime() - DIA), hasta: hoy });

    case 'SEMANA':
      return construir({ desde: new Date(manana.getTime() - 7 * DIA), hasta: manana });

    case 'MES':
      return construir({ desde: new Date(manana.getTime() - 30 * DIA), hasta: manana });

    case 'MES_PASADO': {
      const inicioEste = inicioDeMesBogota(ahora);
      const inicioPasado = sumarMeses(inicioEste, -1);
      // el mes anterior a ese, que no siempre dura igual
      const inicioAntePasado = sumarMeses(inicioEste, -2);
      return {
        rango,
        actual: { desde: inicioPasado, hasta: inicioEste },
        anterior: { desde: inicioAntePasado, hasta: inicioPasado },
        etiqueta: ETIQUETA[rango],
        etiquetaAnterior: 'el mes anterior a ese',
      };
    }

    case 'TRIMESTRE':
      return construir({ desde: new Date(manana.getTime() - 90 * DIA), hasta: manana });

    case 'ANO': {
      const inicio = sumarMeses(manana, -12);
      return {
        rango,
        actual: { desde: inicio, hasta: manana },
        anterior: { desde: sumarMeses(inicio, -12), hasta: inicio },
        etiqueta: ETIQUETA[rango],
        etiquetaAnterior: 'los 12 meses anteriores',
      };
    }

    case 'PERSONALIZADO': {
      // sin las dos fechas no hay corte que valga
      if (!desde || !hasta) return resolverVentana('TODO', undefined, undefined, ahora);
      const a = inicioDeDiaBogota(new Date(`${desde}T12:00:00Z`));
      // el «hasta» que escribe una persona incluye ese día
      const b = new Date(inicioDeDiaBogota(new Date(`${hasta}T12:00:00Z`)).getTime() + DIA);
      if (!(a < b)) return resolverVentana('TODO', undefined, undefined, ahora);
      return construir({ desde: a, hasta: b });
    }

    default:
      return {
        rango: 'TODO',
        actual: null,
        anterior: null,
        etiqueta: ETIQUETA.TODO,
        etiquetaAnterior: null,
      };
  }
}

/** Cuánto cambió, de -1 a +∞. Null si antes no había nada. */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual === 0 ? 0 : null;
  return (actual - anterior) / anterior;
}
