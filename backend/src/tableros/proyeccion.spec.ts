import { calcularProyeccion, ritmoPorDia, type PuntoNeto } from './proyeccion';

const HOY = new Date('2026-08-10T00:00:00.000Z');

/** Serie de `dias` días con `neto` cupos cada uno. */
function constante(dias: number, neto: number): PuntoNeto[] {
  return Array.from({ length: dias }, (_, i) => ({
    dia: new Date(HOY.getTime() - i * 86_400_000).toISOString().slice(0, 10),
    neto,
  }));
}

describe('ritmoPorDia', () => {
  it('divide entre días de calendario, no entre días con datos', () => {
    // 14 cupos en un solo día de una ventana de 14
    const serie: PuntoNeto[] = [{ dia: '2026-08-10', neto: 14 }];
    expect(ritmoPorDia(serie, 14, HOY)).toBe(1);
  });

  it('ignora lo que queda fuera de la ventana', () => {
    const serie: PuntoNeto[] = [
      { dia: '2026-08-10', neto: 7 },
      { dia: '2026-01-01', neto: 700 },
    ];
    expect(ritmoPorDia(serie, 7, HOY)).toBe(1);
  });

  it('una ventana de cero días no divide entre cero', () => {
    expect(ritmoPorDia(constante(3, 5), 0, HOY)).toBe(0);
  });
});

describe('calcularProyeccion', () => {
  const comun = { dias: 14, hoy: HOY };

  it('estima la fecha a partir del ritmo', () => {
    const p = calcularProyeccion({
      ...comun,
      serie: constante(14, 10),
      ocupados: 100,
      meta: 240,
    });
    expect(p.estado).toBe('ESTIMADA');
    expect(p.ritmoDiario).toBe(10);
    expect(p.faltan).toBe(140);
    expect(p.diasEstimados).toBe(14);
    expect(p.fechaEstimada).toBe('2026-08-24');
  });

  it('la meta cumplida no proyecta nada', () => {
    const p = calcularProyeccion({
      ...comun,
      serie: constante(14, 10),
      ocupados: 300,
      meta: 240,
    });
    expect(p.estado).toBe('CUMPLIDA');
    expect(p.faltan).toBe(0);
    expect(p.fechaEstimada).toBeNull();
  });

  it('sin meta no hay contra qué proyectar', () => {
    const p = calcularProyeccion({ ...comun, serie: constante(14, 4), ocupados: 9, meta: 0 });
    expect(p.estado).toBe('SIN_META');
  });

  it('sin movimiento no se inventa una fecha', () => {
    const p = calcularProyeccion({ ...comun, serie: [], ocupados: 10, meta: 100 });
    expect(p.estado).toBe('SIN_RITMO');
    expect(p.ritmoDiario).toBe(0);
    expect(p.fechaEstimada).toBeNull();
  });

  it('si se cancela más de lo que entra, lo dice', () => {
    const p = calcularProyeccion({
      ...comun,
      serie: constante(14, -2),
      ocupados: 50,
      meta: 100,
    });
    expect(p.estado).toBe('RETROCEDE');
    expect(p.fechaEstimada).toBeNull();
  });

  it('más de un año no se pone como fecha', () => {
    const p = calcularProyeccion({
      ...comun,
      serie: [{ dia: '2026-08-10', neto: 1 }],
      ocupados: 0,
      meta: 4000,
    });
    expect(p.estado).toBe('MUY_LEJOS');
    expect(p.diasEstimados).toBeGreaterThan(365);
    expect(p.fechaEstimada).toBeNull();
  });

  it('con menos de una semana de historia la confianza baja', () => {
    const p = calcularProyeccion({
      ...comun,
      serie: constante(3, 10),
      ocupados: 10,
      meta: 100,
      diasDeHistoria: 3,
    });
    expect(p.confianza).toBe('BAJA');
  });

  it('ritmo7 contra ritmo14 dice si acelera', () => {
    const serie: PuntoNeto[] = [
      ...constante(7, 20),
      ...Array.from({ length: 7 }, (_, i) => ({
        dia: new Date(HOY.getTime() - (i + 7) * 86_400_000).toISOString().slice(0, 10),
        neto: 0,
      })),
    ];
    const p = calcularProyeccion({ ...comun, serie, ocupados: 140, meta: 400 });
    expect(p.ritmo7).toBe(20);
    expect(p.ritmo14).toBe(10);
    expect(p.ritmo7).toBeGreaterThan(p.ritmo14);
  });

  it('marca el origen cuando la serie es aproximada', () => {
    const p = calcularProyeccion({
      ...comun,
      serie: constante(14, 5),
      ocupados: 70,
      meta: 100,
      origen: 'APROXIMADO',
    });
    expect(p.origen).toBe('APROXIMADO');
  });
});
