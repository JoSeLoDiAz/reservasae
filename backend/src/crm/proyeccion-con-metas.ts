/**
 * Le pega a cada fila de la proyección las metas de Josse.
 *
 * `proyectarInscripciones` (de Andrés) contesta «¿esta acción llega a
 * sus cupos?». Encima va la cuenta que pidió Josse con su hoja: metas
 * de inscripción con el # de asesores y los días para el cierre que el
 * administrador pone a mano.
 *
 * Va aparte y como función pura para no tocar `proyeccion.ts` ni sus
 * pruebas: aquella no sabe de asesores ni de unos días editables, y
 * esto se prueba solo.
 */

import { metasDeAccion } from './proyeccion-metas';
import type { FilaDeProyeccion } from './proyeccion';

/** Lo que el administrador fijó para una acción. */
export type ConfigProyeccion = {
  /// # asesores. Nulo = sin configurar.
  asesores: number | null;
  /// Los días para el cierre que él teclea, un número. Nulo = se cae
  /// a los que quedan según el cronograma.
  dias: number | null;
};

export type FilaConMetas = FilaDeProyeccion & {
  /// # asesores que puso el admin. Nulo = sin configurar.
  asesores: number | null;
  /// Los días que el admin tecleó, o null si no puso ninguno.
  diasConfigurados: number | null;
  /// Los días EFECTIVOS: los del admin si los puso, si no los que
  /// quedan según el cronograma. Nulo si no hay ninguno.
  diasParaCierre: number | null;
  /// La meta diaria en coma flotante, para pintarla redondeada.
  metaDiariaFlotante: number | null;
  /// La meta de cada asesor: meta diaria / # asesores. Nula sin
  /// asesores configurados, que NO es lo mismo que cero.
  metaPorAsesor: number | null;
};

export function conMetas(
  fila: FilaDeProyeccion,
  config: ConfigProyeccion,
): FilaConMetas {
  /// Los días del admin mandan; si no los puso, los del cronograma.
  const diasParaCierre =
    config.dias !== null ? config.dias : fila.diasRestantes;

  const hayDias = diasParaCierre !== null && diasParaCierre > 0;
  const hayAsesores = config.asesores !== null && config.asesores > 0;

  const m = metasDeAccion({
    metaInscritos: fila.cupos,
    inscritosConfirmados: fila.inscritos,
    numAsesores: config.asesores ?? 0,
    diasParaCierre: diasParaCierre ?? 0,
  });

  return {
    ...fila,
    asesores: config.asesores,
    diasConfigurados: config.dias,
    diasParaCierre,
    metaDiariaFlotante: hayDias ? m.metaDiaria : null,
    /// Sin asesores o sin días, la meta por asesor es NULA, no cero:
    /// un cero se leería como «cada asesor no hace nada», cuando lo
    /// cierto es que falta configurar.
    metaPorAsesor: hayDias && hayAsesores ? m.metaPorAsesor : null,
  };
}
