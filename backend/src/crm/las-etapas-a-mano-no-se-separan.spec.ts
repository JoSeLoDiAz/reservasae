/** La lista de etapas del panel dice lo mismo que la del servidor. */

/**
 * Lo encontró el barrido del 7 oct 2026: la pantalla ofrecía CUATRO
 * etapas a mano y el servidor acepta CINCO. Faltaba `EN_FORMACION`,
 * que el servidor admite a propósito ---«el ingreso tardío y la
 * matrícula adelantada, que el calendario no cubre»---.
 *
 * El síntoma no era un error: era que una cosa que el sistema permite
 * no se podía hacer, y nadie sabía por qué. De los peores, porque no
 * deja rastro en ningún registro.
 *
 * Es el mismo caso que `el-espejo-no-se-separa` con los permisos: una
 * copia a mano sin nada que la sujete. Esto la sujeta.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ETAPAS_A_MANO } from './crm.service';

const PANEL = readFileSync(
  join(__dirname, '..', '..', '..', 'frontend', 'src', 'lib', 'crm-api.ts'),
  'utf8',
);

/// Lo que el panel declara, leído de su propia lista y no de todo el
/// fichero: «INSCRITO» sale en veinte sitios más.
function lasDelPanel(): string[] {
  const i = PANEL.indexOf('export const ETAPAS_A_MANO');
  const bloque = PANEL.slice(i, PANEL.indexOf('];', i));
  return [...bloque.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
}

describe('las dos listas de etapas a mano', () => {
  it('dicen exactamente lo mismo, y en el mismo orden', () => {
    expect(lasDelPanel()).toEqual(ETAPAS_A_MANO);
  });

  /**
   * Y «DATOS_COMPLETOS» NO ESTÁ EN NINGUNA DE LAS DOS, que es una
   * decisión y no un olvido: dejó de ser etapa para ser estado
   * calculado, y un estado que alguien puede poner a dedo no prueba
   * nada. El servidor lo rechaza aunque se mande.
   */
  it('y ninguna ofrece «datos completos»', () => {
    expect(ETAPAS_A_MANO).not.toContain('DATOS_COMPLETOS');
    expect(lasDelPanel()).not.toContain('DATOS_COMPLETOS');
  });

  /// Y las cuatro salidas del aula tampoco: esas las gobierna el
  /// académico y no se ponen desde Inscripciones.
  it('y ninguna ofrece las salidas del aula', () => {
    for (const s of ['RETIRADO', 'NO_APROBO', 'DESERTO', 'ABANDONO']) {
      expect(lasDelPanel()).not.toContain(s);
    }
  });
});
