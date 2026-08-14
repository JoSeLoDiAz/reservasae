import { ErrorApi } from "./api";

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

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch(`/api${ruta}`, {
    ...opciones,
    headers: { "content-type": "application/json", ...opciones?.headers },
  });

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const bruto = (cuerpo as { message?: string | string[] } | null)?.message;
    const mensaje = Array.isArray(bruto) ? bruto.join(". ") : bruto;
    throw new ErrorApi(respuesta.status, mensaje ?? "No se pudo completar la operación.", cuerpo);
  }

  return cuerpo as T;
}

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
