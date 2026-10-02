/** Un asesor coge un lead libre, y nada más. */

/**
 * La rendija que abrió Josse el 2 oct 2026, después de que el equipo
 * reportara que «no deja asignar leads a asesores».
 *
 * Lo que este spec protege son las DOS mitades de la decisión, que es
 * lo que la hace una rendija y no una puerta abierta: que un gestor
 * PUEDA coger uno libre, y que NO pueda nada más. Con solo la primera
 * mitad probada, alguien «simplifica» el candado y vuelve lo que la
 * regla de `REPARTEN_FICHAS` existe para impedir: «cualquiera podía
 * pasarle sus fichas a otro ---o quitárselas».
 */

import {
  motivoParaNoTocarElAsesor,
  puedeCogerlo,
  type QuienTocaElAsesor,
} from './coger-un-lead';

/// El caso del equipo: gestor de inscripciones. Lleva fichas y no
/// reparte.
const GESTOR: QuienTocaElAsesor = {
  adminId: 'yo',
  reparte: false,
  llevaFichas: true,
};

/// Quien responde por el equipo.
const LIDER: QuienTocaElAsesor = {
  adminId: 'jefa',
  reparte: true,
  llevaFichas: true,
};

/// Ve el CRM pero no se queda con leads.
const ACADEMICO: QuienTocaElAsesor = {
  adminId: 'otro',
  reparte: false,
  llevaFichas: false,
};

describe('el asesor coge uno libre', () => {
  it('un gestor se queda con un lead que no es de nadie', () => {
    expect(
      motivoParaNoTocarElAsesor({
        quien: GESTOR,
        asesorAhora: null,
        asesorPedido: 'yo',
      }),
    ).toBeNull();
  });

  it('y `puedeCogerlo` lo dice sin tener que armar la llamada', () => {
    expect(puedeCogerlo({ quien: GESTOR, asesorAhora: null })).toBe(true);
    expect(puedeCogerlo({ quien: GESTOR, asesorAhora: 'jefa' })).toBe(false);
  });
});

describe('y nada más: las tres cosas que sigue sin poder', () => {
  /// Esto es lo que la regla de REPARTEN_FICHAS protege, con las
  /// palabras de su propio docblock.
  it('no se lo puede quitar a otro', () => {
    const motivo = motivoParaNoTocarElAsesor({
      quien: GESTOR,
      asesorAhora: 'otra-persona',
      asesorPedido: 'yo',
    });

    expect(motivo).toMatch(/ya tiene asesor/i);
  });

  it('no se lo puede dar a un tercero, ni estando libre', () => {
    const motivo = motivoParaNoTocarElAsesor({
      quien: GESTOR,
      asesorAhora: null,
      asesorPedido: 'un-tercero',
    });

    expect(motivo).toMatch(/para usted/i);
  });

  /// Soltar saca el lead de la lista de quien responde por él sin que
  /// nadie lo decida.
  it('no puede soltar el suyo', () => {
    const motivo = motivoParaNoTocarElAsesor({
      quien: GESTOR,
      asesorAhora: 'yo',
      asesorPedido: null,
    });

    expect(motivo).toMatch(/soltar/i);
  });
});

describe('quien no lleva fichas no coge ninguna', () => {
  it('un académico no se queda con un lead libre', () => {
    const motivo = motivoParaNoTocarElAsesor({
      quien: ACADEMICO,
      asesorAhora: null,
      asesorPedido: 'otro',
    });

    expect(motivo).toMatch(/no se queda con leads/i);
  });
});

describe('quien reparte sigue repartiendo', () => {
  /// Las tres que el gestor no puede, el líder sí: es la regla vieja,
  /// y comprobarla aquí es lo que impide que la rendija nueva se la
  /// coma sin que nadie lo note.
  it('pone, cambia y quita', () => {
    const casos: Array<[string | null, string | null]> = [
      [null, 'quien-sea'],
      ['otra-persona', 'quien-sea'],
      ['otra-persona', null],
    ];

    const negados = casos.filter(
      ([ahora, pedido]) =>
        motivoParaNoTocarElAsesor({
          quien: LIDER,
          asesorAhora: ahora,
          asesorPedido: pedido,
        }) !== null,
    );

    expect(negados).toEqual([]);
  });
});
