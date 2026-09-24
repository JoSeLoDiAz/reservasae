/** Hasta cuándo tiene una institución para entregar los nombres de sus cupos. */

/**
 * LA REGLA, DICHA POR EL CLIENTE (23 sep 2026):
 *
 *   «Contexto a más tardar el 30 de septiembre, avisar 2 semanas antes
 *    que ya no van a participar».
 *
 * O sea: una institución que apartó cupos tiene hasta el 30 de
 * septiembre para decir con nombre propio quién los ocupa. Si no va a
 * participar, tiene que avisarlo con dos semanas de antelación --el 16
 * de septiembre-- para que esos cupos se puedan volver a ofrecer.
 *
 * FIJA Y PARA TODAS, no por grupo ni por acción: es lo que contestó
 * cuando se le preguntó. Vive aquí, en una constante, y no repartida
 * por la pantalla: el día que el proyecto se corra a diciembre se
 * cambia esta línea y cambian a la vez el informe, el semáforo, el
 * papel y lo que diga cualquier aviso.
 *
 * POR QUÉ NO ES UNA COLUMNA DE LA BASE. Porque no es un dato de cada
 * reserva sino del proyecto, y una columna obligaría a escribirla en
 * las sesenta reservas de hoy y a acordarse de ponerla en cada una
 * nueva --el control en pie y vacío de efecto de siempre--. Si algún
 * día el plazo varía por convenio, el sitio donde ponerlo es este
 * módulo, con una función que reciba el convenio.
 */

/// El día del corte, en Bogotá y como texto: es el mismo formato en
/// que viajan `desde` y `hasta` del informe, y comparar textos
/// «AAAA-MM-DD» funciona sin arrastrar zonas horarias.
export const PLAZO_ENTREGA_NOMBRES = '2026-09-30';

/// Cuántos días antes del plazo se considera que ya corre prisa. Son
/// las «2 semanas» del cliente: a partir de ahí, quien no va a
/// participar tiene que haberlo dicho ya.
export const DIAS_DE_AVISO = 14;

export type EstadoDelPlazo =
  /// Entregó todos los nombres de sus cupos.
  | 'COMPLETA'
  /// Le faltan nombres y todavía hay margen.
  | 'EN_PLAZO'
  /// Le faltan nombres y quedan catorce días o menos.
  | 'POR_VENCER'
  /// Pasó el 30 de septiembre y sigue debiendo nombres.
  | 'VENCIDA';

/** Días de calendario entre dos días «AAAA-MM-DD». Negativo si ya pasó. */
export function diasHasta(hoy: string, plazo: string): number {
  const a = Date.UTC(
    Number(hoy.slice(0, 4)),
    Number(hoy.slice(5, 7)) - 1,
    Number(hoy.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(plazo.slice(0, 4)),
    Number(plazo.slice(5, 7)) - 1,
    Number(plazo.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
}

/**
 * En qué punto del plazo está una fila.
 *
 * `pendientes` son los cupos que siguen sin nombre. Cero es COMPLETA
 * aunque el plazo esté vencido: quien ya entregó no tiene nada que
 * atender, y pintarla en rojo por la fecha sería una alarma falsa en
 * la fila de quien hizo las cosas bien.
 */
export function estadoDelPlazo(
  pendientes: number,
  hoy: string,
  plazo: string = PLAZO_ENTREGA_NOMBRES,
): EstadoDelPlazo {
  if (pendientes <= 0) return 'COMPLETA';
  const dias = diasHasta(hoy, plazo);
  if (dias < 0) return 'VENCIDA';
  if (dias <= DIAS_DE_AVISO) return 'POR_VENCER';
  return 'EN_PLAZO';
}
