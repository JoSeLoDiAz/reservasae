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

describe('los días del admin mandan sobre el cronograma', () => {
  it('sin días propios, usa los del cronograma', () => {
    const f = conMetas(fila({ cupos: 520, inscritos: 71, diasRestantes: 7 }), {
      asesores: 3,
      dias: null,
    });
    expect(f.diasParaCierre).toBe(7);
    expect(f.diasConfigurados).toBeNull();
    /// 449 / 7 = 64,14 · / 3 = 21,38.
    expect(f.metaDiariaFlotante).toBeCloseTo(449 / 7, 5);
    expect(f.metaPorAsesor).toBeCloseTo(449 / 7 / 3, 5);
  });

  it('con días propios, manda ESE número, no el del cronograma', () => {
    /// El admin tecleó 5; el cronograma dice 2. Gana el 5.
    const f = conMetas(fila({ cupos: 520, inscritos: 71, diasRestantes: 2 }), {
      asesores: 3,
      dias: 5,
    });
    expect(f.diasParaCierre).toBe(5);
    expect(f.diasConfigurados).toBe(5);
    expect(f.metaDiariaFlotante).toBeCloseTo(449 / 5, 5);
  });
});

describe('lo que falta configurar sale NULO, no cero', () => {
  it('sin asesores, la meta por asesor es null', () => {
    const f = conMetas(
      fila({ cupos: 520, inscritos: 71, diasRestantes: 7 }),
      { asesores: null, dias: null },
    );
    expect(f.asesores).toBeNull();
    expect(f.metaPorAsesor).toBeNull();
    /// La diaria sí se puede, porque hay días.
    expect(f.metaDiariaFlotante).toBeCloseTo(449 / 7, 5);
  });

  it('sin días de ningún lado, la meta diaria y la por asesor son null', () => {
    const f = conMetas(
      fila({ cupos: 520, inscritos: 71, diasRestantes: null }),
      { asesores: 3, dias: null },
    );
    expect(f.diasParaCierre).toBeNull();
    expect(f.metaDiariaFlotante).toBeNull();
    expect(f.metaPorAsesor).toBeNull();
  });

  it('meta ya cubierta: no se debe nada', () => {
    const f = conMetas(
      fila({ cupos: 520, inscritos: 600, diasRestantes: 7 }),
      { asesores: 3, dias: null },
    );
    expect(f.metaDiariaFlotante).toBe(0);
    expect(f.metaPorAsesor).toBe(0);
  });

  it('conserva lo que ya traía la fila (no pisa a Andrés)', () => {
    const base = fila({ cupos: 520, inscritos: 71, diasRestantes: 7 });
    const f = conMetas(base, { asesores: 3, dias: null });
    expect(f.accionFormacionId).toBe('af1');
    expect(f.codigo).toBe('AF1');
    expect(f.faltan).toBe(449);
    expect(f.leads).toBe(base.leads);
  });
});
