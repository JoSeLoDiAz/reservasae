/** Cerrar el lead de quien se inscribió sola, y solo el suyo. */

/**
 * El cruce funcionaba en un solo sentido: si el lead llegaba
 * DESPUÉS lo ataba `cruzar-con-el-crm`; si llegaba ANTES se
 * quedaba en «Sin atender» para siempre y un asesor acababa
 * llamándola para ofrecerle un curso en el que ya estaba.
 *
 * Lo que este spec protege de verdad no es que cierre: es que
 * cierre SOLO EL SUYO. Esto corre solo, sin nadie mirando, así
 * que un cruce de más une a dos personas sin que nadie se entere.
 */

import { cerrarLeadsQueEsperaban } from './leads-que-esperaban';

type LeadFalso = {
  id: string;
  convenioId: string;
  estado: string;
  participanteId: string | null;
  tipoDocumentoSepId: number | null;
  numeroDocumento: string | null;
  correo?: string | null;
  celular?: string | null;
  origen: string;
  origenSistema: string;
};

function lead(p: Partial<LeadFalso> & { id: string }): LeadFalso {
  return {
    convenioId: 'c-adecopria',
    estado: 'PENDIENTE',
    participanteId: null,
    tipoDocumentoSepId: 1,
    numeroDocumento: '1020304050',
    origen: 'FACEBOOK',
    origenSistema: 'meta',
    ...p,
  };
}

function armar(leads: LeadFalso[]) {
  const cerrados: string[] = [];
  const toques: string[] = [];

  const tx = {
    leadEntrante: {
      /// El doble FILTRA de verdad, con las mismas claves que
      /// manda el servicio. Uno que devolviera la lista entera
      /// probaría el doble, no el candado.
      findMany: (a: { where: Record<string, unknown> }) => {
        const w = a.where;
        return Promise.resolve(
          leads.filter(
            (l) =>
              l.convenioId === w.convenioId &&
              l.estado === w.estado &&
              l.participanteId === w.participanteId &&
              l.tipoDocumentoSepId === w.tipoDocumentoSepId &&
              l.numeroDocumento === w.numeroDocumento,
          ),
        );
      },
      updateMany: (a: { where: { id: { in?: string[] } | string } }) => {
        const id = a.where.id;
        const ids = typeof id === 'string' ? [id] : (id.in ?? []);
        cerrados.push(...ids);
        return Promise.resolve({ count: ids.length });
      },
    },
    toqueDeOrigen: {
      upsert: (a: { create: { origen: string } }) => {
        toques.push(a.create.origen);
        return Promise.resolve({});
      },
    },
  };

  return { tx, cerrados, toques };
}

const QUIEN = {
  participanteId: 'p-1',
  convenioId: 'c-adecopria',
  tipoDocumentoSepId: 1,
  numeroDocumento: '1020304050',
};

describe('cierra el lead que la esperaba', () => {
  it('con el mismo documento, lo ata a su ficha', async () => {
    const { tx, cerrados } = armar([lead({ id: 'suyo' })]);
    const n = await cerrarLeadsQueEsperaban(tx as never, QUIEN);

    expect(n).toBe(1);
    expect(cerrados).toEqual(['suyo']);
  });

  it('y cierra TODOS los suyos, no solo uno', async () => {
    /// Pudo llegar por Instagram y por Facebook. Cerrar uno y
    /// dejar el otro pendiente deja media verdad en la mesa.
    const { tx, cerrados } = armar([
      lead({ id: 'ig', origen: 'INSTAGRAM' }),
      lead({ id: 'fb', origen: 'FACEBOOK' }),
    ]);

    const n = await cerrarLeadsQueEsperaban(tx as never, QUIEN);

    expect(n).toBe(2);
    expect(cerrados.sort()).toEqual(['fb', 'ig']);
  });

  it('la pauta se lleva su crédito, aunque se inscribiera sola', async () => {
    /// La trajo el anuncio. Sin el toque, la campaña que funcionó
    /// parece no haber funcionado.
    const { tx, toques } = armar([
      lead({ id: 'ig', origen: 'INSTAGRAM' }),
      lead({ id: 'fb', origen: 'FACEBOOK' }),
    ]);

    await cerrarLeadsQueEsperaban(tx as never, QUIEN);

    expect(toques.sort()).toEqual(['FACEBOOK', 'INSTAGRAM']);
  });
});

describe('y NO cierra el de nadie más', () => {
  it('otro documento no se toca', async () => {
    const { tx, cerrados } = armar([
      lead({ id: 'ajeno', numeroDocumento: '9999999999' }),
    ]);

    expect(await cerrarLeadsQueEsperaban(tx as never, QUIEN)).toBe(0);
    expect(cerrados).toEqual([]);
  });

  it('el mismo número con OTRO tipo de documento tampoco', async () => {
    /// El mismo número puede ser una cédula y un pasaporte, y son
    /// dos personas distintas.
    const { tx, cerrados } = armar([lead({ id: 'otro', tipoDocumentoSepId: 41 })]);

    expect(await cerrarLeadsQueEsperaban(tx as never, QUIEN)).toBe(0);
    expect(cerrados).toEqual([]);
  });

  it('un lead del otro gremio no se toca', async () => {
    const { tx, cerrados } = armar([
      lead({ id: 'britcham', convenioId: 'c-britcham' }),
    ]);

    expect(await cerrarLeadsQueEsperaban(tx as never, QUIEN)).toBe(0);
    expect(cerrados).toEqual([]);
  });

  it('uno ya convertido no se vuelve a tocar', async () => {
    const { tx, cerrados } = armar([
      lead({ id: 'ya', estado: 'CONVERTIDO', participanteId: 'p-vieja' }),
    ]);

    expect(await cerrarLeadsQueEsperaban(tx as never, QUIEN)).toBe(0);
    expect(cerrados).toEqual([]);
  });

  it('NO cruza por correo ni por celular, aunque coincidan', async () => {
    /// Este es el candado que importa. El cruce hacia atrás sí
    /// usa correo y celular, pero ahí hay un asesor que confirma.
    /// Aquí no mira nadie: una familia que comparte buzón
    /// acabaría con el lead de la madre cerrado por la
    /// inscripción de la hija.
    const { tx, cerrados } = armar([
      lead({
        id: 'mismo-correo',
        numeroDocumento: '7777777777',
        correo: 'casa@ejemplo.test',
        celular: '3001112222',
      }),
    ]);

    expect(await cerrarLeadsQueEsperaban(tx as never, QUIEN)).toBe(0);
    expect(cerrados).toEqual([]);
  });
});
