/** Lo que suman unas metas, sin contar nada dos veces. */

import type { TipoEmbudo } from '../../generated/prisma';
import { aPesos, type Dinero } from './dinero';

/// Lo único que hace falta de una meta para poder sumarla.
export type MetaQueSuma = {
  convenioId: string;
  /// Null: es la meta general de ese convenio, la de los dos
  /// embudos juntos.
  embudo: TipoEmbudo | null;
  valor: Dinero;
};

/**
 * Sumar metas es decidir, no acumular. Dos reglas:
 *
 * 1. **Dentro de un convenio, la general manda.** Fijar a la vez
 *    una meta general y una por embudo es contradecirse, y sumarlas
 *    contaría el total junto con sus partes: el asesor aparecería
 *    debiendo el doble y no habría forma de ver por qué. Ante la
 *    contradicción gana la general, porque es un total y los
 *    totales no se suman con sus sumandos.
 *
 * 2. **Entre convenios se suma.** Quien lleva los dos gremios
 *    responde por lo de los dos, y su tablero enseña los dos. Es la
 *    misma regla que sigue el ámbito en todo el panel.
 *
 * Se llama con las metas de UN dueño: las de una persona, o las
 * del equipo. Agrupa por convenio y no por dueño, así que con las
 * de varias personas mezcladas la general de una taparía las de
 * embudo de otra. Para el total de un grupo se suman los totales de
 * cada quien, que además es lo que enseña la tabla.
 *
 * Vive aparte y con su .spec porque es de las cosas que se rompen
 * en silencio: una meta mal sumada no lanza ningún error, solo
 * enseña un porcentaje que no es.
 */
export function sumarMetas(filas: MetaQueSuma[]): number {
  const porConvenio = new Map<string, MetaQueSuma[]>();
  for (const f of filas) {
    const grupo = porConvenio.get(f.convenioId) ?? [];
    grupo.push(f);
    porConvenio.set(f.convenioId, grupo);
  }

  let total = 0;
  for (const grupo of porConvenio.values()) {
    const general = grupo.find((f) => f.embudo === null);
    total += general
      ? aPesos(general.valor)
      : grupo.reduce((s, f) => s + aPesos(f.valor), 0);
  }
  return total;
}
