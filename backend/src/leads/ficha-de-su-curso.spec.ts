/** El lead se ata a la ficha de SU curso, no a una cualquiera. */

/**
 * Hay una ficha POR CURSO —`@@unique([accionFormacionId,
 * personaId])`— y el cruce las buscaba con `findFirst` sin
 * `orderBy`.
 *
 * Mientras `LeadEntrante.participanteId` era `@unique` daba
 * igual: el segundo lead de esa persona reventaba antes de llegar
 * aquí. Al quitar ese índice —migración 09— el azar de Postgres
 * pasó a decidir a qué ficha se ata el lead.
 *
 * Quien ya está en AF1 y pide AF5 por un anuncio caía en la de
 * AF1, y a esa ficha equivocada le llegaban el toque de pauta, el
 * origen del lead y la propuesta de datos. Lo encontró Mauricio
 * Andrés revisando la migración que él mismo pidió aplicar.
 *
 * El doble ELIGE de verdad sobre una lista, con los mismos
 * filtros que manda el servicio. Uno que devolviera siempre la
 * primera probaría el doble, no el candado.
 */

import { cruzarConElCrm } from './cruzar-con-el-crm';

type FichaFalsa = {
  id: string;
  personaId: string;
  convenioId: string;
  accionFormacionId: string | null;
  creadoEn: Date;
  /// Los de SU persona, para que el doble pueda filtrar por
  /// ellos igual que hace Prisma. Sin esto, los casos de correo
  /// y celular pasarían sin probar nada.
  correo?: string | null;
  celular?: string | null;
};

function armar(fichas: FichaFalsa[]) {
  const prisma = {
    participante: {
      findFirst: (a: {
        where: Record<string, unknown>;
        orderBy?: { creadoEn?: 'asc' | 'desc' };
      }) => {
        const w = a.where;
        let hay = fichas.filter((f) => f.convenioId === w.convenioId);

        /// Los filtros de la PERSONA, que es por lo que busca
        /// cada rama. Sin esto el doble ignoraría el correo y el
        /// celular, y los tests de esas dos ramas pasarían sin
        /// probar nada -- el defecto que este proyecto lleva
        /// documentado: un doble que decide por otra cosa que el
        /// filtro real prueba el doble.
        const per = w.persona as
          | { correo?: string; celular?: string; numeroDocumento?: string }
          | undefined;
        if (per?.correo !== undefined) {
          hay = hay.filter((f) => f.correo === per.correo);
        }
        if (per?.celular !== undefined) {
          hay = hay.filter((f) => f.celular === per.celular);
        }

        /// El filtro por curso, cuando el servicio lo manda.
        if (w.accionFormacionId !== undefined) {
          hay = hay.filter((f) => f.accionFormacionId === w.accionFormacionId);
        }

        /// El orden, cuando lo pide.
        if (a.orderBy?.creadoEn === 'desc') {
          hay = [...hay].sort((x, y) => +y.creadoEn - +x.creadoEn);
        }

        return Promise.resolve(hay[0] ?? null);
      },
    },
  };
  return prisma;
}

const LLAVES = {
  tipoDocumentoSepId: 1,
  numeroDocumento: '1020304050',
  correo: null,
  celular: null,
};

/// Dos fichas de la misma persona: AF1 es la MÁS VIEJA.
const DOS: FichaFalsa[] = [
  {
    id: 'ficha-af1',
    personaId: 'per-1',
    convenioId: 'c-1',
    accionFormacionId: 'af1',
    creadoEn: new Date('2026-01-01'),
    correo: 'casa@x.test',
    celular: '3001112222',
  },
  {
    id: 'ficha-af5',
    personaId: 'per-1',
    convenioId: 'c-1',
    accionFormacionId: 'af5',
    creadoEn: new Date('2026-06-01'),
    correo: 'casa@x.test',
    celular: '3001112222',
  },
];

describe('pide un curso que ya tiene: se ata a ESA ficha', () => {
  it('pide AF5 y cae en la de AF5, no en la de AF1', async () => {
    const r = await cruzarConElCrm(armar(DOS) as never, 'c-1', {
      ...LLAVES,
      accionFormacionId: 'af5',
    });
    expect(r?.participanteId).toBe('ficha-af5');
  });

  it('y pide AF1 y cae en la de AF1', async () => {
    /// Los dos sentidos: si solo se comprobara uno, un doble que
    /// devolviera siempre la primera pasaría la mitad de las
    /// veces.
    const r = await cruzarConElCrm(armar(DOS) as never, 'c-1', {
      ...LLAVES,
      accionFormacionId: 'af1',
    });
    expect(r?.participanteId).toBe('ficha-af1');
  });
});

describe('pide un curso que NO tiene: la más reciente', () => {
  it('pide AF9 y cae en la última que abrió, no en la primera', async () => {
    /// No es arbitrario aunque lo parezca: lo que está haciendo
    /// es nuevo, y la ficha que mejor lo representa es la última.
    /// Lo que no puede ser es «la que devuelva el motor».
    const r = await cruzarConElCrm(armar(DOS) as never, 'c-1', {
      ...LLAVES,
      accionFormacionId: 'af9',
    });
    expect(r?.participanteId).toBe('ficha-af5');
  });

  it('sin curso reconocido, también la más reciente', async () => {
    const r = await cruzarConElCrm(armar(DOS) as never, 'c-1', {
      ...LLAVES,
      accionFormacionId: null,
    });
    expect(r?.participanteId).toBe('ficha-af5');
  });
});

describe('sigue sin salirse del convenio', () => {
  it('una ficha del otro gremio no se elige, ni con el mismo curso', async () => {
    const ajena: FichaFalsa[] = [
      {
        id: 'de-britcham',
        personaId: 'per-1',
        convenioId: 'c-2',
        accionFormacionId: 'af5',
        creadoEn: new Date('2026-06-01'),
      },
    ];

    const r = await cruzarConElCrm(armar(ajena) as never, 'c-1', {
      ...LLAVES,
      accionFormacionId: 'af5',
    });
    expect(r).toBeNull();
  });
});

describe('las OTRAS dos ramas también eligen, no cogen cualquiera', () => {
  /**
   * La primera versión solo pasaba por `elegirFicha` la rama del
   * documento. Y ahí importa MENOS que en estas: por documento
   * salen las fichas de UNA persona; por correo salen las de
   * VARIAS —la secretaria que puso el suyo en veinte
   * formularios—, que es el caso del que avisa el comentario del
   * propio fichero.
   *
   * Lo completó Mauricio Andrés barriendo el patrón por todo el
   * backend.
   */

  const POR_CORREO = { ...LLAVES, numeroDocumento: null, correo: 'casa@x.test' };

  it('por CORREO elige la ficha de su curso', async () => {
    const r = await cruzarConElCrm(armar(DOS) as never, 'c-1', {
      ...POR_CORREO,
      tipoDocumentoSepId: null,
      accionFormacionId: 'af5',
    });
    expect(r?.participanteId).toBe('ficha-af5');
    /// Y sigue diciendo que la coincidencia NO es firme.
    expect(r?.firme).toBe(false);
  });

  it('por CELULAR también', async () => {
    const r = await cruzarConElCrm(armar(DOS) as never, 'c-1', {
      ...LLAVES,
      tipoDocumentoSepId: null,
      numeroDocumento: null,
      correo: null,
      celular: '3001112222',
      accionFormacionId: 'af1',
    });
    expect(r?.participanteId).toBe('ficha-af1');
    expect(r?.firme).toBe(false);
  });

  it('y sin curso, la más reciente, no la que salga', async () => {
    const r = await cruzarConElCrm(armar(DOS) as never, 'c-1', {
      ...POR_CORREO,
      tipoDocumentoSepId: null,
      accionFormacionId: null,
    });
    expect(r?.participanteId).toBe('ficha-af5');
  });
});
