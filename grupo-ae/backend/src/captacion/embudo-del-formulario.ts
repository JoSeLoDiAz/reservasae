/** A qué embudo entra lo que llega por un formulario. */

/**
 * EL EMBUDO LO DICE EL FORMULARIO, NO QUIEN LLENA EL FORMULARIO.
 *
 * La alternativa —un campo `embudo` en el cuerpo del POST— parecía
 * más simple y es la que hay que rechazar: esta ruta es PÚBLICA, así
 * que ese campo lo escribe cualquiera con `curl`. Con él, meter cien
 * oportunidades en el embudo de empresas es una línea de consola, y
 * el tablero de empresas —que es el que se mira para pronosticar—
 * queda contando negocios que nadie sabe de dónde salieron.
 *
 * Se deduce de lo que el formulario PREGUNTA, que está en la base y
 * lo decidió quien lo armó desde el panel. Es la misma regla del
 * slug: contra la base, nunca contra una lista escrita en el código
 * ni contra lo que mande el cliente.
 *
 * Y la señal es el NIT, no la razón social ni el número de
 * colaboradores. Un NIT es una empresa identificable: es la llave
 * con la que este sistema guarda una y solo una organización por
 * NIT, y sin él no hay a quién colgarle el negocio ni contra qué
 * deduplicar. Un formulario que pregunta dónde trabaja usted pero no
 * el NIT no es un formulario de empresas: es uno de personas que
 * además pregunta por su trabajo, y sus leads son personas.
 */

import { CampoNucleo, TipoEmbudo } from '../../generated/prisma';

/** El embudo al que entra lo que llegue por ese formulario. */
export function embudoDelFormulario(
  campos: (CampoNucleo | null)[],
): TipoEmbudo {
  return pideElNit(campos) ? TipoEmbudo.EMPRESA : TipoEmbudo.PERSONA;
}

/** Si ese formulario le pregunta el NIT a quien lo llena. */
export function pideElNit(campos: (CampoNucleo | null)[]): boolean {
  return campos.includes(CampoNucleo.EMPRESA_NIT);
}
