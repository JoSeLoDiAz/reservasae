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
  convenioId: string | null;
  actualizadoEn: string;
  convenio: { sigla: string | null; nombre: string } | null;
  creadoPor: { nombre: string } | null;
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
    convenioId?: string | null;
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

  // --- desde la ficha del lead ---

  paraEsteLead: (participanteId: string) =>
    pedir<PlantillaCorreo[]>(`/admin/participantes/${participanteId}/correo/plantillas`),

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
