/** La cédula es la llave, y por eso hay que normalizarla. */

/**
 * Lo que este spec protege es la idempotencia. Si dos envíos del
 * MISMO lead dan llaves distintas, el reintento crea una segunda
 * persona — y como `Persona` es única por documento, acaba en un
 * error de base o en dos fichas que nadie relaciona.
 */

import { llaveDelLead } from './llave-del-lead';

type Entrada = {
  externoId?: string | null;
  tipoDocumentoSepId?: number | null;
  numeroDocumento?: string | null;
};

const llave = (dto: Entrada) => {
  const r = llaveDelLead(dto);
  return 'llave' in r ? r.llave : null;
};

/** El motivo, cuando no hay llave. */
const porQueNo = (dto: Entrada) => {
  const r = llaveDelLead(dto);
  return 'falta' in r ? r.falta : null;
};

describe('el documento es la llave', () => {
  it('con tipo y número sale una llave estable', () => {
    expect(llave({ tipoDocumentoSepId: 1, numeroDocumento: '1020304050' })).toBe(
      'doc:1-1020304050',
    );
  });

  it('la misma cédula escrita de seis formas da LA MISMA llave', () => {
    /// Es la razón de ser del módulo. Sin normalizar,
    /// `1.020.304.050` y `1020304050` serían dos leads.
    const formas = [
      '1020304050',
      '1.020.304.050',
      '1 020 304 050',
      ' 1020304050 ',
      '1-020-304-050',
      '1_020_304_050',
    ];
    const salidas = new Set(
      formas.map((n) => llave({ tipoDocumentoSepId: 1, numeroDocumento: n })),
    );

    expect({ formas: formas.length, distintas: salidas.size }).toEqual({
      formas: formas.length,
      distintas: 1,
    });
  });

  it('el TIPO también cuenta: dos documentos con el mismo número', () => {
    /// Una cédula 123456 y un pasaporte 123456 no son la misma
    /// persona. `Persona` es única por el par, y la llave
    /// también.
    expect(llave({ tipoDocumentoSepId: 1, numeroDocumento: '123456' })).not.toBe(
      llave({ tipoDocumentoSepId: 4, numeroDocumento: '123456' }),
    );
  });
});

describe('si el emisor trae su propio id, manda ese', () => {
  it('el externoId gana al documento', () => {
    /// Quien ya tiene un id estable no debería perderlo: es más
    /// firme que el documento, porque el documento puede llegar
    /// mal tecleado.
    expect(
      llave({
        externoId: 'meta-8891726354',
        tipoDocumentoSepId: 1,
        numeroDocumento: '1020304050',
      }),
    ).toBe('meta-8891726354');
  });

  it('un externoId en blanco no cuenta como id', () => {
    for (const vacio of ['', '   ', null, undefined]) {
      expect(
        llave({
          externoId: vacio,
          tipoDocumentoSepId: 1,
          numeroDocumento: '1020304050',
        }),
      ).toBe('doc:1-1020304050');
    }
  });
});

describe('el prefijo `doc:` evita que las dos llaves choquen', () => {
  it('un externoId igual al número NO es la misma llave', () => {
    /// Sin prefijo, un emisor que usara la cédula de externoId
    /// chocaría con el lead derivado de esa misma cédula, y uno
    /// se comería al otro.
    expect(llave({ externoId: '1020304050' })).not.toBe(
      llave({ tipoDocumentoSepId: 1, numeroDocumento: '1020304050' }),
    );
  });
});

describe('sin ninguna de las dos NO se guarda', () => {
  it('sin documento y sin externoId, se dice qué falta', () => {
    const motivo = porQueNo({});
    expect(motivo).not.toBeNull();
    expect(motivo).toMatch(/documento/i);
    expect(motivo).toMatch(/externoId/);
  });

  it('con el número pero sin el tipo, tampoco', () => {
    /// Media llave no es una llave: el mismo número puede ser
    /// una cédula o un pasaporte.
    expect('falta' in llaveDelLead({ numeroDocumento: '1020304050' })).toBe(true);
  });

  it('con un documento que no tiene forma de documento, tampoco', () => {
    /// `normalizarDocumento` devuelve null y no una cadena rara:
    /// una llave inventada sobre basura deduplica basura.
    for (const malo of ['', '  ', '...', '12']) {
      expect(
        'falta' in llaveDelLead({ tipoDocumentoSepId: 1, numeroDocumento: malo }),
      ).toBe(true);
    }
  });

  it('y el mensaje dice cómo arreglarlo, no solo que falló', () => {
    expect(porQueNo({})).toMatch(/reintento/i);
  });
});
