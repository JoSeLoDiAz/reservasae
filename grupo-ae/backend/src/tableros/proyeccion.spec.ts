import { diaBogotaHace } from '../comun/dia-bogota';
import { calcularProyeccion, ritmoPorDia, type PuntoNeto } from './proyeccion';

/// Mediodia de Bogota, no medianoche UTC.
///
/// Con `T00:00:00Z` el instante caia a las 19:00 del dia
/// ANTERIOR en Bogota, asi que la serie y la ventana hablaban de
/// dias distintos. Es el mismo defecto que se estaba arreglando,
/// metido en el propio test.
const HOY = new Date('2026-08-10T17:00:00.000Z');

/** Serie de `dias` días con `neto` cupos cada uno. */
function constante(dias: number, neto: number): PuntoNeto[] {
  return Array.from({ length: dias }, (_, i) => ({
    dia: diaBogotaHace(i, HOY),
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
        dia: diaBogotaHace(i + 7, HOY),
        neto: 0,
      })),
    ];
    const p = calcularProyeccion({ ...comun, serie, ocupados: 140, meta: 400 });
    expect(p.ritmo7).toBe(20);
    expect(p.ritmo14).toBe(10);
    expect(p.ritmo7 ?? 0).toBeGreaterThan(p.ritmo14 ?? 0);
  });

  it('ritmo14 con una ventana de 7 dice NULL, no la mitad', () => {
    /// El defecto: sumaba siete días de serie y dividía entre
    /// catorce, así que el panel enseñaba la mitad del ritmo
    /// real como si fuera el de dos semanas.
    const p = calcularProyeccion({
      serie: constante(7, 20),
      dias: 7,
      hoy: HOY,
      ocupados: 140,
      meta: 400,
    });
    expect(p.ritmoDiario).toBe(20);
    expect(p.ritmo7).toBe(20);
    expect(p.ritmo14).toBeNull();
  });

  it('la ventana corta por el día de Bogotá, no por el de UTC', () => {
    /// A las 20:00 de Bogotá el tope en UTC ya era mañana, así
    /// que la ventana de 14 se corría un día y dejaba fuera el
    /// más antiguo: 13 días de 20 entre 14 = 18,57.
    const tarde = new Date('2026-08-11T01:00:00.000Z');
    const serie = Array.from({ length: 14 }, (_, i) => ({
      dia: diaBogotaHace(i, tarde),
      neto: 20,
    }));
    const p = calcularProyeccion({
      serie,
      dias: 14,
      hoy: tarde,
      ocupados: 280,
      meta: 500,
    });
    expect(p.ritmoDiario).toBe(20);
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
