/** La conversión por lote: ámbito, la regla de listo, y una fila mala. */

/**
 * Los tres candados que este lote necesita y que no tenía nadie:
 *
 * 1. Un lead del otro gremio no se convierte NI se menciona.
 * 2. La regla de «está listo» se comprueba AQUÍ, no solo en el
 *    navegador — la ruta se puede llamar directo.
 * 3. Que la fila 17 falle no puede llevarse las otras 99.
 *
 * El doble de Prisma APLICA los filtros de verdad sobre una lista
 * en memoria. Ya se falló una vez en este repositorio con un doble
 * que decidía por el prefijo del id: probaba el doble, no el
 * candado.
 */

import { LoteDeLeads } from './lote.service';

type LeadFalso = {
  id: string;
  convenioId: string;
  estado: string;
  participanteId: string | null;
  tipoDocumentoSepId: number | null;
  numeroDocumento: string | null;
  nombreCompleto: string | null;
  primerNombre: string | null;
  primerApellido: string | null;
  accionFormacionId: string | null;
  origen: string;
  origenSistema: string;
  externoId: string;
  recibidoEn: Date;
};

function lead(p: Partial<LeadFalso> & { id: string }): LeadFalso {
  return {
    convenioId: 'c-adecopria',
    estado: 'PENDIENTE',
    participanteId: null,
    tipoDocumentoSepId: 1,
    numeroDocumento: '1020304050',
    nombreCompleto: null,
    primerNombre: 'Ana',
    primerApellido: 'Ruiz',
    accionFormacionId: 'af-1',
    origen: 'FACEBOOK',
    origenSistema: 'meta',
    externoId: 'ext-' + p.id,
    recibidoEn: new Date('2026-08-30T10:00:00Z'),
    ...p,
  };
}

function armar(leads: LeadFalso[], falla: (id: string) => boolean = () => false) {
  const convertidos: string[] = [];

  const prisma = {
    leadEntrante: {
      findMany: (a: {
        where: { id: { in: string[] }; convenioId: { in: string[] } };
      }) => {
        /// El doble FILTRA de verdad: por id y por convenio, que
        /// es exactamente lo que se dice estar probando.
        const ids = new Set(a.where.id.in);
        const conv = new Set(a.where.convenioId.in);
        return Promise.resolve(
          leads.filter((l) => ids.has(l.id) && conv.has(l.convenioId)),
        );
      },
    },
  };

  const conversion = {
    convertirDeLote: (id: string) => {
      if (falla(id)) {
        return Promise.reject(new Error('Ese documento no tiene forma de documento.'));
      }
      convertidos.push(id);
      return Promise.resolve({
        participanteId: 'p-' + id,
        constancia: 'REGISTRADA',
        conAutorizacion: true,
      });
    },
  };

  /// El doble del CRM comprueba DE VERDAD: solo Ana lleva
  /// ADECOPRIA. Uno que dijera que si a todo probaria el doble.
  const comprobados: Array<[string, string]> = [];
  const crm = {
    exigirAsesorDelConvenio: (asesorId: string, convenioId: string) => {
      comprobados.push([asesorId, convenioId]);
      if (asesorId !== 'ana') {
        return Promise.reject(new Error('No trabaja en este convenio.'));
      }
      return Promise.resolve({ id: asesorId });
    },
  };

  const s = new LoteDeLeads(prisma as never, conversion as never, crm as never);
  const admin = { id: 'ana', correo: 'a@b.co', nombre: 'Ana' };
  return { s, admin, convertidos, comprobados };
}

const AMBITO = ['c-adecopria'];
/// Un lider: reparte, asi que ELIGE a quien se las asigna.
const REPARTE = ['c-adecopria'];
/// Un asesor: no reparte, asi que se las queda.
const NO_REPARTE: string[] = [];

describe('un lead del otro gremio ni se convierte ni se menciona', () => {
  it('no se convierte', async () => {
    const { s, admin, convertidos } = armar([
      lead({ id: 'mio' }),
      lead({ id: 'ajeno', convenioId: 'c-britcham' }),
    ]);

    await s.convertir(['mio', 'ajeno'], 'ana', admin as never, AMBITO, REPARTE);

    expect(convertidos).toEqual(['mio']);
  });

  it('y NO sale en las filas: decir que existe ya es un oráculo', async () => {
    /// Contestar «ese lead no es suyo» confirma que existe en el
    /// otro gremio. Se cuenta en `fuera`, sin decir cuál.
    const { s, admin } = armar([
      lead({ id: 'mio' }),
      lead({ id: 'ajeno', convenioId: 'c-britcham' }),
    ]);

    const r = await s.convertir(['mio', 'ajeno'], 'ana', admin as never, AMBITO, REPARTE);

    expect(r.fuera).toBe(1);
    expect(JSON.stringify(r.filas)).not.toContain('ajeno');
  });

  it('con ámbito vacío no se convierte ninguno', async () => {
    const { s, admin, convertidos } = armar([lead({ id: 'mio' })]);
    const r = await s.convertir(['mio'], 'ana', admin as never, [], REPARTE);

    expect(convertidos).toEqual([]);
    expect(r.convertidos).toBe(0);
  });
});

describe('la regla de «listo» se comprueba en el SERVIDOR', () => {
  it('sin curso no se convierte, aunque lo pidan por la API', async () => {
    /// Es lo que hace morder al unique (accionFormacionId,
    /// personaId): sin curso, dos leads de la misma persona
    /// darían dos fichas y nada lo pararía.
    const { s, admin, convertidos } = armar([
      lead({ id: 'sin-curso', accionFormacionId: null }),
    ]);

    const r = await s.convertir(['sin-curso'], 'ana', admin as never, AMBITO, REPARTE);

    expect(convertidos).toEqual([]);
    expect(r.problemas[0].porque).toMatch(/curso/i);
  });

  it('sin documento tampoco', async () => {
    const { s, admin, convertidos } = armar([
      lead({ id: 'sin-doc', numeroDocumento: null, tipoDocumentoSepId: null }),
    ]);

    await s.convertir(['sin-doc'], 'ana', admin as never, AMBITO, REPARTE);
    expect(convertidos).toEqual([]);
  });

  it('uno ya convertido no se vuelve a convertir', async () => {
    const { s, admin, convertidos } = armar([
      lead({ id: 'ya', estado: 'CONVERTIDO', participanteId: 'p-vieja' }),
    ]);

    const r = await s.convertir(['ya'], 'ana', admin as never, AMBITO, REPARTE);

    expect(convertidos).toEqual([]);
    expect(r.problemas[0].porque).toMatch(/atendió|atendio/i);
  });
});

describe('una fila mala no se lleva a las demás', () => {
  it('las otras entran igual, y se dice cuál falló', async () => {
    const { s, admin, convertidos } = armar(
      [lead({ id: 'a' }), lead({ id: 'b' }), lead({ id: 'c' })],
      (id) => id === 'b',
    );

    const r = await s.convertir(['a', 'b', 'c'], 'ana', admin as never, AMBITO, REPARTE);

    expect(convertidos).toEqual(['a', 'c']);
    expect({ convertidos: r.convertidos, fallaron: r.fallaron }).toEqual({
      convertidos: 2,
      fallaron: 1,
    });
    expect(r.problemas[0].leadId).toBe('b');
  });
});

describe('el mismo id dos veces es un intento, no dos', () => {
  it('se quitan los repetidos antes de empezar', async () => {
    /// El segundo chocaría con «este lead ya tiene ficha»: un
    /// error que no es del usuario y que ensucia el recuento.
    const { s, admin, convertidos } = armar([lead({ id: 'a' })]);

    const r = await s.convertir(['a', 'a', 'a'], 'ana', admin as never, AMBITO, REPARTE);

    expect(convertidos).toEqual(['a']);
    expect(r.pedidos).toBe(1);
  });
});

describe('el tope', () => {
  it('se rechaza un lote más grande que el tope, y se dice por qué', async () => {
    const { s, admin } = armar([]);
    const muchos = Array.from({ length: 101 }, (_, i) => 'l' + i);

    await expect(s.convertir(muchos, 'ana', admin as never, AMBITO, REPARTE)).rejects.toThrow(
      /hasta 100/,
    );
  });
});

describe('el asesor se elige, y tiene que poder ver las fichas', () => {
  it('un asesor que no trabaja en ese convenio NO recibe nada', async () => {
    /// Quedarían con dueño y sin nadie que las mire, y la brecha
    /// de nombres las contaría como atendidas.
    const { s, admin, convertidos } = armar([lead({ id: 'a' })]);

    await expect(
      s.convertir(['a'], 'ajeno', admin as never, AMBITO, REPARTE),
    ).rejects.toThrow(/convenio/i);

    /// Y NO se convierte ninguna: la comprobación va ANTES.
    expect(convertidos).toEqual([]);
  });

  it('se comprueba una vez por convenio, no una por ficha', async () => {
    /// Dentro del bucle serían cien consultas iguales.
    const { s, admin, comprobados } = armar([
      lead({ id: 'a' }),
      lead({ id: 'b' }),
      lead({ id: 'c' }),
    ]);

    await s.convertir(['a', 'b', 'c'], 'ana', admin as never, AMBITO, REPARTE);

    expect(comprobados).toEqual([['ana', 'c-adecopria']]);
  });
});

describe('quien reparte elige; quien no, se las queda', () => {
  it('un ASESOR no tiene que elegirse a si mismo', () => {
    /// Acaba de decidir que las atiende el. Pedirle que se elija
    /// en un desplegable es un paso que no decide nada.
    const { s, admin, comprobados } = armar([lead({ id: 'a' })]);

    return s
      .convertir(['a'], undefined, admin as never, AMBITO, NO_REPARTE)
      .then(() => {
        expect(comprobados).toEqual([['ana', 'c-adecopria']]);
      });
  });

  it('y aunque nombre a otro, se las queda EL', async () => {
    /// El candado importa mas que la comodidad: si un asesor
    /// pudiera asignarle fichas a otro por la API, la linea que
    /// separa atender de repartir seria un adorno.
    const { s, admin, comprobados } = armar([lead({ id: 'a' })]);

    await s.convertir(['a'], 'otro', admin as never, AMBITO, NO_REPARTE);

    expect(comprobados).toEqual([['ana', 'c-adecopria']]);
  });

  it('un LIDER sin elegir asesor no convierte nada', async () => {
    /// El no las atiende: reparte. Dejarle convertir sin elegir
    /// le asignaria cien fichas a alguien que no las va a llamar.
    const { s, admin, convertidos } = armar([lead({ id: 'a' })]);

    await expect(
      s.convertir(['a'], undefined, admin as never, AMBITO, REPARTE),
    ).rejects.toThrow(/asesor/i);

    expect(convertidos).toEqual([]);
  });
});
