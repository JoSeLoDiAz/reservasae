/** El mes comercial: dónde empieza, dónde acaba y cuántos días de trabajo tiene. */

/**
 * Un mes no es un rango de fechas: es un rango de INSTANTES.
 *
 * La cifra del mes se calcula comparando `cerradaEn` —un instante
 * en UTC— contra los bordes del mes. Si esos bordes se construyen
 * con `new Date(anio, mes, 1)`, salen en la hora del servidor, y el
 * servidor de producción vive en UTC: el mes empezaría a las siete
 * de la tarde del último día del mes anterior. Una venta cerrada el
 * 30 de septiembre a las 8 p. m. en Bogotá se contaría en octubre,
 * el asesor juraría que la cerró en septiembre, y tendría razón.
 *
 * Por eso todo lo que aquí se construye lleva el huso dentro, y por
 * eso este módulo es puro: la frontera entre «día de calendario» e
 * «instante» se cruza en un solo sitio y se prueba sin levantar
 * nada.
 */

/**
 * Colombia va cinco horas detrás de UTC, todo el año.
 *
 * La misma constante vive en `crm/calendario-inscripcion.ts`. Está
 * repetida a propósito: el huso de Bogotá es un hecho geográfico,
 * no una política nuestra —Colombia no mueve el reloj desde 1993—,
 * y repetir un hecho sale más barato que amarrar el módulo
 * comercial al de inscripciones, que se mueve por otras razones.
 */
const HORAS_DE_COLOMBIA = -5;

const UNA_HORA = 3_600_000;

/** Un mes concreto. `mes` va de 1 a 12, como lo dice la gente. */
export type Periodo = { anio: number; mes: number };

/** El día colombiano al que pertenece un instante. */
export type DiaColombiano = Periodo & { dia: number };

/**
 * Los dos bordes de un periodo, como instantes.
 *
 * `desde` entra y `hasta` NO: es `[desde, hasta)`. Cerrarlo por los
 * dos lados obliga a elegir el último milisegundo del mes, y ese
 * milisegundo siempre se elige mal —las 23:59:59 dejan fuera lo que
 * pase en el último segundo—. Media abierta no tiene ese borde.
 */
export type Ventana = { desde: Date; hasta: Date };

/// Medianoche de Bogotá de ese día, como instante.
function medianocheEnBogota(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes - 1, dia) - HORAS_DE_COLOMBIA * UNA_HORA);
}

/** Del primer instante del mes al primero del siguiente. */
export function ventanaDelMes(anio: number, mes: number): Ventana {
  return {
    desde: medianocheEnBogota(anio, mes, 1),
    /// `mes + 1` con diciembre da enero del año siguiente: `Date.UTC`
    /// desborda el mes solo, así que el cierre de año no necesita un
    /// caso aparte —que es justo donde se equivocan estas cuentas—.
    hasta: medianocheEnBogota(anio, mes + 1, 1),
  };
}

/** El año entero, para los informes que comparan doce meses. */
export function ventanaDelAnio(anio: number): Ventana {
  return {
    desde: medianocheEnBogota(anio, 1, 1),
    hasta: medianocheEnBogota(anio + 1, 1, 1),
  };
}

/** La ventana de un mes, o la del año entero si no se dice el mes. */
export function ventanaDe(anio: number, mes?: number | null): Ventana {
  return mes ? ventanaDelMes(anio, mes) : ventanaDelAnio(anio);
}

/** Qué día era en Bogotá cuando pasó esto. */
export function diaEnColombia(instante: Date): DiaColombiano {
  const local = new Date(instante.getTime() + HORAS_DE_COLOMBIA * UNA_HORA);
  return {
    anio: local.getUTCFullYear(),
    mes: local.getUTCMonth() + 1,
    dia: local.getUTCDate(),
  };
}

/** A qué mes comercial pertenece un instante. */
export function periodoDe(instante: Date): Periodo {
  const { anio, mes } = diaEnColombia(instante);
  return { anio, mes };
}

/// Para agrupar por mes sin comparar objetos: «2026-09».
export function claveDe(p: Periodo): string {
  return `${p.anio}-${String(p.mes).padStart(2, '0')}`;
}

/** Cuántos días tiene ese mes. */
export function diasDelMes(anio: number, mes: number): number {
  /// El día 0 del mes siguiente es el último de este.
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

function esFinDeSemana(anio: number, mes: number, dia: number): boolean {
  const d = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return d === 0 || d === 6;
}

/// Hábiles entre dos días del mismo mes, los dos incluidos.
function habilesEntre(
  anio: number,
  mes: number,
  desdeDia: number,
  hastaDia: number,
): number {
  let n = 0;
  for (let d = desdeDia; d <= hastaDia; d += 1) {
    if (!esFinDeSemana(anio, mes, d)) n += 1;
  }
  return n;
}

/**
 * Los días de trabajo del mes. SIN descontar festivos.
 *
 * Colombia tiene dieciocho festivos al año y ninguno está aquí. No
 * es un olvido: un calendario de festivos a medias —los fijos sí,
 * los que la ley Emiliani corre al lunes no— reparte mal la meta
 * justo en las semanas que importan, y sale peor que no tenerlo.
 *
 * Mientras no esté, el avance lo dice: viaja marcado con
 * `sinDescontarFestivos` para que el panel lo escriba al lado de la
 * cifra, en vez de aparentar una precisión que no tiene.
 */
export function diasHabilesDelMes(anio: number, mes: number): number {
  return habilesEntre(anio, mes, 1, diasDelMes(anio, mes));
}

/**
 * Los días hábiles que quedan, contando HOY.
 *
 * Hoy cuenta porque hoy todavía se vende. Dejarlo fuera hace que el
 * último día del mes tenga cero días para lo que falta, y entonces
 * «cuánto falta por día» —la cifra que dirige— se apaga justo en la
 * jornada en la que más se mira.
 */
export function diasHabilesRestantes(
  anio: number,
  mes: number,
  ahora: Date,
): number {
  if (mesTerminado(anio, mes, ahora)) return 0;
  const hoy = diaEnColombia(ahora);
  /// Un mes que aún no empieza tiene todos sus días por delante.
  if (anio > hoy.anio || (anio === hoy.anio && mes > hoy.mes)) {
    return diasHabilesDelMes(anio, mes);
  }
  return habilesEntre(anio, mes, hoy.dia, diasDelMes(anio, mes));
}

/** Si ese mes ya pasó del todo. */
export function mesTerminado(anio: number, mes: number, ahora: Date): boolean {
  const hoy = diaEnColombia(ahora);
  return anio < hoy.anio || (anio === hoy.anio && mes < hoy.mes);
}

/**
 * Los doce meses que acaban en el corriente, del más viejo al de hoy.
 *
 * Doce y no «lo que va del año»: en enero, un informe del año en
 * curso es una sola columna y no enseña ninguna tendencia. Doce
 * meses móviles siempre comparan contra la misma época del año
 * anterior.
 */
export function ultimosDoceMeses(ahora: Date): Periodo[] {
  const hoy = diaEnColombia(ahora);
  const meses: Periodo[] = [];
  for (let atras = 11; atras >= 0; atras -= 1) {
    /// Restar meses con `Date.UTC` y no a mano: `mes - atras` se va
    /// a negativo al cruzar el año y hay que corregirlo; esto lo
    /// hace solo.
    const d = new Date(Date.UTC(hoy.anio, hoy.mes - 1 - atras, 1));
    meses.push({ anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 });
  }
  return meses;
}

const NOMBRES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function rotuloDeMes(mes: number): string {
  return NOMBRES[mes - 1] ?? `Mes ${mes}`;
}

export function rotuloDePeriodo(anio: number, mes?: number | null): string {
  return mes ? `${rotuloDeMes(mes)} de ${anio}` : `Año ${anio}`;
}

/// El primer año con datos. Antes de esto no había CRM, así que un
/// año menor es un dedo torcido tecleando, no un histórico.
export const PRIMER_ANIO = 2020;
export const ULTIMO_ANIO = 2100;

/**
 * Qué le falta al periodo para ser uno de verdad. Null si está bien.
 *
 * Devuelve el reparo en vez de lanzarlo, y vive aquí en vez de en
 * los decoradores del DTO, porque la misma regla la tiene que
 * cumplir quien llame al servicio desde un guion de siembra: una
 * regla escrita solo en el DTO protege la puerta HTTP y ninguna
 * otra.
 */
export function revisarPeriodo(anio: number, mes: number): string | null {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return `El mes va de 1 (enero) a 12 (diciembre). Llegó «${mes}».`;
  }
  if (!Number.isInteger(anio) || anio < PRIMER_ANIO || anio > ULTIMO_ANIO) {
    return `El año «${anio}» no parece un año de trabajo. Use uno entre ${PRIMER_ANIO} y ${ULTIMO_ANIO}.`;
  }
  return null;
}
