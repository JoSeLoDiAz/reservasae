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
 * `null` es que NADA la cubre: ni la sede que pidió ni su
 * domicilio. Pedir una sede que ese curso no dicta ya no la deja
 * fuera — se cae al domicilio, que es lo que de verdad la cubre.
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

  /// Dos que casan: NO se elige. Lo confirma una persona.
  if (pedida && 'ambigua' in pedida) return null;

  /// Esa sede no existe para ese curso: manda el domicilio.
  ///
  /// Antes se quedaba sin sede, y eso mataba el caso normal: AF1
  /// solo se dicta por DEPARTAMENTO, así que quien vive en
  /// Medellín y escribe «Medellín» pedía algo que no existe y se
  /// quedaba fuera — con 130 cupos libres en Antioquia, que sí lo
  /// cubre. La protección de la híbrida no se toca: ahí la sede
  /// SÍ casa y se devuelve arriba.
  return sedeQueLeToca(ofertas, lead.accionFormacionId, vive);
}
