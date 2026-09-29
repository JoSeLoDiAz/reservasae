/** El enriquecedor: le pega las metas de Josse a una fila de proyección. */

import { conMetas } from './proyeccion-con-metas';
import type { FilaDeProyeccion } from './proyeccion';

/// Una fila cualquiera, con lo que `conMetas` mira: cupos, inscritos y
/// los días del cronograma. El resto es relleno.
function fila(p: {
  cupos: number;
  inscritos: number;
  diasRestantes: number | null;
}): FilaDeProyeccion {
  return {
    accionFormacionId: 'af1',
    codigo: 'AF1',
    nombre: 'Una acción',
    cupos: p.cupos,
    inscritos: p.inscritos,
    faltan: Math.max(0, p.cupos - p.inscritos),
    leads: 0,
    abiertos: 0,
    cierre: null,
    diasRestantes: p.diasRestantes,
    ritmoReal: 0,
    inscritosVentana: 0,
    metaDiaria: null,
    proyeccion: p.inscritos,
    conversion: 0,
    conversionPropia: false,
    leadsNecesarios: 0,
    leadsPorConseguir: 0,
    veredicto: 'SIN_FECHA',
  };
}

/// Un lunes cualquiera, para contar días de trabajo sin sorpresas.
const HOY = new Date('2026-09-28T05:00:00.000Z');

describe('la fecha de cierre del admin manda sobre el cronograma', () => {
  it('sin fecha propia, usa los días del cronograma', () => {
    const f = conMetas(
      fila({ cupos: 520, inscritos: 71, diasRestantes: 7 }),
      { asesores: 3, cierre: null },
      HOY,
    );
    expect(f.diasParaCierre).toBe(7);
    expect(f.cierreProyeccion).toBeNull();
    /// 449 / 7 = 64,14 · / 3 = 21,38.
    expect(f.metaDiariaFlotante).toBeCloseTo(449 / 7, 5);
    expect(f.metaPorAsesor).toBeCloseTo(449 / 7 / 3, 5);
  });

  it('con fecha propia, los días salen de ella, no del cronograma', () => {
    /// El admin corrió el cierre a un jueves: de este lunes al jueves
    /// hay 3 días de trabajo (mar, mié, jue). Manda esa cuenta, NO los
    /// 2 que dice el cronograma (diasRestantes).
    const cierre = new Date('2026-10-01T05:00:00.000Z');
    const f = conMetas(
      fila({ cupos: 520, inscritos: 71, diasRestantes: 2 }),
      { asesores: 3, cierre },
      HOY,
    );
    expect(f.diasParaCierre).toBe(3);
    expect(f.cierreProyeccion).toBe('2026-10-01');
    expect(f.metaDiariaFlotante).toBeCloseTo(449 / 3, 5);
  });
});

describe('lo que falta configurar sale NULO, no cero', () => {
  it('sin asesores, la meta por asesor es null', () => {
    const f = conMetas(
      fila({ cupos: 520, inscritos: 71, diasRestantes: 7 }),
      { asesores: null, cierre: null },
      HOY,
    );
    expect(f.asesores).toBeNull();
    expect(f.metaPorAsesor).toBeNull();
    /// La diaria sí se puede, porque hay días.
    expect(f.metaDiariaFlotante).toBeCloseTo(449 / 7, 5);
  });

  it('sin días de ningún lado, la meta diaria y la por asesor son null', () => {
    const f = conMetas(
      fila({ cupos: 520, inscritos: 71, diasRestantes: null }),
      { asesores: 3, cierre: null },
      HOY,
    );
    expect(f.diasParaCierre).toBeNull();
    expect(f.metaDiariaFlotante).toBeNull();
    expect(f.metaPorAsesor).toBeNull();
  });

  it('meta ya cubierta: no se debe nada', () => {
    const f = conMetas(
      fila({ cupos: 520, inscritos: 600, diasRestantes: 7 }),
      { asesores: 3, cierre: null },
      HOY,
    );
    expect(f.metaDiariaFlotante).toBe(0);
    expect(f.metaPorAsesor).toBe(0);
  });

  it('conserva lo que ya traía la fila (no pisa a Andrés)', () => {
    const base = fila({ cupos: 520, inscritos: 71, diasRestantes: 7 });
    const f = conMetas(base, { asesores: 3, cierre: null }, HOY);
    expect(f.accionFormacionId).toBe('af1');
    expect(f.codigo).toBe('AF1');
    expect(f.faltan).toBe(449);
    expect(f.leads).toBe(base.leads);
  });
});
