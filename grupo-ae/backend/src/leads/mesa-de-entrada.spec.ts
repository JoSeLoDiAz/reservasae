/** La mesa de entrada no enseña los leads del otro gremio. */

/**
 * Este spec mira el `where` que sale hacia Prisma, no el
 * resultado. Es lo único que distingue «el filtro se INTERSECA
 * con el ámbito» de «el filtro lo SUSTITUYE», y esa distinción
 * ya falló dos veces en este repositorio —`porUbicacion` y
 * `respuestasDeFormulario`— las dos por escribirla con un spread
 * donde la clave repetida borraba la anterior.
 */

import { MesaDeEntrada } from './mesa-de-entrada.service';

function armar() {
  const vistos: { where?: unknown }[] = [];

  const prisma = {
    leadEntrante: {
      count: (a: { where?: unknown }) => {
        vistos.push(a);
        return Promise.resolve(0);
      },
      findMany: (a: { where?: unknown }) => {
        vistos.push(a);
        return Promise.resolve([]);
      },
      groupBy: (a: { where?: unknown }) => {
        vistos.push(a);
        return Promise.resolve([]);
      },
    },
    /// La lista de asesores también se acota por ámbito: sin eso,
    /// el desplegable ofrecería a gente del otro gremio y
    /// asignarles una ficha las dejaría con dueño y sin nadie que
    /// las vea.
    admin: {
      findMany: (a: { where?: unknown }) => {
        vistos.push(a);
        return Promise.resolve([]);
      },
    },
    /// Y los cursos que se ofrecen para arreglar un lead: sin
    /// ámbito, el desplegable ofrecería los del otro gremio y el
    /// servidor rechazaría lo que la pantalla dejó elegir.
    accionFormacion: {
      findMany: (a: { where?: unknown }) => {
        vistos.push(a);
        return Promise.resolve([]);
      },
    },
  };

  return { s: new MesaDeEntrada(prisma as never, {
    /// Nadie revoco: es el caso normal y la revocacion tiene su
    /// propio spec.
    cualesRevocaron: () => Promise.resolve(new Set<string>()),
    revoco: () => Promise.resolve(false),
  } as never, {
    /// Ese documento no es de nadie mas: caso normal, y el cruce
    /// tiene su propio spec.
    mirar: () => Promise.resolve({ que: 'LIBRE' }),
  } as never), vistos };
}

/// Los `convenioId` que de verdad ACOTAN: los de la raíz y los
/// de un `AND`. Uno metido en un `OR` no filtra, y en un `NOT`
/// filtra al revés — por eso no vale un `JSON.stringify`.
function acotanPor(nodo: unknown): string[][] {
  if (!nodo || typeof nodo !== 'object') return [];
  const o = nodo as Record<string, unknown>;
  const salida: string[][] = [];

  const c = o.convenioId as { in?: string[] } | string | undefined;
  if (c && typeof c === 'object' && Array.isArray(c.in)) salida.push(c.in);
  if (typeof c === 'string') salida.push([c]);

  /// El de la lista de asesores va anidado en `convenios.some`.
  const some = (o.convenios as { some?: unknown } | undefined)?.some;
  if (some) salida.push(...acotanPor(some));

  const and = o.AND;
  if (Array.isArray(and)) for (const x of and) salida.push(...acotanPor(x));
  else if (and) salida.push(...acotanPor(and));

  return salida;
}

const AMBITO = ['c-adecopria'];

describe('el ámbito va SIEMPRE, se pida lo que se pida', () => {
  it('sin filtros, acota a los convenios de la cuenta', async () => {
    const { s, vistos } = armar();
    await s.listar({}, AMBITO);

    for (const v of vistos) {
      expect(acotanPor(v.where)).toContainEqual(AMBITO);
    }
  });

  it('con un convenio de FUERA, el ámbito sigue puesto', async () => {
    /// Esto es lo que separa «interseca» de «sustituye». Si el
    /// filtro pedido reemplazara el ámbito, pedir el gremio
    /// ajeno devolvería sus leads.
    const { s, vistos } = armar();
    await s.listar({ convenioId: 'c-britcham' }, AMBITO);

    const consulta = vistos[0];
    expect(acotanPor(consulta.where)).toContainEqual(AMBITO);
  });

  it('y el convenio pedido se AÑADE, no reemplaza', async () => {
    const { s, vistos } = armar();
    await s.listar({ convenioId: 'c-britcham' }, AMBITO);

    const cotas = acotanPor(vistos[0].where);
    expect(cotas).toContainEqual(AMBITO);
    expect(cotas).toContainEqual(['c-britcham']);
  });
});

describe('el recuento de arriba cuenta lo mismo que la tabla', () => {
  it('el groupBy lleva el ámbito', async () => {
    /// Sin el, las cifras contarian los dos gremios mientras la
    /// tabla enseña uno: un número que parece exacto y no lo es.
    const { s, vistos } = armar();
    await s.listar({}, AMBITO);

    const group = vistos[vistos.length - 1];
    expect(acotanPor(group.where)).toContainEqual(AMBITO);
  });
});

describe('con ámbito vacío no se ve nada', () => {
  it('una cuenta sin concesiones no ve ningún lead', async () => {
    /// `{ in: [] }` no devuelve filas. Lo que NO puede pasar es
    /// que el ámbito desaparezca del `where`.
    const { s, vistos } = armar();
    await s.listar({}, []);

    expect(acotanPor(vistos[0].where)).toContainEqual([]);
  });
});
