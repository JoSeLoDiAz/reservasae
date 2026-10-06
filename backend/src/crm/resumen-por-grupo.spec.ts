/** Las columnas calculadas del detalle por grupos. */

import { completarGrupo, resumenPorGrupoSql } from './resumen-por-grupo';

/**
 * `inscritosVigentes` ---los que ocupan silla hoy--- vale por defecto
 * lo mismo que los inscritos del periodo, que es lo que pasa sin
 * ventana puesta y sin nadie que haya desertado. Los casos donde las
 * dos cuentas se separan lo pasan a mano.
 */
function cruda(p: Partial<Parameters<typeof completarGrupo>[0]> = {}) {
  const base = {
    grupoId: 'g1',
    numero: 1,
    modalidad: 'PRESENCIAL',
    sedes: 'Bogotá',
    departamento: 'BOGOTÁ D.C',
    meta: 65,
    nominadosPorEmpresa: 0,
    campanaDigital: 0,
    inscritosReservas: 0,
    inscritosCampana: 0,
    ...p,
  };
  return {
    ...base,
    inscritosVigentes:
      p.inscritosVigentes ?? base.inscritosReservas + base.inscritosCampana,
  };
}

describe('completarGrupo', () => {
  it('los leads son los nominados más la campaña', () => {
    const f = completarGrupo(
      cruda({ nominadosPorEmpresa: 12, campanaDigital: 30 }),
    );
    expect(f.totalLeads).toBe(42);
  });

  it('los inscritos suman los dos orígenes', () => {
    const f = completarGrupo(
      cruda({ inscritosReservas: 5, inscritosCampana: 9 }),
    );
    expect(f.totalInscritos).toBe(14);
  });

  it('los cupos disponibles descuentan INSCRITOS, no leads', () => {
    // la regla que el cliente corrigió el 23 sep 2026: una reserva es
    // una intención; el cupo se consume al inscribirse
    const f = completarGrupo(
      cruda({
        meta: 65,
        nominadosPorEmpresa: 40,
        campanaDigital: 40,
        inscritosCampana: 20,
      }),
    );
    expect(f.cuposDisponibles).toBe(45);
  });

  it('un grupo lleno queda CERRADO, y pasado también', () => {
    expect(
      completarGrupo(cruda({ meta: 10, inscritosCampana: 10 })).estado,
    ).toBe('CERRADO');
    expect(
      completarGrupo(cruda({ meta: 10, inscritosCampana: 12 })).estado,
    ).toBe('CERRADO');
    expect(
      completarGrupo(cruda({ meta: 10, inscritosCampana: 9 })).estado,
    ).toBe('ABIERTO');
  });

  it('sin leads la conversión es nula: no es un 0 %, es que no hay de qué', () => {
    expect(completarGrupo(cruda()).conversion).toBeNull();
  });

  it('con leads la conversión es inscritos sobre leads', () => {
    const f = completarGrupo(
      cruda({ campanaDigital: 40, inscritosCampana: 10 }),
    );
    expect(f.conversion).toBeCloseTo(0.25);
  });

  it('un grupo sin coberturas da meta cero y disponibles negativos si hay inscritos', () => {
    const f = completarGrupo(cruda({ meta: 0, inscritosCampana: 3 }));
    expect(f.cuposDisponibles).toBe(-3);
    expect(f.estado).toBe('CERRADO');
  });

  /**
   * LOS CUPOS SON LOS DE HOY, no los del periodo que se mire.
   *
   * Con el periodo en «Hoy», los inscritos del periodo son uno y los
   * que ocupan silla sesenta y cinco: la columna enseñaba 64 cupos
   * libres en un grupo lleno.
   */
  it('los cupos disponibles no dependen del periodo', () => {
    const f = completarGrupo(
      cruda({ meta: 65, inscritosCampana: 1, inscritosVigentes: 65 }),
    );
    expect(f.totalInscritos).toBe(1);
    expect(f.cuposDisponibles).toBe(0);
    expect(f.estado).toBe('CERRADO');
  });

  it('el conteo de sillas no viaja en la fila', () => {
    expect('inscritosVigentes' in completarGrupo(cruda())).toBe(false);
  });
});

/**
 * EL RECORTE LLEGA A LA CONSULTA.
 *
 * «No es confiable los filtros en los tableros» (cliente, 5 oct
 * 2026). Este bloque no obedecía a ninguno, y se abre pulsando una
 * fila de la tabla de arriba, que sí los obedece: los dos, en la
 * misma pantalla, contaban gente distinta para la misma acción.
 */
describe('la consulta obedece al mismo recorte que la tabla de arriba', () => {
  const sql = (recorte: Parameters<typeof resumenPorGrupoSql>[1] = {}) =>
    resumenPorGrupoSql('af1', recorte).sql;

  it('sin recorte no corta a nadie', () => {
    const q = sql();
    expect(q).not.toContain('pa."asesorId"');
    expect(q).not.toContain('pa."creadoEn"');
    expect(q).not.toContain('an."momento" >=');
  });

  it('el asesor recorta a las personas del grupo', () => {
    expect(sql({ asesorId: 'x' })).toContain('pa."asesorId"');
  });

  it('el departamento se busca en la persona, no en dónde se dicta', () => {
    const q = sql({ departamentoSepId: 5 });
    expect(q).toContain('"personas"');
    expect(q).toContain('departamentoSepId');
  });

  it('con un grupo elegido arriba, solo se enseña ese', () => {
    expect(sql({ grupoId: 'g9' })).toContain('g."id" = ');
    expect(sql()).not.toContain('g."id" = ');
  });

  /// Las dos ventanas, como arriba: los leads por cuándo entró la
  /// persona y los inscritos por cuándo se inscribió.
  it('los leads van por `creadoEn` y los inscritos por el ancla', () => {
    const q = sql({
      desde: '2026-10-01T05:00:00.000Z',
      hasta: '2026-10-02T05:00:00.000Z',
    });
    expect(q).toContain('primera_matricula');
    expect(q).toContain('pa."creadoEn" >=');
    expect(q).toContain('an."momento" >=');
    /// Y el tope EXCLUSIVO en los dos, para no contar un día de más.
    expect(q).not.toContain('pa."creadoEn" <=');
    expect(q).not.toContain('an."momento" <=');
  });

  it('LA META Y LAS SEDES NO SE RECORTAN: los cupos son los que son', () => {
    const q = sql({
      asesorId: 'x',
      desde: '2026-10-01T05:00:00.000Z',
      hasta: '2026-10-02T05:00:00.000Z',
    });
    const meta = q.slice(q.indexOf('LA META'), q.indexOf('LAS PERSONAS'));
    expect(meta).not.toContain('creadoEn');
    expect(meta).not.toContain('asesorId');
    expect(meta).not.toContain('momento');
  });

  /**
   * Y LOS QUE OCUPAN SILLA, EN SU PROPIA SUBCONSULTA: sin la ventana
   * y sin los filtros.
   *
   * Compartió la de las personas, y entonces cargaba con todos: con
   * una asesora filtrada, un grupo lleno decía que quedan 64 cupos
   * libres. Un cupo es del grupo, no de quien lo mire; la meta no se
   * recorta, así que lo que se le resta tampoco puede recortarse.
   */
  it('y los que ocupan silla se cuentan por la etapa, sin ventana ni filtros', () => {
    const q = sql({
      desde: '2026-10-01T05:00:00.000Z',
      hasta: '2026-10-02T05:00:00.000Z',
      asesorId: 'x',
      departamentoSepId: 5,
    });
    const i = q.indexOf('LOS QUE OCUPAN SILLA');
    expect(i).toBeGreaterThan(-1);
    const bloque = q.slice(i, q.indexOf(') v ON', i));
    expect(bloque).toContain('pa."etapa"');
    expect(bloque).not.toContain('creadoEn');
    expect(bloque).not.toContain('an."momento"');
    expect(bloque).not.toContain('asesorId');
    expect(bloque).not.toContain('personaId');
  });
});
