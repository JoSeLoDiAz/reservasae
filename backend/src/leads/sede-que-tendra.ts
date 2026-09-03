/** La sede que le va a tocar a un lead: la decisión ENTERA. */

/**
 * POR QUÉ EXISTE, Y ES UN ARREGLO DE UN DEFECTO PROPIO.
 *
 * Hasta ahora había dos mitades y solo una se compartía. La mesa
 * de entrada llamaba a `sedeQueLeToca` —deducir del domicilio— y
 * la conversión hacía DOS cosas: honrar primero `lead.sedePedida`
 * y, solo si no hay pedida, deducir. Las dos llamaban a la misma
 * función, así que un spec que comprobara «las dos usan
 * `sedeQueLeToca`» pasaba en verde. Y estaba mal:
 *
 *   · La mesa pintaba «Sede: SANTANDER» —deducida del domicilio—
 *   · La conversión veía una `sedePedida` que ese curso no tiene,
 *     devolvía null a propósito, y la ficha nacía SIN OFERTA.
 *
 * Comprobado en vivo contra pruebas: un lead de Bucaramanga que
 * pide AF1 en Cartagena sale en la mesa con «SANTANDER» y su
 * ficha nace con `ofertaId = NULL`. El asesor decide mirando un
 * dato que no va a pasar, y nada falla.
 *
 * LA LECCIÓN, que el repositorio ya tenía escrita con otra cara:
 * compartir la función NO es compartir la decisión. Lo que hay
 * que compartir es la decisión entera, y por eso vive aquí y es
 * pura — para que las dos la llamen y ninguna pueda tener media.
 */

import { sedePedida } from './sede-pedida';
import { sedeQueLeToca, type OfertaCandidata, type Vive } from './sede-que-le-toca';

export type LeadConSede = {
  accionFormacionId: string | null;
  sedePedida?: string | null;
};

/**
 * La oferta que le tocará, o null.
 *
 * `null` tiene DOS causas y las dos son legítimas: su domicilio
 * no lo cubre ninguna sede, o pidió una que ese curso no dicta.
 * No se caen la una en la otra — darle una sede que no pidió, y
 * que además puede ser de otra modalidad, sería peor que dejarla
 * sin sede y decirlo.
 */
export function sedeQueTendra(
  lead: LeadConSede,
  ofertas: OfertaCandidata[],
  vive: Vive,
): OfertaCandidata | null {
  if (!lead.accionFormacionId) return null;

  /// LO QUE PIDIÓ manda sobre lo que se deduce.
  ///
  /// Para una híbrida la sede ES la modalidad: AF7 en Medellín se
  /// iría siempre a la virtual por tener más cupo, aunque la
  /// persona hubiera dicho que va presencial.
  const pedida = sedePedida(lead.sedePedida, ofertas, lead.accionFormacionId);
  if (pedida && 'sede' in pedida) return pedida.sede;
  /// Pidió una que ese curso no tiene: se queda sin sede.
  if (pedida) return null;

  return sedeQueLeToca(ofertas, lead.accionFormacionId, vive);
}
