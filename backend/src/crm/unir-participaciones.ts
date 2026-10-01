/** Mover la gestión de una ficha a otra, antes de quitarla. */

/**
 * EL ORDEN DE LA FUSIÓN, en un solo sitio.
 *
 * Igual que `borrar-participaciones.ts`: en cuanto haya un segundo
 * lugar que una fichas, copiar estos pasos daría dos órdenes que
 * discrepan justo en el que menos se usa.
 *
 * QUÉ SE MUEVE Y QUÉ NO, que es la única decisión de verdad.
 *
 * SE MUEVE todo lo que es de LA PERSONA y no del curso: las notas de
 * gestión ---el trabajo de las dos asesoras---, el historial de etapas,
 * de dónde llegó el lead, los cambios de sus datos y los enlaces de
 * completado. Si eso se perdiera, unir fichas sería borrar una.
 *
 * NO SE MUEVE EL AVANCE DEL AULA, y es a propósito. Un
 * `AvanceActividad` es «completó la UT3 DE ESTE CURSO»: las
 * actividades pertenecen a la acción de formación. Llevarlas a la otra
 * ficha fabricaría progreso en un curso que esa persona no cursó, y
 * ese número viaja al SENA. Se quedan con la ficha que se va, y la
 * constancia DICE CUÁNTAS eran: perder algo callando es lo que no se
 * puede hacer.
 *
 * TAMPOCO LOS DESTINATARIOS DE CAMPAÑA: van por (campaña, correo), no
 * por ficha, así que mover los de una sobre la otra choca con su
 * propia llave. Y no hacen falta: el correo es el mismo.
 */

/// Lo mínimo que hace falta de un cliente de Prisma. Igual que en
/// `borrar-participaciones.ts`: así entra tanto el `PrismaService` como
/// el `tx` de una transacción.
export type Movedor = {
  notaDeGestion: { updateMany: (a: unknown) => Promise<{ count: number }> };
  movimientoParticipante: { updateMany: (a: unknown) => Promise<{ count: number }> };
  leadEntrante: { updateMany: (a: unknown) => Promise<{ count: number }> };
  toqueDeOrigen: { updateMany: (a: unknown) => Promise<{ count: number }> };
  valorAnterior: { updateMany: (a: unknown) => Promise<{ count: number }> };
  propuestaDeDatos: { updateMany: (a: unknown) => Promise<{ count: number }> };
  enlaceCompletado: { updateMany: (a: unknown) => Promise<{ count: number }> };
  notificacion: { updateMany: (a: unknown) => Promise<{ count: number }> };
  avanceActividad: { count: (a: unknown) => Promise<number> };
  participante: { update: (a: unknown) => Promise<unknown> };
};

export type LoQueSeMovio = {
  notas: number;
  movimientos: number;
  leads: number;
  toques: number;
  cambios: number;
  propuestas: number;
  enlaces: number;
  avisos: number;
  /// Lo que NO se mueve y se va con la ficha. Se cuenta para poder
  /// decirlo en la constancia.
  avancesQueSePierden: number;
};

export async function moverLaGestion(
  db: Movedor,
  deId: string,
  aId: string,
  queQueda: Record<string, unknown>,
): Promise<LoQueSeMovio> {
  const donde = { where: { participanteId: deId }, data: { participanteId: aId } };

  const notas = (await db.notaDeGestion.updateMany(donde)).count;
  const movimientos = (await db.movimientoParticipante.updateMany(donde)).count;
  const leads = (await db.leadEntrante.updateMany(donde)).count;
  const toques = (await db.toqueDeOrigen.updateMany(donde)).count;
  const cambios = (await db.valorAnterior.updateMany(donde)).count;
  const propuestas = (await db.propuestaDeDatos.updateMany(donde)).count;
  const enlaces = (await db.enlaceCompletado.updateMany(donde)).count;
  const avisos = (await db.notificacion.updateMany(donde)).count;

  /// Se cuentan ANTES de que la ficha se vaya: después ya no están.
  const avancesQueSePierden = await db.avanceActividad.count({
    where: { participanteId: deId },
  });

  if (Object.keys(queQueda).length > 0) {
    await db.participante.update({ where: { id: aId }, data: queQueda });
  }

  return {
    notas,
    movimientos,
    leads,
    toques,
    cambios,
    propuestas,
    enlaces,
    avisos,
    avancesQueSePierden,
  };
}

/** Para la constancia: qué se movió, en palabras. */
export function enPalabras(m: LoQueSeMovio): string {
  const partes = [
    m.notas && `${m.notas} ${m.notas === 1 ? 'nota' : 'notas'}`,
    m.movimientos && `${m.movimientos} movimientos de etapa`,
    m.leads && `${m.leads} leads de origen`,
    m.cambios && `${m.cambios} cambios de datos`,
    m.propuestas && `${m.propuestas} propuestas`,
    m.enlaces && `${m.enlaces} enlaces de completado`,
  ].filter(Boolean) as string[];

  const movido = partes.length > 0 ? `Se movieron ${partes.join(', ')}.` : 'No había gestión que mover.';

  /// LO QUE SE PIERDE VA EN LA MISMA FRASE, no en una nota al pie: es
  /// lo único que esta operación destruye.
  const perdido =
    m.avancesQueSePierden > 0
      ? ` Se perdieron ${m.avancesQueSePierden} avances del aula de la acción que se abandona: las actividades son de ese curso y moverlas habría inventado progreso en otro.`
      : '';

  return movido + perdido;
}
