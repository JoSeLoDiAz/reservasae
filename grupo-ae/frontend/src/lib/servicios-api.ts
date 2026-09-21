/** El portafolio: lo que Grupo AE oferta al público. */

import { pedir } from "./pedir";

export type FamiliaServicio = "EDUCACION" | "EMPRESAS";
export type TipoServicio =
  | "LICENCIA"
  | "IMPLEMENTACION"
  | "SOPORTE"
  | "FORMACION"
  | "EQUIPO";

export type Servicio = {
  id: string;
  familia: FamiliaServicio;
  tipo: TipoServicio;
  nombre: string;
  unidad: string;
  orden: number;
  visible: boolean;
  /// Cuántos negocios lo llevan.
  _count: { oportunidades: number };
};

/// Las dos familias, en el orden en que se ofertan.
export const FAMILIAS: Array<{ valor: FamiliaServicio; rotulo: string }> = [
  { valor: "EDUCACION", rotulo: "Educación" },
  { valor: "EMPRESAS", rotulo: "Empresas" },
];

export const ROTULO_TIPO: Record<TipoServicio, string> = {
  LICENCIA: "Licencia",
  IMPLEMENTACION: "Implementación",
  SOPORTE: "Soporte",
  FORMACION: "Formación",
  EQUIPO: "Equipo",
};

export const serviciosApi = {
  /// Los visibles, para elegir el servicio de un negocio.
  visibles: () => pedir<Servicio[]>("/admin/servicios"),
  /// Todos, ocultos incluidos, para administrar el portafolio.
  todos: () => pedir<Servicio[]>("/admin/servicios?todos=si"),
  actualizar: (
    id: string,
    cambios: Partial<Pick<Servicio, "nombre" | "tipo" | "unidad" | "visible" | "orden">>,
  ) =>
    pedir<Servicio>(`/admin/servicios/${id}`, {
      method: "PATCH",
      body: JSON.stringify(cambios),
    }),
};
