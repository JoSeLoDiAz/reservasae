/**
 * «Datos completos» puesto al día en los DOS sentidos.
 *
 * SUBE a quien ya no debe nada y BAJA a quien sí debe algo, contra
 * la regla de hoy. Se corre una vez por cada cambio de la regla.
 *
 *   pnpm db:datos-completos             # solo mira, no escribe
 *   pnpm db:datos-completos --aplicar   # las mueve
 *
 * POR QUÉ HAY QUE BAJARLAS A MANO, que es lo que no se ve:
 * `pasarSiNoLeFaltaNada` SOLO AVANZA --su lista `DESDE` son
 * «Interesado» y «Contactado»-- y eso es correcto en el día a día:
 * completar unos datos no puede sacar a nadie del aula. Pero
 * cuando la REGLA se endurece, las que ya estaban arriba se
 * quedan ahí con la columna de al lado diciendo «Faltan 3»: la
 * misma contradicción de dos verdades sobre la misma fila que
 * `datos-completos.ts` existe para cerrar, movida de sitio.
 *
 * DOS PUESTAS AL DÍA, Y LA SEGUNDA ES LA QUE BAJA:
 *
 *   18 sep 2026 · la regla nació. Subió a quien ya estaba completo
 *     y nadie había vuelto a tocar.
 *   24 sep 2026 · la regla pasó a mirar también la ORGANIZACIÓN
 *     («datos completos deben estar los datos de la persona y los
 *     datos de la empresa», Josse). Baja a quien ya no cumple.
 *
 * ADÓNDE BAJAN: a «Interesado», y lo eligió Josse --«para que la
 * persona se gestione y mande el correo de completar datos»--. Se
 * descartó devolverlas a su `etapaAntes`: la mitad venían de
 * «Contactado» y habría dos destinos para la misma decisión.
 * Lo que la persona ya hizo NO se pierde: el historial lo guarda,
 * y este paso deja su propio movimiento con su motivo.
 *
 * EL CORREO NO SALE SOLO, y conviene saberlo antes de correrlo:
 * `DisparadorDePlantilla` solo tiene `PREINSCRIPCION`, así que
 * mover la etapa no dispara nada. El correo se manda lanzando una
 * campaña sobre el segmento «Interesado» con la plantilla «Nos
 * faltan tus datos», donde `{{faltan}}` se rellena solo. Es
 * deliberado: un masivo a setenta personas como efecto secundario
 * de una migración, sin que nadie lo pulse, no se puede deshacer.
 *
 * La regla NO se copia: se llama a `faltaDeLaFicha`, la misma que
 * usan la etapa, la columna y la ficha.
 */

import { PrismaClient } from '../generated/prisma';
import { faltaDeLaFicha } from '../src/crm/completitud';
import { pasarSiNoLeFaltaNada } from '../src/crm/datos-completos';
import { exigirBaseSegura } from './guardia-de-base';

const MOTIVO_SUBE = 'Puesta al día: ya no le falta ningún dato';
const MOTIVO_BAJA =
  'Puesta al día del 24 sep 2026: «Datos completos» pasa a exigir ' +
  'también los datos de su organización';

/// Lo que `faltaDeLaEmpresa` mira, y nada más.
const CAMPOS_EMPRESA = {
  nit: true,
  sectorEconomico: true,
  contactoNombre: true,
  contactoCargo: true,
  contactoCorreo: true,
} as const;

const QUE_TRAER = {
  id: true,
  etapa: true,
  nivelOcupacionalSepId: true,
  convenio: { select: { sigla: true, slug: true } },
  persona: {
    select: {
      numeroDocumento: true,
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
  /// La suya y, si no, la de la reserva que la nominó: la misma
  /// cadena que el F7 y la compuerta.
  empresa: { select: CAMPOS_EMPRESA },
  reserva: { select: { empresa: { select: CAMPOS_EMPRESA } } },
} as const;

type Ficha = {
  id: string;
  etapa: string;
  nivelOcupacionalSepId: number | null;
  convenio: { sigla: string | null; slug: string };
  persona: Parameters<typeof faltaDeLaFicha>[0]['persona'] & {
    numeroDocumento: string;
  };
  empresa: Parameters<typeof faltaDeLaFicha>[0]['empresa'];
  reserva: { empresa: Parameters<typeof faltaDeLaFicha>[0]['empresa'] } | null;
};

function loQueFalta(p: Ficha): string[] {
  return faltaDeLaFicha({
    persona: p.persona,
    nivelOcupacionalSepId: p.nivelOcupacionalSepId,
    empresa: p.empresa ?? p.reserva?.empresa ?? null,
    documentoDeLaPersona: p.persona.numeroDocumento,
  });
}

function contarPorGremio(fichas: Ficha[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of fichas) {
    const clave = `${p.convenio.sigla ?? p.convenio.slug} · ${p.etapa}`;
    m.set(clave, (m.get(clave) ?? 0) + 1);
  }
  return m;
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  // en producción, solo a mano
  if (aplicar) exigirBaseSegura('Poner al día datos completos');
  const prisma = new PrismaClient();

  try {
    // ── las que suben ──
    const enLaCola = (await prisma.participante.findMany({
      where: { etapa: { in: ['INTERESADO', 'CONTACTADO'] } },
      select: QUE_TRAER,
    })) as unknown as Ficha[];
    const suben = enLaCola.filter((p) => loQueFalta(p).length === 0);

    // ── las que bajan ──
    const arriba = (await prisma.participante.findMany({
      where: { etapa: 'DATOS_COMPLETOS' },
      select: QUE_TRAER,
    })) as unknown as Ficha[];
    const bajan = arriba.filter((p) => loQueFalta(p).length > 0);

    console.log(
      `En la cola del asesor: ${enLaCola.length}. ` +
        `Ya sin nada pendiente: ${suben.length}.`,
    );
    for (const [c, n] of contarPorGremio(suben)) console.log(`  sube  ${c}: ${n}`);

    console.log(
      `\nEn «Datos completos»: ${arriba.length}. ` +
        `Con algo pendiente según la regla de hoy: ${bajan.length}.`,
    );
    for (const [c, n] of contarPorGremio(bajan)) console.log(`  baja  ${c}: ${n}`);

    /// QUÉ les falta, agrupado: es lo que dice si la campaña que
    /// se va a lanzar después puede pedirlo de verdad.
    const cuenta = new Map<string, number>();
    for (const p of bajan) {
      for (const q of loQueFalta(p)) cuenta.set(q, (cuenta.get(q) ?? 0) + 1);
    }
    if (cuenta.size > 0) {
      console.log('\n  Lo que les falta:');
      for (const [q, n] of [...cuenta].sort((a, b) => b[1] - a[1])) {
        console.log(`    ${n.toString().padStart(4)}  ${q}`);
      }
    }

    if (!aplicar) {
      console.log('\nNo se escribió nada. Para moverlas: --aplicar');
      return;
    }

    let subidas = 0;
    for (const p of suben) {
      const etapa = await pasarSiNoLeFaltaNada(prisma, p.id, MOTIVO_SUBE);
      if (etapa === 'DATOS_COMPLETOS') subidas += 1;
    }

    /// Cada una con su movimiento, como cualquier cambio de etapa.
    /// Sin él, setenta fichas cambiarían de estado sin rastro, que
    /// es lo contrario de lo que el historial existe para hacer.
    let bajadas = 0;
    for (const p of bajan) {
      await prisma.$transaction([
        prisma.participante.update({
          where: { id: p.id },
          data: { etapa: 'INTERESADO' },
        }),
        prisma.movimientoParticipante.create({
          data: {
            participanteId: p.id,
            etapaAntes: 'DATOS_COMPLETOS',
            etapaDespues: 'INTERESADO',
            motivo: `${MOTIVO_BAJA}. Le falta: ${loQueFalta(p).join(', ')}`,
            adminId: null,
          },
        }),
      ]);
      bajadas += 1;
    }

    console.log(`\nSubidas a «Datos completos»: ${subidas}.`);
    console.log(`Bajadas a «Interesado»: ${bajadas}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
