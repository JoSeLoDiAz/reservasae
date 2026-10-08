/** Contar inscripciones es contar quien ENTRÓ, no quien se quedó. */

/**
 * UN TRASLADO DE GRUPO NO ES UNA INSCRIPCIÓN.
 *
 * `etapaDespues: 'INSCRITO'` a secas cuenta también los movimientos
 * `INSCRITO → INSCRITO`, y ese es exactamente el que escribe un cambio
 * de cohorte: `asignar` deja su huella con la MISMA etapa antes y
 * después, a propósito --«misma etapa: no es una transicion»--.
 *
 * O sea que mover de grupo a veinte personas diría que se inscribieron
 * veinte ese día. El defecto no existía hasta hoy: aparece porque el
 * traslado de grupo y estos contadores entraron el mismo día, cada uno
 * correcto por su lado.
 *
 * `etapaAntes` es NULABLE y el nulo SÍ cuenta --es la primera vez--,
 * así que la condición es `NOT { etapaAntes: 'INSCRITO' }` y no
 * `etapaAntes: { not: 'INSCRITO' }`, que en Prisma deja fuera los nulos.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const servicio = readFileSync(join(__dirname, 'crm.service.ts'), 'utf8');

describe('entrar a INSCRITO no es seguir en INSCRITO', () => {
  /// Sin esto, renombrar la consulta dejaria el spec en verde sin
  /// mirar nada. Es la leccion de `quien-crea-se-queda-la-ficha`.
  it('hay consultas que contar', () => {
    const cuantas = (servicio.match(/etapaDespues: 'INSCRITO',/g) ?? []).length;
    expect(cuantas).toBeGreaterThanOrEqual(2);
  });

  it('todas las que cuentan inscripciones excluyen el INSCRITO→INSCRITO', () => {
    /// Por cada `etapaDespues: 'INSCRITO'` tiene que venir su NOT
    /// pegado: si alguien anade una tercera consulta sin el, cae.
    const conGuarda = (
      servicio.match(
        /etapaDespues: 'INSCRITO',\s*\n\s*NOT: \{ etapaAntes: 'INSCRITO' \},/g,
      ) ?? []
    ).length;
    const total = (servicio.match(/etapaDespues: 'INSCRITO',/g) ?? []).length;
    expect(conGuarda).toBe(total);
  });

  /// EL CANDADO AL REVES, y es el que protege del arreglo excesivo:
  /// con `etapaAntes: { not: 'INSCRITO' }` Prisma deja fuera los
  /// NULOS, o sea la PRIMERA inscripcion de cada quien --que es
  /// justo la que siempre hay que contar--.
  it('no se escribe de la forma que se come los nulos', () => {
    expect(servicio).not.toMatch(/etapaAntes: \{ not: 'INSCRITO' \}/);
  });

  /// Y que el traslado siga dejando su huella con la misma etapa:
  /// si alguien «arregla» eso, este contador vuelve a cuadrar por el
  /// motivo equivocado y perdemos el rastro del cambio de cohorte.
  it('el traslado de grupo sigue escribiendo la misma etapa', () => {
    expect(servicio).toMatch(
      /etapaAntes: p\.etapa,\s*\n\s*etapaDespues: p\.etapa,/,
    );
  });
});
