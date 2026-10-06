/** A cuántas fichas tocó cada quien, acreditando a QUIEN TOCÓ. */

/**
 * Sale aparte del servicio para poder probarla de verdad.
 *
 * Su spec leía el TEXTO de `crm.service.ts` y comprobaba que
 * contuviera ciertas cadenas, porque el servicio pide media docena de
 * dependencias para instanciarse. Un test así no puede ver la única
 * decisión que de verdad importa aquí ---a quién se le apunta cada
 * toque---, y de hecho no vio que se apuntaba al dueño ACTUAL de la
 * ficha: repartir 83 leads le ponía 83 gestionados a quien los recibe
 * sin haber abierto ninguno.
 */

/// Una nota de gestión escrita por una persona.
export type NotaDeAlguien = {
  autorId: string | null;
  participanteId: string | null;
};

/// Un movimiento de etapa hecho por una persona.
export type MovimientoDeAlguien = {
  adminId: string | null;
  participanteId: string | null;
};

/// Una ficha cuyos datos tocó su asesor dentro de la ventana.
export type DatosTocados = { id: string; asesorId: string | null };

/// La llave de quien no tiene asesor, que también cuenta.
export const SIN_ASESOR = 'SIN_ASESOR';

/**
 * Cuenta FICHAS DISTINTAS por persona, no toques.
 *
 * `datos` es la única de las tres que no dice quién: la columna
 * `datosTocadosPorAsesorEn` solo guarda cuándo, así que se le acredita
 * al asesor de la ficha, que es lo que su propio nombre afirma.
 */
export function acreditarPorQuienToco(
  notas: NotaDeAlguien[],
  movimientos: MovimientoDeAlguien[],
  datos: DatosTocados[],
): Map<string, number> {
  const vistos = new Set<string>();
  const por = new Map<string, number>();

  const apuntar = (quien: string | null, ficha: string | null) => {
    if (!ficha) return;
    const llave = quien ?? SIN_ASESOR;
    /// Una ficha tocada tres veces por la misma persona es UNA.
    if (vistos.has(`${llave}|${ficha}`)) return;
    vistos.add(`${llave}|${ficha}`);
    por.set(llave, (por.get(llave) ?? 0) + 1);
  };

  for (const n of notas) apuntar(n.autorId, n.participanteId);
  for (const m of movimientos) apuntar(m.adminId, m.participanteId);
  for (const d of datos) apuntar(d.asesorId, d.id);

  return por;
}
