/** El rango que se pinta no puede terminar antes de empezar. */

/**
 * «Hoy» salía etiquetado «27 ago → 26 ago». El último día
 * dentro de la ventana se calculaba restando un día entero a
 * `hasta`, y eso solo vale cuando `hasta` es la medianoche
 * siguiente: el periodo en curso se recorta en «ahora», que ya
 * está DENTRO del último día, así que restarle un día se iba
 * uno más atrás.
 *
 * Se prueba a través de la función pública del tablero para que
 * el test siga valiendo si el cálculo se mueve de sitio.
 */

import { aDiaBogota } from '../comun/dia-bogota';
import { resolverVentana } from './ventana';

/// El último día dentro, tal como lo pinta el tablero.
/// Es la misma línea de `describirVentana`.
function ultimoDiaDentro(hasta: Date): string {
  return aDiaBogota(new Date(hasta.getTime() - 1));
}

describe('el último día de la ventana', () => {
  it('«Hoy» a media tarde termina HOY, no ayer', () => {
    /// 14:00 en Bogotá del 27.
    const ahora = new Date('2026-08-27T19:00:00.000Z');
    const c = resolverVentana('HOY', undefined, undefined, ahora);

    expect(c.actual).not.toBeNull();
    expect(aDiaBogota(c.actual!.desde)).toBe('2026-08-27');
    expect(ultimoDiaDentro(c.actual!.hasta)).toBe('2026-08-27');
  });

  it('«Hoy» a las 20:00 de Bogotá sigue siendo el 27', () => {
    /// Es la hora en la que `toISOString()` ya decía 28.
    const ahora = new Date('2026-08-28T01:00:00.000Z');
    const c = resolverVentana('HOY', undefined, undefined, ahora);

    expect(aDiaBogota(c.actual!.desde)).toBe('2026-08-27');
    expect(ultimoDiaDentro(c.actual!.hasta)).toBe('2026-08-27');
  });

  it('«Ayer», que sí está cerrada, termina ayer', () => {
    const ahora = new Date('2026-08-27T19:00:00.000Z');
    const c = resolverVentana('AYER', undefined, undefined, ahora);

    expect(aDiaBogota(c.actual!.desde)).toBe('2026-08-26');
    expect(ultimoDiaDentro(c.actual!.hasta)).toBe('2026-08-26');
  });

  it('ninguna ventana termina antes de empezar', () => {
    const ahora = new Date('2026-08-27T19:00:00.000Z');
    for (const rango of [
      'HOY',
      'AYER',
      'SEMANA',
      'MES',
      'MES_PASADO',
      'TRIMESTRE',
      'ANO',
    ] as const) {
      const c = resolverVentana(rango, undefined, undefined, ahora);
      if (!c.actual) continue;
      const desde = aDiaBogota(c.actual.desde);
      const hasta = ultimoDiaDentro(c.actual.hasta);
      expect(hasta >= desde).toBe(true);
    }
  });
});
