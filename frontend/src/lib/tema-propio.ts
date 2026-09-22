/** Los colores de UNA persona en el panel, encima de los del sistema. */

/// Por qué existe.
///
/// Los colores del panel eran una sola paleta para todos, y quien los
/// cambiaba en Apariencia se los cambiaba a todo el equipo: en
/// producción el panel amaneció granate para todos. «Los colores, que
/// sea individual, porque si alguien modifica queda para todos»
/// (cliente, 21 sep 2026).
///
/// Cada cuenta guarda los suyos en el servidor (`/admin/perfil/tema`)
/// y el marco del panel los pinta DESPUÉS de la paleta general, así que
/// mandan sobre ella solo para esa persona. Vive en su propio archivo y
/// no en `admin-api.ts` para no cruzarse con lo que José toca allí.

import { pedir } from "./pedir";
import type { ColoresTema, Esquema } from "./tema";

export type TemaPropio = Partial<Record<Esquema, ColoresTema>>;

export const temaPropioApi = {
  leer: () => pedir<TemaPropio>("/admin/perfil/tema"),

  // el DTO espera { colores }, igual que el tema general
  guardar: (esquema: Esquema, colores: ColoresTema) =>
    pedir<TemaPropio>(`/admin/perfil/tema/${esquema}`, {
      method: "PATCH",
      body: JSON.stringify({ colores }),
    }),

  restablecer: (esquema: Esquema) =>
    pedir<TemaPropio>(`/admin/perfil/tema/${esquema}/restablecer`, { method: "POST" }),
};

/// El aviso de «cambiaron mis colores», para que el marco los repinte
/// al momento sin volver a pedirlos. Un evento y no un contexto: quien
/// guarda (Apariencia) y quien pinta (el marco) no comparten árbol de
/// estado, y meter un proveedor más por una sola señal es de más.
export const EVENTO_TEMA_PROPIO = "convoca:tema-propio";

export function avisarTemaPropio(tema: TemaPropio): void {
  window.dispatchEvent(new CustomEvent<TemaPropio>(EVENTO_TEMA_PROPIO, { detail: tema }));
}

/// La copia local, por persona, para pintar sus colores sin esperar
/// al servidor en cada visita: sin ella, cada recarga enseñaba medio
/// segundo la paleta general antes de la suya.
export function llaveTemaPropio(adminId: string): string {
  return `convoca:tema-propio:${adminId}`;
}

/**
 * La hoja de estilo de sus colores, con el mismo selector que la
 * paleta general (`:root[data-tema="claro"]`).
 *
 * Mismo selector a propósito: gana por ORDEN, porque el marco la pone
 * después. Así no hace falta subir la especificidad, y quien no ha
 * elegido nada no recibe ninguna regla.
 */
export function cssDelTemaPropio(
  tema: TemaPropio | null,
  tokens: Array<{ clave: string; variableCss: string }> | undefined,
): string {
  if (!tema || !tokens?.length) return "";
  // segunda barrera: esto acaba en un <style>
  const hexadecimal = /^#[0-9a-fA-F]{6}$/;
  return (["CLARO", "OSCURO"] as const)
    .map((esquema) => {
      const colores = tema[esquema];
      if (!colores) return "";
      const lineas = tokens
        .filter((t) => hexadecimal.test(colores[t.clave] ?? ""))
        .map((t) => `${t.variableCss}:${colores[t.clave]};`)
        .join("");
      return lineas ? `:root[data-tema="${esquema.toLowerCase()}"]{${lineas}}` : "";
    })
    .join("");
}
