/**
 * PASA EL JEFE DIRECTO DE LAS RESERVAS A SU ORGANIZACIÓN.
 *
 * «Las personas llenan los datos de empresa en el formulario
 * personalizado y queda la notificación, pero no queda» (cliente, 7
 * oct 2026).
 *
 * El formulario escribía el nombre, el cargo y el correo del jefe
 * directo SOLO en la reserva, y `faltaDeLaEmpresa` ---la regla que
 * decide si una ficha pasa a datos completos, y la que llena el F7---
 * los busca en la ORGANIZACIÓN. Desde hoy el formulario los escribe en
 * los dos sitios; esto es para lo que ya se escribió antes.
 *
 * NO INVENTA NADA: copia lo que la propia empresa tecleó en su
 * reserva, al hueco de su propia organización. Si la organización ya
 * tiene algo, no se toca ---lo guardado manda, igual que en la ruta
 * pública---.
 *
 * LA MÁS RECIENTE GANA entre varias reservas de la misma empresa: es
 * la última vez que esa empresa dijo quién es su contacto.
 *
 * VISTA PREVIA POR DEFECTO. Sin `--aplicar` no escribe nada y solo
 * cuenta, que es como se mira antes de tocar producción.
 *
 *   pnpm ts-node prisma/jefe-directo-de-las-reservas.ts
 *   pnpm ts-node prisma/jefe-directo-de-las-reservas.ts --aplicar
 */

import { PrismaClient } from '../generated/prisma';
import { exigirBaseSegura } from './guardia-de-base';

const aplicar = process.argv.includes('--aplicar');
/// La guardia solo cuando se va a escribir: mirar no hace daño.
if (aplicar) exigirBaseSegura('Pasar el jefe directo a las organizaciones');

const prisma = new PrismaClient();

/// Cuántos ejemplos se enseñan. Suficiente para reconocer el caso.
const EJEMPLOS = 5;

async function main() {
  console.log(
    `\n═══ EL JEFE DIRECTO, DE LA RESERVA A SU ORGANIZACIÓN ═══\n${
      aplicar ? '  APLICANDO.\n' : '  Vista previa: no se escribe nada.\n'
    }`,
  );

  /// Las organizaciones a las que les falta ALGUNO de los tres y
  /// tienen al menos una reserva de donde sacarlo.
  const empresas = await prisma.empresa.findMany({
    where: {
      OR: [
        { contactoNombre: null },
        { contactoCargo: null },
        { contactoCorreo: null },
      ],
      reservas: { some: {} },
    },
    select: {
      id: true,
      nit: true,
      razonSocial: true,
      contactoNombre: true,
      contactoCargo: true,
      contactoCorreo: true,
      reservas: {
        /// La más reciente primero: es la última vez que esa empresa
        /// dijo quién es su contacto.
        orderBy: { creadoEn: 'desc' },
        select: {
          contactoNombre: true,
          contactoCargo: true,
          contactoCorreo: true,
        },
      },
    },
  });

  let tocadas = 0;
  let campos = 0;
  const ejemplos: string[] = [];

  for (const e of empresas) {
    /// Se mira reserva por reserva, de la más nueva a la más vieja:
    /// una reserva puede traer el nombre y no el cargo, y la
    /// anterior al revés. Se completa con lo primero que aparezca.
    const nuevo: Record<string, string> = {};
    for (const r of e.reservas) {
      if (!e.contactoNombre && !nuevo.contactoNombre && r.contactoNombre) {
        nuevo.contactoNombre = r.contactoNombre;
      }
      if (!e.contactoCargo && !nuevo.contactoCargo && r.contactoCargo) {
        nuevo.contactoCargo = r.contactoCargo;
      }
      if (!e.contactoCorreo && !nuevo.contactoCorreo && r.contactoCorreo) {
        nuevo.contactoCorreo = r.contactoCorreo;
      }
    }
    const cuantos = Object.keys(nuevo).length;
    if (cuantos === 0) continue;

    tocadas += 1;
    campos += cuantos;
    if (ejemplos.length < EJEMPLOS) {
      ejemplos.push(
        `${e.nit}  ${e.razonSocial ?? ''} → ${Object.keys(nuevo).join(', ')}`,
      );
    }
    if (aplicar) {
      await prisma.empresa.update({ where: { id: e.id }, data: nuevo });
    }
  }

  console.log(`  Organizaciones con algún hueco y reserva: ${empresas.length}`);
  console.log(
    `  ${aplicar ? 'Completadas' : 'Se completarían'}: ${tocadas}, con ${campos} campos\n`,
  );
  for (const x of ejemplos) console.log(`    ${x}`);
  if (tocadas > EJEMPLOS) console.log(`    …y más, hasta ${tocadas}.`);

  /**
   * Y LO QUE ESTO NO ARREGLA, dicho aquí para que no se busque
   * después: el SECTOR ECONÓMICO. `faltaDeLaEmpresa` también lo pide
   * y el formulario de reserva no lo pregunta, así que no hay de
   * dónde copiarlo. Esas fichas seguirán pidiéndolo hasta que alguien
   * lo ponga desde el panel o se añada la pregunta al formulario.
   */
  const sinSector = await prisma.empresa.count({
    where: { sectorEconomico: null, reservas: { some: {} } },
  });
  console.log(
    `\n  Y sin sector económico, que esto NO arregla: ${sinSector}` +
      '\n  El formulario de reserva no lo pregunta, así que no hay de dónde' +
      '\n  copiarlo. Se pone desde el panel, o se añade al formulario.\n',
  );

  if (!aplicar) {
    console.log('  Para escribirlo: añada --aplicar.\n');
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
