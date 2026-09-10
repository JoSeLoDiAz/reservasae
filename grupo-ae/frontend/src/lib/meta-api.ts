/** El banco de pruebas del webhook de Meta. */

import { pedir } from "./pedir";

/// El estado de UN gremio. Hay una app de Meta por gremio, y
/// cada una tiene su URL, su secreto y su token: el estado de
/// uno no dice nada del otro.
export type GremioMeta = {
  slug: string;
  nombre: string;
  listo: boolean;
  /// Lo que falta, ya redactado, con el nombre EXACTO de cada
  /// variable para poder copiarlo y pegarlo.
  faltan: string[];
  /// Lo que se pega en Meta, tal cual.
  urlDeDevolucion: string;
  /// Ni el token ni el secreto viajan: solo si están puestos.
  /// Una credencial en pantalla es una credencial en una
  /// captura.
  tokenPuesto: boolean;
  secretoPuesto: boolean;
  leads: { total: number; pendientes: number };
  /// La tabla donde se guardan no existe todavía.
  sinTabla: boolean;
};

export type EstadoMeta = {
  listo: boolean;
  gremios: GremioMeta[];
  campo: string;
  /// Inventar leads solo se puede en pruebas.
  puedeSimular: boolean;
};

export type Resultado = {
  pasa: boolean;
  /// Por qué pasó o por qué no, en una frase que se pueda
  /// leer sin saber qué es un HMAC.
  porque: string;
  estado?: number;
  devolvio?: string;
};

export type ResultadoAviso = Resultado & {
  mandados?: number;
  guardados?: number;
  sinConvenio?: boolean;
  filas?: Array<{
    externoId: string;
    estado: string;
    origen: string;
    motivo: string | null;
    recibidoEn: string;
    deprueba: boolean;
  }>;
};

export const metaApi = {
  estado: () => pedir<EstadoMeta>("/admin/pruebas/meta"),

  probarVerificacion: (gremio: string) =>
    pedir<Resultado>(
      `/admin/pruebas/meta/verificacion?gremio=${encodeURIComponent(gremio)}`,
      { method: "POST" },
    ),

  probarAviso: (gremio: string, cuantos: number) =>
    pedir<ResultadoAviso>(
      `/admin/pruebas/meta/aviso?gremio=${encodeURIComponent(gremio)}&cuantos=${cuantos}`,
      { method: "POST" },
    ),

  limpiar: () =>
    pedir<{ borrados: number }>("/admin/pruebas/meta/limpiar", {
      method: "POST",
    }),
};
