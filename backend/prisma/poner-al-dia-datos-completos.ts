/**
 * Las fichas que ya estaban en «Interesado» o «Contactado» sin
 * ningún dato pendiente, pasadas a «Datos completos».
 *
 * Una sola vez, el día que se despliegue `crm/datos-completos.ts`.
 * Esa regla arregla lo que venga; lo que ya quedó mal --un asesor
 * completó los datos en la ficha, alguien se inscribió desde el
 * panel con todo-- no se corrige solo, porque nadie vuelve a tocar
 * esas fichas. Lo vio Mauricio en producción el 18 sep 2026.
 *
 * SIN `--aplicar` NO ESCRIBE NADA: cuenta y enseña cuáles pasaría.
 * Se mira eso primero y después se aplica.
 *
 *   pnpm db:datos-completos             # solo mira
 *   pnpm db:datos-completos --aplicar   # las pasa
 *
 * Usa la MISMA función que el panel, así que la regla no se copia:
 * cada una queda con su movimiento y su motivo, como si la hubiera
 * movido el sistema en su momento.
 */

import { PrismaClient } from '../generated/prisma';
import { faltaDeLaPersona } from '../src/crm/completitud';
import { pasarSiNoLeFaltaNada } from '../src/crm/datos-completos';

const MOTIVO = 'Puesta al día del 18 sep 2026: ya tenía todos sus datos';

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const prisma = new PrismaClient();

  try {
    const candidatas = await prisma.participante.findMany({
      where: { etapa: { in: ['INTERESADO', 'CONTACTADO'] } },
      select: {
        id: true,
        etapa: true,
        nivelOcupacionalSepId: true,
        convenio: { select: { sigla: true, slug: true } },
        persona: {
          select: {
            correo: true,
            celular: true,
            fechaNacimiento: true,
            generoSepId: true,
            estrato: true,
            departamentoSepId: true,
            municipioSepId: true,
            barrio: true,
            direccion: true,
          },
        },
      },
    });

    const completas = candidatas.filter(
      (p) =>
        faltaDeLaPersona({
          persona: p.persona,
          nivelOcupacionalSepId: p.nivelOcupacionalSepId,
        }).length === 0,
    );

    console.log(
      `En «Interesado» o «Contactado»: ${candidatas.length}. ` +
        `Sin ningún dato pendiente: ${completas.length}.`,
    );
    const porGremio = new Map<string, number>();
    for (const p of completas) {
      const g = p.convenio.sigla ?? p.convenio.slug;
      porGremio.set(`${g} · ${p.etapa}`, (porGremio.get(`${g} · ${p.etapa}`) ?? 0) + 1);
    }
    for (const [clave, n] of porGremio) console.log(`  ${clave}: ${n}`);

    if (!aplicar) {
      console.log('\nNo se escribió nada. Para pasarlas: --aplicar');
      return;
    }

    let pasadas = 0;
    for (const p of completas) {
      const etapa = await pasarSiNoLeFaltaNada(prisma, p.id, MOTIVO);
      if (etapa === 'DATOS_COMPLETOS') pasadas += 1;
    }
    console.log(`\nPasadas a «Datos completos»: ${pasadas}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
