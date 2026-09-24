/** La palabra del enlace que dice qué formulario es este. */

/**
 * `https://adecopria.reservasae.com/?TallerBootcamp` no es el
 * formulario general: es el del taller-bootcamp, que ofrece una
 * acción que NO está publicada. La palabra suelta del enlace es
 * la que lo decide, y quien la reconoce de verdad es el servidor
 * --aquí solo se recoge y se le pasa.
 *
 * NO es el enlace corto del mailing (`enlace-corto.ts`), aunque
 * las dos sean una palabra suelta en la URL. Aquel dice POR DÓNDE
 * llegó alguien y por eso exige prefijo de canal; esta dice QUÉ
 * formulario está viendo. Se mantienen separadas a propósito: un
 * `?TallerBootcamp` contado como campaña de pauta ensuciaría el
 * único número con el que se decide dónde invertir.
 */

import { PREFIJOS } from "@/lib/enlace-corto";

/// Lo mismo que valida el servidor en
/// `backend/src/preinscripcion/formularios-personalizados.ts`.
/// Sin punto ni guion bajo: así nunca puede tener la forma de un
/// enlace corto.
const PATRON = /^[A-Za-z][A-Za-z0-9-]{2,39}$/;

/// Un `?mailing18092026` es del embudo y no de aquí. Se descarta
/// ANTES de preguntar, para que una sola palabra no pueda
/// significar dos cosas según quién la mire.
const CANALES = new RegExp(`^(${Object.keys(PREFIJOS).join("|")})`, "i");

/**
 * La primera palabra suelta del enlace que PODRÍA ser un
 * formulario, o undefined.
 *
 * Solo cuenta una clave SIN valor, igual que el enlace corto:
 * `?fbclid=...` o `?utm_source=correo` no son esto. Que la
 * palabra exista de verdad lo dice el servidor; devolver una que
 * no existe no abre nada.
 */
export function palabraDelFormulario(busqueda: string): string | undefined {
  for (const [clave, valor] of new URLSearchParams(busqueda)) {
    if (valor !== "") continue;
    if (!PATRON.test(clave)) continue;
    if (CANALES.test(clave)) continue;
    return clave;
  }
  return undefined;
}
