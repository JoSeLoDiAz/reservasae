/** Se lleva la carga de volumen y nada mas. */

import { PrismaClient } from '../../generated/prisma';
import { borrarParticipaciones } from '../../src/crm/borrar-participaciones';
import { exigirBaseSegura } from '../guardia-de-base';
import { soloEnPruebas } from './solo-pruebas';

const prisma = new PrismaClient();

async function main() {
  exigirBaseSegura('El borrado de la carga de volumen');
  soloEnPruebas('db:borrar-volumen');

  const suyas = await prisma.persona.findMany({
    where: { numeroDocumento: { startsWith: '200' }, esDePrueba: true },
    select: { id: true },
  });
  const ids = suyas.map((p) => p.id);
  console.log(`  · ${ids.length.toLocaleString('es-CO')} personas de volumen`);

  for (let i = 0; i < ids.length; i += 2000) {
    const trozo = ids.slice(i, i + 2000);
    await borrarParticipaciones(prisma, { personaId: { in: trozo } });
    await prisma.autorizacionDatos.deleteMany({ where: { personaId: { in: trozo } } });
    await prisma.persona.deleteMany({ where: { id: { in: trozo } } });
  }

  const { count } = await prisma.empresa.deleteMany({
    where: { nit: { startsWith: '92' }, reservas: { none: {} }, participantes: { none: {} } },
  });
  console.log(`  · ${count} organizaciones de volumen`);
  console.log('\n✓ fuera');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
