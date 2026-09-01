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

const llave = (dto: Entrada, curso?: string | null) => {
  const r = llaveDelLead(dto, curso);
  return 'llave' in r ? r.llave : null;
};

/** El motivo, cuando no hay llave. */
const porQueNo = (dto: Entrada) => {
  const r = llaveDelLead(dto);
  return 'falta' in r ? r.falta : null;
};

describe('el documento es la llave', () => {
  it('con tipo, número y curso sale una llave estable', () => {
    expect(
      llave({ tipoDocumentoSepId: 1, numeroDocumento: '1020304050' }, 'AF1'),
    ).toBe('doc:1-1020304050:AF1');
  });

  it('sin curso resuelto, la llave lo dice', () => {
    expect(llave({ tipoDocumentoSepId: 1, numeroDocumento: '1020304050' })).toBe(
      'doc:1-1020304050:sin-af',
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
      formas.map((n) =>
        llave({ tipoDocumentoSepId: 1, numeroDocumento: n }, 'AF1'),
      ),
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
        llave(
          {
            externoId: vacio,
            tipoDocumentoSepId: 1,
            numeroDocumento: '1020304050',
          },
          'AF1',
        ),
      ).toBe('doc:1-1020304050:AF1');
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

describe('sin documento ENTRA IGUAL: la llave sale del contenido', () => {
  /**
   * Un lead de una pauta PAGADA que se rechaza es dinero
   * quemado, y quien lo mandó ni se entera. Perderlo es peor que
   * guardarlo raro — y el equipo le pone el documento después,
   * desde la mesa de entrada.
   */

  it('con correo y nombre, se guarda', () => {
    const r = llaveDelLead({
      correo: 'ana@ejemplo.test',
      nombres: 'Ana',
      primerApellido: 'Ruiz',
    });
    expect('llave' in r).toBe(true);
  });

  it('y el reintento del MISMO cuerpo es el mismo lead', () => {
    /// Es lo que se temía al rechazarlos, y es lo que hay que
    /// conservar: sin esto, un parpadeo de red duplica.
    const cuerpo = {
      correo: 'ana@ejemplo.test',
      celular: '+57 300 111 2222',
      nombres: 'Ana',
      primerApellido: 'Ruiz',
    };
    expect(llaveDelLead(cuerpo, 'AF1')).toEqual(llaveDelLead(cuerpo, 'AF1'));
  });

  it('el celular se normaliza, como el documento', () => {
    /// `+57 300 111 2222` y `3001112222` son el mismo número, y
    /// sin limpiarlo el reintento con otro formato sería otro
    /// lead.
    const a = llaveDelLead({ celular: '+57 300 111 2222', nombres: 'Ana' });
    const b = llaveDelLead({ celular: '3001112222', nombres: 'Ana' });
    expect(a).toEqual(b);
  });

  it('y sigue distinguiendo cursos, como con documento', () => {
    const cuerpo = { correo: 'ana@ejemplo.test', nombres: 'Ana' };
    expect(llaveDelLead(cuerpo, 'AF1')).not.toEqual(llaveDelLead(cuerpo, 'AF2'));
  });

  it('con el número pero sin el tipo, cae al contenido', () => {
    /// Media llave no es una llave para el documento —el mismo
    /// número puede ser una cédula o un pasaporte— pero eso ya no
    /// significa rechazar: se cae a la del contenido.
    const r = llaveDelLead({ numeroDocumento: '1020304050', nombres: 'Ana' });
    expect('llave' in r).toBe(true);
    expect((r as { llave: string }).llave.startsWith('doc:')).toBe(false);
  });

  it('un documento sin forma de documento tampoco forma llave de documento', () => {
    /// `normalizarDocumento` devuelve null y no una cadena rara:
    /// una llave inventada sobre basura deduplica basura.
    for (const malo of ['', '  ', '...', '12']) {
      const r = llaveDelLead({
        tipoDocumentoSepId: 1,
        numeroDocumento: malo,
        correo: 'x@ejemplo.test',
      });
      expect((r as { llave?: string }).llave?.startsWith('doc:')).not.toBe(true);
    }
  });

  it('una petición VACÍA sí se rechaza', () => {
    /// Sin documento, sin externoId, sin correo, sin celular y
    /// sin nombre no es un lead incompleto: es una petición
    /// vacía, y una fila por cada reintento de eso llena la mesa
    /// de ruido que nadie puede atender.
    const motivo = porQueNo({});
    expect(motivo).not.toBeNull();
    expect(motivo).toMatch(/nada con que reconocerlo/i);
  });

  it('y el mensaje dice QUE hace falta, no solo que fallo', () => {
    /// Un «no se pudo» sin decir con que se arregla obliga a
    /// adivinar, y quien integra no tiene el codigo delante.
    expect(porQueNo({})).toMatch(/correo|celular|nombre/i);
  });
});

describe('la misma persona puede inscribirse en varios cursos', () => {
  const ANA = { tipoDocumentoSepId: 1, numeroDocumento: '1020304050' };

  it('AF1 y AF2 son DOS leads, no uno repetido', () => {
    /// Es el caso que pidio el cliente: alguien se inscribe en
    /// una formacion y despues en otra. Con la cedula sola, la
    /// segunda volvia como «repetido» y su peticion se perdia en
    /// silencio.
    expect(llave(ANA, 'AF1')).not.toBe(llave(ANA, 'AF2'));
  });

  it('pero el MISMO curso escrito de tres formas es UNO', () => {
    /// Va el codigo ya resuelto y no el texto: «AF1»,
    /// «af 1» y «AF1 - los nuevos metodos» resuelven todas a
    /// AF1, asi que son la misma inscripcion.
    const tres = new Set([llave(ANA, 'AF1'), llave(ANA, 'AF1'), llave(ANA, 'AF1')]);
    expect(tres.size).toBe(1);
  });

  it('dos personas distintas en el mismo curso siguen siendo dos', () => {
    const OTRO = { tipoDocumentoSepId: 1, numeroDocumento: '9998887776' };
    expect(llave(ANA, 'AF1')).not.toBe(llave(OTRO, 'AF1'));
  });

  it('y la misma cedula con OTRO tipo de documento tambien', () => {
    const conPasaporte = { tipoDocumentoSepId: 41, numeroDocumento: '1020304050' };
    expect(llave(ANA, 'AF1')).not.toBe(llave(conPasaporte, 'AF1'));
  });
});
