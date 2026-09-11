/** En qué cubo de la agenda cae cada gestión, y desde cuándo. */

/**
 * La agenda se mide en DÍAS de Bogotá, no en instantes.
 *
 * Es la decisión de fondo de este archivo y conviene decirla
 * entera, porque las dos formas de equivocarse cuestan caro y
 * ninguna de las dos da error:
 *
 * 1. **Comparar instantes.** Una gestión que vence «hoy» se
 *    guarda con la hora que mande el panel —a menudo la de
 *    creación—, así que `venceEn < ahora` la pinta VENCIDA a los
 *    cinco minutos de agendarla. El asesor abre su agenda a las
 *    diez de la mañana y ve en rojo lo que se comprometió a hacer
 *    hoy. Cuando todo está en rojo, el rojo deja de leerse. En un
 *    CRM el compromiso es del DÍA: «llámelo el martes» se cumple
 *    a cualquier hora del martes.
 *
 * 2. **Partir el día en UTC.** `toISOString().slice(0, 10)` da el
 *    día de Greenwich, y Colombia va cinco horas detrás: a partir
 *    de las 19:00 de Bogotá ese cálculo ya devuelve mañana. Sin
 *    corregirlo, cada tarde a las siete la agenda de todo el
 *    equipo salta un día: lo de hoy se marca vencido y lo de
 *    mañana aparece como de hoy. Es el mismo defecto que
 *    `comun/dia-bogota.ts` documenta para los tableros.
 *
 * Este módulo es puro a propósito —ni Nest ni Prisma— para poder
 * fijar los bordes de medianoche en `agenda.spec.ts` sin levantar
 * nada. Por eso NO importa `comun/dia-bogota.ts`, que sí carga
 * Prisma para sus ayudas de SQL. Para que esa copia no se separe
 * en silencio, la prueba de aquí compara las dos contra los
 * mismos instantes: si una cambia, la otra revienta.
 */

/// Colombia no mueve el reloj desde 1993, así que el desfase es
/// −5 fijo. Se declara UNA vez y se usa en las dos direcciones
/// —leer el día de un instante y construir la medianoche de un
/// día—, que es lo que garantiza que la consulta a la base y la
/// clasificación en memoria partan el día por el mismo sitio.
/// Mezclar `Intl` para un lado y un número para el otro es como
/// se cuela una gestión en dos cubos a la vez.
export const HORAS_DE_BOGOTA = -5;

const MS_HORA = 3_600_000;
const MS_DIA = 24 * MS_HORA;

/**
 * Dónde cae una gestión pendiente al mirar la agenda.
 *
 * Son EXCLUYENTES: `HOY` no está dentro de `ESTA_SEMANA`. Una
 * gestión que aparece en dos cubos se cuenta dos veces, y una
 * agenda que dice «14 cosas» y enseña 11 es una agenda a la que
 * nadie vuelve.
 */
export type Cubo = 'VENCIDA' | 'HOY' | 'ESTA_SEMANA' | 'MAS_ADELANTE';

/// En el orden en que se leen, que es el de la urgencia.
export const CUBOS: Cubo[] = ['VENCIDA', 'HOY', 'ESTA_SEMANA', 'MAS_ADELANTE'];

/** El día del calendario de Bogotá de un instante, `YYYY-MM-DD`. */
export function diaBogotaDe(instante: Date): string {
  return corrida(instante).toISOString().slice(0, 10);
}

/**
 * El instante UTC en que ARRANCA ese día de Bogotá.
 *
 * `2026-09-10` → `2026-09-10T05:00:00.000Z`. Es lo que se le pasa
 * a Prisma: la base guarda en UTC y no sabe de Bogotá, así que la
 * frontera se traduce aquí una sola vez y las consultas ya
 * comparan instantes contra instantes.
 */
export function medianocheBogotaDe(dia: string): Date {
  return new Date(
    Date.parse(`${dia}T00:00:00.000Z`) - HORAS_DE_BOGOTA * MS_HORA,
  );
}

/** Los cortes de la agenda en un momento dado, ya en UTC. */
export type Limites = {
  /// El día de Bogotá que se está mirando, para poder decirlo.
  dia: string;
  /// 00:00 de hoy en Bogotá. Todo lo anterior está VENCIDO.
  inicioDeHoy: Date;
  /// 00:00 de mañana en Bogotá. Hasta aquí llega HOY.
  finDeHoy: Date;
  /// 00:00 del lunes que viene. Hasta aquí llega ESTA SEMANA.
  finDeSemana: Date;
};

/**
 * De cuándo a cuándo va cada cubo.
 *
 * La semana es la del CALENDARIO —de lunes a domingo— y no una
 * ventana móvil de siete días. La ventana móvil parece más cómoda
 * y es peor: absorbe un día nuevo cada mañana, así que «lo de
 * esta semana» nunca baja de doce y la semana no se termina
 * nunca. Una semana de calendario se vacía, y esa es la gracia:
 * es un compromiso que cierra y que el lunes se vuelve a abrir.
 * Además hace que el asesor y su líder estén mirando exactamente
 * los mismos días.
 *
 * El domingo `finDeSemana` coincide con `finDeHoy` y el cubo de
 * la semana queda vacío. Es correcto: el domingo no queda semana
 * por delante, y lo del lunes es MAS_ADELANTE hasta que llegue.
 */
export function limitesDeAgenda(ahora: Date): Limites {
  const dia = diaBogotaDe(ahora);
  const inicioDeHoy = medianocheBogotaDe(dia);

  /// 0 = domingo … 6 = sábado, ya en el calendario de Bogotá.
  const diaDeLaSemana = corrida(ahora).getUTCDay();
  /// Cuántos días faltan para el lunes que viene. El lunes son
  /// siete y no cero: la semana que empieza hoy cuenta entera.
  const hastaElLunes = (8 - diaDeLaSemana) % 7 || 7;

  return {
    dia,
    inicioDeHoy,
    /// Sumar días en milisegundos es exacto porque Colombia no
    /// tiene horario de verano; en una zona que lo tuviera esto
    /// habría que hacerlo sobre el calendario.
    finDeHoy: new Date(inicioDeHoy.getTime() + MS_DIA),
    finDeSemana: new Date(inicioDeHoy.getTime() + hastaElLunes * MS_DIA),
  };
}

/** En qué cubo cae algo que vence en ese instante. */
export function cuboDe(venceEn: Date, ahora: Date): Cubo {
  return cuboSegun(venceEn, limitesDeAgenda(ahora));
}

/**
 * Igual, pero con los límites ya calculados.
 *
 * Existe para clasificar una lista entera contra UN solo corte.
 * Recalcularlos fila por fila abre la ventana a que la primera y
 * la última se midan contra días distintos si la consulta cae
 * encima de la medianoche — raro, y por eso mismo imposible de
 * reproducir cuando alguien lo reporte.
 */
export function cuboSegun(venceEn: Date, limites: Limites): Cubo {
  const cuando = venceEn.getTime();
  if (cuando < limites.inicioDeHoy.getTime()) return 'VENCIDA';
  if (cuando < limites.finDeHoy.getTime()) return 'HOY';
  if (cuando < limites.finDeSemana.getTime()) return 'ESTA_SEMANA';
  return 'MAS_ADELANTE';
}

/// Lo mínimo que hay que saber de una gestión para juzgarla. Se
/// declara así, y no con el tipo de Prisma, para que este módulo
/// siga sin depender del cliente generado.
export type GestionEnAgenda = {
  venceEn: Date | null;
  hechaEn: Date | null;
};

/**
 * Si esa gestión es un PRÓXIMO PASO de verdad.
 *
 * Es la definición que sostiene la consulta de «oportunidades sin
 * próximo paso», así que se escribe aquí y no dentro de un
 * `where`: son tres condiciones a la vez y cada una tapa un
 * agujero distinto.
 *
 *  - **Sin hacer.** Lo hecho es historial, no plan.
 *  - **Con fecha.** Una gestión sin `venceEn` es una nota suelta
 *    —«se llamó y no contestó»—, no un compromiso. Contarla como
 *    próximo paso saca el negocio de la lista sin que nadie haya
 *    prometido nada.
 *  - **No vencida.** Y esta es la que cierra el agujero grande.
 *    Crear una gestión mueve `ultimoToqueEn`, así que un negocio
 *    con una tarea agendada deja de salir en «frías»; si además
 *    una tarea vencida contara como próximo paso, agendar algo y
 *    no hacerlo nunca lo escondería de las DOS listas para
 *    siempre. Al vencerse vuelve a la lista, que es lo que debe
 *    pasar: el compromiso incumplido es justo la señal de que hay
 *    que mirarlo.
 */
export function esProximoPaso(g: GestionEnAgenda, ahora: Date): boolean {
  if (g.hechaEn !== null) return false;
  if (g.venceEn === null) return false;
  return g.venceEn.getTime() >= limitesDeAgenda(ahora).inicioDeHoy.getTime();
}

/**
 * Si se puede borrar.
 *
 * Vive con el resto de la distinción hecho/pendiente porque es la
 * misma: lo hecho es el historial del negocio —quién llamó, qué
 * dijeron, cuándo— y es la mitad del valor de un CRM. Borrarlo
 * deja una oportunidad ganada sin rastro de cómo se ganó. Lo
 * pendiente todavía no le pasó a nadie, así que se puede quitar.
 */
export function puedeBorrarse(hechaEn: Date | null): boolean {
  return hechaEn === null;
}

/// El instante corrido a Bogotá, para poder leerle el día y el
/// día de la semana con las funciones de UTC.
function corrida(instante: Date): Date {
  return new Date(instante.getTime() + HORAS_DE_BOGOTA * MS_HORA);
}
