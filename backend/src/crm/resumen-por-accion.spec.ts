/** Las cuentas de la tabla del comité, contra su propio Excel. */

import {
  completarFila,
  resumenPorAccionSql,
  type FilaDeAccion,
} from './resumen-por-accion';

/**
 * `inscritosVigentes` ---los que ocupan silla hoy--- vale por defecto
 * lo mismo que los inscritos del periodo, que es lo que pasa cuando no
 * hay ventana puesta y nadie ha desertado: así las cifras del Excel
 * siguen diciendo lo que decían. Los casos donde las dos cuentas se
 * separan lo pasan a mano.
 */
const cruda = (p: Partial<Parameters<typeof completarFila>[0]> = {}) => {
  const base = {
    accionFormacionId: 'af',
    codigo: 'AF1',
    nombre: 'Una acción',
    meta: 0,
    cuposReservados: 0,
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
};

describe('la tabla por acción de formación', () => {
  /// Las cifras son las de su hoja del 23 de septiembre de 2026, para
  /// que el día que alguien cambie una fórmula lo diga una prueba y no
  /// una reunión.
  describe('cuadra con el Excel del cliente', () => {
    it('AF2: 520 de meta, 524 inscritos, −4 disponibles y CERRADO', () => {
      const f = completarFila(
        cruda({
          codigo: 'AF2',
          meta: 520,
          cuposReservados: 76,
          campanaDigital: 1229,
          inscritosReservas: 4,
          inscritosCampana: 520,
        }),
      );
      expect(f.totalLeads).toBe(1305);
      expect(f.totalInscritos).toBe(524);
      expect(f.cuposDisponibles).toBe(-4);
      expect(f.estado).toBe('CERRADO');
      expect(Math.round((f.conversion ?? 0) * 100)).toBe(40);
    });

    it('AF4: 163 de meta, 68 inscritos y 95 disponibles', () => {
      const f = completarFila(
        cruda({
          codigo: 'AF4',
          meta: 163,
          campanaDigital: 96,
          inscritosCampana: 68,
        }),
      );
      expect(f.cuposDisponibles).toBe(95);
      expect(f.estado).toBe('ABIERTO');
    });

    it('AF11: cuenta las dos fuentes de inscritos', () => {
      const f = completarFila(
        cruda({
          codigo: 'AF11',
          meta: 315,
          campanaDigital: 29,
          inscritosReservas: 2,
          inscritosCampana: 45,
        }),
      );
      expect(f.totalInscritos).toBe(47);
      expect(f.cuposDisponibles).toBe(268);
    });
  });

  /// La regla que el cliente corrigió ese mismo día en Comité
  /// Marketing: una reserva es una intención, y el cupo se consume
  /// cuando la persona queda inscrita.
  it('los cupos reservados NO descuentan disponibles', () => {
    const f = completarFila(
      cruda({ meta: 100, cuposReservados: 40, inscritosCampana: 10 }),
    );
    expect(f.cuposDisponibles).toBe(90);
  });

  /// Su Excel enseña «#DIV/0!» en tres filas. Aquí es nulo, y la
  /// pantalla escribe una raya: una tasa inventada sobre cero leads es
  /// peor que decir que no hay.
  it('sin leads no hay conversión que calcular', () => {
    expect(completarFila(cruda({ meta: 52 })).conversion).toBeNull();
  });

  /**
   * LOS CUPOS SALEN DE QUIEN OCUPA SILLA HOY, no de las inscripciones
   * del periodo.
   *
   * Es la diferencia que trae el contar por el ancla: mirando «Hoy»,
   * los inscritos del periodo son dos y los que ocupan silla
   * cuatrocientos. Antes esta columna enseñaba 518 cupos libres en una
   * acción que está llena.
   */
  it('los cupos disponibles no dependen del periodo que se mire', () => {
    const f = completarFila(
      cruda({
        meta: 520,
        campanaDigital: 3,
        inscritosCampana: 2,
        inscritosVigentes: 400,
      }),
    );
    expect(f.totalInscritos).toBe(2);
    expect(f.cuposDisponibles).toBe(120);
    expect(f.estado).toBe('ABIERTO');
  });

  it('y una acción llena sigue CERRADA aunque hoy no se inscribiera nadie', () => {
    const f = completarFila(
      cruda({ meta: 100, inscritosCampana: 0, inscritosVigentes: 100 }),
    );
    expect(f.totalInscritos).toBe(0);
    expect(f.cuposDisponibles).toBe(0);
    expect(f.estado).toBe('CERRADO');
  });

  /// Y no sale a la pantalla: dos columnas de inscritos en la misma
  /// tabla dejan sin respuesta buena la pregunta «¿cuántos son?».
  it('el conteo de sillas no viaja en la fila', () => {
    expect('inscritosVigentes' in completarFila(cruda())).toBe(false);
  });

  it('una acción sin grupos todavía tiene meta cero, y es cierto', () => {
    const f = completarFila(cruda({ campanaDigital: 10, inscritosCampana: 3 }));
    expect(f.meta).toBe(0);
    expect(f.cuposDisponibles).toBe(-3);
    expect(f.estado).toBe('CERRADO');
  });

  describe('la consulta', () => {
    const sql = (ambito: string[], gremio: string | null = null) =>
      resumenPorAccionSql(ambito, gremio).sql;

    it('la meta sale del cronograma y CON el 30 % de sobrecupo', () => {
      // «esto es con el 30 %, tanto en la general como en la que se ve
      // por AF» (cliente, 23 sep 2026). Estuvo con `cuposBase` y él lo
      // corrigió: su Excel da 520 por AF1, que es el máximo.
      const q = sql(['ade']);
      expect(q).toContain('grupos_cobertura');
      expect(q).toContain('cuposMaximos');
      expect(q).not.toContain('cuposBase');
    });

    it('solo suma reservas confirmadas', () => {
      expect(sql(['ade'])).toContain(`"estado" = 'CONFIRMADA'`);
    });

    it('recorta por el gremio elegido cuando hay uno', () => {
      expect(sql(['ade', 'brit'], 'ade')).toContain('a."convenioId" = ');
      expect(sql(['ade', 'brit'], null)).not.toContain('a."convenioId" = $');
    });

    it('pide las acciones del ámbito, no todas', () => {
      expect(sql(['ade'])).toContain('a."convenioId" IN');
    });
  });
});

/// El tipo se usa en la pantalla: si cambia, que rompa aquí también.
const _tipo: FilaDeAccion = completarFila(cruda());
void _tipo;

// ── el recorte de la pantalla ────────────────────────────────────
//
// «Los filtros deben ser funcionales, hasta el momento no los entiendo
// para nada» (cliente, 23 sep 2026). Esta tabla no obedecía a ninguno.

describe('el recorte llega a la consulta', () => {
  const sql = (recorte: Parameters<typeof resumenPorAccionSql>[2]) =>
    resumenPorAccionSql(['ade'], null, recorte).sql;

  it('sin recorte, la consulta no lleva ningún corte de gente', () => {
    const q = sql({});
    expect(q).toContain('pa."accionFormacionId" IS NOT NULL');
    expect(q).not.toContain('pa."asesorId"');
    expect(q).not.toContain('pa."creadoEn"');
  });

  it('el asesor recorta a las personas', () => {
    expect(sql({ asesorId: 'x' })).toContain('pa."asesorId"');
  });

  it('el grupo se busca por la cobertura, que es de donde cuelga', () => {
    expect(sql({ grupoId: 'g' })).toContain('grupos_cobertura');
  });

  it('el departamento se busca en la persona, no en la ficha', () => {
    expect(sql({ departamentoSepId: 5 })).toContain('"personas"');
  });

  /**
   * LOS INSCRITOS NO SE CUENTAN POR CUANDO LLEGO LA PERSONA.
   *
   * «No tengo certeza de inscripciones realizadas en control de
   * inscritos» (cliente, 5 oct 2026). Esta tabla contaba como inscrito
   * del periodo a quien LLEGÓ en el periodo y está inscrito HOY, así
   * que quien llegó en agosto y se inscribió hoy no contaba hoy.
   */
  it('los inscritos van por el ancla de la matrícula, no por `creadoEn`', () => {
    const q = sql({
      desde: '2026-10-01T05:00:00.000Z',
      hasta: '2026-10-02T05:00:00.000Z',
    });
    /// El ancla está en la consulta y se une a la ficha.
    expect(q).toContain('primera_matricula');
    expect(q).toContain('an."pid" = pa."id"');
    /// Y es ella la que lleva la ventana de los inscritos.
    expect(q).toContain('an."momento" >=');
    expect(q).toContain('an."momento" <');
  });

  /**
   * Y LA ETAPA DE HOY NO DECIDE SI HUBO INSCRIPCIÓN. Mirándola, una
   * inscripción de septiembre desaparecía del comité de septiembre en
   * cuanto la persona desertaba en octubre.
   */
  it('los dos conteos de inscritos no miran la etapa de hoy', () => {
    const q = sql({});
    const bloque = q.slice(
      q.indexOf('LOS INSCRITOS'),
      q.indexOf('LOS QUE OCUPAN SILLA'),
    );
    expect(bloque).toContain('inscritosReserva');
    expect(bloque).toContain('inscritosCampana');
    expect(bloque).not.toContain('pa."etapa"');
  });

  /**
   * LOS CUPOS, EN CAMBIO, SÍ son los de hoy y sin ventana: salían de
   * `meta - inscritos del periodo`, y como la meta no se recorta, con
   * «Hoy» arriba una acción llena enseñaba sus 520 cupos libres.
   */
  it('los que ocupan silla se cuentan por la etapa y sin ventana', () => {
    const q = sql({
      desde: '2026-10-01T05:00:00.000Z',
      hasta: '2026-10-02T05:00:00.000Z',
      asesorId: 'x',
      grupoId: 'g',
      departamentoSepId: 5,
    });
    /// SU PROPIA SUBCONSULTA, de `LOS QUE OCUPAN SILLA` hasta donde
    /// se une. Antes compartía la de las personas, y entonces
    /// cargaba con los cinco filtros: filtrando por una asesora,
    /// una acción llena decía que quedan 519 cupos libres.
    const i = q.indexOf('LOS QUE OCUPAN SILLA');
    expect(i).toBeGreaterThan(-1);
    const bloque = q.slice(i, q.indexOf(') v ON', i));
    expect(bloque).toContain('pa."etapa"');
    /// Ni la ventana...
    expect(bloque).not.toContain('creadoEn');
    expect(bloque).not.toContain('an."momento"');
    /// ...ni ninguno de los cinco filtros.
    expect(bloque).not.toContain('asesorId');
    expect(bloque).not.toContain('coberturaId');
    expect(bloque).not.toContain('personaId');
  });

  it('la ventana va por instantes y el tope es EXCLUSIVO', () => {
    // igual que `donde()` con gte/lt: con `<=` sobre días de calendario
    // el último día entraba entero y esta tabla contaba uno más que la
    // tira de arriba
    const q = sql({
      desde: '2026-09-01T05:00:00.000Z',
      hasta: '2026-09-24T05:00:00.000Z',
    });
    expect(q).toContain('pa."creadoEn" >=');
    expect(q).toContain('pa."creadoEn" <');
    expect(q).not.toContain('pa."creadoEn" <=');
  });

  it('LA META NO SE RECORTA: los cupos comprometidos son los mismos hoy que ayer', () => {
    const q = sql({ desde: '2026-09-01T05:00:00.000Z' });
    const meta = q.slice(
      q.indexOf('LA META'),
      q.indexOf('LOS CUPOS APARTADOS'),
    );
    expect(meta).not.toContain('creadoEn');
  });
});
