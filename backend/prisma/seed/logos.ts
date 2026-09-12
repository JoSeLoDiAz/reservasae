/** Siembra los logos de la marca general desde el repo. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EsquemaDeLogo, PrismaClient } from '../../generated/prisma';
import { exigirBaseSegura } from '../guardia-de-base';

// el 5433 es produccion, aunque diga localhost
exigirBaseSegura('La siembra de logos');

const prisma = new PrismaClient();

// Los archivos viven en el repo y no solo en la base: cada entorno
// nuevo los perdia y habia que volver a subirlos a mano. ADECOPRIA
// manda dos versiones porque su logo no se puede recolorear: texto
// oscuro para cabecera clara, texto blanco para cabecera oscura.
const SEMILLAS = [
  {
    nombre: 'grupo-ae.png',
    etiqueta: 'Grupo AE',
    esquema: EsquemaDeLogo.AMBOS,
    orden: 0,
    tipoMime: 'image/png',
  },
  {
    nombre: 'adecopria_adaptive.svg',
    etiqueta: 'ADECOPRIA',
    esquema: EsquemaDeLogo.CLARO,
    orden: 1,
    tipoMime: 'image/svg+xml',
  },
  {
    nombre: 'adecopria_dark.svg',
    etiqueta: 'ADECOPRIA',
    esquema: EsquemaDeLogo.OSCURO,
    orden: 2,
    tipoMime: 'image/svg+xml',
  },
];

async function main() {
  for (const s of SEMILLAS) {
    const datos = readFileSync(join(__dirname, 'logos', s.nombre));

    const ya = await prisma.logo.findFirst({
      where: { formularioId: null, etiqueta: s.etiqueta, esquema: s.esquema },
      select: { id: true, version: true, datos: true },
    });

    if (!ya) {
      await prisma.logo.create({ data: { ...s, datos, formularioId: null } });
      console.log(`  creado      ${s.etiqueta} (${s.esquema}) ${datos.length} bytes`);
      continue;
    }

    // La version va en la URL y permite cachear para siempre, asi
    // que solo sube cuando los bytes cambian de verdad.
    if (Buffer.from(ya.datos).equals(datos)) {
      console.log(`  sin cambios ${s.etiqueta} (${s.esquema})`);
      continue;
    }

    await prisma.logo.update({
      where: { id: ya.id },
      data: {
        datos,
        tipoMime: s.tipoMime,
        nombre: s.nombre,
        orden: s.orden,
        version: ya.version + 1,
      },
    });
    console.log(`  actualizado ${s.etiqueta} (${s.esquema}) ${datos.length} bytes`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
