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

    it('la meta sale de los cupos del cronograma, no de la oferta', () => {
      const q = sql(['ade']);
      expect(q).toContain('grupos_cobertura');
      expect(q).toContain('cuposBase');
      /// `cuposMaximos` trae el 30 % de sobrecupo: no es la meta.
      expect(q).not.toContain('cuposMaximos');
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
