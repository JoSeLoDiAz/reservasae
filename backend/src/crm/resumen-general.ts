/** El Resumen General: siete cifras macro, una barra por acción de formación. */

/**
 * EL BLOQUE 1 DE CONTROL DE INSCRITOS (cliente, 23 sep 2026).
 *
 * Lo pidió así: «los gráficos son de lo macro, por acción de
 * formación», y dictó las siete cifras que quiere ver de un vistazo:
 *
 *   1. Leads que entraron          5. Sin ninguna gestión
 *   2. Datos completos             6. Total inscritos
 *   3. Datos parciales             7. Total no interesados
 *   4. En proceso
 *
 * SON DOS CORTES DISTINTOS DE LA MISMA GENTE, y conviene saberlo antes
 * de sumar columnas:
 *
 * - «Datos completos» + «Datos parciales» = leads que entraron. Es el
 *   corte por CALIDAD DEL DATO: qué le falta a la persona para poder
 *   reportarla al SENA. Una persona inscrita puede estar en cualquiera
 *   de las dos.
 * - «En proceso» + «Sin gestión» + «Inscritos» + «No interesados» =
 *   leads que entraron, menos las salidas del aula. Es el corte por
 *   DÓNDE ESTÁ: cada persona cae en uno y solo uno.
 *
 * QUÉ ES «GESTIÓN». El cliente lo resolvió el mismo día: «esto pienso
 * que se puede hacer con última actividad y quizás blindarlo con las
 * notas». Así quedó: una persona está gestionada si alguien del equipo
 * le escribió una nota, le tocó los datos, o la movió de etapa a mano.
 * Las tres son actos de una persona; `actualizadoEn` a secas no sirve,
 * porque el sistema también escribe ahí --al calcular datos completos,
 * al asignar grupo por lote-- y entonces «sin gestión» daría cero
 * siempre y el gráfico no diría nada.
 */

import type { EtapaParticipante } from '../../generated/prisma';
import { faltaDeLaPersona } from './completitud';
import { OCUPAN_SILLA } from './etapas';

/// Las etapas que todavía están en manos del asesor: ni entró al
/// aula, ni se perdió. Son las tres del embudo comercial.
const ABIERTAS: EtapaParticipante[] = [
  'INTERESADO',
  'CONTACTADO',
  'DATOS_COMPLETOS',
];

/// Las dos etapas a las que se llega SIN que nadie del equipo haga
/// nada: `INTERESADO` es el estado de nacimiento y `DATOS_COMPLETOS`
/// lo pone el sistema cuando la persona misma termina su formulario.
/// Estar en cualquier otra ya es señal de que alguien la movió.
const ETAPAS_SIN_TOCAR: EtapaParticipante[] = ['INTERESADO', 'DATOS_COMPLETOS'];

/// «No interesado» en la pantalla; `PERDIDO` en la base. El enum no
/// tiene `NO_INTERESADO`, y renombrarlo en la base por una etiqueta
/// costaría una migración y todas sus lecturas.
const NO_INTERESADO: EtapaParticipante = 'PERDIDO';

export type FilaResumenGeneral = {
  accionFormacionId: string;
  codigo: string;
  nombre: string;
  /// La sigla del gremio. Los dos convenios numeran sus acciones desde
  /// AF1, así que con los dos a la vista «AF1» sale dos veces y no se
  /// sabe cuál es cuál. La pantalla la pega al código solo cuando hace
  /// falta.
  gremio: string;
  leads: number;
  datosCompletos: number;
  datosParciales: number;
  enProceso: number;
  sinGestion: number;
  inscritos: number;
  noInteresados: number;
};

/// Lo mínimo para contar las siete. Se traen las filas y se cuentan
/// aquí --y no con siete `groupBy`-- por lo mismo que en
/// `metricas-inscripciones.ts`: «datos completos» no es una columna
/// de la base, es una regla.
export const SELECT_RESUMEN_GENERAL = {
  etapa: true,
  nivelOcupacionalSepId: true,
  datosTocadosPorAsesorEn: true,
  accionFormacion: { select: { id: true, codigo: true, nombre: true } },
  convenio: { select: { sigla: true, nombre: true } },
  persona: {
    select: {
      correo: true,
      celular: true,
      fechaNacimiento: true,
      generoSepId: true,
      estrato: true,
      departamentoSepId: true,
      municipioSepId: true,
      barrio: true,
      direccion: true,
    },
  },
  _count: { select: { notas: true } },
} as const;

export type FilaCruda = {
  etapa: EtapaParticipante;
  nivelOcupacionalSepId: number | null;
  datosTocadosPorAsesorEn: Date | null;
  accionFormacion: { id: string; codigo: string; nombre: string } | null;
  convenio: { sigla: string | null; nombre: string } | null;
  persona: Parameters<typeof faltaDeLaPersona>[0]['persona'];
  _count: { notas: number };
};

/** ¿Alguien del equipo hizo algo con esta persona? */
export function fueGestionada(f: FilaCruda): boolean {
  if (f._count.notas > 0) return true;
  if (f.datosTocadosPorAsesorEn !== null) return true;
  return !ETAPAS_SIN_TOCAR.includes(f.etapa);
}

/**
 * Una fila por acción de formación, ordenadas por código.
 *
 * Las acciones sin una sola persona NO salen: una barra en cero por
 * cada acción del catálogo llena el gráfico de huecos y esconde las
 * que sí tienen movimiento. Los leads sin acción tampoco: no hay
 * barra donde ponerlos.
 */
/**
 * CADA CIFRA SE MIDE POR LA FECHA DE SU PROPIO HECHO.
 *
 * «Filtro por ayer: voy a ver leads, inscritos y demás de solo
 * ayer. Así para todo» (cliente, 7 oct 2026).
 *
 * Las barras de este bloque son un corte de los leads que
 * LLEGARON en el periodo ---cuántos tienen los datos completos,
 * cuántos están en proceso, cuántos dijeron que no---, y eso está
 * bien para todas menos para una: «inscritos» respondía «de los
 * que llegaron ayer, cuántos están inscritos hoy», que no es lo
 * que se pregunta y, peor, NO ES LO QUE DICE LA TABLA DE ABAJO en
 * esta misma pantalla. Dos cifras distintas para la misma
 * pregunta, que es justo lo que el cliente señaló en Tráfico.
 *
 * `inscritosDelPeriodo` llega de una consulta aparte ---por el
 * ancla y exigiendo que siga inscrito, igual que la tabla--- y
 * manda sobre el conteo de la cohorte cuando hay periodo puesto.
 *
 * LO QUE SE PIERDE, Y HAY QUE SABERLO: con periodo, las barras
 * dejan de sumar los leads. Son conteos de hechos y no las partes
 * de una tarta: alguien que llegó en agosto y se inscribió ayer
 * cuenta en «inscritos de ayer» y no en «leads de ayer». Es el
 * mismo trato que ya tiene la tabla de abajo, y preferible a dos
 * cifras que se contradicen.
 */
export function resumenGeneral(
  filas: FilaCruda[],
  /// Por acción, cuántos quedaron inscritos DENTRO del periodo.
  /// `undefined` = no hay periodo puesto, y entonces manda el
  /// conteo de siempre.
  inscritosDelPeriodo?: Map<string, number>,
  /**
   * CÓMO SE ROTULA CADA ACCIÓN, para poder dibujar la barra de una
   * que tuvo inscripciones y ningún lead nuevo.
   *
   * Las barras se arman recorriendo `filas`, que son los leads que
   * LLEGARON en el periodo, así que una acción sin lead nuevo no
   * tiene entrada y sus inscripciones no tenían dónde salir. A
   * mitad de convocatoria eso es lo normal: ya no entran leads y se
   * inscribe a los que había.
   *
   * Sin estos rótulos no hay con qué pintarla: el código, el nombre
   * y el gremio salen de los leads, y justo no hay ninguno.
   */
  rotulos?: Map<string, { codigo: string; nombre: string; gremio: string }>,
): FilaResumenGeneral[] {
  const porAccion = new Map<string, FilaResumenGeneral>();

  for (const f of filas) {
    const af = f.accionFormacion;
    if (!af) continue;

    const fila = porAccion.get(af.id) ?? {
      accionFormacionId: af.id,
      codigo: af.codigo,
      nombre: af.nombre,
      gremio: f.convenio?.sigla || f.convenio?.nombre || '',
      leads: 0,
      datosCompletos: 0,
      datosParciales: 0,
      enProceso: 0,
      sinGestion: 0,
      inscritos: 0,
      noInteresados: 0,
    };

    fila.leads += 1;

    // --- corte por calidad del dato
    const falta = faltaDeLaPersona({
      persona: f.persona,
      nivelOcupacionalSepId: f.nivelOcupacionalSepId,
    });
    if (falta.length === 0) fila.datosCompletos += 1;
    else fila.datosParciales += 1;

    // --- corte por dónde está
    if (OCUPAN_SILLA.includes(f.etapa)) fila.inscritos += 1;
    else if (f.etapa === NO_INTERESADO) fila.noInteresados += 1;
    else if (ABIERTAS.includes(f.etapa)) {
      if (fueGestionada(f)) fila.enProceso += 1;
      else fila.sinGestion += 1;
    }
    /// Las salidas del aula --retirado, no aprobó, desertó,
    /// abandonó-- no caen en ninguna de las cuatro: ni están en
    /// proceso ni dijeron que no. Se cuentan en «leads», que es
    /// donde el cliente las busca.

    porAccion.set(af.id, fila);
  }

  /// Y si hay periodo, los inscritos son los del periodo. Las
  /// acciones que no estén en el mapa se quedan en cero: nadie se
  /// inscribió ahí dentro de la ventana.
  if (inscritosDelPeriodo) {
    for (const [id, fila] of porAccion) {
      fila.inscritos = inscritosDelPeriodo.get(id) ?? 0;
    }

    /**
     * Y LA ACCIÓN QUE TUVO INSCRIPCIONES SIN UN SOLO LEAD NUEVO
     * TAMBIÉN SALE.
     *
     * Si no, el Resumen General dice menos inscritos que la tabla
     * de abajo de la MISMA pantalla ---aquella sí la cuenta---, que
     * es justo el descuadre que ya costó una semana.
     *
     * Nace con los leads en CERO, y eso es verdad: no le llegó
     * nadie nuevo en el periodo. Lo que no era verdad era no estar.
     */
    for (const [id, cuantos] of inscritosDelPeriodo) {
      if (cuantos <= 0 || porAccion.has(id)) continue;
      const r = rotulos?.get(id);
      if (!r) continue;
      porAccion.set(id, {
        accionFormacionId: id,
        codigo: r.codigo,
        nombre: r.nombre,
        gremio: r.gremio,
        leads: 0,
        datosCompletos: 0,
        datosParciales: 0,
        enProceso: 0,
        sinGestion: 0,
        inscritos: cuantos,
        noInteresados: 0,
      });
    }
  }

  return [...porAccion.values()].sort((a, b) =>
    a.codigo.localeCompare(b.codigo),
  );
}
