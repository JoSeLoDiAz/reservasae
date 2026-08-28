/** Revocar y no haber autorizado nunca no son lo mismo. */

/**
 * Los dos casos se omiten igual —y hacen bien: sin autorización
 * no se le escribe a nadie—, pero el MOTIVO se guarda en la fila
 * de por qué no salió el correo, y alguien lo va a leer y se lo
 * va a tener que explicar a otro.
 *
 * Decirle «revocó» a quien nunca autorizó es dejar por escrito
 * algo que no pasó. Y es el caso más común, no el raro: el
 * asesor crea la ficha y la autorización se registra después.
 *
 * Es el mismo defecto que tuvo el candado del RUI, que
 * preguntaba «¿tiene alguna viva?» y con eso apagaba el RUI para
 * todos los leads recién creados.
 */

import {
  estadoDeAutorizacion,
  noSeLePuedeEscribir,
  porQueNoSeLeMando,
} from './autorizacion-vigente';

/** Un Prisma con las autorizaciones que se le digan. */
function conAutorizaciones(suyas: Array<{ revocadaEn: Date | null }> | null) {
  return {
    participante: {
      findUnique: () =>
        Promise.resolve(
          suyas === null ? null : { personaId: 'per1', convenioId: 'c1' },
        ),
    },
    autorizacionDatos: { findMany: () => Promise.resolve(suyas ?? []) },
  } as never;
}

const AYER = new Date('2026-08-27');

describe('los cuatro estados', () => {
  it('con una viva, VIVA', async () => {
    const e = await estadoDeAutorizacion(
      conAutorizaciones([{ revocadaEn: null }]),
      'p1',
    );
    expect(e).toBe('VIVA');
  });

  it('con todas revocadas, REVOCADA', async () => {
    const e = await estadoDeAutorizacion(
      conAutorizaciones([{ revocadaEn: AYER }, { revocadaEn: AYER }]),
      'p1',
    );
    expect(e).toBe('REVOCADA');
  });

  it('sin ninguna, NUNCA — que NO es revocada', async () => {
    /// El caso más común: ficha recién creada por el asesor.
    const e = await estadoDeAutorizacion(conAutorizaciones([]), 'p1');
    expect(e).toBe('NUNCA');
  });

  it('sin ficha, SIN_FICHA', async () => {
    /// Los correos de una base subida: no hay a quién mirarle
    /// la autorización.
    expect(await estadoDeAutorizacion(conAutorizaciones([]), null)).toBe(
      'SIN_FICHA',
    );
    expect(await estadoDeAutorizacion(conAutorizaciones(null), 'p1')).toBe(
      'SIN_FICHA',
    );
  });

  it('una viva entre varias revocadas basta', async () => {
    const e = await estadoDeAutorizacion(
      conAutorizaciones([{ revocadaEn: AYER }, { revocadaEn: null }]),
      'p1',
    );
    expect(e).toBe('VIVA');
  });
});

describe('a quién no se le escribe', () => {
  it('a quien revocó y a quien nunca autorizó', () => {
    expect(noSeLePuedeEscribir('REVOCADA')).toBe(true);
    expect(noSeLePuedeEscribir('NUNCA')).toBe(true);
  });

  it('a quien la tiene viva, sí', () => {
    expect(noSeLePuedeEscribir('VIVA')).toBe(false);
  });

  it('sin ficha NO se bloquea: es otra conversación', () => {
    /// Una base subida son correos sueltos; exigirles una
    /// autorización que nunca hubo dejaría las campañas de base
    /// sin poder mandarse nunca.
    expect(noSeLePuedeEscribir('SIN_FICHA')).toBe(false);
  });
});

describe('el motivo que queda escrito es verdad', () => {
  it('a quien revocó se le dice que revocó', () => {
    expect(porQueNoSeLeMando('REVOCADA')).toMatch(/revoc/i);
  });

  it('a quien NUNCA autorizó NO se le dice que revocó', () => {
    /// Esta es la aserción que importa: era el motivo falso.
    const m = porQueNoSeLeMando('NUNCA');
    expect(m).not.toMatch(/revoc/i);
    expect(m).toMatch(/no ha autorizado/i);
  });
});
