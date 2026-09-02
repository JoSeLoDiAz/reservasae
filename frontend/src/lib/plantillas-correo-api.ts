/** Plantillas de correo: escribirlas y mandarlas. */

import { pedir } from "./pedir";

export type VariableCorreo = {
  clave: string;
  titulo: string;
  ejemplo: string;
};

export type PlantillaCorreo = {
  id: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  activa: boolean;
  /// En qué etapas tiene sentido. Vacío: en cualquiera.
  etapasPermitidas: string[];
  convenioId: string | null;
  actualizadoEn: string;
  /// El cabezote. El mime dice si lo hay; la versión rompe el
  /// caché del navegador cuando se cambia. Los bytes no
  /// viajan aquí: se piden por su URL.
  bannerMime: string | null;
  bannerVersion: number;
  convenio: { sigla: string | null; nombre: string } | null;
  creadoPor: { nombre: string } | null;
};

/// A dónde apunta el `<img>` del cabezote. Lleva la versión
/// porque la respuesta se cachea una semana.
export function urlDelCabezote(p: {
  id: string;
  bannerVersion: number;
}): string {
  return `/api/plantillas-correo/${p.id}/banner?v=${p.bannerVersion}`;
}

/// La misma plantilla, pero mirada contra UNA ficha: trae el
/// motivo por el que no se le puede mandar a esa persona.
export type PlantillaParaFicha = PlantillaCorreo & {
  bloqueo: string | null;
};

export type VistaPrevia = {
  /// A dónde iría. Null si la persona no tiene correo.
  para: string | null;
  nombre: string;
  asunto: string;
  cuerpo: string;
  /// Variables que la plantilla usa y esta persona no tiene.
  /// Mientras haya una, no se manda.
  faltantes: string[];
  desconocidas: string[];
  sePuede: boolean;
};

export const plantillasCorreoApi = {
  variables: () => pedir<VariableCorreo[]>("/admin/plantillas-correo/variables"),

  listar: () => pedir<PlantillaCorreo[]>("/admin/plantillas-correo"),

  crear: (datos: {
    nombre: string;
    asunto: string;
    cuerpo: string;
    /// Null o ausente: sirve para todos los gremios.
    convenioId?: string | null;
    /// Vacío o ausente: sirve en cualquier etapa.
    etapasPermitidas?: string[];
  }) =>
    pedir<PlantillaCorreo>("/admin/plantillas-correo", {
      method: "POST",
      body: JSON.stringify(datos),
    }),

  editar: (id: string, datos: Partial<PlantillaCorreo>) =>
    pedir<PlantillaCorreo>(`/admin/plantillas-correo/${id}`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  /// No borra: apaga. Una plantilla que ya se usó es parte de
  /// lo que se le dijo a alguien.
  apagar: (id: string) =>
    pedir<PlantillaCorreo>(`/admin/plantillas-correo/${id}`, { method: "DELETE" }),

  /**
   * El cabezote del correo.
   *
   * No pasa por `pedir` porque va como FormData: ahí el
   * navegador tiene que poner él mismo el `content-type` con
   * la frontera del multipart, y ponerlo a mano rompe la
   * subida.
   */
  subirCabezote: async (id: string, archivo: File) => {
    const cuerpo = new FormData();
    cuerpo.append("archivo", archivo);

    const gremio =
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem("convoca:gremio");

    const r = await fetch(`/api/admin/plantillas-correo/${id}/banner`, {
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
          "No se pudo subir el cabezote.",
      );
    }
  },

  quitarCabezote: (id: string) =>
    pedir<{ listo: boolean }>(`/admin/plantillas-correo/${id}/banner`, {
      method: "DELETE",
    }),

  // --- desde la ficha del lead ---

  paraEsteLead: (participanteId: string) =>
    pedir<PlantillaParaFicha[]>(
      `/admin/participantes/${participanteId}/correo/plantillas`,
    ),

  vistaPrevia: (participanteId: string, plantillaId: string) =>
    pedir<VistaPrevia>(
      `/admin/participantes/${participanteId}/correo/${plantillaId}/vista-previa`,
    ),

  enviar: (participanteId: string, plantillaId: string) =>
    pedir<{
      enviado: boolean;
      /// A quien iba dirigido.
      para: string;
      /// Donde cayo de verdad. En pruebas todo se desvia a un
      /// buzon nuestro, y eso hay que decirlo: si no, el
      /// asesor cree que la persona ya esta avisada.
      entregadoA: string[];
      desviado: boolean;
      asunto: string;
      id: string;
    }>(
      `/admin/participantes/${participanteId}/correo/${plantillaId}`,
      { method: "POST" },
    ),
};
