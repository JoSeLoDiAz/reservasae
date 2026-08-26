import { ErrorApi } from "./api";
import { pedir } from "./pedir";

export type Destinatario = "RESERVA" | "PARTICIPANTE";

export type ConvenioBreve = {
  id: string;
  nombre: string;
  sigla: string | null;
  slug: string;
};

export type Politica = {
  id: string;
  convenio: ConvenioBreve;
  destinatario: Destinatario;
  version: number;
  titulo: string;
  contenido: string;
  vigente: boolean;
  vigenteDesde: string;
  vigenteHasta: string | null;
  aceptaciones: number;
  editable: boolean;
};

export type Cobertura = {
  convenio: ConvenioBreve;
  reserva: { version: number } | null;
  participante: { version: number } | null;
};


export const politicasApi = {
  listar: () => pedir<Politica[]>("/admin/politicas"),

  cobertura: () => pedir<Cobertura[]>("/admin/politicas/cobertura"),

  crear: (datos: {
    convenioId: string;
    destinatario: Destinatario;
    titulo: string;
    contenido: string;
  }) =>
    pedir<Politica>("/admin/politicas", {
      method: "POST",
      body: JSON.stringify(datos),
    }),

  actualizar: (id: string, datos: { titulo?: string; contenido?: string }) =>
    pedir<Politica>(`/admin/politicas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  eliminar: (id: string) =>
    pedir<{ borrada: boolean }>(`/admin/politicas/${id}`, { method: "DELETE" }),
};

export const ETIQUETA_DESTINATARIO: Record<Destinatario, string> = {
  RESERVA: "Preinscripción — la empresa",
  PARTICIPANTE: "Inscripción — la persona",
};
