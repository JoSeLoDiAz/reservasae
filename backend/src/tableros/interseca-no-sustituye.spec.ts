/** Un filtro pedido se interseca con el ámbito. */

/**
 * `porUbicacion` tenía dos spreads y los dos traían la clave
 * `accionFormacion`: el segundo PISABA la del ámbito y se
 * quedaba solo el slug pedido. O sea que
 * `?convenio=britcham-adee` desde una cuenta que solo tiene
 * ADECOPRIA devolvía las ofertas de BRITCHAM.
 *
 * Se comprueba sobre el `where` que sale, no sobre el
 * resultado: es lo único que distingue «interseca» de
 * «sustituye», y es lo que un spread rompe en silencio.
 */

import { TablerosService } from './tableros.service';

/** Se queda con el `where` que reciba. */
function espia() {
  const vistos: unknown[] = [];
  const prisma = {
    oferta: {
      findMany: (args: { where: unknown }) => {
        vistos.push(args.where);
        return Promise.resolve([]);
      },
    },
    reserva: { groupBy: () => Promise.resolve([]) },
  };
  return { prisma, vistos };
}

/** ¿Aparece el ámbito en algún sitio del filtro? */
function mencionaElAmbito(where: unknown, ambito: string[]): boolean {
  return JSON.stringify(where).includes(JSON.stringify(ambito));
}

describe('porUbicacion no deja que el filtro borre el ámbito', () => {
  const AMBITO = ['solo-adecopria'];

  it('sin filtro, el ámbito está', async () => {
    const { prisma, vistos } = espia();
    const s = new TablerosService(prisma as never);

    await s.porUbicacion(AMBITO);

    expect(mencionaElAmbito(vistos[0], AMBITO)).toBe(true);
  });

  it('CON filtro del otro gremio, el ámbito SIGUE estando', async () => {
    /// Esta es la que fallaba: el ámbito desaparecía del
    /// `where` entero y la consulta salía sin cerradura.
    const { prisma, vistos } = espia();
    const s = new TablerosService(prisma as never);

    await s.porUbicacion(AMBITO, 'britcham-adee');

    expect(mencionaElAmbito(vistos[0], AMBITO)).toBe(true);
    expect(JSON.stringify(vistos[0])).toContain('britcham-adee');
  });
});
