/** Los invariantes de cupos. Todo se revierte. */
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function esperaFallo(nombre: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`FALLO   ${nombre}: la base lo aceptó y no debía`);
  } catch (e: any) {
    const msg = String(e.message).split('\n').filter(Boolean).pop() ?? '';
    console.log(`OK      ${nombre}: rechazado (${msg.slice(0, 70)})`);
  }
}

async function main() {
  const oferta = await prisma.oferta.findFirstOrThrow({
    include: { accionFormacion: true, ubicacion: true },
  });
  console.log(
    `Oferta de prueba: ${oferta.accionFormacion.codigo} / ${oferta.ubicacion.nombre} ` +
      `· ${oferta.cuposOcupados}/${oferta.cuposMaximos}\n`,
  );

  await esperaFallo('sobrepasar el tope de cupos', () =>
    prisma.$transaction(async (tx) => {
      await tx.oferta.update({
        where: { id: oferta.id },
        data: { cuposOcupados: oferta.cuposMaximos + 1 },
      });
      throw new Error('revertir');
    }),
  );

  await esperaFallo('dejar cupos ocupados en negativo', () =>
    prisma.$transaction(async (tx) => {
      await tx.oferta.update({ where: { id: oferta.id }, data: { cuposOcupados: -1 } });
      throw new Error('revertir');
    }),
  );

  // el doble clic y el reintento de Cloudflare
  await esperaFallo('dos reservas de la misma empresa en la misma oferta', () =>
    prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: { nit: '900000001', razonSocial: 'PRUEBA SAS' },
      });
      const datos = {
        empresaId: empresa.id,
        ofertaId: oferta.id,
        cuposSolicitados: 2,
        cuposConfirmados: 2,
        contactoNombre: 'Prueba',
        contactoCorreo: 'prueba@ejemplo.com',
      };
      await tx.reserva.create({ data: datos });
      await tx.reserva.create({ data: datos });
    }),
  );

  await esperaFallo('reserva cancelada que retiene cupos', () =>
    prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: { nit: '900000002', razonSocial: 'PRUEBA DOS SAS' },
      });
      await tx.reserva.create({
        data: {
          empresaId: empresa.id,
          ofertaId: oferta.id,
          cuposSolicitados: 3,
          cuposConfirmados: 3,
          estado: 'CANCELADA',
          contactoNombre: 'Prueba',
          contactoCorreo: 'prueba2@ejemplo.com',
        },
      });
    }),
  );

  await esperaFallo('repartir más cupos de los solicitados', () =>
    prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: { nit: '900000003', razonSocial: 'PRUEBA TRES SAS' },
      });
      await tx.reserva.create({
        data: {
          empresaId: empresa.id,
          ofertaId: oferta.id,
          cuposSolicitados: 2,
          cuposConfirmados: 2,
          cuposEnEspera: 1,
          contactoNombre: 'Prueba',
          contactoCorreo: 'prueba3@ejemplo.com',
        },
      });
    }),
  );

  await esperaFallo('dos empresas con el mismo NIT', () =>
    prisma.$transaction(async (tx) => {
      await tx.empresa.create({ data: { nit: '900000004', razonSocial: 'A SAS' } });
      await tx.empresa.create({ data: { nit: '900000004', razonSocial: 'B SAS' } });
    }),
  );

  // El camino feliz, y que se revierte limpio.
  await prisma
    .$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: { nit: '900000005', razonSocial: 'FELIZ SAS' },
      });
      const [actualizada] = await tx.$queryRaw<{ cuposOcupados: number }[]>`
        UPDATE "ofertas" SET "cuposOcupados" = "cuposOcupados" + 5
         WHERE "id" = ${oferta.id} AND "cuposOcupados" + 5 <= "cuposMaximos"
        RETURNING "cuposOcupados"`;
      await tx.reserva.create({
        data: {
          empresaId: empresa.id,
          ofertaId: oferta.id,
          cuposSolicitados: 5,
          cuposConfirmados: 5,
          contactoNombre: 'Feliz',
          contactoCorreo: 'feliz@ejemplo.com',
        },
      });
      console.log(`OK      reserva de 5 cupos: ocupados quedó en ${actualizada.cuposOcupados}`);
      throw new Error('revertir');
    })
    .catch(() => {});

  const empresas = await prisma.empresa.count();
  const reservas = await prisma.reserva.count();
  const suma = await prisma.oferta.aggregate({ _sum: { cuposOcupados: true } });
  console.log(
    `\nEstado final: ${empresas} empresas, ${reservas} reservas, ` +
      `${suma._sum.cuposOcupados ?? 0} cupos ocupados (debe ser 0/0/0)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
