/**
 * Le pega a cada fila de la proyección las metas de Josse.
 *
 * `proyectarInscripciones` (de Andrés) contesta «¿esta acción llega a
 * sus cupos?». Encima va la cuenta que pidió Josse: cuántas
 * inscripciones al día y por asesor hacen falta, con el # de asesores
 * y la fecha de cierre que el administrador pone a mano.
 *
 * Va aparte y como función pura para no tocar `proyeccion.ts` ni sus
 * pruebas: aquella no sabe de asesores ni de una fecha editable, y
 * esto se prueba solo.
 */

import { diasDeTrabajoEntre } from './calendario-inscripcion';
import { metasDeAccion } from './proyeccion-metas';
import type { FilaDeProyeccion } from './proyeccion';

/** Lo que el administrador fijó para una acción. */
export type ConfigProyeccion = {
  /// # asesores. Nulo = sin configurar.
  asesores: number | null;
  /// La fecha de cierre de la proyección, aparte del cronograma.
  /// Nula = se usa la del cronograma.
  cierre: Date | null;
};

export type FilaConMetas = FilaDeProyeccion & {
  /// # asesores que puso el admin. Nulo = sin configurar.
  asesores: number | null;
  /// La fecha de cierre que fijó el admin (ISO), o null.
  cierreProyeccion: string | null;
  /// Días de trabajo al cierre EFECTIVO: el del admin si lo puso, si
  /// no el del cronograma. Nulo si no hay ninguno.
  diasParaCierre: number | null;
  /// La meta diaria en coma flotante, para pintarla redondeada. Sale
  /// de los días EFECTIVOS; por eso puede diferir de `metaDiaria`, que
  /// es la de Andrés (entera y sobre el cronograma).
  metaDiariaFlotante: number | null;
  /// La meta de cada asesor: meta diaria / # asesores. Nula sin
  /// asesores configurados, que NO es lo mismo que cero.
  metaPorAsesor: number | null;
};

export function conMetas(
  fila: FilaDeProyeccion,
  config: ConfigProyeccion,
  hoyBogota: Date,
): FilaConMetas {
  /// El cierre del admin manda; si no lo puso, el del cronograma.
  const diasParaCierre =
    config.cierre !== null
      ? diasDeTrabajoEntre(hoyBogota, config.cierre)
      : fila.diasRestantes;

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
    cierreProyeccion: config.cierre
      ? config.cierre.toISOString().slice(0, 10)
      : null,
    diasParaCierre,
    metaDiariaFlotante: hayDias ? m.metaDiaria : null,
    /// Sin asesores o sin días, la meta por asesor es NULA, no cero:
    /// un cero se leería como «cada asesor no hace nada», cuando lo
    /// cierto es que falta configurar.
    metaPorAsesor: hayDias && hayAsesores ? m.metaPorAsesor : null,
  };
}
