/** Los avisos de quien lleva fichas. */

import { pedir } from "./pedir";
import type { Etapa } from "./crm-api";

export type Notificacion = {
  id: string;
  tipo: string;
  /// Congelado al escribirse: si mañana se reescribe la etiqueta,
  /// los avisos viejos siguen diciendo lo que decían.
  titulo: string;
  detalle: string | null;
  creadoEn: string;
  leida: boolean;
  participanteId: string;
  etapa: Etapa;
  quien: string;
  documento: string;
};

export const notificacionesApi = {
  listar: (opciones: { sinLeer?: boolean; limite?: number } = {}) => {
    const q = new URLSearchParams();
    if (opciones.sinLeer) q.set("sinLeer", "si");
    if (opciones.limite) q.set("limite", String(opciones.limite));
    const cola = q.toString();
    return pedir<{ notificaciones: Notificacion[]; sinLeer: number }>(
      `/admin/notificaciones${cola ? `?${cola}` : ""}`,
    );
  },

  /// Solo el número. La lista entera cada treinta segundos sería
  /// traer treinta fichas para pintar un punto.
  cuenta: () => pedir<{ sinLeer: number }>("/admin/notificaciones/cuenta"),

  leida: (id: string) =>
    pedir<{ marcada: boolean; sinLeer: number }>(
      `/admin/notificaciones/${id}/leida`,
      { method: "POST" },
    ),

  leerTodas: () =>
    pedir<{ marcadas: number; sinLeer: number }>(
      "/admin/notificaciones/leer-todas",
      { method: "POST" },
    ),
};
