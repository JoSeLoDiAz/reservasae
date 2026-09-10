/** A quién se puede llamar desde la mesa, y a quién no. */

/**
 * Lo que este spec sujeta son DOS cosas, y la segunda es la que
 * nadie escribe:
 *
 *   1. Que a quien REVOCÓ no se le llama.
 *   2. Que a quien TODAVÍA NO HA AUTORIZADO SÍ.
 *
 * La segunda protege del arreglo excesivo, que en este proyecto ya
 * ha hecho daño tres veces seguidas. Es facilísimo «endurecer»
 * esta regla exigiendo autorización para llamar — suena
 * prudente — y con eso se apaga la mesa entera: un lead recién
 * llegado nunca ha autorizado, y llamarlo es COMO SE CONSIGUE la
 * autorización.
 *
 * Se recorre la superficie y no el caso: los tres estados por las
 * dos situaciones, no los pares que se me ocurran. Es lo que hizo
 * falta cuando `escalera.spec` probaba pares elegidos a mano y por
 * eso no vio que `INSCRITO → EN_FORMACION` había quedado
 * imposible.
 */

import { porQueNoPuedoContactar, puedoContactar } from './puedo-contactar';

const EN_LA_MESA = { estado: 'PENDIENTE', participanteId: null };

describe('revocar cierra la puerta', () => {
  it('quien revocó no se puede contactar', () => {
    expect(puedoContactar({ ...EN_LA_MESA, revoco: true })).toBe('REVOCO');
  });

  it('y el motivo lo dice, para que el asesor no lo intente por otro lado', () => {
    const p = porQueNoPuedoContactar('REVOCO');
    expect(p).toMatch(/revocó/i);
  });
});

describe('NO haber autorizado todavía NO cierra nada', () => {
  /// EL ASERTO QUE PROTEGE DEL ARREGLO EXCESIVO.
  ///
  /// Sin esto, alguien «arregla» la regla exigiendo autorización
  /// para llamar y apaga la mesa entera sin que ninguna prueba se
  /// queje.
  it('un lead recién llegado, sin ninguna autorización, SÍ se llama', () => {
    expect(puedoContactar({ ...EN_LA_MESA, revoco: false })).toBe('SI');
  });

  it('y no hay motivo que dar, porque no hay nada que impedir', () => {
    expect(porQueNoPuedoContactar('SI')).toBeNull();
  });
});

describe('lo que ya salió de la mesa se gestiona en su ficha', () => {
  /// La superficie entera: los dos caminos por los que un lead
  /// deja de estar en la mesa, cada uno por su cuenta.
  const FUERA = [
    { que: 'ya tiene ficha', lead: { estado: 'PENDIENTE', participanteId: 'p1' } },
    { que: 'está convertido', lead: { estado: 'CONVERTIDO', participanteId: null } },
    { que: 'está descartado', lead: { estado: 'DESCARTADO', participanteId: null } },
  ];

  it.each(FUERA)('$que → no se gestiona aquí', ({ lead }) => {
    expect(puedoContactar({ ...lead, revoco: false })).toBe('YA_NO_ESTA_EN_LA_MESA');
  });

  it('y eso manda sobre la revocación, porque saca de la mesa antes', () => {
    /// El orden importa: si se juzgara primero la revocación, un
    /// lead ya convertido cuya persona revocó diría «REVOCO» y el
    /// asesor buscaría en la mesa algo que está en la ficha.
    expect(
      puedoContactar({ estado: 'CONVERTIDO', participanteId: 'p1', revoco: true }),
    ).toBe('YA_NO_ESTA_EN_LA_MESA');
  });
});

describe('los tres estados tienen su frase', () => {
  it('ninguno se queda sin explicación', () => {
    /// Un botón apagado que no dice por qué es un lead que
    /// alguien va a dar por perdido. Se recorre el enum entero
    /// para que añadir un estado obligue a escribir su frase.
    const TODOS = ['SI', 'REVOCO', 'YA_NO_ESTA_EN_LA_MESA'] as const;
    for (const e of TODOS) {
      const frase = porQueNoPuedoContactar(e);
      if (e === 'SI') expect(frase).toBeNull();
      else expect(frase && frase.length > 20).toBe(true);
    }
  });
});
