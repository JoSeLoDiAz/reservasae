/** Qué acción y qué grupo le tocan a una fila importada. */

/**
 * La plantilla trae la acción de formación POR FILA («AF3 · …») y dónde
 * vive la persona. De ahí sale su grupo: el de la acción que cubre su
 * ciudad, con la MISMA regla que usa el panel para ofrecer grupos
 * (`cubreA`), porque un grupo presencial en Medellín no le sirve a
 * alguien de Apartadó aunque los dos sean de Antioquia.
 *
 * Lo que no se puede resolver NO se adivina: se dice en la
 * previsualización, que es donde alguien puede corregirlo antes de que
 * se cree nada.
 */

import { cubreA, igual, type DondeSeDicta, type DondeVive } from './cobertura';

/** Una oferta del convenio, con lo que hace falta para elegir. */
export type OfertaParaCarga = {
  id: string;
  accionFormacionId: string;
  codigo: string;
  etiqueta: string;
  abierta: boolean;
  cuposMaximos: number;
  ocupados: number;
  ubicacion: DondeSeDicta;
};

export type EleccionDeAccion = {
  accionFormacionId: string | null;
  ofertaId: string | null;
  /** «AF3 · NOMBRE», para decirlo en pantalla. */
  etiqueta: string | null;
  /** Dónde se dicta el grupo elegido. */
  grupo: string | null;
  /** Lo que hay que decir en pantalla sobre esta fila. */
  problemas: string[];
};

/**
 * CUÁL DE LOS QUE LE SIRVEN LE SIRVE MÁS.
 *
 * Tres escalones, y el orden importa:
 *
 *   1. Un grupo en SU MISMA ciudad. Es el que de verdad le queda
 *      cerca.
 *   2. El DEPARTAMENTAL. Está pensado para todo el departamento, así
 *      que es la casa natural de quien no es de la ciudad.
 *   3. Un grupo en OTRA ciudad de su departamento. Le sirve ---desde
 *      el 30 sep 2026 se puede inscribir--- pero es el último
 *      recurso, no la primera opción.
 *
 * Antes eran dos escalones ---ciudad antes que departamento--- y con
 * la regla nueva eso habría mandado a alguien de Apartadó al
 * presencial de Medellín TENIENDO un departamental abierto, solo
 * porque «ciudad gana». El argumento de que la ciudad gana es que le
 * queda cerca, y eso solo vale cuando es SU ciudad.
 */
function comoDeBien(o: OfertaParaCarga, vive: DondeVive): number {
  if (o.ubicacion.tipo !== 'CIUDAD') return 1;
  return igual(o.ubicacion.nombre, vive.ciudad) ? 0 : 2;
}

function mejorPara(vive: DondeVive) {
  return (a: OfertaParaCarga, b: OfertaParaCarga): number => {
    const ea = comoDeBien(a, vive);
    const eb = comoDeBien(b, vive);
    if (ea !== eb) return ea - eb;
    /// Y en el mismo escalón, el que tiene más sitio: así una tanda
    /// grande no llena un grupo y deja el otro vacío.
    return b.cuposMaximos - b.ocupados - (a.cuposMaximos - a.ocupados);
  };
}

export function elegirOferta(
  codigo: string | null,
  ofertas: OfertaParaCarga[],
  vive: DondeVive,
): EleccionDeAccion {
  if (!codigo)
    return {
      accionFormacionId: null,
      ofertaId: null,
      etiqueta: null,
      grupo: null,
      problemas: [],
    };

  const suyas = ofertas.filter(
    (o) => o.codigo.toUpperCase() === codigo.toUpperCase(),
  );
  if (suyas.length === 0) {
    return {
      accionFormacionId: null,
      ofertaId: null,
      etiqueta: null,
      grupo: null,
      problemas: [`«${codigo}» no es una acción de formación de este convenio`],
    };
  }

  const accionFormacionId = suyas[0].accionFormacionId;
  const abiertas = suyas.filter((o) => o.abierta);
  if (abiertas.length === 0) {
    return {
      accionFormacionId,
      ofertaId: null,
      etiqueta: suyas[0].etiqueta,
      grupo: null,
      problemas: [
        `los grupos de ${codigo} están cerrados: queda en la acción, sin grupo`,
      ],
    };
  }

  const cubren = abiertas.filter((o) => cubreA(o.ubicacion, vive));
  if (cubren.length === 0) {
    const donde = vive.ciudad ?? vive.departamento ?? 'donde vive';
    return {
      accionFormacionId,
      ofertaId: null,
      etiqueta: suyas[0].etiqueta,
      grupo: null,
      problemas: [
        `ningún grupo de ${codigo} llega a ${donde}: queda en la acción, sin grupo`,
      ],
    };
  }

  const elegida = [...cubren].sort(mejorPara(vive))[0];
  return {
    accionFormacionId,
    ofertaId: elegida.id,
    etiqueta: elegida.etiqueta,
    grupo: elegida.ubicacion.nombre,
    problemas: [],
  };
}
