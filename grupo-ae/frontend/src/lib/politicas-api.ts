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


/**
 * La politica vigente que se ensena en el formulario publico.
 *
 * Es un subconjunto de `Politica`: la ruta publica no devuelve
 * el id, ni cuantas aceptaciones lleva, ni si es editable. Un
 * tipo aparte y no `Partial<Politica>` porque eso ultimo dejaria
 * pasar un `contenido` opcional, y el contenido es lo unico que
 * esta caja existe para ensenar.
 */
export type PoliticaPublica = {
  titulo: string;
  contenido: string;
  version: number;
  vigenteDesde: string;
  convenio: { nombre: string; sigla: string | null; slug: string };
};

/**
 * La politica vigente de un convenio, sin sesion.
 *
 * Lanza 404 cuando el convenio todavia no tiene texto
 * publicado; quien la llame decide que hacer con eso.
 */
export function politicaVigente(slug: string, destinatario: Destinatario) {
  return pedir<PoliticaPublica>(
    `/politicas/${encodeURIComponent(slug)}/${destinatario}`,
  );
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
