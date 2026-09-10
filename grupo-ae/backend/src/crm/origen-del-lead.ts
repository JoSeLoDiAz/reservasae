import { Prisma, type OrigenParticipante } from '../../generated/prisma';

/**
 * Por dónde entró un lead, en las tres puertas que le sirven al
 * asesor.
 *
 * La regla vivía PRIVADA dentro de `crm.service`, así que el
 * informe por acción se escribió con otra: leía la columna
 * `origenLead`, que solo llena el webhook de Meta. Con eso todo
 * lo que no venía de Meta caía fuera de «pauta» y la columna
 * salía en cero.
 *
 * Es el patrón que este proyecto lleva documentado desde el
 * principio: dos verdades sobre la misma decisión acaban
 * discrepando. Aquí está una sola vez, y la usan los dos.
 */
export type OrigenDeLead = 'PAUTA' | 'ORGANICO' | 'IMPORTACION';

export const ETIQUETA_ORIGEN_DE_LEAD: Record<OrigenDeLead, string> = {
  PAUTA: 'Pauta pagada',
  ORGANICO: 'Llegó por su cuenta',
  IMPORTACION: 'Lo cargó el equipo',
};

/// Qué canales entran en cada grupo. Va a la pantalla porque
/// al lado se listan los canales sueltos —«Redes sociales»,
/// «La empresa lo nominó»— y sin esto son dos vocabularios
/// para lo mismo, que es justo lo que no se entiende.
export const CANALES_DE_ORIGEN_DE_LEAD: Record<OrigenDeLead, string> = {
  PAUTA: 'redes sociales',
  ORGANICO: 'se inscribió solo',
  IMPORTACION: 'empresa, asesor, referido o feria',
};

/// Las redes de Meta: lo que se paga.
export const ORIGENES_DE_PAUTA: OrigenParticipante[] = [
  'REDES',
  'INSTAGRAM',
  'FACEBOOK',
  'LINKEDIN',
];

/** La puerta por la que entró, a partir de su origen. */
export function origenDeLead(origen: OrigenParticipante): OrigenDeLead {
  if (ORIGENES_DE_PAUTA.includes(origen)) return 'PAUTA';
  if (origen === 'AUTOGESTION') return 'ORGANICO';
  return 'IMPORTACION';
}

/**
 * La misma regla, en SQL.
 *
 * La columna `origenLead` MANDA cuando está: la escribe el
 * webhook de Meta y ahí consta de qué anuncio vino, que es más
 * preciso que deducirlo del origen. Cuando está vacía —que es
 * casi siempre, porque solo Meta la llena— se deduce.
 */
export function origenDeLeadSql(alias = 'p'): Prisma.Sql {
  const col = Prisma.raw(`"${alias}"`);
  return Prisma.sql`
    CASE
      WHEN ${col}."origenLead" IS NOT NULL THEN ${col}."origenLead"::text
      WHEN ${col}."origen"::text IN (${Prisma.join(ORIGENES_DE_PAUTA)}) THEN 'PAUTA'
      WHEN ${col}."origen"::text = 'AUTOGESTION' THEN 'ORGANICO'
      ELSE 'IMPORTACION'
    END`;
}

/**
 * Deja constancia de que esta persona llegó por este canal.
 *
 * NO pisa nada. Una persona que ya estaba —la subió el community
 * manager en una lista— y después cae por una pauta tuvo DOS
 * orígenes, y las dos cosas son ciertas: la pauta la volvió a
 * traer, pero el lead ya era de alguien. Pisar `origen` le
 * quitaría el lead a quien lo consiguió; no registrar el toque
 * dejaría la pauta sin constancia de haber funcionado.
 *
 * El primer origen se queda donde está y manda para la
 * atribución; el toque se suma al lado.
 */
export async function registrarToqueDeOrigen(
  tx: {
    toqueDeOrigen: {
      upsert(args: unknown): Promise<unknown>;
    };
  },
  participanteId: string,
  origen: OrigenParticipante,
  campana?: string | null,
): Promise<void> {
  await tx.toqueDeOrigen.upsert({
    where: { participanteId_origen: { participanteId, origen } },
    /// Volver por el mismo canal no es un origen nuevo: se
    /// cuenta. Dos filas dirian que llego por dos sitios.
    update: { ultimaVez: new Date(), veces: { increment: 1 }, ...(campana ? { campana } : {}) },
    create: { participanteId, origen, clase: origenDeLead(origen), campana: campana ?? null },
  });
}
