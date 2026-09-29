/** La cuenta de metas por acción y por asesor, contra los números de Josse. */

import {
  metasDeAccion,
  arrastreDelAsesor,
  cumplimiento,
  paraPintar,
} from './proyeccion-metas';

describe('la hoja de cálculo de Josse, misma cuenta', () => {
  /// Su Excel: meta 520, 71 confirmados, 3 asesores, 7 días → 64 y 21.
  it('520 · 71 · 3 asesores · 7 días → 449, 64 y 21', () => {
    const m = metasDeAccion({
      metaInscritos: 520,
      inscritosConfirmados: 71,
      numAsesores: 3,
      diasParaCierre: 7,
    });
    expect(m.cuposDisponibles).toBe(449);
    expect(paraPintar(m.metaDiaria)).toBe(64);
    expect(paraPintar(m.metaPorAsesor)).toBe(21);
  });

  /// La conversación: los mismos 449 en 5 días dan 90, no 89.
  it('449 en 5 días se pinta 90, no 89 (es redondeo, no piso)', () => {
    const m = metasDeAccion({
      metaInscritos: 520,
      inscritosConfirmados: 71,
      numAsesores: 2,
      diasParaCierre: 5,
    });
    expect(paraPintar(m.metaDiaria)).toBe(90);
    /// 89,8 / 2 = 44,9 → 45.
    expect(paraPintar(m.metaPorAsesor)).toBe(45);
  });

  it('con un cuarto asesor, la meta por asesor cae a 22', () => {
    const m = metasDeAccion({
      metaInscritos: 520,
      inscritosConfirmados: 71,
      numAsesores: 4,
      diasParaCierre: 5,
    });
    /// 89,8 / 4 = 22,45 → 22.
    expect(paraPintar(m.metaPorAsesor)).toBe(22);
  });

  it('la meta por asesor sale de la diaria SIN redondear', () => {
    /// Si se redondeara la diaria antes de dividir, 64 en vez de
    /// 64,14, la de por asesor saldría de 64/3 = 21,33 y no de
    /// 64,14/3 = 21,38. Aquí las dos rondan a 21, pero el valor
    /// interno tiene que ser el de la división sin redondear, que es
    /// lo que encadena con el resto.
    const m = metasDeAccion({
      metaInscritos: 520,
      inscritosConfirmados: 71,
      numAsesores: 3,
      diasParaCierre: 7,
    });
    expect(m.metaDiaria).toBeCloseTo(449 / 7, 5);
    expect(m.metaPorAsesor).toBeCloseTo(449 / 7 / 3, 5);
  });
});

describe('los bordes, que el Excel no cubre pero la pantalla sí', () => {
  it('meta ya cubierta: no se debe nada, sin negativos', () => {
    const m = metasDeAccion({
      metaInscritos: 520,
      inscritosConfirmados: 600,
      numAsesores: 3,
      diasParaCierre: 7,
    });
    expect(m.cuposDisponibles).toBe(0);
    expect(m.metaDiaria).toBe(0);
    expect(m.metaPorAsesor).toBe(0);
  });

  it('sin días para el cierre no se divide entre cero', () => {
    const m = metasDeAccion({
      metaInscritos: 520,
      inscritosConfirmados: 71,
      numAsesores: 3,
      diasParaCierre: 0,
    });
    expect(m.metaDiaria).toBe(0);
    expect(m.metaPorAsesor).toBe(0);
  });

  it('sin asesores, la meta por asesor es cero, no infinito', () => {
    const m = metasDeAccion({
      metaInscritos: 520,
      inscritosConfirmados: 71,
      numAsesores: 0,
      diasParaCierre: 7,
    });
    expect(Number.isFinite(m.metaPorAsesor)).toBe(true);
    expect(m.metaPorAsesor).toBe(0);
  });
});

describe('el arrastre: lo de ayer se suma hoy', () => {
  it('sin días previos, la meta de hoy es solo su base', () => {
    const a = arrastreDelAsesor([{ metaBase: 21, inscritos: 0 }]);
    expect(a.deficitArrastrado).toBe(0);
    expect(a.metaHoy).toBe(21);
  });

  it('debió 21, hizo 15: hoy debe 21 + 6', () => {
    const a = arrastreDelAsesor([
      { metaBase: 21, inscritos: 15 }, // ayer, cerrado
      { metaBase: 21, inscritos: 0 }, // hoy, abierto
    ]);
    expect(a.deficitArrastrado).toBe(6);
    expect(a.metaHoy).toBe(27);
  });

  it('el faltante se ACUMULA día a día', () => {
    /// Falla dos días seguidos: el déficit se suma.
    const a = arrastreDelAsesor([
      { metaBase: 20, inscritos: 15 }, // debe 20, hace 15 → debe 5
      { metaBase: 20, inscritos: 18 }, // debe 25, hace 18 → debe 7
      { metaBase: 20, inscritos: 0 }, // hoy: base 20 + 7 = 27
    ]);
    expect(a.deficitArrastrado).toBe(7);
    expect(a.metaHoy).toBe(27);
  });

  it('un sobrante NO se abona a la cuenta personal', () => {
    /// Un día pasa de su meta; al siguiente empieza en su base, no
    /// debiendo menos. El exceso ya bajó los cupos de todos.
    const a = arrastreDelAsesor([
      { metaBase: 20, inscritos: 30 }, // hace 30 de 20: sobra 10
      { metaBase: 20, inscritos: 0 }, // hoy: 20, no 10
    ]);
    expect(a.deficitArrastrado).toBe(0);
    expect(a.metaHoy).toBe(20);
  });

  it('el sobrante de un día NO tapa el faltante de otro', () => {
    /// Día 1 sobra, día 2 falta: el día 2 arrastra su faltante entero,
    /// sin descontar lo que sobró el día 1.
    const a = arrastreDelAsesor([
      { metaBase: 20, inscritos: 25 }, // sobra 5, no se guarda
      { metaBase: 20, inscritos: 12 }, // debe 20, hace 12 → debe 8
      { metaBase: 20, inscritos: 0 }, // hoy: 28
    ]);
    expect(a.deficitArrastrado).toBe(8);
    expect(a.metaHoy).toBe(28);
  });
});

describe('el cumplimiento, la «conversión» de esta tabla', () => {
  it('15 de 21 es 0,71', () => {
    expect(cumplimiento(15, 21)).toBeCloseTo(15 / 21, 5);
  });

  it('sin meta no hay cumplimiento: null, no un 0 % engañoso', () => {
    expect(cumplimiento(0, 0)).toBeNull();
  });

  it('pasarse de la meta da más de 1 (más del 100 %)', () => {
    expect(cumplimiento(30, 20)).toBeCloseTo(1.5, 5);
  });
});
