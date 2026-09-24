/** Las cuentas de la tabla del comité, contra su propio Excel. */

import { completarFila, resumenPorAccionSql, type FilaDeAccion } from './resumen-por-accion';

const cruda = (p: Partial<Parameters<typeof completarFila>[0]> = {}) => ({
  accionFormacionId: 'af',
  codigo: 'AF1',
  nombre: 'Una acción',
  meta: 0,
  cuposReservados: 0,
  campanaDigital: 0,
  inscritosReservas: 0,
  inscritosCampana: 0,
  ...p,
});

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
        cruda({ codigo: 'AF4', meta: 163, campanaDigital: 96, inscritosCampana: 68 }),
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
    const f = completarFila(cruda({ meta: 100, cuposReservados: 40, inscritosCampana: 10 }));
    expect(f.cuposDisponibles).toBe(90);
  });

  /// Su Excel enseña «#DIV/0!» en tres filas. Aquí es nulo, y la
  /// pantalla escribe una raya: una tasa inventada sobre cero leads es
  /// peor que decir que no hay.
  it('sin leads no hay conversión que calcular', () => {
    expect(completarFila(cruda({ meta: 52 })).conversion).toBeNull();
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

  it('la ventana va por instantes y el tope es EXCLUSIVO', () => {
    // igual que `donde()` con gte/lt: con `<=` sobre días de calendario
    // el último día entraba entero y esta tabla contaba uno más que la
    // tira de arriba
    const q = sql({ desde: '2026-09-01T05:00:00.000Z', hasta: '2026-09-24T05:00:00.000Z' });
    expect(q).toContain('pa."creadoEn" >=');
    expect(q).toContain('pa."creadoEn" <');
    expect(q).not.toContain('pa."creadoEn" <=');
  });

  it('LA META NO SE RECORTA: los cupos comprometidos son los mismos hoy que ayer', () => {
    const q = sql({ desde: '2026-09-01T05:00:00.000Z' });
    const meta = q.slice(q.indexOf('LA META'), q.indexOf('LOS CUPOS APARTADOS'));
    expect(meta).not.toContain('creadoEn');
  });
});
