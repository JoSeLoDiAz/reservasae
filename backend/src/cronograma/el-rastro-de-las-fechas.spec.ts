/** Quién mueve las fechas del cronograma queda escrito y se puede leer. */

/**
 * Pendiente 8 (7 oct 2026). La huella de `GRUPO_EDITADO` ya decía el
 * antes y el después del inicio y del fin, pero:
 *
 *   - los días de las sesiones solo dejaban «sesiones» en los campos
 *     tocados, sin decir de qué día a qué día;
 *   - y no había por dónde leerla.
 */

import { fraseDelCambioDeFechas } from './cronograma.service';

const dia = (x: string) => new Date(`${x}T00:00:00.000Z`);

describe('la frase del cambio', () => {
  const antes = {
    fechaInicio: dia('2026-10-12'),
    fechaFin: dia('2026-11-30'),
    sesiones: [{ dia: dia('2026-10-14') }, { dia: dia('2026-10-21') }],
  };

  it('dice el inicio y el fin, como antes', () => {
    expect(
      fraseDelCambioDeFechas(antes, dia('2026-10-19'), dia('2026-11-30')),
    ).toBe('inicio 2026-10-12 → 2026-10-19');
  });

  it('y ahora también el día de la sesión que se movió', () => {
    expect(
      fraseDelCambioDeFechas(antes, antes.fechaInicio, antes.fechaFin, [
        dia('2026-10-14'),
        dia('2026-10-28'),
      ]),
    ).toBe('sesión 2 2026-10-21 → 2026-10-28');
  });

  it('una sesión nueva y una quitada se dicen como tales', () => {
    expect(
      fraseDelCambioDeFechas(antes, antes.fechaInicio, antes.fechaFin, [
        dia('2026-10-14'),
      ]),
    ).toBe('sesión 2 2026-10-21 → quitada');
    expect(
      fraseDelCambioDeFechas(antes, antes.fechaInicio, antes.fechaFin, [
        dia('2026-10-14'),
        dia('2026-10-21'),
        null,
      ]),
    ).toBe('sesión 3 no existía → sin fecha');
  });

  /// Sin sesiones en la petición no se tocaron: no se inventa cambio.
  it('si no vienen sesiones, no se habla de ellas', () => {
    expect(
      fraseDelCambioDeFechas(antes, antes.fechaInicio, antes.fechaFin),
    ).toBe('sin cambio de fechas');
  });
});

describe('el rastro se lee', () => {
  const leer = (f: string) =>
    require('fs').readFileSync(require('path').join(__dirname, f), 'utf8') as string;

  it('hay una ruta para pedirlo', () => {
    expect(leer('cronograma.controller.ts')).toContain(
      "@Get('grupos/:id/cambios')",
    );
  });

  /// Antes de leer la bitácora se comprueba que el grupo es del
  /// gremio de quien pregunta.
  it('y mira el ámbito antes de leer', () => {
    const s = leer('cronograma.service.ts');
    const i = s.indexOf('async cambiosDelGrupo');
    const cuerpo = s.slice(i, s.indexOf('\n  }\n', i) + 1 || undefined);
    expect(cuerpo).toContain('convenioId: { in: ambito }');
    expect(cuerpo.indexOf('convenioId: { in: ambito }')).toBeLessThan(
      cuerpo.indexOf('auditoria.historial'),
    );
  });
});
