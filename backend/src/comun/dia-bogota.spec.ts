/** El día de Bogotá no es el día de UTC. */

import { aDiaBogota, aDiaDeCalendario, diaBogotaHace } from './dia-bogota';

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

describe('una fecha de calendario NO se lee en Bogotá', () => {
  /// El grupo que empieza el 1 de septiembre lo teclea alguien
  /// como `2026-09-01`, y `new Date(...)` lo guarda a medianoche
  /// UTC. Leerlo «en el día de Bogotá» lo retrasa un día entero.
  /// Pasó de verdad con las fechas de los grupos.
  const TECLEADA = new Date('2026-09-01');

  it('se guarda a medianoche UTC', () => {
    expect(TECLEADA.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('leída como fecha de calendario, es el día que se tecleó', () => {
    expect(aDiaDeCalendario(TECLEADA)).toBe('2026-09-01');
  });

  it('leída como instante, se va un día atrás: es el defecto', () => {
    /// Este test existe para dejar escrito POR QUÉ hay dos
    /// funciones. Si algún día `aDiaBogota` dejara de retrasarla,
    /// la distinción habría dejado de hacer falta y este test lo
    /// diría fallando.
    expect(aDiaBogota(TECLEADA)).toBe('2026-08-31');
    expect(aDiaBogota(TECLEADA)).not.toBe(aDiaDeCalendario(TECLEADA));
  });

  it('y un instante de media tarde da el mismo día por las dos', () => {
    /// Por eso el defecto no se ve casi nunca: solo se separa
    /// entre las 19:00 y la medianoche, y en las fechas de
    /// calendario, que son exactamente medianoche.
    const tarde = new Date('2026-09-01T17:00:00.000Z');
    expect(aDiaBogota(tarde)).toBe('2026-09-01');
    expect(aDiaDeCalendario(tarde)).toBe('2026-09-01');
  });
});
