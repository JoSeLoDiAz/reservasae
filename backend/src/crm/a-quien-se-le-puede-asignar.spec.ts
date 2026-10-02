/** A quién se le ofrece un lead, y a quién no. */

/**
 * EL CÍRCULO DEL QUE NO SE SALÍA (cliente, 2 oct 2026).
 *
 * El desplegable «Asignar a» de la tabla de leads y el FILTRO de la
 * columna «Asesor» salían de la MISMA lista, y esa lista se armaba
 * agrupando las fichas por asesor: los que YA tienen leads.
 *
 * Para el filtro está bien ---filtrar por alguien con cero filas no
 * devuelve nada---. Para asignar dejaba un círculo sin salida: para
 * aparecer en el desplegable había que tener ya un lead, y para tener
 * el primero había que aparecer en el desplegable. Tres cuentas
 * recién creadas no podían recibir ninguno.
 *
 * Ahora son dos listas porque son dos preguntas, y la de asignar usa
 * la misma fuente que el selector de la ficha individual: `llevanFichasEn`.
 */

import { PUEDEN_LLEVAR_FICHAS, llevanFichasEn } from './quien-lleva-fichas';

describe('quién puede llevar fichas', () => {
  /**
   * LOS DOS QUE PIDIÓ EL CLIENTE: «solo debe salir Gestor de
   * Inscripciones y Líder de Inscripciones».
   */
  it('el gestor y el líder de inscripciones', () => {
    expect(PUEDEN_LLEVAR_FICHAS).toEqual([
      'GESTOR_INSCRIPCION',
      'LIDER_INSCRIPCION',
    ]);
  });

  /**
   * Y EL LÍDER DE SISTEMAS YA NO.
   *
   * Estaba porque tiene `inscripciones · ESCRIBIR`, pero una cosa es
   * PODER escribir en las fichas y otra que la gente le reparta leads:
   * ese rol administra el sistema, no atiende la captación.
   */
  it('el líder de sistemas no', () => {
    expect(PUEDEN_LLEVAR_FICHAS).not.toContain('LIDER_SISTEMAS');
  });

  it('ni los académicos ni los de consulta', () => {
    for (const r of [
      'GESTOR_ACADEMICO',
      'LIDER_ACADEMICO',
      'CONSULTA',
    ]) {
      expect(PUEDEN_LLEVAR_FICHAS).not.toContain(r);
    }
  });

  /**
   * Y LA CUENTA TIENE QUE SEGUIR ACTIVA: desactivar a alguien corta su
   * sesión al instante, así que ofrecerlo sería ofrecer a quien ya no
   * entra.
   */
  it('y la cuenta, activa', () => {
    const w = llevanFichasEn('adecopria') as {
      activo: boolean;
      convenios: { some: { convenioId: unknown; rol: { in: string[] } } };
    };
    expect(w.activo).toBe(true);
    expect(w.convenios.some.convenioId).toBe('adecopria');
    expect(w.convenios.some.rol.in).toEqual(PUEDEN_LLEVAR_FICHAS);
  });

  it('y admite un ámbito entero, para la mesa', () => {
    const w = llevanFichasEn(['adecopria', 'britcham']) as {
      convenios: { some: { convenioId: { in: string[] } } };
    };
    expect(w.convenios.some.convenioId).toEqual({
      in: ['adecopria', 'britcham'],
    });
  });
});

describe('las dos listas de la pantalla de leads', () => {
  const fuente = () =>
    require('fs').readFileSync(
      require('path').join(__dirname, 'crm.service.ts'),
      'utf8',
    ) as string;

  /**
   * LA DE ASIGNAR NO SALE DE LAS FICHAS.
   *
   * Es el fallo entero en una línea: si `asesoresAsignables` volviera a
   * salir de `idsAsesor`, el círculo vuelve y nada falla.
   */
  it('la de asignar sale de quién PUEDE, no de quién ya tiene', () => {
    const t = fuente();
    expect(t).toContain('where: llevanFichasEn(filtros.ambito)');
    expect(t).toContain('asesoresAsignables,');
  });

  it('y la del filtro sigue saliendo de las fichas', () => {
    expect(fuente()).toContain('where: { id: { in: idsAsesor } }');
  });

  /**
   * LA MISMA FUENTE QUE LA FICHA INDIVIDUAL, que es el motivo de que
   * `quien-lleva-fichas.ts` exista: dos listas de quién puede ser
   * asesor acaban discrepando, y el síntoma es un desplegable que
   * ofrece a alguien que luego recibe un 403.
   */
  it('la ficha individual y la mesa usan la misma', () => {
    expect(fuente()).toContain('where: llevanFichasEn(convenioId)');
    const mesa = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'leads', 'mesa-de-entrada.service.ts'),
      'utf8',
    ) as string;
    expect(mesa).toContain('llevanFichasEn(ambito)');
  });
});

/**
 * LO QUE ESTO NO CAMBIA, y conviene dejarlo fijado.
 *
 * Esta lista decide a quién se OFRECE, no quién puede tener. Las fichas
 * que ya lleva un líder de sistemas se quedan donde están y se le
 * pueden quitar; lo que no se puede es darle más desde el desplegable.
 */
describe('lo ya asignado no se toca', () => {
  it('exigirAsesorDelConvenio sigue aceptando a cualquiera con concesión', () => {
    const t = require('fs').readFileSync(
      require('path').join(__dirname, 'crm.service.ts'),
      'utf8',
    ) as string;
    const i = t.indexOf('async exigirAsesorDelConvenio(');
    expect(i).toBeGreaterThan(-1);
    const cuerpo = t.slice(i, t.indexOf('\n  async ', i + 20));
    /// Mira que tenga concesión en el convenio, no que su rol esté en
    /// la lista de ofrecibles.
    expect(cuerpo).toContain('adminConvenio.findFirst');
    expect(cuerpo).not.toContain('PUEDEN_LLEVAR_FICHAS');
  });
});
