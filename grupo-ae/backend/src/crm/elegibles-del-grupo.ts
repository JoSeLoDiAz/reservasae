/** A quién se le puede asignar un grupo por lote, y por qué a esos. */

/**
 * EL CLIENTE LO PIDIÓ ASÍ: «si el grupo es en Bogotá, que me muestre
 * los que seleccionaron Bogotá; y si es presencial o virtual, el
 * grupo también debe filtrar».
 *
 * Las dos condiciones son UNA SOLA, y por el modelo:
 *
 *   Oferta         @@unique([accionFormacionId, ubicacionId])
 *   GrupoCobertura @@unique([grupoId, ubicacionId, modalidad])
 *
 * Como la oferta es única por acción y ubicación, «misma acción +
 * misma sede» colapsa en UNA columna indexada: `ofertaId`. No hace
 * falta comparar nombres de ciudad ni tipos de ubicación.
 *
 * Y LA MODALIDAD NO FILTRA PERSONAS. Una persona no tiene modalidad:
 * la tiene su oferta, y la oferta ya quedó fijada por la sede. Añadir
 * `oferta.modalidad === celda.modalidad` al predicado solo podría
 * hacer dos cosas —nada, o vaciar el lote entero— porque es la misma
 * para todos los candidatos. Va como PRECONDICIÓN del par, no como
 * filtro, y `porQueNoCuadraLaCelda` la comprueba.
 *
 * ESTA NO ES UNA REGLA NUEVA. Es la que el servidor ya aplica donde
 * escribe: `exigirCoberturaDeLaOferta` exige
 * `cobertura.ubicacionId === oferta.ubicacionId`, y `panel-de-cupos`
 * lista los grupos de una oferta con ese mismo par. Un lote con regla
 * propia sería la cuarta verdad sobre la misma decisión.
 */

import { OCUPAN_SILLA } from './etapas';

import type { Prisma } from '../../generated/prisma';

/// El destino, ya resuelto: una celda de un grupo.
export type CeldaDestino = {
  coberturaId: string;
  ofertaId: string;
  convenioId: string;
};

/**
 * A quién ofrece el lote: SOLO A QUIEN YA ESTÁ INSCRITO.
 *
 * Lo pidió el cliente, y con un argumento que corrige el diseño:
 * «el grupo es lo último que se asigna, una vez se llame y se
 * completen los datos». Un INTERESADO puede no llegar nunca a
 * inscribirse, así que apuntarlo a una cohorte le reserva un asiento
 * que quizá no use — y el asiento sale del cupo comprometido con el
 * SENA.
 *
 * Se usa `OCUPAN_SILLA` y no una lista propia: son las tres etapas
 * que este sistema llama «ya inscrito» —INSCRITO, EN_FORMACION y
 * CERTIFICADO— y es la MISMA de la que deriva `ETAPAS_DEL_REPORTE`.
 * Escribir aquí `['INSCRITO']` a secas dejaría sin poder asignar en
 * bloque justamente a los que ya están en el aula, que son los que
 * el reporte necesita con cohorte.
 *
 * Por la ficha se puede seguir asignando grupo a un INTERESADO, y
 * eso no cambia: ahí hay un asesor mirando UNA persona. Lo que no
 * puede es pasar de a trescientos.
 *
 * `coberturaId: null` es lo que lo vuelve seguro: este lote RELLENA
 * el hueco, nunca mueve a nadie de cohorte. Cambiar de grupo a alguien
 * que ya lo tiene es otra decisión —afecta a dos cupos y a lo que se
 * le reportó al SENA— y se hace ficha por ficha.
 */
export function elegiblesDelGrupo(d: {
  ofertaId: string;
  convenioId: string;
}): Prisma.ParticipanteWhereInput {
  return {
    /// El ámbito ya acotó por convenio; esto lo cierra sobre la fila.
    convenioId: d.convenioId,
    /// Acción Y sede de un golpe.
    ofertaId: d.ofertaId,
    /// Solo el hueco.
    coberturaId: null,
    /// SOLO LOS YA INSCRITOS. Ver el docblock.
    etapa: { in: OCUPAN_SILLA },
  };
}

/**
 * Por qué esa celda no puede recibir gente de esa oferta.
 *
 * Hoy no salta nunca —en el catálogo real las 106 ofertas y las 114
 * coberturas casan— y por eso mismo tiene que estar: si algún día
 * salta, alguien movió el catálogo y está a punto de reportarle al
 * SENA una cohorte presencial hecha de gente que se apuntó a virtual.
 */
export function porQueNoCuadraLaCelda(
  celda: { ubicacionId: string; modalidad: string; numero: number; sede: string },
  oferta: { ubicacionId: string; modalidad: string } | null,
): string | null {
  if (!oferta) {
    return (
      `La sede ${celda.sede} no tiene oferta de esta acción de formación, ` +
      'así que no hay de dónde sacar gente.'
    );
  }
  if (oferta.ubicacionId !== celda.ubicacionId) {
    return 'Ese grupo no es de esa sede.';
  }
  if (oferta.modalidad !== celda.modalidad) {
    return (
      `El grupo ${celda.numero} de ${celda.sede} es ${celda.modalidad} y la oferta ` +
      `de esa sede es ${oferta.modalidad}. Nadie se inscribió a esa modalidad ahí: ` +
      'cuadre el catálogo antes de asignar la cohorte.'
    );
  }
  return null;
}

/**
 * Cuántos caben todavía en la celda.
 *
 * `apuntados` NO son los que ocupan silla: son los que tienen esa
 * cobertura escrita y no han salido. Contar con `OCUPAN_SILLA` haría
 * ver vacío un grupo con doscientos interesados dentro, y el lote
 * metería otros doscientos encima.
 */
export function cuantosCaben(celda: {
  cuposMaximos: number;
  apuntados: number;
}): number {
  return Math.max(0, celda.cuposMaximos - celda.apuntados);
}
