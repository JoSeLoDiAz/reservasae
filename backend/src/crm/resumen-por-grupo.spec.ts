/** Las columnas calculadas del detalle por grupos. */

import { completarGrupo } from './resumen-por-grupo';

function cruda(p: Partial<Parameters<typeof completarGrupo>[0]> = {}) {
  return {
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
}

describe('completarGrupo', () => {
  it('los leads son los nominados más la campaña', () => {
    const f = completarGrupo(cruda({ nominadosPorEmpresa: 12, campanaDigital: 30 }));
    expect(f.totalLeads).toBe(42);
  });

  it('los inscritos suman los dos orígenes', () => {
    const f = completarGrupo(cruda({ inscritosReservas: 5, inscritosCampana: 9 }));
    expect(f.totalInscritos).toBe(14);
  });

  it('los cupos disponibles descuentan INSCRITOS, no leads', () => {
    // la regla que el cliente corrigió el 23 sep 2026: una reserva es
    // una intención; el cupo se consume al inscribirse
    const f = completarGrupo(
      cruda({ meta: 65, nominadosPorEmpresa: 40, campanaDigital: 40, inscritosCampana: 20 }),
    );
    expect(f.cuposDisponibles).toBe(45);
  });

  it('un grupo lleno queda CERRADO, y pasado también', () => {
    expect(completarGrupo(cruda({ meta: 10, inscritosCampana: 10 })).estado).toBe('CERRADO');
    expect(completarGrupo(cruda({ meta: 10, inscritosCampana: 12 })).estado).toBe('CERRADO');
    expect(completarGrupo(cruda({ meta: 10, inscritosCampana: 9 })).estado).toBe('ABIERTO');
  });

  it('sin leads la conversión es nula: no es un 0 %, es que no hay de qué', () => {
    expect(completarGrupo(cruda()).conversion).toBeNull();
  });

  it('con leads la conversión es inscritos sobre leads', () => {
    const f = completarGrupo(cruda({ campanaDigital: 40, inscritosCampana: 10 }));
    expect(f.conversion).toBeCloseTo(0.25);
  });

  it('un grupo sin coberturas da meta cero y disponibles negativos si hay inscritos', () => {
    const f = completarGrupo(cruda({ meta: 0, inscritosCampana: 3 }));
    expect(f.cuposDisponibles).toBe(-3);
    expect(f.estado).toBe('CERRADO');
  });
});
