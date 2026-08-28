/** Campañas de correo. */

import { pedir } from "./pedir";
import type { VariableCorreo } from "./plantillas-correo-api";

export type EstadoCampana = "BORRADOR" | "ENVIANDO" | "PAUSADA" | "TERMINADA";

export const ETIQUETA_ESTADO_CAMPANA: Record<EstadoCampana, string> = {
  BORRADOR: "Borrador",
  ENVIANDO: "Enviando",
  PAUSADA: "Pausada",
  TERMINADA: "Terminada",
};

export type Segmento = {
  etapas?: string[];
  accionFormacionId?: string | null;
  coberturaId?: string | null;
  soloDatosIncompletos?: boolean;
  soloConGrupo?: boolean;
  soloSinAsesor?: boolean;
};

export type SegmentoListo = {
  clave: string;
  titulo: string;
  para: string;
  segmento: Segmento;
};

export type Campana = {
  id: string;
  nombre: string;
  asunto: string;
  estado: EstadoCampana;
  lanzadaEn: string | null;
  terminadaEn: string | null;
  creadoEn: string;
  convenio: { sigla: string | null; nombre: string };
  creadoPor: { nombre: string } | null;
  _count: { destinatarios: number };
};

export type Resultados = {
  id: string;
  nombre: string;
  estado: EstadoCampana;
  lanzadaEn: string | null;
  total: number;
  pendientes: number;
  enviados: number;
  fallidos: number;
  omitidos: number;
  /// Firme: el clic pasa por nuestro servidor.
  conClic: number;
  /// Aproximado, y por eso viene con ese nombre. Gmail y Apple
  /// inflan este número por diseño.
  aperturasEstimadas: number;
};

export type DestinatarioCampana = {
  id: string;
  correo: string;
  estado: "PENDIENTE" | "ENVIADO" | "FALLIDO" | "OMITIDO";
  motivo: string | null;
  enviadoEn: string | null;
  abiertoEn: string | null;
  clics: number;
  participante: {
    persona: { primerNombre: string; primerApellido: string };
  };
};

export const campanasApi = {
  segmentos: () => pedir<SegmentoListo[]>("/admin/campanas/segmentos"),
  variables: () => pedir<VariableCorreo[]>("/admin/campanas/variables"),
  listar: () => pedir<Campana[]>("/admin/campanas"),

  /// Cuántos le tocarían hoy, sin mandar nada.
  aCuantos: (convenioId: string, segmento: Segmento) =>
    pedir<{ total: number }>("/admin/campanas/a-cuantos", {
      method: "POST",
      body: JSON.stringify({ convenioId, segmento }),
    }),

  crear: (datos: {
    convenioId: string;
    nombre: string;
    asunto: string;
    cuerpo: string;
    segmento: Segmento;
  }) =>
    pedir<{ id: string; nombre: string; estado: EstadoCampana }>("/admin/campanas", {
      method: "POST",
      body: JSON.stringify(datos),
    }),

  lanzar: (id: string) =>
    pedir<{ lanzada: boolean; destinatarios: number }>(
      `/admin/campanas/${id}/lanzar`,
      { method: "POST" },
    ),

  pausar: (id: string) =>
    pedir<{ estado: EstadoCampana }>(`/admin/campanas/${id}/pausar`, {
      method: "POST",
    }),

  reanudar: (id: string) =>
    pedir<{ estado: EstadoCampana }>(`/admin/campanas/${id}/reanudar`, {
      method: "POST",
    }),

  resultados: (id: string) =>
    pedir<Resultados>(`/admin/campanas/${id}/resultados`),

  destinatarios: (id: string) =>
    pedir<DestinatarioCampana[]>(`/admin/campanas/${id}/destinatarios`),

  /**
   * El banner del encabezado.
   *
   * No pasa por `pedir` porque va como FormData: ahí el
   * navegador tiene que poner él mismo el `content-type` con
   * la frontera del multipart, y ponerlo a mano rompe la
   * subida.
   */
  subirBanner: async (id: string, archivo: File) => {
    const cuerpo = new FormData();
    cuerpo.append("archivo", archivo);

    const gremio =
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem("convoca:gremio");

    const r = await fetch(`/api/admin/campanas/${id}/banner`, {
      method: "POST",
      body: cuerpo,
      headers: gremio ? { "x-gremio": gremio } : undefined,
    });

    const datos = (await r.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;

    if (!r.ok) {
      const bruto = datos?.message;
      throw new Error(
        (Array.isArray(bruto) ? bruto.join(". ") : bruto) ??
          "No se pudo subir el banner.",
      );
    }
    return datos as unknown as { nombre: string; bytes: number };
  },
};
