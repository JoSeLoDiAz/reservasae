/**
 * ¿QUIÉN PUEDE RECIBIR LEADS, Y QUIÉN NO AUNQUE YA LOS LLEVE?
 *
 * «Que los asesores que tengo en Gestión de leads también me salgan»
 * (cliente, 7 oct 2026), viendo siete nombres en la columna Asesor y
 * solo dos en el desplegable de «Asignar a».
 *
 * LAS DOS LISTAS SON CORRECTAS Y SON DISTINTAS:
 *
 *   - la COLUMNA enseña a quien YA lleva leads;
 *   - el DESPLEGABLE, a quien PUEDE recibirlos, que desde el 2 oct
 *     2026 ---y a petición del propio cliente--- son solo
 *     `GESTOR_INSCRIPCION` y `LIDER_INSCRIPCION`.
 *
 * Así que quien no aparece es porque su cuenta tiene otro rol en ese
 * gremio ---académico, consulta, líder de sistemas---, o porque está
 * desactivada. No es un fallo del panel: es cómo está dada de alta
 * esa persona, y se arregla en Configuración › Usuarios.
 *
 * Esto lo dice fila por fila, para no adivinarlo.
 *
 * SOLO LEE. No escribe nada, ni con argumentos, ni acepta ninguno.
 *
 *   pnpm ts-node prisma/quien-puede-recibir-leads.ts
 */

import { PrismaClient } from '../generated/prisma';
import { PUEDEN_LLEVAR_FICHAS } from '../src/crm/quien-lleva-fichas';

const prisma = new PrismaClient();

async function main() {
  console.log('\n═══ QUIÉN PUEDE RECIBIR LEADS ═══\n');
  console.log(
    `  Roles que pueden: ${PUEDEN_LLEVAR_FICHAS.join(', ')}\n` +
      '  (decisión del cliente, 2 oct 2026)\n',
  );

  const gente = await prisma.admin.findMany({
    select: {
      id: true,
      nombre: true,
      correo: true,
      activo: true,
      convenios: {
        select: { rol: true, convenio: { select: { sigla: true, slug: true } } },
      },
      /// Cuántos leads lleva HOY. Es lo que hace la pregunta
      /// urgente: alguien con leads que no puede recibir más es
      /// alguien a quien hay que arreglarle el rol, no un caso
      /// raro de laboratorio.
      _count: { select: { leadsQueLleva: true } },
    },
    orderBy: { nombre: 'asc' },
  });

  const puede = (c: { rol: string }) =>
    (PUEDEN_LLEVAR_FICHAS as string[]).includes(c.rol);

  const siP: string[] = [];
  const noP: string[] = [];

  for (const a of gente) {
    const donde = a.convenios.filter(puede).map((c) => c.convenio.sigla ?? c.convenio.slug);
    const linea =
      `${a.nombre.padEnd(24)} ${String(a._count.leadsQueLleva).padStart(5)} leads  ` +
      `${a.activo ? '' : '[DESACTIVADA] '}` +
      a.convenios
        .map((c) => `${c.convenio.sigla ?? c.convenio.slug}=${c.rol}`)
        .join('  ');
    if (a.activo && donde.length) siP.push(linea);
    else noP.push(linea);
  }

  console.log(`  SÍ aparecen en «Asignar a» (${siP.length}):\n`);
  for (const l of siP) console.log('    ' + l);

  /**
   * Y LOS QUE NO, que es la lista por la que se abre este sondeo. El
   * caso que duele es el de arriba del todo: quien ya lleva leads y
   * sin embargo no puede recibir más.
   */
  console.log(`\n  NO aparecen (${noP.length}):\n`);
  for (const l of noP) console.log('    ' + l);

  const conLeadsYSinPoder = gente.filter(
    (a) =>
      a._count.leadsQueLleva > 0 &&
      !(a.activo && a.convenios.some(puede)),
  );
  if (conLeadsYSinPoder.length) {
    console.log(
      `\n  ⚠ LLEVAN LEADS PERO NO PUEDEN RECIBIR MÁS: ${conLeadsYSinPoder.length}\n` +
        '    Lo ya asignado se queda donde está ---esta regla decide a quién\n' +
        '    se OFRECE, no quién puede tener---, pero a estas personas no se\n' +
        '    les puede pasar ni uno más desde el desplegable.\n',
    );
    for (const a of conLeadsYSinPoder) {
      console.log(
        `      ${a.nombre} (${a.correo}) — ${a._count.leadsQueLleva} leads`,
      );
    }
    console.log(
      '\n    Se arregla en Configuración › Usuarios, poniéndoles Gestor o\n' +
        '    Líder de Inscripciones en ese gremio.\n',
    );
  } else {
    console.log('\n  Y nadie lleva leads sin poder recibir más.\n');
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
