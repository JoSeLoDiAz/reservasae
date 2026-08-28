/** Un filtro pedido se interseca con el ámbito. */

/**
 * Dos consultas tenían un `where` con un spread del ámbito y,
 * debajo, la MISMA clave otra vez: la segunda pisaba a la
 * primera y la cerradura desaparecía entera.
 *
 *  - `porUbicacion`: `ofertaDeConvenio` trae `accionFormacion` y
 *    el filtro `?convenio=` también. Una cuenta con solo
 *    ADECOPRIA pedía `?convenio=britcham-adee` y recibía las
 *    ofertas de BRITCHAM.
 *  - `respuestasDeFormulario`: `respuestaDeConvenio` trae
 *    `reserva` y la condición de «no cancelada» también, así que
 *    el informe contaba las respuestas de los dos gremios.
 *
 * Se comprueba sobre el `where` que SALE, no sobre el resultado:
 * es lo único que distingue «interseca» de «sustituye», y es lo
 * que un spread rompe en silencio.
 *
 * La primera versión de este spec buscaba el ámbito con
 * `JSON.stringify(where).includes(...)`, y eso aprueba un ámbito
 * escondido dentro de un `OR` —donde no filtra nada— o dentro de
 * un `NOT` —donde filtra al revés—. Ahora se recorre el árbol y
 * solo cuentan las posiciones donde de verdad restringe.
 */

import { TablerosService } from './tableros.service';

type Where = Record<string, unknown>;

/**
 * ¿El ámbito restringe DE VERDAD en este `where`?
 *
 * Solo cuenta si está en la raíz o dentro de un `AND`: son las
 * dos posiciones en las que Prisma lo aplica como condición
 * obligatoria. Dentro de `OR` una rama sin ámbito lo anula, y
 * dentro de `NOT` significa lo contrario.
 */
function restringeDeVerdad(where: unknown, ambito: string[]): boolean {
  if (!where || typeof where !== 'object') return false;

  const nodo = where as Where;

  for (const [clave, valor] of Object.entries(nodo)) {
    if (clave === 'OR' || clave === 'NOT') continue;

    if (clave === 'AND') {
      const ramas = Array.isArray(valor) ? valor : [valor];
      if (ramas.some((r) => restringeDeVerdad(r, ambito))) return true;
      continue;
    }

    // `convenioId: { in: [...] }` es la hoja que buscamos
    if (clave === 'convenioId' && esElAmbito(valor, ambito)) return true;

    if (valor && typeof valor === 'object' && restringeDeVerdad(valor, ambito)) {
      return true;
    }
  }

  return false;
}

function esElAmbito(valor: unknown, ambito: string[]): boolean {
  if (!valor || typeof valor !== 'object') return false;
  const dentro = (valor as { in?: unknown }).in;
  return Array.isArray(dentro) && ambito.every((c) => dentro.includes(c));
}

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

const AMBITO = ['solo-adecopria'];

describe('el ayudante del propio test distingue dónde filtra', () => {
  /// Si esto no fuera cierto, el resto del spec no valdría: era
  /// exactamente el defecto de la primera versión.
  it('en la raíz, sí', () => {
    expect(
      restringeDeVerdad({ accionFormacion: { convenioId: { in: AMBITO } } }, AMBITO),
    ).toBe(true);
  });

  it('dentro de un AND, sí', () => {
    expect(
      restringeDeVerdad(
        { AND: [{ accionFormacion: { convenioId: { in: AMBITO } } }, { x: 1 }] },
        AMBITO,
      ),
    ).toBe(true);
  });

  it('dentro de un OR, NO: una rama sin ámbito lo anula', () => {
    expect(
      restringeDeVerdad(
        { OR: [{ accionFormacion: { convenioId: { in: AMBITO } } }, { x: 1 }] },
        AMBITO,
      ),
    ).toBe(false);
  });

  it('dentro de un NOT, NO: significaría lo contrario', () => {
    expect(
      restringeDeVerdad(
        { NOT: { accionFormacion: { convenioId: { in: AMBITO } } } },
        AMBITO,
      ),
    ).toBe(false);
  });

  it('un ámbito distinto no cuenta como este', () => {
    expect(
      restringeDeVerdad(
        { accionFormacion: { convenioId: { in: ['otro-gremio'] } } },
        AMBITO,
      ),
    ).toBe(false);
  });
});

describe('porUbicacion no deja que el filtro borre el ámbito', () => {
  it('sin filtro, el ámbito restringe', async () => {
    const { prisma, vistos } = espia();
    const s = new TablerosService(prisma as never);

    await s.porUbicacion(AMBITO);

    expect(restringeDeVerdad(vistos[0], AMBITO)).toBe(true);
  });

  it('CON el filtro del otro gremio, el ámbito SIGUE restringiendo', async () => {
    /// Esta es la que fallaba: el ámbito desaparecía del `where`
    /// entero y la consulta salía sin cerradura.
    const { prisma, vistos } = espia();
    const s = new TablerosService(prisma as never);

    await s.porUbicacion(AMBITO, 'britcham-adee');

    expect(restringeDeVerdad(vistos[0], AMBITO)).toBe(true);
    expect(JSON.stringify(vistos[0])).toContain('britcham-adee');
  });

  it('con el filtro propio, también', async () => {
    const { prisma, vistos } = espia();
    const s = new TablerosService(prisma as never);

    await s.porUbicacion(AMBITO, 'adecopria');

    expect(restringeDeVerdad(vistos[0], AMBITO)).toBe(true);
  });
});
