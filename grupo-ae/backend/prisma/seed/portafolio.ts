/** El portafolio de Grupo AE: lo que se oferta al público. */

/**
 * La lista sale TAL CUAL de la que mandó la dirección el 17 sep 2026,
 * en el mismo orden y con las mismas palabras. «CEU» incluido: se deja
 * como venía y no se interpreta.
 *
 * Se puede correr las veces que haga falta: casa por (familia, nombre)
 * y actualiza tipo, unidad y orden. NO toca `visible`: si alguien ocultó
 * un servicio desde el panel, volver a sembrar no lo resucita.
 *
 * Y NO BORRA. Un servicio que salga de esta lista se queda en la base
 * —oculto a mano si hace falta—, porque puede ser lo que se vendió en
 * un negocio que ya existe.
 *
 *   pnpm db:sembrar-portafolio
 */

import { FamiliaServicio, PrismaClient, TipoServicio } from '../../generated/prisma';
import { exigirBaseSegura } from '../guardia-de-base';

type Fila = { nombre: string; tipo: TipoServicio; unidad: string };

/**
 * El TIPO y la UNIDAD sí son supuestos míos, deducidos del nombre, y
 * son lo único que no venía en la lista. Se corrigen aquí o desde el
 * panel:
 *
 *   licencias, Workspace, Gemini          -> LICENCIA, «licencia»
 *   Chrome Education CEU, Chrome Enterprise -> LICENCIA, «dispositivo»
 *     (Chrome se licencia por equipo, no por persona)
 *   dominio y consola, entorno Microsoft  -> IMPLEMENTACION, «proyecto»
 *   Soporte                               -> SOPORTE, «servicio»
 *   Cursos                                -> FORMACION, «curso»
 *   Chromebooks                           -> EQUIPO, «equipo»
 */
const L = (nombre: string): Fila => ({ nombre, tipo: TipoServicio.LICENCIA, unidad: 'licencia' });
const COMUNES: Fila[] = [
  { nombre: 'Soporte', tipo: TipoServicio.SOPORTE, unidad: 'servicio' },
  { nombre: 'Cursos', tipo: TipoServicio.FORMACION, unidad: 'curso' },
  { nombre: 'Chromebooks', tipo: TipoServicio.EQUIPO, unidad: 'equipo' },
];

export const PORTAFOLIO: Record<FamiliaServicio, Fila[]> = {
  [FamiliaServicio.EDUCACION]: [
    { nombre: 'Creación dominio y consola con Google educación', tipo: TipoServicio.IMPLEMENTACION, unidad: 'proyecto' },
    { nombre: 'Añadir Google a tu entorno Microsoft', tipo: TipoServicio.IMPLEMENTACION, unidad: 'proyecto' },
    L('Licencias Education Plus'),
    L('Licencias Teaching and Learning'),
    L('Licencias Google AI Pro for Education'),
    { nombre: 'Licencia Chrome Education CEU', tipo: TipoServicio.LICENCIA, unidad: 'dispositivo' },
    ...COMUNES,
  ],
  [FamiliaServicio.EMPRESAS]: [
    L('Google Workspace Starter'),
    L('Google Workspace Business Standard'),
    L('Google Workspace Business Plus'),
    L('Google Workspace Enterprise Essentials'),
    L('Google Workspace Enterprise Essentials Plus'),
    L('Google Workspace Enterprise Starter'),
    L('Google Workspace Enterprise Standard'),
    L('Google Workspace Enterprise Plus'),
    L('Gemini Enterprise CEU'),
    { nombre: 'Chrome Enterprise', tipo: TipoServicio.LICENCIA, unidad: 'dispositivo' },
    ...COMUNES,
  ],
};

async function main() {
  await exigirBaseSegura();
  const prisma = new PrismaClient();
  try {
    let n = 0;
    for (const familia of Object.values(FamiliaServicio)) {
      for (const [i, f] of PORTAFOLIO[familia].entries()) {
        await prisma.servicio.upsert({
          where: { familia_nombre: { familia, nombre: f.nombre } },
          create: { familia, nombre: f.nombre, tipo: f.tipo, unidad: f.unidad, orden: i + 1 },
          update: { tipo: f.tipo, unidad: f.unidad, orden: i + 1 },
        });
        n++;
      }
      console.log(`  ${familia}: ${PORTAFOLIO[familia].length} servicios`);
    }
    console.log(`  ${n} en total, sembrados`);
  } finally {
    await prisma.$disconnect();
  }
}

/// Solo cuando se corre directo: la prueba importa `PORTAFOLIO` sin
/// escribir en ninguna base.
if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
