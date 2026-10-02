/**
 * Las organizaciones que el dígito pegado partió en dos.
 *
 *   pnpm db:nit-pegado             # solo mira, no escribe
 *   pnpm db:nit-pegado --aplicar   # las une
 *
 * QUÉ PASÓ.
 *
 * `8001837677` es `800183767` con su dígito de verificación pegado
 * detrás, y hasta el 30 sep 2026 entraba entero como un NIT de diez
 * cifras. Así nacieron SIETE organizaciones duplicadas en producción
 * ---Fontán, Montessori, Marymount, Benedictino entre ellas---, cada
 * una partida en dos filas con su gente repartida. Y ese NIT es el que
 * viaja al F7 del SENA: partido, el SENA ve dos entidades donde hay
 * una, cada una con la mitad de sus formados.
 *
 * La entrada ya está cerrada ---`normalizarNit` parte el pegado desde
 * el 30 sep--- pero las filas de antes no se arreglan solas. Esto es
 * para ellas.
 *
 * LAS TRES CONDICIONES, y ninguna sobra. Una fila es «la pegada» solo
 * si cumple las tres:
 *
 *   - diez dígitos que empiezan en 8 o 9;
 *   - su décimo dígito es EXACTAMENTE el DV de los nueve primeros;
 *   - y existe otra fila con esos nueve dígitos.
 *
 * Son las mismas que usa `traeElDvPegado`, más la tercera. Sin la
 * segunda, una de cada once cédulas se partiría por azar; sin la
 * tercera no hay con qué unir y lo que toca es renombrar, que es otra
 * operación y la hace una persona.
 *
 * NO BORRA NADA. Aquí nada se borra: se oculta, se cancela o se
 * cierra, pero la fila se queda. La pegada queda EN SU SITIO y VACÍA
 * ---sin gente y sin reservas---, que es lo reversible: si mañana
 * resulta que eran dos organizaciones de verdad, los participantes se
 * devuelven. Un `DELETE` no se devuelve.
 *
 * NO PISA NINGÚN DATO. Al unir, un campo de la que se queda solo se
 * rellena si está VACÍO. Lo que ya tiene valor no se toca, aunque la
 * pegada traiga otro: elegir entre dos valores escritos por personas
 * distintas no es trabajo de un guión.
 *
 * Y NO TOCA `institucionId` A PROPÓSITO. La pegada apunta ---si
 * apunta--- a una ficha del directorio con el NIT MALO. Copiarla sería
 * mudar el error de tabla. El directorio se arregla por su lado, con
 * `db:independientes`.
 */

import { PrismaClient } from '../generated/prisma';
import { calcularDigitoVerificacion } from '../src/comun/nit';
import { exigirBaseSegura } from './guardia-de-base';

const aplicar = process.argv.includes('--aplicar');

/**
 * EL GUARDIA, ANTES DE ABRIR LA CONEXIÓN, y solo con `--aplicar`.
 *
 * Mira el PUERTO y no el nombre de la base: una base «reservasae»
 * alcanzada por el túnel no lleva «prueba» en la URL, y el `.env` del
 * portátil de José apunta a producción por ahí.
 */
if (aplicar) exigirBaseSegura('Unir las organizaciones del NIT pegado');

const prisma = new PrismaClient();

/**
 * Los campos que se rellenan si están vacíos.
 *
 * Solo los opcionales de la organización. Fuera quedan `nit` ---es la
 * llave--- y `razonSocial`, que nunca está vacía, y fuera queda
 * `institucionId` por lo dicho arriba.
 */
const RELLENABLES = [
  'digitoVerificacion',
  'numeroColaboradores',
  'redAsociada',
  'redAsociadaOtra',
  'tamanoSepId',
  'tipoDocumentoSepId',
  'direccion',
  'telefono',
  'departamentoSepId',
  'municipioSepId',
  'sectorEconomico',
  'numeroTrabajadores',
  'papelEnConvenio',
  'clasificacion',
  'contactoNombre',
  'contactoCargo',
  'contactoCorreo',
] as const;

type Campo = (typeof RELLENABLES)[number];

const SELECCION = {
  id: true,
  nit: true,
  razonSocial: true,
  ...Object.fromEntries(RELLENABLES.map((c) => [c, true])),
  _count: { select: { participantes: true, reservas: true } },
} as const;

type Fila = {
  id: string;
  nit: string;
  razonSocial: string;
  _count: { participantes: number; reservas: number };
} & Record<Campo, unknown>;

/** La pegada y la buena, emparejadas. */
type Pareja = {
  pegada: Fila;
  buena: Fila;
  /// Qué campos de la buena están vacíos y la pegada sí trae.
  rellena: Campo[];
};

function emparejar(filas: Fila[]): Pareja[] {
  const porNit = new Map(filas.map((f) => [f.nit, f]));
  const parejas: Pareja[] = [];

  for (const pegada of filas) {
    if (!/^[89]\d{9}$/.test(pegada.nit)) continue;

    const nueve = pegada.nit.slice(0, 9);
    if (calcularDigitoVerificacion(nueve) !== pegada.nit.slice(9)) continue;

    const buena = porNit.get(nueve);
    if (!buena) continue;

    const rellena = RELLENABLES.filter(
      (c) =>
        (buena[c] === null || buena[c] === undefined) &&
        pegada[c] !== null &&
        pegada[c] !== undefined,
    );

    /**
     * SOLO SI QUEDA ALGO POR HACER.
     *
     * Después de unir, las dos filas siguen existiendo ---aquí nada
     * se borra--- así que el emparejamiento las encuentra igual. Sin
     * esto, el guión decía «partidas: 1» para siempre, y correrlo
     * otra vez movía cero personas diciendo que había trabajo.
     *
     * Un aviso que no se apaga deja de leerse. La pareja está
     * pendiente si la pegada todavía tiene gente o reservas, o si a
     * la buena le falta algo que la otra pueda llenar.
     */
    const pendiente =
      pegada._count.participantes > 0 ||
      pegada._count.reservas > 0 ||
      rellena.length > 0;
    if (!pendiente) continue;

    parejas.push({ pegada, buena, rellena });
  }

  return parejas;
}

async function main() {
  const filas = (await prisma.empresa.findMany({
    select: SELECCION,
  })) as unknown as Fila[];

  const parejas = emparejar(filas);

  console.log(`\norganizaciones: ${filas.length}`);
  console.log(`partidas por el dígito pegado, con algo pendiente: ${parejas.length}\n`);

  if (parejas.length === 0) {
    console.log('Nada que unir: ninguna pareja tiene gente, reservas ni huecos pendientes.\n');
    return;
  }

  let gente = 0;
  let reservas = 0;

  for (const { pegada, buena, rellena } of parejas) {
    gente += pegada._count.participantes;
    reservas += pegada._count.reservas;

    console.log(`▸ ${buena.nit} · ${buena.razonSocial}`);
    console.log(
      `    se queda esta, con ${buena._count.participantes} personas y ${buena._count.reservas} reservas`,
    );
    console.log(
      `    llega de ${pegada.nit} «${pegada.razonSocial}»: ${pegada._count.participantes} personas, ${pegada._count.reservas} reservas`,
    );
    if (pegada.razonSocial.trim() !== buena.razonSocial.trim()) {
      console.log(
        `    OJO · los nombres no coinciden. El que se queda es el de la fila buena; el otro NO se pierde, la fila sigue ahí.`,
      );
    }
    console.log(
      rellena.length > 0
        ? `    se le rellena lo que tenía vacío: ${rellena.join(', ')}`
        : `    no se le rellena nada: no tenía huecos que la otra pudiera llenar`,
    );
    console.log(
      `    la fila ${pegada.nit} se queda VACÍA, no se borra\n`,
    );
  }

  console.log(
    `En total se mueven ${gente} personas y ${reservas} reservas, y ninguna fila se borra.`,
  );

  if (!aplicar) {
    console.log('\nSolo mirando. Con --aplicar se escriben los cambios.\n');
    return;
  }

  /**
   * TODO O NADA, y por eso una transacción.
   *
   * A mitad de camino el estado es peor que al principio: la gente
   * movida y los campos sin rellenar, o al revés. Y esto corre sobre
   * producción una sola vez.
   */
  for (const { pegada, buena, rellena } of parejas) {
    await prisma.$transaction(async (tx) => {
      await tx.participante.updateMany({
        where: { empresaId: pegada.id },
        data: { empresaId: buena.id },
      });
      await tx.reserva.updateMany({
        where: { empresaId: pegada.id },
        data: { empresaId: buena.id },
      });
      if (rellena.length > 0) {
        await tx.empresa.update({
          where: { id: buena.id },
          data: Object.fromEntries(rellena.map((c) => [c, pegada[c]])),
        });
      }
    });
    console.log(`unida: ${pegada.nit} -> ${buena.nit}`);
  }

  console.log(
    `\nAplicado: ${parejas.length} organizaciones unidas, ${gente} personas y ${reservas} reservas movidas. Ninguna fila borrada.\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
