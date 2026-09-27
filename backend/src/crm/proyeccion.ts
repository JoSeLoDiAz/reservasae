/**
 * PROYECCIÓN DE INSCRIPCIONES, por acción de formación.
 *
 * «Por AF, aquí el asesor pasa a segundo plano y lo macro viene a ser
 * la Acción de Formación, donde el sistema con base a los leads, ritmo
 * de inscripción y fechas de cierre e inicio me calcula cuántas deben
 * ser las inscripciones, leads necesarios y todo proceso estadístico»
 * (cliente, 26 sep 2026).
 *
 * LA PREGUNTA QUE CONTESTA cada fila es una sola: **¿esta acción llega
 * a sus cupos antes de que cierre?** Todo lo demás son los pasos para
 * llegar ahí, y están a la vista para que nadie tenga que creerse el
 * veredicto: se puede seguir la cuenta con el dedo.
 *
 * DOS SUPUESTOS DECLARADOS, que se cambian en una línea:
 *
 * 1. La conversión sale del HISTÓRICO DE CADA AF cuando tiene con qué
 *    ---veinte leads o más---; por debajo, del promedio general. Una
 *    acción con tres leads y un inscrito daría un 33 % que no
 *    significa nada, y multiplicar por él da una cifra inventada con
 *    cara de dato.
 *
 * 2. El ritmo real se mide en los ÚLTIMOS QUINCE DÍAS de trabajo, no
 *    desde que arrancó. Un arranque lento de hace dos meses no dice si
 *    llega ahora, que es lo único que se pregunta aquí.
 *
 * Y LA SEMANA ES DE LUNES A SÁBADO, seis días, como en el resto de
 * Seguimiento de asesores.
 */

import type { EtapaParticipante } from '../../generated/prisma';
import { diasDeTrabajoEntre, hoyEnColombia } from './calendario-inscripcion';
import { OCUPAN_SILLA } from './etapas';

/** Cuántos leads hacen falta para fiarse de la conversión de UNA acción. */
export const LEADS_PARA_FIARSE = 20;

/** La ventana en la que se mide el ritmo, en días de trabajo. */
export const DIAS_DE_RITMO = 15;

/** Si llega o no, y con cuánta holgura. */
export type Veredicto =
  /// No tiene fecha de inicio: sin ella no hay cierre que calcular.
  | 'SIN_FECHA'
  /// Ya pasó el cierre. Lo que haya, es lo que hubo.
  | 'CERRADO'
  /// Ya tiene sus cupos cubiertos.
  | 'CUBIERTO'
  /// Al ritmo que lleva, llega.
  | 'LLEGA'
  /// Llega justo: menos de un diez por ciento de margen.
  | 'APRETADO'
  /// Al ritmo que lleva, NO llega.
  | 'NO_LLEGA';

export type FilaDeProyeccion = {
  accionFormacionId: string;
  codigo: string | null;
  nombre: string | null;
  /// Lo comprometido con el SENA. Es el denominador de todo.
  cupos: number;
  /// Quien ya ocupa silla.
  inscritos: number;
  /// Lo que falta para cubrir los cupos.
  faltan: number;
  /// Todos los leads que ha tenido la acción.
  leads: number;
  /// Los que siguen sin resolver: son la materia prima que queda.
  abiertos: number;
  /// Cuándo deja de poderse inscribir. Nulo sin fecha de inicio.
  cierre: string | null;
  /// Días de trabajo hasta el cierre. Negativo si ya pasó.
  diasRestantes: number | null;
  /// Cuántos viene inscribiendo al día en la ventana de ritmo.
  ritmoReal: number;
  /// Cuántos tendría que inscribir cada día para llegar.
  metaDiaria: number | null;
  /// Dónde acaba si sigue a este ritmo.
  proyeccion: number;
  /// De cada uno, qué parte acaba inscrita.
  conversion: number;
  /// Si la conversión es la suya o la del promedio general.
  conversionPropia: boolean;
  /// Cuántos leads hay que meter para cubrir lo que falta.
  leadsNecesarios: number;
  /// Los que faltan por conseguir, descontando los que ya están abiertos.
  leadsPorConseguir: number;
  veredicto: Veredicto;
};

type LeadDeLaAccion = {
  accionFormacionId: string | null;
  codigo: string | null;
  nombre: string | null;
  etapa: EtapaParticipante;
};

/// De peor a mejor. «Sin fecha» va arriba del todo porque es lo único
/// que no se arregla inscribiendo: se arregla poniéndole fecha.
const ORDEN: Record<Veredicto, number> = {
  SIN_FECHA: 0,
  NO_LLEGA: 1,
  APRETADO: 2,
  CERRADO: 3,
  LLEGA: 4,
  CUBIERTO: 5,
};

function veredictoDe(e: {
  faltan: number;
  cierre: Date | null;
  diasRestantes: number | null;
  proyeccion: number;
  cupos: number;
}): Veredicto {
  /// El orden de estas tres importa: quien ya cubrió sus cupos está
  /// cubierto aunque el plazo haya vencido, y pintarlo en rojo por el
  /// calendario sería una alarma falsa en la fila de quien hizo el
  /// trabajo. Es la misma regla que `ritmoDe`.
  if (e.faltan === 0 && e.cupos > 0) return 'CUBIERTO';
  if (!e.cierre) return 'SIN_FECHA';
  if (e.diasRestantes !== null && e.diasRestantes <= 0) return 'CERRADO';

  /// Un diez por ciento de margen: por debajo de eso «llega» es un
  /// decir, porque cualquier semana floja se lo come.
  if (e.proyeccion >= e.cupos) {
    return e.proyeccion >= e.cupos * 1.1 ? 'LLEGA' : 'APRETADO';
  }
  return 'NO_LLEGA';
}

/**
 * @param cupos               lo comprometido por acción.
 * @param cierres             el cierre más próximo de cada acción.
 * @param inscritosRecientes  cuántos se inscribieron dentro de la
 *                            ventana de ritmo, por acción. Sale de los
 *                            movimientos, que es donde consta CUÁNDO se
 *                            inscribió cada uno: la etapa de hoy no
 *                            lleva fecha pegada.
 */
export function proyectarInscripciones(
  leads: LeadDeLaAccion[],
  cupos: Map<string, number>,
  cierres: Map<string, Date>,
  inscritosRecientes: Map<string, number>,
  hoy: Date,
): FilaDeProyeccion[] {
  const ocupa = (e: EtapaParticipante) => OCUPAN_SILLA.includes(e);

  const por = new Map<
    string,
    {
      codigo: string | null;
      nombre: string | null;
      leads: number;
      inscritos: number;
      abiertos: number;
    }
  >();

  let leadsTotales = 0;
  let inscritosTotales = 0;

  for (const l of leads) {
    if (!l.accionFormacionId) continue;
    const fila = por.get(l.accionFormacionId) ?? {
      codigo: l.codigo,
      nombre: l.nombre,
      leads: 0,
      inscritos: 0,
      abiertos: 0,
    };
    fila.leads += 1;
    leadsTotales += 1;
    if (ocupa(l.etapa)) {
      fila.inscritos += 1;
      inscritosTotales += 1;
    } else if (l.etapa !== 'PERDIDO') {
      /// «Abierto» es lo que todavía puede convertirse. Un descartado
      /// no vuelve, así que no cuenta como materia prima.
      fila.abiertos += 1;
    }
    por.set(l.accionFormacionId, fila);
  }

  /// EL PROMEDIO GENERAL, el que se usa cuando una acción no tiene
  /// historia propia suficiente.
  const conversionGeneral =
    leadsTotales > 0 ? inscritosTotales / leadsTotales : 0;

  const hoyBogota = hoyEnColombia(hoy);

  return (
    [...por.entries()]
      .map(([id, f]) => {
        const cuposDeLaAccion = cupos.get(id) ?? 0;
        const faltan = Math.max(0, cuposDeLaAccion - f.inscritos);

        const cierre = cierres.get(id) ?? null;
        const diasRestantes = cierre
          ? diasDeTrabajoEntre(hoyBogota, cierre)
          : null;

        /// El ritmo, sobre la ventana COMPLETA y no sobre los días que
        /// lleva viva la acción: así dos acciones se comparan entre sí.
        /// Una que arrancó ayer sale con ritmo bajo, que es la verdad.
        const ritmoReal = (inscritosRecientes.get(id) ?? 0) / DIAS_DE_RITMO;

        const conversionPropia = f.leads >= LEADS_PARA_FIARSE;
        const conversion = conversionPropia
          ? f.leads > 0
            ? f.inscritos / f.leads
            : 0
          : conversionGeneral;

        /// Sin conversión no se puede decir cuántos leads hacen falta:
        /// sería dividir por cero y contestar «infinitos».
        const leadsNecesarios =
          conversion > 0 ? Math.ceil(faltan / conversion) : 0;

        const metaDiaria =
          diasRestantes !== null && diasRestantes > 0
            ? Math.ceil(faltan / diasRestantes)
            : null;

        const proyeccion =
          diasRestantes !== null && diasRestantes > 0
            ? Math.round(f.inscritos + ritmoReal * diasRestantes)
            : f.inscritos;

        return {
          accionFormacionId: id,
          codigo: f.codigo,
          nombre: f.nombre,
          cupos: cuposDeLaAccion,
          inscritos: f.inscritos,
          faltan,
          leads: f.leads,
          abiertos: f.abiertos,
          cierre: cierre ? cierre.toISOString().slice(0, 10) : null,
          diasRestantes,
          ritmoReal,
          metaDiaria,
          proyeccion,
          conversion,
          conversionPropia,
          leadsNecesarios,
          leadsPorConseguir: Math.max(0, leadsNecesarios - f.abiertos),
          veredicto: veredictoDe({
            faltan,
            cierre,
            diasRestantes,
            proyeccion,
            cupos: cuposDeLaAccion,
          }),
        };
      })
      /// Los que peor van, arriba: la pantalla es para decidir dónde
      /// meter esfuerzo, no para leer el catálogo por orden.
      .sort(
        (a, b) =>
          ORDEN[a.veredicto] - ORDEN[b.veredicto] || b.faltan - a.faltan,
      )
  );
}
