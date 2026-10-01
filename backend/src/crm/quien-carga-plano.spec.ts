/** El gestor de inscripciones no carga por plano. */

/**
 * «Una restricción que no se tiene, para los usuarios de Gestor(a) de
 * inscripciones: no pueden cargar por plano, no pueden borrar leads»
 * (cliente, 1 oct 2026).
 *
 * De las dos, LA DE BORRAR YA ESTABA: el borrado individual y el de
 * lote llevan `@Roles(RolAdmin.SUPERADMIN)` desde el 13 sep 2026, y un
 * gestor no es superadministrador. Se comprobó antes de tocar nada
 * para no poner un segundo candado sobre una puerta ya cerrada; lo que
 * faltaba era la carga.
 */

import {
  CARGAN_PLANO,
  conveniosQueCargan,
  puedeCargarPlano,
} from './quien-carga-plano';

import type { PeticionConAdmin } from '../admin/admin.guard';

const peticion = (
  rol: 'SUPERADMIN' | 'GESTOR' | 'CONSULTA',
  roles: Record<string, string[]>,
  gremioElegido?: string,
) =>
  ({
    admin: { rol },
    ambito: { roles, gremioElegido },
  }) as unknown as PeticionConAdmin;

describe('quién carga por plano', () => {
  it('el gestor de inscripciones NO', () => {
    expect(
      puedeCargarPlano(peticion('GESTOR', { adecopria: ['GESTOR_INSCRIPCION'] })),
    ).toBe(false);
    expect(CARGAN_PLANO).not.toContain('GESTOR_INSCRIPCION');
  });

  it('el líder de inscripciones y el de sistemas, sí', () => {
    expect(
      puedeCargarPlano(peticion('GESTOR', { adecopria: ['LIDER_INSCRIPCION'] })),
    ).toBe(true);
    expect(
      puedeCargarPlano(peticion('GESTOR', { adecopria: ['LIDER_SISTEMAS'] })),
    ).toBe(true);
  });

  it('un administrador, siempre', () => {
    expect(puedeCargarPlano(peticion('SUPERADMIN', {}))).toBe(true);
  });

  it('sin ningún rol, no', () => {
    expect(puedeCargarPlano(peticion('CONSULTA', {}))).toBe(false);
  });

  /**
   * LA LECCIÓN DE `quien-asigna-grupo.ts`, y por eso se prueba aquí
   * también: `ambito.roles` trae TODAS las concesiones, no las del
   * gremio en el que se está trabajando. Sin mirar el elegido, quien
   * es líder en ADECOPRIA y gestor en BRITCHAM cargaría también en
   * BRITCHAM, que es justo el caso que el ámbito existe para separar.
   */
  it('mira el gremio elegido, no el montón', () => {
    const dosGremios = {
      adecopria: ['LIDER_INSCRIPCION'],
      britcham: ['GESTOR_INSCRIPCION'],
    };
    expect(puedeCargarPlano(peticion('GESTOR', dosGremios, 'adecopria'))).toBe(
      true,
    );
    expect(puedeCargarPlano(peticion('GESTOR', dosGremios, 'britcham'))).toBe(
      false,
    );
  });

  it('dice en qué gremios sí carga, para que el panel no ofrezca el botón', () => {
    expect(
      conveniosQueCargan({
        adecopria: ['LIDER_INSCRIPCION'],
        britcham: ['GESTOR_INSCRIPCION'],
      }),
    ).toEqual(['adecopria']);
  });
});
