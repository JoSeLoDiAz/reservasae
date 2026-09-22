/** El trabajo de otra persona lo ve quien responde por ella. */

/**
 * «No, es la líder de inscripciones, no más» (Josse, 22 sep 2026),
 * sobre quién ve el módulo de seguimiento de asesores del Resumen.
 * Un gestor se ve a sí mismo; quien responde por el equipo lo ve
 * entero.
 *
 * LA TRAMPA, Y POR POCO SE CAE EN ELLA: lo natural era atarlo a
 * `REPARTEN_FICHAS`, que ya existe y que este repositorio describe
 * como «de quien responde por el equipo». Pero la Sra. Catalina
 * —que fue QUIEN PIDIÓ el módulo— es COUNTRY_MANAGER y no reparte
 * fichas: «ve todo en VER… no crea, ni mueve de etapa, ni
 * certifica. No lleva fichas, no las reparte». Atarlo a la lista
 * que ya había habría dejado fuera a quien lo encargó, y el
 * síntoma sería una pantalla vacía sin que nada fallara.
 *
 * Son dos preguntas distintas: repartir es ORGANIZAR el trabajo y
 * esto es MIRARLO. Por eso hay dos listas —y la segunda se deriva
 * de la primera, para que no se separen el día que entre un rol
 * nuevo.
 */

import {
  conveniosQueReparten,
  conveniosQueVenElEquipo,
  REPARTEN_FICHAS,
  VEN_EL_EQUIPO,
} from '../admin/permisos';
import { RolConvenio } from '../../generated/prisma';

const solo = (rol: RolConvenio) => ({ adecopria: [rol] });

describe('quién ve el trabajo del equipo', () => {
  it('la líder de inscripciones lo ve', () => {
    expect(conveniosQueVenElEquipo(solo('LIDER_INSCRIPCION'))).toEqual(['adecopria']);
  });

  it('el líder ACADÉMICO no: responde por el aula, no por los asesores', () => {
    /// Reparte fichas --está en REPARTEN_FICHAS-- y aun así no ve
    /// este módulo. Es la prueba de que las dos listas responden a
    /// preguntas distintas y no se pueden fundir.
    expect(conveniosQueReparten(solo('LIDER_ACADEMICO'))).toEqual(['adecopria']);
    expect(conveniosQueVenElEquipo(solo('LIDER_ACADEMICO'))).toEqual([]);
  });

  it('el country manager lo ve AUNQUE no reparta fichas', () => {
    /// Es el caso que motivó que existan dos listas: supervisa el
    /// trabajo del equipo y no lo organiza.
    expect(conveniosQueReparten(solo('COUNTRY_MANAGER'))).toEqual([]);
    expect(conveniosQueVenElEquipo(solo('COUNTRY_MANAGER'))).toEqual(['adecopria']);
  });

  it('un gestor de inscripciones NO lo ve: se ve a sí mismo', () => {
    expect(conveniosQueVenElEquipo(solo('GESTOR_INSCRIPCION'))).toEqual([]);
  });

  it('quien solo consulta tampoco', () => {
    expect(conveniosQueVenElEquipo(solo('CONSULTA'))).toEqual([]);
    expect(conveniosQueVenElEquipo(solo('GESTOR_ACADEMICO'))).toEqual([]);
  });

  it('quien lleva sistemas tampoco, por su concesión', () => {
    /// Entra por ser SUPERADMIN, que es otra puerta y se pregunta
    /// aparte: «country manager, admin y líder de inscripciones».
    expect(conveniosQueVenElEquipo(solo('LIDER_SISTEMAS'))).toEqual([]);
  });

  it('basta con responder por el equipo en UN gremio', () => {
    /// El recorte del corte por asesor es uno solo para toda la
    /// respuesta: quien lidera en un gremio y solo gestiona en el
    /// otro ve el equipo. Es deliberado y conviene que esté escrito:
    /// la alternativa —recortar gremio a gremio— exigiría un
    /// `asesorId` distinto por fila y ya no sería un `GROUP BY`.
    const mezcla = {
      adecopria: ['GESTOR_INSCRIPCION'] as RolConvenio[],
      'britcham-adee': ['LIDER_INSCRIPCION'] as RolConvenio[],
    };
    expect(conveniosQueVenElEquipo(mezcla)).toEqual(['britcham-adee']);
  });

  it('son DOS listas y ninguna contiene a la otra', () => {
    /// Y eso es lo que hay que recordar de aquí. `REPARTEN_FICHAS`
    /// tiene al líder académico, que NO ve este módulo; y
    /// `VEN_EL_EQUIPO` tiene al country manager, que NO reparte.
    /// Fundirlas --en cualquiera de los dos sentidos-- rompe una.
    expect(REPARTEN_FICHAS).toContain('LIDER_ACADEMICO');
    expect(VEN_EL_EQUIPO).not.toContain('LIDER_ACADEMICO');
    expect(VEN_EL_EQUIPO).toContain('COUNTRY_MANAGER');
    expect(REPARTEN_FICHAS).not.toContain('COUNTRY_MANAGER');
  });
});
