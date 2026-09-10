/** Borra reservas por NIT y devuelve sus cupos. */

import { PrismaClient } from '../generated/prisma';
import { exigirBaseSegura } from './guardia-de-base';

// el 5433 es produccion, aunque diga localhost
exigirBaseSegura('Borrar reservas');

const prisma = new PrismaClient();

async function main() {
  const argumentos = process.argv.slice(2);
  const confirmado = argumentos.includes('--si');
  const nits = argumentos
    .filter((a) => !a.startsWith('--'))
    .map((a) => a.replace(/\D/g, ''))
    .filter(Boolean);

  if (!nits.length) {
    console.error('Uso: db:borrar-reservas <nit> [<nit>...] [--si]');
    process.exitCode = 1;
    return;
  }

  const empresas = await prisma.empresa.findMany({
    where: { nit: { in: nits } },
    include: {
      reservas: {
        include: {
          oferta: {
            include: {
              ubicacion: true,
              accionFormacion: { select: { codigo: true, nombre: true } },
            },
          },
          _count: { select: { respuestas: true, movimientos: true } },
        },
      },
    },
  });

  for (const nit of nits.filter((n) => !empresas.some((e) => e.nit === n))) {
    console.warn(`AVISO  no hay ninguna organización con el NIT ${nit}.`);
  }
  if (!empresas.length) return;

  console.log('');
  for (const empresa of empresas) {
    console.log(`${empresa.razonSocial} — NIT ${empresa.nit}-${empresa.digitoVerificacion ?? '?'}`);
    for (const r of empresa.reservas) {
      console.log(
        `  ${r.creadoEn.toISOString().slice(0, 10)}  ` +
          `${r.oferta.accionFormacion.codigo} ${r.oferta.ubicacion.nombre}  ` +
          `${r.cuposConfirmados} confirmados` +
          (r.cuposEnEspera ? ` + ${r.cuposEnEspera} en espera` : '') +
          `  [${r.estado}]  ${r._count.respuestas} respuestas, ${r._count.movimientos} movimientos`,
      );
      console.log(`      ${r.contactoNombre} · ${r.contactoCorreo}`);
    }
    if (!empresa.reservas.length) console.log('  (sin reservas)');
  }

  const totalReservas = empresas.reduce((s, e) => s + e.reservas.length, 0);
  const totalCupos = empresas.reduce(
    (s, e) => s + e.reservas.reduce((t, r) => t + r.cuposConfirmados, 0),
    0,
  );
  console.log(
    `\nSe borrarían ${totalReservas} reservas de ${empresas.length} organizaciones ` +
      `y se devolverían ${totalCupos} cupos.`,
  );

  if (!confirmado) {
    console.log('\nNada borrado. Vuelva a ejecutarlo con --si para confirmar.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const empresa of empresas) {
      for (const r of empresa.reservas) {
        if (r.cuposConfirmados > 0) {
          await tx.oferta.update({
            where: { id: r.ofertaId },
            data: { cuposOcupados: { decrement: r.cuposConfirmados } },
          });
        }
        await tx.reserva.delete({ where: { id: r.id } });
      }
      // se borra si no le queda ninguna reserva
      const quedan = await tx.reserva.count({ where: { empresaId: empresa.id } });
      if (quedan === 0) await tx.empresa.delete({ where: { id: empresa.id } });
    }
  });

  const descuadres = await prisma.$queryRaw<{ id: string }[]>`
    SELECT o."id"
      FROM "ofertas" o
      LEFT JOIN "reservas" r ON r."ofertaId" = o."id" AND r."estado" <> 'CANCELADA'
     GROUP BY o."id", o."cuposOcupados"
    HAVING o."cuposOcupados" <> COALESCE(SUM(r."cuposConfirmados"), 0)`;

  console.log(
    descuadres.length === 0
      ? '\nHecho. Contadores cuadrados con las reservas.'
      : `\nHecho, pero DESCUADRE en ${descuadres.length} ofertas.`,
  );
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
