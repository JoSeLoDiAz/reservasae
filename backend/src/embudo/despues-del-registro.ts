/** Fichas del registro que terminaron. */

import { Prisma } from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';

export type DespuesDelRegistro = { recibieron: number; terminaron: number };

/** La consulta sola, para pg-mem. */
export function despuesDelRegistroSql(
  ambito: string[],
  desde: Date,
  hasta: Date,
): Prisma.Sql {
  // terminar: cualquier enlace usado
  return Prisma.sql`
    SELECT COUNT(DISTINCT p."id") AS recibieron,
           COUNT(DISTINCT CASE WHEN t."id" IS NOT NULL
                               THEN p."id" END) AS terminaron
      FROM "participantes" p
      JOIN "enlaces_completado" r
        ON r."participanteId" = p."id"
       AND r."delRegistro" = true
      LEFT JOIN "enlaces_completado" t
        ON t."participanteId" = p."id"
       AND t."usadoEn" IS NOT NULL
     WHERE p."convenioId" IN (${Prisma.join(ambito)})
       AND p."creadoEn" >= ${desde}
       AND p."creadoEn" < ${hasta}
  `;
}

/** Desde el arranque del contador. */
export async function despuesDelRegistro(
  prisma: PrismaService,
  ambito: string[],
  desde: Date,
  hasta: Date,
  contandoDesde: Date | null,
): Promise<DespuesDelRegistro> {
  if (ambito.length === 0 || !contandoDesde) {
    return { recibieron: 0, terminaron: 0 };
  }
  const inicio = desde > contandoDesde ? desde : contandoDesde;
  const [f] = await prisma.$queryRaw<
    Array<{ recibieron: bigint | number; terminaron: bigint | number }>
  >(despuesDelRegistroSql(ambito, inicio, hasta));
  return {
    recibieron: Number(f?.recibieron ?? 0),
    terminaron: Number(f?.terminaron ?? 0),
  };
}
