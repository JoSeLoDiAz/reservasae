/**
 * Resumen rápido de qué hay en la base. Útil para confirmar de un vistazo que
 * el catálogo está completo y que no quedaron datos de prueba.
 *
 *   pnpm --filter backend db:estado
 */

import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const convenios = await prisma.convenio.findMany({
    orderBy: { orden: 'asc' },
    include: { _count: { select: { acciones: true } } },
  });

  for (const convenio of convenios) {
    const ofertas = await prisma.oferta.aggregate({
      where: { accionFormacion: { convenioId: convenio.id } },
      _sum: { cuposMaximos: true, cuposOcupados: true },
      _count: true,
    });
    const visibles = await prisma.accionFormacion.count({
      where: { convenioId: convenio.id, visible: true },
    });

    console.log(
      `${convenio.slug.padEnd(15)} ${convenio._count.acciones} acciones ` +
        `(${visibles} publicadas) · ${ofertas._count} ofertas · ` +
        `${ofertas._sum.cuposMaximos ?? 0} cupos · ` +
        `${ofertas._sum.cuposOcupados ?? 0} ocupados`,
    );
  }

  const [empresas, reservas, movimientos, grupos] = await Promise.all([
    prisma.empresa.count(),
    prisma.reserva.count(),
    prisma.movimientoReserva.count(),
    prisma.grupo.count(),
  ]);

  console.log(
    `\n${grupos} grupos · ${empresas} empresas · ${reservas} reservas · ` +
      `${movimientos} movimientos`,
  );

  // Si esto encuentra algo, hay un fallo grave: significa que el contador de
  // alguna oferta se separó de la realidad.
  const descuadres = await prisma.$queryRaw<{ id: string; contador: number; suma: number }[]>`
    SELECT o."id",
           o."cuposOcupados" AS contador,
           COALESCE(SUM(r."cuposConfirmados"), 0)::int AS suma
      FROM "ofertas" o
      LEFT JOIN "reservas" r ON r."ofertaId" = o."id" AND r."estado" <> 'CANCELADA'
     GROUP BY o."id", o."cuposOcupados"
    HAVING o."cuposOcupados" <> COALESCE(SUM(r."cuposConfirmados"), 0)`;

  console.log(
    descuadres.length === 0
      ? 'Contadores cuadrados con las reservas.'
      : `DESCUADRE en ${descuadres.length} ofertas: ${JSON.stringify(descuadres.slice(0, 5))}`,
  );
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
