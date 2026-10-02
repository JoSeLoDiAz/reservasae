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
  /// EL DIGITO DE VERIFICACION NO ESTA, Y ES EL ERROR QUE MAS CARO
  /// HABRIA SALIDO.
  ///
  /// Estaba, y lo vio Josse el 2 oct 2026 corriendo el algoritmo de
  /// la DIAN sobre el ejemplo de este mismo fichero:
  ///
  ///   DV('8001837677') --la pegada, diez digitos--  = 1
  ///   DV('800183767')  --la buena--                 = 7
  ///
  /// Si la buena lo tenia vacio, se le grababa el 1. Y de ahi sale
  /// al cargue del SENA. Que ese estado existe lo cuenta el propio
  /// sondeo de esta rama: hay empresas sin digito.
  ///
  /// EL DV NO ES UNA PROPIEDAD DE LA ORGANIZACION como la direccion
  /// o el telefono: ES UNA FUNCION DEL NIT, y las dos filas tienen
  /// NIT distinto. Copiarlo no es rellenar un hueco, es inventarse
  /// un numero.
  ///
  /// Y lo evitable del caso es que el docblock de arriba YA ENUNCIA
  /// esta regla, aplicada a `institucionId`: «apunta a una ficha con
  /// el NIT MALO; copiarla seria mudar el error de tabla». Era el
  /// mismo caso y no lo vi.
  ///
  /// Quien quiera ponerle el digito a la buena tiene su guion:
  /// `db:independientes` lo calcula a partir de SU PROPIO nit.
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
  /// Las reservas CON SU OFERTA, para detectar el choque del punto
  /// de abajo. Una consulta más por fila en un guión que corre una
  /// vez; la alternativa es descubrirlo a mitad de la escritura.
  reservas: { select: { ofertaId: true, cuposSolicitados: true } },
} as const;

type Fila = {
  id: string;
  nit: string;
  razonSocial: string;
  _count: { participantes: number; reservas: number };
  reservas: Array<{ ofertaId: string; cuposSolicitados: number }>;
} & Record<Campo, unknown>;

/** La pegada y la buena, emparejadas. */
type Pareja = {
  pegada: Fila;
  buena: Fila;
  /// Qué campos de la buena están vacíos y la pegada sí trae.
  rellena: Campo[];
  /**
   * LAS OFERTAS EN LAS QUE RESERVARON LAS DOS.
   *
   * `Reserva` tiene `@@unique([empresaId, ofertaId])`, así que mover
   * la reserva de la pegada a la buena cuando la buena YA reservó en
   * esa misma oferta lanza P2002.
   *
   * Y NO ES TEÓRICO: Josse lo encontró escribiendo el SQL
   * equivalente ---Fontán tenía reserva por los dos lados sobre la
   * misma oferta, 1 cupo en la buena y 3 en la pegada---. Es
   * justamente lo que significa «su gente repartida».
   *
   * Ahí NO SE MUEVE: se suman, se deja huella en
   * `movimientos_reserva` y hay que cuidar que el contador de la
   * oferta no se descuadre. Eso son tres decisiones sobre cupos
   * comprometidos y no las toma un guión: se avisa y esa
   * organización se une a mano.
   */
  choques: Array<{ ofertaId: string; enBuena: number; enPegada: number }>;
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

    /// Las ofertas donde reservaron las dos. Ver `Pareja.choques`.
    const enLaBuena = new Map(
      buena.reservas.map((r) => [r.ofertaId, r.cuposSolicitados]),
    );
    const choques = pegada.reservas
      .filter((r) => enLaBuena.has(r.ofertaId))
      .map((r) => ({
        ofertaId: r.ofertaId,
        enBuena: enLaBuena.get(r.ofertaId) ?? 0,
        enPegada: r.cuposSolicitados,
      }));

    parejas.push({ pegada, buena, rellena, choques });
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

  let aMano = 0;

  for (const { pegada, buena, rellena, choques } of parejas) {
    /// Lo que de verdad se va a mover: lo de las parejas que chocan
    /// no se mueve, así que contarlo ahí haría que el resumen
    /// prometiera un trabajo que no se va a hacer.
    if (choques.length > 0) {
      aMano += 1;
    } else {
      gente += pegada._count.participantes;
      reservas += pegada._count.reservas;
    }

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
    if (choques.length > 0) {
      console.log(
        `    NO SE UNE: las dos reservaron en ${choques.length} oferta(s) la misma.`,
      );
      for (const c of choques) {
        console.log(
          `      oferta ${c.ofertaId}: ${c.enBuena} cupos en la buena + ${c.enPegada} en la pegada`,
        );
      }
      console.log(
        `      Ahí los cupos se SUMAN, no se mueven, y hay que cuidar el contador`,
      );
      console.log(
        `      de la oferta. Esta organización se une a mano.\n`,
      );
    } else {
      console.log(
        `    la fila ${pegada.nit} se queda VACÍA, no se borra\n`,
      );
    }
  }

  console.log(
    `En total se mueven ${gente} personas y ${reservas} reservas, y ninguna fila se borra.`,
  );
  if (aMano > 0) {
    console.log(
      `Y ${aMano} organización(es) NO se tocan: sus reservas chocan y hay que unirlas a mano.`,
    );
  }

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
  for (const { pegada, buena, rellena, choques } of parejas) {
    /// Las que chocan no se tocan. Intentarlo lanza P2002 y deja el
    /// guión aplicado A MEDIAS ENTRE PAREJAS: las anteriores hechas,
    /// esta revertida y las siguientes sin correr. El `$transaction`
    /// es por pareja, así que el «todo o nada» vale dentro de una y
    /// no entre varias.
    if (choques.length > 0) {
      console.log(`saltada: ${pegada.nit} -> ${buena.nit} (reservas que chocan)`);
      continue;
    }
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
    `\nAplicado: ${parejas.length - aMano} organizaciones unidas, ${gente} personas y ` +
      `${reservas} reservas movidas. Ninguna fila borrada.` +
      (aMano > 0 ? ` ${aMano} quedaron para unir a mano.` : '') +
      '\n',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
