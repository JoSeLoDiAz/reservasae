/** A cuánta gente inscribió cada quien dentro del periodo. */

/**
 * «DEBO SABER CUÁNTO HIZO CADA ASESORA AYER, ANTIER, HOY. VUELVO Y
 * REITERO: LOS FILTROS DE TIEMPO O DE FECHA NO FUNCIONAN, Y YA LO
 * HABÍA REITERADO EN MUCHAS OCASIONES» (cliente, 7 oct 2026).
 *
 * Y seguían sin funcionar donde él mira. La tabla del comité ya cuenta
 * las inscripciones por cuándo se hicieron, pero Seguimiento de
 * asesores no: ahí el periodo recorta por `creadoEn` ---cuándo LLEGÓ
 * el lead--- así que «inscritos» respondía «de los leads que llegaron
 * ayer, cuántos están inscritos hoy». Con una base que lleva meses
 * creciendo, poner «ayer» daba casi cero siempre, y la columna parecía
 * rota porque lo estaba para la pregunta que se le hacía.
 *
 * Esto cuenta lo otro: cuántas personas quedaron inscritas DENTRO del
 * periodo, sin importar cuándo llegaron.
 *
 * A QUIÉN SE LE ACREDITA. Al admin que hizo el movimiento, que es
 * quien la inscribió. Cuando no hay admin ---la persona completó sola
 * el formulario público--- se le acredita al asesor de la ficha, que
 * es quien la venía trabajando; y si no tiene, cuenta en la fila de
 * los que no tienen dueño, que también es trabajo hecho.
 *
 * Es la misma lección de `acreditar-gestion.ts`, de Josse: acreditar
 * al dueño de HOY infla a quien recibe un reparto. Aquí el dueño de
 * hoy solo entra como respaldo, y únicamente cuando nadie firmó el
 * movimiento.
 *
 * VIVE APARTE DEL SERVICIO para poder probarla de verdad: es una
 * decisión de tres ramas, y una prueba que leyera el texto del
 * servicio no vería ninguna.
 */

/// La llave de quien no tiene asesor, la misma de `acreditar-gestion`.
export const SIN_ASESOR = 'SIN_ASESOR';

/** El movimiento que dejó a alguien inscrito, dentro del periodo. */
export type InscripcionDelPeriodo = {
  /// Quién la hizo. Nulo cuando la persona se inscribió sola.
  adminId: string | null;
  participanteId: string;
};

/** De quién es cada ficha hoy, para el respaldo. */
export type DuenoDeLaFicha = { id: string; asesorId: string | null };

/**
 * Cuenta PERSONAS DISTINTAS por quien las inscribió.
 *
 * Distintas y no movimientos: alguien que entra, sale y vuelve a
 * entrar tiene dos movimientos a INSCRITO y es una sola inscripción
 * para la cuenta de la asesora.
 */
export function acreditarPorQuienInscribio(
  inscripciones: InscripcionDelPeriodo[],
  duenos: DuenoDeLaFicha[],
): Map<string, number> {
  const duenoDe = new Map(duenos.map((d) => [d.id, d.asesorId]));
  const vistos = new Set<string>();
  const por = new Map<string, number>();

  for (const i of inscripciones) {
    /// El que la movió; si nadie, el dueño de la ficha; si tampoco,
    /// la fila de los que no tienen asesor.
    const quien = i.adminId ?? duenoDe.get(i.participanteId) ?? null;
    const llave = quien ?? SIN_ASESOR;

    /// La misma persona no se cuenta dos veces, ni siquiera si dos
    /// asesoras distintas la movieron: la primera que la inscribió se
    /// la lleva.
    if (vistos.has(i.participanteId)) continue;
    vistos.add(i.participanteId);

    por.set(llave, (por.get(llave) ?? 0) + 1);
  }
  return por;
}
