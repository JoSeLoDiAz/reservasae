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
import { rotuloDelPeriodo } from './control';
import { describirVentana, fechaDeGrupo } from './tablero-academico';
import { resolverVentana } from './ventana';

/**
 * El rótulo, tal como lo pinta el tablero.
 *
 * Llama a `describirVentana`, que es la función que se arregló.
 * La primera versión de este spec REIMPLEMENTABA esa línea
 * —`hasta.getTime() - 1`— en vez de llamarla, así que devolver
 * el código a `- DIA` no lo habría hecho fallar: la prueba de
 * mutación que se le hizo mutaba la copia del spec. Un test que
 * copia lo que dice proteger no protege nada, y da confianza sin
 * darla, que es peor que no tenerlo.
 */
function rotulo(rango: Parameters<typeof resolverVentana>[0], ahora: Date) {
  return describirVentana(resolverVentana(rango, undefined, undefined, ahora));
}

describe('el último día de la ventana', () => {
  it('«Hoy» a media tarde termina HOY, no ayer', () => {
    /// 14:00 en Bogotá del 27.
    const v = rotulo('HOY', new Date('2026-08-27T19:00:00.000Z'));

    expect(v.desde).toBe('2026-08-27');
    expect(v.hasta).toBe('2026-08-27');
  });

  it('«Hoy» a las 20:00 de Bogotá sigue siendo el 27', () => {
    /// Es la hora en la que `toISOString()` ya decía 28.
    const v = rotulo('HOY', new Date('2026-08-28T01:00:00.000Z'));

    expect(v.desde).toBe('2026-08-27');
    expect(v.hasta).toBe('2026-08-27');
  });

  it('«Ayer», que sí está cerrada, termina ayer', () => {
    const v = rotulo('AYER', new Date('2026-08-27T19:00:00.000Z'));

    expect(v.desde).toBe('2026-08-26');
    expect(v.hasta).toBe('2026-08-26');
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
      'TODO',
    ] as const) {
      const v = rotulo(rango, ahora);
      if (!v.desde || !v.hasta) continue;
      expect({ rango, bien: v.hasta >= v.desde }).toEqual({ rango, bien: true });
    }
  });

  it('«Hoy» dura un solo día, no cero ni dos', () => {
    /// Con el `- DIA` daba «27 ago → 26 ago», que además de
    /// estar del revés dice que el periodo no existe.
    const v = rotulo('HOY', new Date('2026-08-27T19:00:00.000Z'));
    expect(v.desde).toBe(v.hasta);
  });

  it('la ventana de una semana cubre siete días de Bogotá', () => {
    const v = rotulo('SEMANA', new Date('2026-08-27T19:00:00.000Z'));
    const dias =
      (Date.parse(`${v.hasta}T00:00:00Z`) - Date.parse(`${v.desde}T00:00:00Z`)) /
        86_400_000 +
      1;
    expect(dias).toBe(7);
  });
});

describe('las fechas de un grupo son fechas de calendario', () => {
  /// El rótulo de la ventana y las fechas de un grupo salen de
  /// la misma pantalla y NO se leen igual. Aplicarles el día de
  /// Bogotá las retrasa un día, porque se guardan a medianoche
  /// UTC: el grupo que empieza el 1 de septiembre salía
  /// empezando el 31 de agosto. Pasó de verdad.
  it('el 1 de septiembre es el 1 de septiembre', () => {
    expect(fechaDeGrupo(new Date('2026-09-01'))).toBe('2026-09-01');
  });

  it('el primero de enero no se va al año anterior', () => {
    /// El caso caro: en Bogotá daría 2025-12-31.
    expect(fechaDeGrupo(new Date('2026-01-01'))).toBe('2026-01-01');
  });

  it('sin fecha no se inventa ninguna', () => {
    expect(fechaDeGrupo(null)).toBeNull();
  });
});

describe('el rótulo del control del CRM: el mismo, y hasta hoy sin test', () => {
  /// `control.ts` tiene su propio rótulo, gemelo del del tablero
  /// académico. Tenía los DOS mismos defectos —el día de UTC y
  /// el «- DIA»— y se quedó sin arreglar cuando se arregló
  /// aquel; y después se quedó sin test. Lo señaló la revisión.
  function suRotulo(rango: Parameters<typeof resolverVentana>[0], ahora: Date) {
    return rotuloDelPeriodo(resolverVentana(rango, undefined, undefined, ahora));
  }

  it('«Hoy» a las 20:00 de Bogotá es el 27, no el 28 ni el 26', () => {
    const v = suRotulo('HOY', new Date('2026-08-28T01:00:00.000Z'));
    expect(v.desde).toBe('2026-08-27');
    expect(v.hasta).toBe('2026-08-27');
  });

  it('ninguna ventana termina antes de empezar', () => {
    const ahora = new Date('2026-08-27T19:00:00.000Z');
    for (const rango of ['HOY', 'AYER', 'SEMANA', 'MES', 'TRIMESTRE', 'ANO'] as const) {
      const v = suRotulo(rango, ahora);
      if (!v.desde || !v.hasta) continue;
      expect({ rango, bien: v.hasta >= v.desde }).toEqual({ rango, bien: true });
    }
  });

  it('dice lo mismo que el del tablero académico', () => {
    /// Son dos, y mientras lo sean tienen que coincidir: que
    /// discrepen es como empezó esto.
    const ahora = new Date('2026-08-28T01:00:00.000Z');
    for (const rango of ['HOY', 'AYER', 'SEMANA', 'MES'] as const) {
      const c = resolverVentana(rango, undefined, undefined, ahora);
      expect({
        rango,
        desde: rotuloDelPeriodo(c).desde,
        hasta: rotuloDelPeriodo(c).hasta,
      }).toEqual({
        rango,
        desde: describirVentana(c).desde,
        hasta: describirVentana(c).hasta,
      });
    }
  });
});
