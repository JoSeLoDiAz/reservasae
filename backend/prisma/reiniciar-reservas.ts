/**
 * Borra TODAS las reservas y devuelve los contadores a cero.
 *
 *   pnpm --filter backend db:reiniciar-reservas --si
 *
 * Sin `--si` solo informa. Es irreversible.
 */

import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const confirmado = process.argv.includes('--si');

  const [reservas, empresas, movimientos] = await Promise.all([
    prisma.reserva.count(),
    prisma.empresa.count(),
    prisma.movimientoReserva.count(),
  ]);
  const ocupados = await prisma.oferta.aggregate({ _sum: { cuposOcupados: true } });

  console.log(
    `Hay ${reservas} reservas, ${empresas} empresas, ${movimientos} movimientos ` +
      `y ${ocupados._sum.cuposOcupados ?? 0} cupos ocupados.`,
  );

  if (!confirmado) {
    console.log('\nNada borrado. Vuelva a ejecutarlo con --si para confirmar.');
    return;
  }

  // en una transaccion: o todo o nada
  await prisma.$transaction([
    // caen por cascada; explicito para poder contarlos
    prisma.movimientoReserva.deleteMany({}),
    prisma.reserva.deleteMany({}),
    prisma.empresa.deleteMany({}),
    prisma.oferta.updateMany({ data: { cuposOcupados: 0 } }),
  ]);

  const totales = await prisma.oferta.aggregate({
    _sum: { cuposMaximos: true, cuposOcupados: true },
    _count: true,
  });

  console.log('\nHecho. Estado del catálogo:');
  for (const convenio of await prisma.convenio.findMany({ orderBy: { orden: 'asc' } })) {
    const porConvenio = await prisma.oferta.aggregate({
      where: { accionFormacion: { convenioId: convenio.id } },
      _sum: { cuposMaximos: true },
      _count: true,
    });
    const acciones = await prisma.accionFormacion.count({
      where: { convenioId: convenio.id },
    });
    console.log(
      `  ${convenio.slug.padEnd(15)} ${acciones} acciones · ` +
        `${porConvenio._count} ofertas · ${porConvenio._sum.cuposMaximos ?? 0} cupos`,
    );
  }
  console.log(
    `  ${'TOTAL'.padEnd(15)} ${totales._count} ofertas · ` +
      `${totales._sum.cuposMaximos ?? 0} cupos · ` +
      `${totales._sum.cuposOcupados ?? 0} ocupados`,
  );
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
