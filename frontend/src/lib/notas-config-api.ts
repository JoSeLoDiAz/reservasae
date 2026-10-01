/** El catálogo de categorías y subcategorías de una nota. */

/**
 * Lo pidió el cliente el 30 sep 2026: «necesito que las notas sean
 * como las plantillas personalizables [...] su categoría y su
 * subcategoría más lo que coloque el asesor».
 *
 * Vive aparte de `crm-api.ts` a propósito: ese fichero pasa de las
 * 1.800 líneas y lo toca todo el mundo. Esto es un catálogo pequeño
 * con una pantalla propia, y mezclarlo allí lo volvería imposible de
 * encontrar.
 */

import { pedir } from "./pedir";

export type SubcategoriaDeNota = {
  id: string;
  categoriaId: string;
  nombre: string;
  orden: number;
  /// `true` cuando dejó de ofrecerse. La fila NO desaparece: hay
  /// notas viejas que la nombran, y leerlas tiene que seguir
  /// funcionando.
  oculta: boolean;
  ocultaEn: string | null;
  /// Cuántas notas la nombran. Es el número que explica por qué esto
  /// no se puede borrar, dicho donde alguien buscaría el botón.
  notas: number;
};

export type CategoriaDeNota = {
  id: string;
  nombre: string;
  orden: number;
  oculta: boolean;
  ocultaEn: string | null;
  notas: number;
  subcategorias: SubcategoriaDeNota[];
};

export const notasConfigApi = {
  /// Todo, incluido lo oculto. Es lo que necesita la pantalla de
  /// configuración: si escondiera lo oculto, no habría forma de
  /// volverlo a ofrecer.
  listar: () => pedir<CategoriaDeNota[]>("/admin/configuracion-notas"),

  /// Solo lo que se puede ofrecer. Es lo que piden los desplegables
  /// del asesor.
  ofrecidas: () =>
    pedir<CategoriaDeNota[]>("/admin/configuracion-notas?visibles=1"),

  crearCategoria: (nombre: string) =>
    pedir<CategoriaDeNota>("/admin/configuracion-notas/categorias", {
      method: "POST",
      body: JSON.stringify({ nombre }),
    }),

  /// NO HAY `eliminar`, y es la decisión, no un olvido: en este CRM
  /// nada se borra. `oculta: true` es lo que hace lo que la gente
  /// quiere cuando pide borrar --que deje de ofrecerse-- sin dejar
  /// huérfanas las notas que la nombran.
  actualizarCategoria: (
    id: string,
    datos: { nombre?: string; orden?: number; oculta?: boolean },
  ) =>
    pedir<CategoriaDeNota>(`/admin/configuracion-notas/categorias/${id}`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  crearSubcategoria: (categoriaId: string, nombre: string) =>
    pedir<CategoriaDeNota>(
      `/admin/configuracion-notas/categorias/${categoriaId}/subcategorias`,
      { method: "POST", body: JSON.stringify({ nombre }) },
    ),

  actualizarSubcategoria: (
    id: string,
    datos: { nombre?: string; orden?: number; oculta?: boolean },
  ) =>
    pedir<CategoriaDeNota>(`/admin/configuracion-notas/subcategorias/${id}`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),
};
