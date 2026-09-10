/** Las fechas que se derivan del arranque de un grupo. */

/// Ninguna de estas fechas se teclea: todas salen de la de
/// inicio del grupo. Si el cronograma se mueve, se mueven
/// solas, y por eso al participante no se le dice ninguna
/// hasta que cierre inscripciones.
///
/// El ejemplo que fija las cuentas, tal como lo planteo
/// Mauricio: un curso que empieza el lunes 7 de septiembre
/// cierra inscripciones el lunes 31 de agosto, y el aviso
/// para liberar cupos sale el miercoles 26.
///
///     inicio del grupo        lunes  7 sep
///     - 5 dias habiles  ->    lunes 31 ago   cierre
///     - 3 dias habiles  ->  miercoles 26 ago   aviso

/// Una semana laboral entre el cierre y el arranque: lo que
/// tarda alistar listas, grupos y aulas.
export const HABILES_ANTES_DEL_INICIO = 5;

/// Y tres dias mas de margen para avisar. No se espera al
/// cierre para descubrir que faltan cupos: para entonces ya
/// no hay a quien llamar.
export const HABILES_DE_AVISO = 3;

const ES_FIN_DE_SEMANA = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

/// Colombia va cinco horas detras de UTC, y no mueve el
/// reloj en todo el año.
///
/// Sin esto, a las siete de la noche en Bogotá ya es el dia
/// siguiente en UTC, y una ventana que cierra hoy se daria
/// por cerrada esta misma tarde. Cada tarde. Un dia menos
/// para inscribir, todos los dias, y nadie entendiendo por
/// que.
const HORAS_DE_COLOMBIA = -5;

/**
 * El dia de Bogota al que pertenece un instante, como fecha.
 *
 * Se convierte UNA vez, en la frontera: de aqui para adentro
 * todo son fechas de calendario y se comparan entre si. Los
 * instantes -- «ahora» -- se quedan fuera. Mezclar las dos
 * cosas es lo que hacia que una ventana cerrara la tarde
 * antes.
 */
export function hoyEnColombia(instante: Date): Date {
  const local = new Date(instante.getTime() + HORAS_DE_COLOMBIA * 3600_000);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
  );
}

/// El dia de una fecha de calendario, para compararla.
function diaDeLaFecha(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Retrocede N días hábiles desde una fecha. */
export function habilesAtras(desde: Date, cuantos: number): Date {
  const f = new Date(desde.getTime());
  let quedan = cuantos;
  while (quedan > 0) {
    f.setUTCDate(f.getUTCDate() - 1);
    if (!ES_FIN_DE_SEMANA(f)) quedan -= 1;
  }
  return f;
}

/** Hasta cuándo se puede inscribir a este grupo. */
export function cierreDeInscripciones(fechaInicio: Date): Date {
  return habilesAtras(fechaInicio, HABILES_ANTES_DEL_INICIO);
}

/** Cuándo hay que avisar que faltan cupos por completar. */
export function avisoDeLiberacion(fechaInicio: Date): Date {
  return habilesAtras(cierreDeInscripciones(fechaInicio), HABILES_DE_AVISO);
}

/** En qué punto está la ventana de inscripción de un grupo. */
export type VentanaInscripcion = {
  /// Null cuando el grupo todavia no tiene fecha de inicio:
  /// sin ella no hay ventana, y no se puede inscribir.
  fechaInicio: Date | null;
  cierre: Date | null;
  aviso: Date | null;
  /// Dias habiles que quedan para inscribir. Negativo si ya cerro.
  diasHabilesRestantes: number | null;
  estado: 'SIN_FECHAS' | 'ABIERTA' | 'POR_AVISAR' | 'AVISANDO' | 'CERRADA';
};

export function ventanaDe(fechaInicio: Date | null, hoy: Date): VentanaInscripcion {
  if (!fechaInicio) {
    return {
      fechaInicio: null,
      cierre: null,
      aviso: null,
      diasHabilesRestantes: null,
      estado: 'SIN_FECHAS',
    };
  }

  const cierre = cierreDeInscripciones(fechaInicio);
  const aviso = avisoDeLiberacion(fechaInicio);

  // se comparan dias de Bogota, no instantes: inscribir a las
  // once de la noche del dia del cierre sigue siendo el dia
  // del cierre
  // aqui es la frontera: de esta linea en adelante, fechas
  const hoyBogota = hoyEnColombia(hoy);
  const h = diaDeLaFecha(hoyBogota);

  let estado: VentanaInscripcion['estado'];
  if (h > diaDeLaFecha(cierre)) estado = 'CERRADA';
  else if (h >= diaDeLaFecha(aviso)) estado = 'AVISANDO';
  else estado = 'ABIERTA';

  return {
    fechaInicio,
    cierre,
    aviso,
    diasHabilesRestantes: habilesEntre(hoyBogota, cierre),
    estado,
  };
}

/// Dias habiles de `desde` a `hasta`. Negativo si ya paso.
/// Entre dos FECHAS de calendario. Si tiene un instante,
/// paselo antes por `hoyEnColombia`.
export function habilesEntre(desde: Date, hasta: Date): number {
  const a = diaDeLaFecha(desde);
  const b = diaDeLaFecha(hasta);
  if (a === b) return 0;

  const atras = b < a;
  const f = new Date(Math.min(a, b));
  const tope = Math.max(a, b);
  let n = 0;
  while (f.getTime() < tope) {
    f.setUTCDate(f.getUTCDate() + 1);
    if (!ES_FIN_DE_SEMANA(f)) n += 1;
  }
  return atras ? -n : n;
}
