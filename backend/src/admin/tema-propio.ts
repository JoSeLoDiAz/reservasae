/** Los colores de UNA persona, encima de los del sistema. */

/// Por qué existe.
///
/// Los colores del panel eran una sola paleta para todos (la tabla
/// `temas`), así que quien los tocaba en Apariencia se los cambiaba a
/// todo el equipo: en producción el panel amaneció granate para todos.
/// «Los colores, que sea individual, porque si alguien modifica queda
/// para todos» (cliente, 21 sep 2026).
///
/// Ahora cada cuenta guarda los suyos en `administradores.temaPropio`,
/// y solo los que eligió: lo que no eligió lo sigue poniendo la paleta
/// general. Vive aparte, y puro, porque decide qué se guarda y qué se
/// devuelve, y eso se prueba sin base.

import type { EsquemaColor } from '../../generated/prisma';
import { CLAVES_TOKEN } from './temas';

const HEXADECIMAL = /^#[0-9a-fA-F]{6}$/;

export type ColoresPropios = Record<string, string>;
export type TemaPropio = Partial<Record<EsquemaColor, ColoresPropios>>;

const ESQUEMAS: EsquemaColor[] = ['CLARO', 'OSCURO'];

/**
 * Lo que hay en la base, limpio.
 *
 * La columna es JSON: nada impide que un día traiga una clave que ya
 * no existe o un color mal escrito. Se descarta en silencio lo que no
 * sirve --un color inválido pintaría la pantalla de negro-- y se
 * devuelve siempre un objeto, aunque la columna esté vacía.
 */
export function leerTemaPropio(valor: unknown): TemaPropio {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
  const salida: TemaPropio = {};
  for (const esquema of ESQUEMAS) {
    const crudo = (valor as Record<string, unknown>)[esquema];
    if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) continue;
    const limpio: ColoresPropios = {};
    for (const [clave, color] of Object.entries(crudo as Record<string, unknown>)) {
      if (CLAVES_TOKEN.has(clave) && typeof color === 'string' && HEXADECIMAL.test(color)) {
        limpio[clave] = color;
      }
    }
    if (Object.keys(limpio).length > 0) salida[esquema] = limpio;
  }
  return salida;
}

/**
 * Los colores nuevos, SUMADOS a los que ya tenía en ese esquema.
 *
 * Suma y no reemplaza, igual que el tema general: el editor manda
 * solo lo que se tocó, y reemplazar borraría los demás colores que
 * esa persona había elegido antes.
 */
export function conColores(
  actual: TemaPropio,
  esquema: EsquemaColor,
  colores: ColoresPropios,
): TemaPropio {
  return leerTemaPropio({ ...actual, [esquema]: { ...(actual[esquema] ?? {}), ...colores } });
}

/** Sin sus colores de ese esquema: vuelve a ver los del sistema. */
export function sinEsquema(actual: TemaPropio, esquema: EsquemaColor): TemaPropio {
  const copia: TemaPropio = { ...actual };
  delete copia[esquema];
  return copia;
}
