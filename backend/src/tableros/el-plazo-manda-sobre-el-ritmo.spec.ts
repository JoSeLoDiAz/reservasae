/**
 * La proyección contra el CRONOGRAMA, que es la pregunta real.
 *
 * «A este ritmo se llena el 22 de junio de 2027» es cierto y no
 * sirve: para esa fecha el curso arrancó y cerró hace meses. Lo
 * que hay que contestar es si llega antes del cierre, y el
 * cierre sale del cronograma.
 */

import { diaBogotaHace } from '../comun/dia-bogota';
import { calcularProyeccion, cierreDeLaAccion, type PuntoNeto } from './proyeccion';

/// Mediodia de Bogota, igual que en `proyeccion.spec.ts`.
const HOY = new Date('2026-08-10T17:00:00.000Z');

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function constante(dias: number, neto: number): PuntoNeto[] {
  return Array.from({ length: dias }, (_, i) => ({
    dia: diaBogotaHace(i, HOY),
    neto,
  }));
}

describe('cierreDeLaAccion', () => {
  it('toma el ÚLTIMO grupo que cierra, no el primero', () => {
    // mientras quede un grupo abierto, la meta se sigue llenando
    const cierre = cierreDeLaAccion([dia('2026-08-20'), dia('2026-12-01')]);
    expect(cierre?.toISOString().slice(0, 10)).toBe('2026-11-24');
  });

  it('los grupos sin fecha no restan plazo', () => {
    const cierre = cierreDeLaAccion([null, dia('2026-08-20'), null]);
    expect(cierre?.toISOString().slice(0, 10)).toBe('2026-08-13');
  });

  it('sin una sola fecha no hay cierre que calcular', () => {
    expect(cierreDeLaAccion([null, null])).toBeNull();
    expect(cierreDeLaAccion([])).toBeNull();
  });
});

describe('el veredicto contra el cronograma', () => {
  const comun = {
    dias: 14,
    hoy: HOY,
    serie: constante(14, 10),
    ocupados: 100,
    meta: 240,
  };

  it('con plazo de sobra, alcanza', () => {
    // 140 cupos a 10/dia, y el cierre esta a 106 dias
    const p = calcularProyeccion({ ...comun, cierre: dia('2026-11-24') });
    expect(p.cronograma).toBe('ALCANZA');
    expect(p.diasAlCierre).toBe(106);
    expect(p.faltaranAlCierre).toBe(0);
  });

  it('con el cierre encima, dice cuántos cupos van a faltar', () => {
    // tres dias a 10/dia son 30 de los 140 que faltan
    const p = calcularProyeccion({ ...comun, cierre: dia('2026-08-13') });
    expect(p.cronograma).toBe('NO_ALCANZA');
    expect(p.diasAlCierre).toBe(3);
    expect(p.faltaranAlCierre).toBe(110);
  });

  it('un cierre que ya pasó no se proyecta: se cuenta lo que faltó', () => {
    const p = calcularProyeccion({ ...comun, cierre: dia('2026-07-29') });
    expect(p.cronograma).toBe('CERRADA');
    expect(p.diasAlCierre).toBeLessThan(0);
    expect(p.faltaranAlCierre).toBe(140);
  });

  it('sin fecha en el cronograma lo dice, y no se lo inventa', () => {
    const p = calcularProyeccion({ ...comun, cierre: null });
    expect(p.cronograma).toBe('SIN_CRONOGRAMA');
    expect(p.cierre).toBeNull();
    expect(p.faltaranAlCierre).toBeNull();
    // el ritmo se sigue calculando: es la otra pregunta
    expect(p.estado).toBe('ESTIMADA');
  });

  it('si se cancela más de lo que entra, el día del cierre falta MÁS', () => {
    const p = calcularProyeccion({
      ...comun,
      serie: constante(14, -1),
      cierre: dia('2026-08-13'),
    });
    expect(p.estado).toBe('RETROCEDE');
    expect(p.cronograma).toBe('NO_ALCANZA');
    // 140 que faltan mas los 3 que se pierden en 3 dias
    expect(p.faltaranAlCierre).toBe(143);
  });

  it('la meta ya cumplida no depende del plazo', () => {
    const p = calcularProyeccion({
      ...comun,
      ocupados: 240,
      cierre: dia('2026-08-13'),
    });
    expect(p.estado).toBe('CUMPLIDA');
    expect(p.faltaranAlCierre).toBe(0);
  });
});
