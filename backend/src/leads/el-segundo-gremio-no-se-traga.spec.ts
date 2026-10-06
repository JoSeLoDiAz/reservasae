/** El mismo «AF1» en dos gremios son DOS leads, no un repetido. */

/**
 * LO QUE PASABA, Y POR QUÉ NO SE VEÍA.
 *
 * El único de la base es `(origenSistema, externoId)` y NO lleva
 * convenio (`prisma/schema.prisma`), así que lo único que separa
 * los gremios es la llave que arma `llave-del-lead.ts`. Esa
 * llave llevaba el CÓDIGO de la acción --`doc:1-1020304050:AF1`--
 * y el código no distingue nada: `AF1` existe en ADECOPRIA y en
 * BRITCHAM y no es el mismo curso. El propio `leads.service`
 * resuelve el código contra las acciones DE ESE convenio por ese
 * motivo exacto, y luego tiraba el convenio a la basura al
 * formar la llave.
 *
 * Resultado: la misma persona pidiendo «AF1» en BRITCHAM caía en
 * la llave de su lead de ADECOPRIA. No se creaba nada, el
 * webhook contestaba 200 --para Meta el lead había entrado-- y
 * además se le devolvía a quien llamaba el `id`, el `estado` y el
 * `participanteId` del lead del OTRO gremio.
 *
 * Dos cosas lo tapaban: que el 200 es la respuesta de un lead que
 * sí entró, y que la comprobación de repetido era un `findUnique`
 * sin convenio, así que tampoco había forma de notar la mezcla
 * mirando las consultas.
 */

import { LeadsService } from './leads.service';
import { llaveDelLead } from './llave-del-lead';

const ANA = { tipoDocumentoSepId: 1, numeroDocumento: '1020304050' };

describe('la llave derivada lleva el gremio', () => {
  it('la misma cédula y el mismo AF1 en dos gremios dan llaves distintas', () => {
    const enAde = llaveDelLead(ANA, 'AF1', 'c-ade');
    const enBrit = llaveDelLead(ANA, 'AF1', 'c-brit');

    expect(enAde).not.toEqual(enBrit);
  });

  it('y dentro del MISMO gremio sigue siendo la misma: el reintento no duplica', () => {
    /// Lo que no se puede perder al arreglar lo otro. Si la llave
    /// dejara de ser estable, un parpadeo de red crearía dos
    /// personas, que es para lo que existe este módulo.
    expect(llaveDelLead(ANA, 'AF1', 'c-ade')).toEqual(
      llaveDelLead(ANA, 'AF1', 'c-ade'),
    );
  });

  it('la llave del CONTENIDO también lo lleva', () => {
    /// Por la misma razón y no por simetría: dos leads con el
    /// mismo correo, celular, nombre y código en gremios
    /// distintos daban una sola llave, y ahí el choque lo habría
    /// dado el único de la base --un 500 que quien manda el
    /// webhook lee como «no llegó» y reintenta--.
    const cuerpo = { correo: 'ana@ejemplo.test', nombres: 'Ana' };

    expect(llaveDelLead(cuerpo, 'AF1', 'c-ade')).not.toEqual(
      llaveDelLead(cuerpo, 'AF1', 'c-brit'),
    );
  });

  it('el externoId propio del emisor se deja tal cual', () => {
    /// Ese id es su identidad: si manda el mismo para dos gremios
    /// está diciendo que es el mismo registro, no coincidiendo por
    /// casualidad. Quien lo decide es el emisor, no nosotros.
    expect(llaveDelLead({ externoId: 'meta-8891' }, 'AF1', 'c-ade')).toEqual(
      llaveDelLead({ externoId: 'meta-8891' }, 'AF1', 'c-brit'),
    );
  });
});

const CONVENIOS: Record<string, { id: string; slug: string }> = {
  adecopria: { id: 'c-ade', slug: 'adecopria' },
  'britcham-adee': { id: 'c-brit', slug: 'britcham-adee' },
};

/**
 * El webhook entero, con una tabla de leads que SÍ respeta el
 * `where`: es lo único que puede enseñar la mezcla, porque el
 * defecto estaba en qué se le preguntaba a la base.
 */
function armar(filas: Array<Record<string, unknown>> = []) {
  const creados: Array<Record<string, unknown>> = [];
  const consultas: Array<Record<string, unknown>> = [];

  const prisma = {
    convenio: {
      findFirst: ({ where }: { where: { slug?: string } }) => {
        const c = where.slug ? CONVENIOS[where.slug] : undefined;
        if (!c) return Promise.resolve(null);
        return Promise.resolve({
          ...c,
          /// Los dos gremios tienen un «AF1», que es el caso: el
          /// mismo código y otro curso.
          acciones: [{ id: `af1-${c.slug}`, codigo: 'AF1', visible: true }],
        });
      },
    },
    participante: { findFirst: () => Promise.resolve(null) },
    leadEntrante: {
      findFirst: ({ where }: { where: Record<string, unknown> }) => {
        consultas.push(where);
        /**
         * ENTIENDE `{ in: [...] }`, que antes no.
         *
         * La comprobación de repetido busca por la llave nueva Y por la
         * de antes de que llevara gremio ---los leads ya guardados
         * tienen la vieja---, así que el `where` trae
         * `externoId: { in: [nueva, anterior] }`. Un doble que compara
         * con `===` no casa nunca y haría pasar por bueno un reintento
         * que en realidad crea un duplicado.
         */
        const casa = (valorDeLaFila: unknown, pedido: unknown) =>
          pedido !== null &&
          typeof pedido === 'object' &&
          Array.isArray((pedido as { in?: unknown[] }).in)
            ? (pedido as { in: unknown[] }).in.includes(valorDeLaFila)
            : valorDeLaFila === pedido;
        return Promise.resolve(
          filas.find((f) =>
            Object.entries(where).every(([k, v]) => casa(f[k], v)),
          ) ?? null,
        );
      },
      findUnique: ({ where }: { where: Record<string, any> }) =>
        Promise.resolve(
          filas.find(
            (f) =>
              f.origenSistema ===
                where.origenSistema_externoId?.origenSistema &&
              f.externoId === where.origenSistema_externoId?.externoId,
          ) ?? null,
        ),
      create: ({ data }: { data: Record<string, unknown> }) => {
        creados.push(data);
        const fila = {
          ...data,
          id: `l-${creados.length}`,
          estado: 'PENDIENTE',
          participanteId: null,
        };
        filas.push(fila);
        return Promise.resolve(fila);
      },
    },
  };

  const s = new LeadsService(
    prisma as never,
    { encolarSiHaceFalta: () => Promise.resolve() } as never,
    {
      intentar: () =>
        Promise.resolve({ paso: false, porque: 'se queda', falta: [] }),
    } as never,
  );

  return { s, creados, consultas };
}

const PIDE_AF1 = {
  tipoDocumento: 'CC',
  numeroDocumento: '1020304050',
  nombres: 'Ana',
  primerApellido: 'Jaramillo',
  celular: '3001234567',
  interes: 'AF1',
};

describe('el webhook: un lead de cada gremio son dos leads', () => {
  it('el segundo gremio NO vuelve como repetido: se crea', async () => {
    const { s, creados } = armar();

    const enAde = await s.entra({ ...PIDE_AF1, convenio: 'adecopria' }, 'meta');
    const enBrit = await s.entra(
      { ...PIDE_AF1, convenio: 'britcham-adee' },
      'meta',
    );

    expect(enAde.repetido).toBe(false);
    expect(enBrit.repetido).toBe(false);
    expect(creados.map((c) => c.convenioId)).toEqual(['c-ade', 'c-brit']);
  });

  it('y a quien llama NO se le devuelve el lead del otro gremio', async () => {
    /// Esto era una fuga de datos además de un lead perdido: el
    /// `id` y el `participanteId` que se devolvían eran de una
    /// persona de otro convenio.
    const { s } = armar();

    const enAde = await s.entra({ ...PIDE_AF1, convenio: 'adecopria' }, 'meta');
    const enBrit = await s.entra(
      { ...PIDE_AF1, convenio: 'britcham-adee' },
      'meta',
    );

    expect(enBrit.id).not.toBe(enAde.id);
  });

  it('dentro de su gremio el reintento sigue siendo repetido', async () => {
    /// La otra mitad: acotar por convenio no puede romper la
    /// idempotencia que es la razón de ser del webhook.
    const { s, creados } = armar();

    await s.entra({ ...PIDE_AF1, convenio: 'adecopria' }, 'meta');
    const otra = await s.entra({ ...PIDE_AF1, convenio: 'adecopria' }, 'meta');

    expect(otra.repetido).toBe(true);
    expect(creados).toHaveLength(1);
  });

  it('la comprobación de repetido pregunta por el convenio', async () => {
    /// Se mira el `where` y no solo el resultado: el defecto
    /// estaba en lo que se le preguntaba a la base, y una prueba
    /// que solo mire la respuesta pasa igual con la pregunta mal
    /// hecha en cuanto el doble devuelve null.
    const { s, consultas } = armar();
    await s.entra({ ...PIDE_AF1, convenio: 'britcham-adee' }, 'meta');

    expect(consultas[0]).toMatchObject({ convenioId: 'c-brit' });
  });
});

/**
 * Y LO QUE YA ESTÁ GUARDADO SE SIGUE RECONOCIENDO.
 *
 * Esta llave no se calcula y se tira: SE GUARDA, en
 * `LeadEntrante.externoId`. Los leads que ya están en la base llevan
 * la forma de antes del 5 oct 2026 ---sin gremio--- así que buscar
 * solo por la nueva no encontraría ninguno, y el primer reintento del
 * emisor crearía un DUPLICADO de un lead que existe.
 *
 * O sea: el arreglo del gremio, SOLO, habría roto la idempotencia de
 * todo lo anterior, y precisamente en la puerta por la que entra la
 * pauta pagada. Es el riesgo que no se ve al mirar el código nuevo,
 * porque está en los datos viejos.
 *
 * Lo que se ESCRIBE es siempre la llave nueva, así que esto se apaga
 * solo según los leads viejos se van gestionando: ni migración, ni
 * elegir un día para el cambio.
 */
describe('la llave de antes se sigue reconociendo', () => {
  it('la función devuelve también la anterior, sin gremio', () => {
    const r = llaveDelLead(
      { tipoDocumentoSepId: 1, numeroDocumento: '1020304050' },
      'AF1',
      'conv-adecopria',
    );
    expect('llave' in r).toBe(true);
    if (!('llave' in r)) return;
    expect(r.llave).toBe('doc:conv-adecopria:1-1020304050:AF1');
    /// Exactamente la que se guardaba antes.
    expect(r.anterior).toBe('doc:1-1020304050:AF1');
  });

  it('y la consulta busca por las dos', () => {
    const t = require('fs').readFileSync(
      require('path').join(__dirname, 'leads.service.ts'),
      'utf8',
    ) as string;
    expect(t).toContain('externoId: { in: llaves }');
    /// Acotada al gremio igual que la nueva: la compatibilidad hacia
    /// atrás no puede reabrir la fuga que acabamos de cerrar.
    const i = t.indexOf('externoId: { in: llaves }');
    const desde = t.lastIndexOf('where: {', i);
    expect(t.slice(desde, i + 60)).toContain('convenioId: convenio.id');
  });
});
