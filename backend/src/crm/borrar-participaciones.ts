/** Borrar participaciones, en el orden que la base admite. */

/**
 * NO es un `delete` a secas, y por eso vive aquí.
 *
 * `NotaParticipante.participanteId` es `ON DELETE SET NULL` y
 * encima lleva el CHECK `nota_cuelga_de_algo`, así que borrar una
 * ficha con notas propias **falla**: la nota se quedaría colgando
 * de nada. Son cuatro pasos en un orden concreto, y quien no los
 * sepa se lleva un `23514` que no dice nada de lo que pasó.
 *
 * Estaba escrito una sola vez, dentro de `crm.service.eliminar`, y
 * se saca porque en cuanto hubo un segundo sitio que borra —la
 * siembra de interesados— la alternativa era copiarlo. Dos copias
 * de un orden de borrado acaban discrepando en el paso que menos
 * se usa, y el síntoma sería una restricción de la base saltando
 * en producción.
 *
 * LAS NOTAS COMPARTIDAS NO SE BORRAN. Una nota escrita sobre el
 * lead y re-apuntada al convertir lleva las dos columnas: es la
 * misma llamada vista desde los dos lados, y el lead sigue
 * existiendo. Sobreviven por el `SET NULL`, colgando solo del
 * lead — que es justo por lo que el CHECK es «al menos una» y no
 * «exactamente una».
 */

import type { Prisma } from '../../generated/prisma';

/// Lo mínimo que hace falta: el cliente de una transacción vale.
type Borrador = {
  avanceActividad: { deleteMany: (a: unknown) => Promise<{ count: number }> };
  notaDeGestion: { deleteMany: (a: unknown) => Promise<{ count: number }> };
  movimientoParticipante: { deleteMany: (a: unknown) => Promise<{ count: number }> };
  participante: {
    findMany: (a: unknown) => Promise<Array<{ id: string }>>;
    deleteMany: (a: unknown) => Promise<{ count: number }>;
  };
};

/**
 * Borra las participaciones que casen, con lo que cuelga de ellas.
 *
 * Devuelve cuántas. NO toca a la persona: la misma cédula puede
 * estar en el otro convenio, y ese es el motivo de que `Persona`
 * no tenga convenio.
 *
 * Va dentro de una transacción de quien llama, no abre la suya:
 * el borrado casi siempre acompaña a algo más —una auditoría, una
 * siembra— y una transacción propia dejaría eso fuera.
 */
export async function borrarParticipaciones(
  db: Borrador,
  where: Prisma.ParticipanteWhereInput,
): Promise<number> {
  const suyas = await db.participante.findMany({ where, select: { id: true } });
  const ids = suyas.map((p) => p.id);
  if (ids.length === 0) return 0;

  await db.avanceActividad.deleteMany({ where: { participanteId: { in: ids } } });
  /// Solo las SUYAS: las del lead sobreviven. Ver el docblock.
  await db.notaDeGestion.deleteMany({
    where: { participanteId: { in: ids }, leadId: null },
  });
  await db.movimientoParticipante.deleteMany({ where: { participanteId: { in: ids } } });
  const { count } = await db.participante.deleteMany({ where: { id: { in: ids } } });
  return count;
}
