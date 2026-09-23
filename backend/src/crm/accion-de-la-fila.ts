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

import { cubreA, type DondeSeDicta, type DondeVive } from './cobertura';

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

/// Ciudad antes que departamento: entre un grupo en su misma ciudad y
/// uno departamental, el de su ciudad es el que de verdad le queda cerca.
function mejor(a: OfertaParaCarga, b: OfertaParaCarga): number {
  const porTipo = (o: OfertaParaCarga) => (o.ubicacion.tipo === 'CIUDAD' ? 0 : 1);
  if (porTipo(a) !== porTipo(b)) return porTipo(a) - porTipo(b);
  /// Y con el mismo tipo, el que tiene más sitio: así una tanda grande
  /// no llena un grupo y deja el otro vacío.
  return b.cuposMaximos - b.ocupados - (a.cuposMaximos - a.ocupados);
}

export function elegirOferta(
  codigo: string | null,
  ofertas: OfertaParaCarga[],
  vive: DondeVive,
): EleccionDeAccion {
  if (!codigo) return { accionFormacionId: null, ofertaId: null, etiqueta: null, grupo: null, problemas: [] };

  const suyas = ofertas.filter((o) => o.codigo.toUpperCase() === codigo.toUpperCase());
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
      problemas: [`los grupos de ${codigo} están cerrados: queda en la acción, sin grupo`],
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
      problemas: [`ningún grupo de ${codigo} llega a ${donde}: queda en la acción, sin grupo`],
    };
  }

  const elegida = [...cubren].sort(mejor)[0];
  return {
    accionFormacionId,
    ofertaId: elegida.id,
    etiqueta: elegida.etiqueta,
    grupo: elegida.ubicacion.nombre,
    problemas: [],
  };
}
