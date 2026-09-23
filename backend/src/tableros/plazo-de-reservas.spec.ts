/** El plazo del 30 de septiembre y su aviso de dos semanas. */

import {
  DIAS_DE_AVISO,
  PLAZO_ENTREGA_NOMBRES,
  diasHasta,
  estadoDelPlazo,
} from './plazo-de-reservas';

describe('diasHasta', () => {
  it('cuenta los días que faltan', () => {
    expect(diasHasta('2026-09-23', '2026-09-30')).toBe(7);
  });

  it('el mismo día es cero', () => {
    expect(diasHasta('2026-09-30', '2026-09-30')).toBe(0);
  });

  it('da negativo cuando ya pasó', () => {
    expect(diasHasta('2026-10-05', '2026-09-30')).toBe(-5);
  });

  it('cruza el cambio de mes sin perder un día', () => {
    expect(diasHasta('2026-08-31', '2026-09-30')).toBe(30);
  });

  it('no se descuadra con el horario de verano de otras zonas', () => {
    // se cuenta en UTC a propósito: con horas locales, un salto de
    // hora convierte 7 días en 6,96 y el redondeo se come uno
    expect(diasHasta('2026-03-01', '2026-11-01')).toBe(245);
  });
});

describe('estadoDelPlazo', () => {
  it('sin cupos pendientes está COMPLETA, aunque el plazo esté vencido', () => {
    // quien ya entregó no tiene nada que atender: pintarla en rojo por
    // la fecha sería una alarma falsa en la fila de quien cumplió
    expect(estadoDelPlazo(0, '2026-12-01')).toBe('COMPLETA');
  });

  it('con margen de sobra está EN_PLAZO', () => {
    expect(estadoDelPlazo(5, '2026-08-01')).toBe('EN_PLAZO');
  });

  it('a catorce días justos ya está POR_VENCER: son las «2 semanas» del aviso', () => {
    expect(estadoDelPlazo(5, '2026-09-16')).toBe('POR_VENCER');
  });

  it('a quince días todavía no', () => {
    expect(estadoDelPlazo(5, '2026-09-15')).toBe('EN_PLAZO');
  });

  it('el mismo 30 de septiembre sigue siendo POR_VENCER, no vencida', () => {
    // el plazo es «a más tardar el 30»: ese día todavía se puede
    expect(estadoDelPlazo(5, '2026-09-30')).toBe('POR_VENCER');
  });

  it('el 1 de octubre ya está VENCIDA', () => {
    expect(estadoDelPlazo(5, '2026-10-01')).toBe('VENCIDA');
  });

  it('los cupos pendientes negativos --más gente que cupos-- son COMPLETA', () => {
    expect(estadoDelPlazo(-2, '2026-10-01')).toBe('COMPLETA');
  });

  it('acepta otro plazo, para el día que el proyecto se corra', () => {
    expect(estadoDelPlazo(5, '2026-10-01', '2026-12-31')).toBe('EN_PLAZO');
  });

  it('las constantes son las que dijo el cliente', () => {
    expect(PLAZO_ENTREGA_NOMBRES).toBe('2026-09-30');
    expect(DIAS_DE_AVISO).toBe(14);
  });
});
