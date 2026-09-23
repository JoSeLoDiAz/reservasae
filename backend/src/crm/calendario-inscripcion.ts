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

/**
 * Y en los VIRTUALES, dos semanas de calendario.
 *
 * «En inscripciones existen dos momentos: en virtuales 2 semanas, en
 * presenciales 5 días hábiles antes» (cliente, 23 sep 2026). Él mismo
 * añadió «esto sujeto a cambio», así que las dos viven aquí arriba y
 * se mueven de una línea.
 *
 * DÍAS DE CALENDARIO Y NO HÁBILES, a propósito: «dos semanas» son
 * catorce días para cualquiera que lo diga en voz alta. Contarlas en
 * hábiles daría dieciocho de calendario y el cierre caería casi tres
 * semanas antes, que no es lo que se acordó.
 */
export const DIAS_ANTES_DEL_INICIO_VIRTUAL = 14;

/**
 * Cómo se dicta el grupo, que es lo que decide cuál de las dos manda.
 *
 * LA HÍBRIDA VA POR LA REGLA PRESENCIAL, y conviene saber por qué: un
 * grupo híbrido tiene gente que se sienta en una sala, y esa sala hay
 * que alistarla igual que la de un presencial. Darle el plazo del
 * virtual sería cerrar dos semanas antes sin necesidad y perder diez
 * días de inscripción en los grupos más grandes.
 */
export type ModalidadDeCierre = 'PRESENCIAL' | 'VIRTUAL' | 'HIBRIDA';

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

/** Retrocede N días de calendario desde una fecha. */
function diasAtras(desde: Date, cuantos: number): Date {
  const f = new Date(desde.getTime());
  f.setUTCDate(f.getUTCDate() - cuantos);
  return f;
}

/**
 * Hasta cuándo se puede inscribir a este grupo.
 *
 * La modalidad va OPCIONAL y sin ella manda la regla presencial. No
 * es pereza: es que los tres sitios que ya llamaban a esta función
 * --el panel de cupos, la proyección y el tablero-- no tenían por qué
 * cambiar el día que aparecieron dos reglas, y la presencial es la
 * que estaba en vigor para todos ellos.
 */
export function cierreDeInscripciones(
  fechaInicio: Date,
  modalidad?: ModalidadDeCierre,
): Date {
  if (modalidad === 'VIRTUAL') {
    return diasAtras(fechaInicio, DIAS_ANTES_DEL_INICIO_VIRTUAL);
  }
  return habilesAtras(fechaInicio, HABILES_ANTES_DEL_INICIO);
}

/** Cuándo hay que avisar que faltan cupos por completar. */
export function avisoDeLiberacion(
  fechaInicio: Date,
  modalidad?: ModalidadDeCierre,
): Date {
  /// El aviso se cuenta en hábiles en las dos modalidades: son días
  /// de trabajo de quien tiene que llamar, no de calendario.
  return habilesAtras(cierreDeInscripciones(fechaInicio, modalidad), HABILES_DE_AVISO);
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

export function ventanaDe(
  fechaInicio: Date | null,
  hoy: Date,
  modalidad?: ModalidadDeCierre,
): VentanaInscripcion {
  if (!fechaInicio) {
    return {
      fechaInicio: null,
      cierre: null,
      aviso: null,
      diasHabilesRestantes: null,
      estado: 'SIN_FECHAS',
    };
  }

  const cierre = cierreDeInscripciones(fechaInicio, modalidad);
  const aviso = avisoDeLiberacion(fechaInicio, modalidad);

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
