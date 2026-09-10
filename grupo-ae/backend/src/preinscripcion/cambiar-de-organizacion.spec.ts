/** Corregirse de organización sí se puede; que la nominó una empresa, no. */

/**
 * El defecto, visto en producción:
 *
 *     const suya = p.reserva?.empresaId ?? p.empresaId ?? null;
 *
 * El comentario decía «la de la reserva manda y no se cambia: la
 * nominó ella», y eso es cierto del PRIMER término. El segundo
 * no es una nominación: es la respuesta anterior de la propia
 * persona, y corregirla es justo para lo que existe el enlace.
 *
 * Con los dos en el mismo `??`, quien volvía diciendo «me
 * equivoqué, trabajo en Vise LTDA» reescribía la organización
 * VIEJA con los datos de la nueva. Y como el NIT y la razón
 * social no viajan en `datos`, quedaba una fila imposible: el
 * NIT y el nombre de la primera con la persona de contacto de la
 * segunda. La organización nueva no llegaba a crearse.
 *
 * Lo que se fija aquí es la DECISIÓN —a qué organización se ata
 * la ficha— y no el `update` que viene después: es donde estaba
 * el error y donde volvería a estar.
 */

import { aQueOrganizacionSeAta } from './organizacion-de-la-ficha';

const VISE = '860507033';
const SU_CEDULA = '1026300012';

describe('la que la nominó no se toca', () => {
  it('aunque escriba otro NIT, se queda con la de la reserva', () => {
    /// La empresa apartó el cupo y puso su nombre. Que la
    /// persona escriba otro NIT no le quita la silla a quien la
    /// pagó, ni cambia a quién se le reporta.
    const r = aQueOrganizacionSeAta({
      nominadaPorReserva: 'emp-de-la-reserva',
      suyaAhora: { id: 'emp-de-la-reserva', nit: '90152555' },
      nitQueDice: VISE,
    });

    expect(r.atar).toBe('emp-de-la-reserva');
    expect(r.cambia).toBe(false);
  });
});

describe('la suya propia sí se corrige', () => {
  it('un NIT distinto la desata para que se cree la nueva', () => {
    /// `null` es la señal de «cae en la rama del NIT», que hace
    /// upsert por NIT y vuelve a atar la ficha. Devolver la
    /// vieja es lo que producía la fila Frankenstein.
    const r = aQueOrganizacionSeAta({
      nominadaPorReserva: null,
      suyaAhora: { id: 'emp-vieja', nit: SU_CEDULA },
      nitQueDice: VISE,
    });

    expect(r.atar).toBeNull();
    expect(r.cambia).toBe(true);
  });

  it('el MISMO NIT no es un cambio: se actualiza la que ya está', () => {
    /// Corregir el teléfono de su empresa no puede crear otra.
    const r = aQueOrganizacionSeAta({
      nominadaPorReserva: null,
      suyaAhora: { id: 'emp-vieja', nit: VISE },
      nitQueDice: VISE,
    });

    expect(r.atar).toBe('emp-vieja');
    expect(r.cambia).toBe(false);
  });

  it('el NIT se compara ya limpio de puntos y guiones', () => {
    /// `860.507.033` y `860507033` son el mismo NIT. Si no se
    /// normalizara antes, escribirlo con puntos parecería un
    /// cambio de organización y crearía una duplicada.
    const r = aQueOrganizacionSeAta({
      nominadaPorReserva: null,
      suyaAhora: { id: 'emp-vieja', nit: VISE },
      nitQueDice: '860.507.033'.replace(/\D/g, ''),
    });

    expect(r.cambia).toBe(false);
  });
});

describe('los casos en que no hay nada que decidir', () => {
  it('sin NIT escrito no se cambia nada', () => {
    /// El paso puede llegar sin NIT —un desempleado, o quien
    /// solo corrige su dirección—. Sin NIT no hay con qué
    /// comparar, así que se queda donde está.
    const r = aQueOrganizacionSeAta({
      nominadaPorReserva: null,
      suyaAhora: { id: 'emp-vieja', nit: SU_CEDULA },
      nitQueDice: null,
    });

    expect(r.atar).toBe('emp-vieja');
    expect(r.cambia).toBe(false);
  });

  it('sin organización previa, tampoco es un cambio', () => {
    /// Es la primera vez que la dice: se crea y ya. Marcarlo
    /// como cambio dejaría una anotación de auditoría diciendo
    /// que cambió de algo que no tenía.
    const r = aQueOrganizacionSeAta({
      nominadaPorReserva: null,
      suyaAhora: null,
      nitQueDice: VISE,
    });

    expect(r.atar).toBeNull();
    expect(r.cambia).toBe(false);
  });
});

describe('el caso exacto de producción', () => {
  it('de independiente con su cédula a Vise LTDA', () => {
    /// Primero dijo «independiente» y quedó una organización
    /// con su cédula de NIT y su nombre de razón social.
    /// Después volvió y dijo que trabaja en Vise LTDA.
    const r = aQueOrganizacionSeAta({
      nominadaPorReserva: null,
      suyaAhora: { id: 'emp-el-mismo', nit: SU_CEDULA },
      nitQueDice: VISE,
    });

    /// Antes devolvía 'emp-el-mismo' y la reescribía: NIT y
    /// nombre de él, persona de contacto de Vise.
    expect(r.atar).not.toBe('emp-el-mismo');
    expect(r.atar).toBeNull();
    expect(r.cambia).toBe(true);
  });
});
