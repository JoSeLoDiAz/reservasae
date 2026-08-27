/** El día de Bogotá no es el día de UTC. */

import { aDiaBogota, diaBogotaHace } from './dia-bogota';

describe('aDiaBogota', () => {
  it('las 20:00 de Bogotá siguen siendo el mismo día', () => {
    /// 20:00 del 26 en Bogotá son las 01:00 del 27 en UTC.
    /// `toISOString()` decía 27, y es la hora a la que la
    /// gente diligencia.
    expect(aDiaBogota(new Date('2026-08-27T01:00:00.000Z'))).toBe('2026-08-26');
  });

  it('las 23:59 de Bogotá, también', () => {
    expect(aDiaBogota(new Date('2026-08-27T04:59:00.000Z'))).toBe('2026-08-26');
  });

  it('medianoche de Bogotá ya es el día siguiente', () => {
    expect(aDiaBogota(new Date('2026-08-27T05:00:00.000Z'))).toBe('2026-08-27');
  });

  it('el mediodía de Bogotá coincide con UTC, y por eso no se veía', () => {
    expect(aDiaBogota(new Date('2026-08-27T17:00:00.000Z'))).toBe('2026-08-27');
  });

  it('cruza el año por el día de Bogotá', () => {
    /// 19:00 del 31 de diciembre en Bogotá: en UTC ya es enero.
    expect(aDiaBogota(new Date('2027-01-01T00:00:00.000Z'))).toBe('2026-12-31');
  });
});

describe('diaBogotaHace', () => {
  it('hace 0 días es hoy', () => {
    const hoy = new Date('2026-08-27T01:00:00.000Z');
    expect(diaBogotaHace(0, hoy)).toBe('2026-08-26');
  });

  it('hace 13 días abre una ventana de 14 con hoy dentro', () => {
    const hoy = new Date('2026-08-27T17:00:00.000Z');
    expect(diaBogotaHace(13, hoy)).toBe('2026-08-14');
    expect(aDiaBogota(hoy)).toBe('2026-08-27');
  });
});
