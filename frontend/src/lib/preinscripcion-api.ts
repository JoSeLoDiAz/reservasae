/** Lo público: inscribirse y completar la propia ficha. */

import { ErrorApi } from "./api";

export type OfertaPublica = {
  id: string;
  ubicacion: string;
  tipo: string;
  modalidad: string;
  libres: number;
};

export type AccionPublica = {
  id: string;
  codigo: string;
  nombre: string;
  horas: number;
  modalidad: string;
  ofertas: OfertaPublica[];
};

export type ValorSep = { id: number; etiqueta: string };

export type CatalogoPreinscripcion = {
  convenio: { id: string; slug: string; nombre: string; sigla: string | null };
  acciones: AccionPublica[];
  documentos: ValorSep[];
  generos: ValorSep[];
};

export type DatosBasicos = {
  ofertaId: string;
  tipoDocumentoSepId: number;
  numeroDocumento: string;
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  generoSepId?: number;
  celular?: string;
  correo?: string;
};

export type FichaAbierta = {
  expiraEn: string;
  convenio: { nombre: string; sigla: string | null };
  formacion: {
    codigo: string;
    nombre: string;
    horas: number;
    ubicacion: string | null;
  } | null;
  empresa: string | null;
  nitEmpresa: string | null;
  /** Si la nominó una empresa, no la cambia ella. */
  empresaFijada: boolean;
  cargoEnEmpresa: string | null;
  persona: Record<string, unknown> & {
    primerNombre: string;
    primerApellido: string;
    numeroDocumento: string;
  };
  yaAutorizo: boolean;
  politica: { id: string; version: number; titulo: string; contenido: string } | null;
  documentos: ValorSep[];
  generos: ValorSep[];
  departamentos: ValorSep[];
  /** [id, departamentoId, nombre]: se filtra sin pedir nada. */
  municipios: Array<[number, number, string]>;
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
    throw new ErrorApi(respuesta.status, mensaje ?? "No se pudo completar la operación.");
  }
  return cuerpo as T;
}

export const preinscripcionApi = {
  catalogo: (slug: string) => pedir<CatalogoPreinscripcion>(`/preinscripcion/${slug}`),

  registrar: (slug: string, datos: DatosBasicos) =>
    pedir<{ registrado: boolean; yaEstaba: boolean; token: string; expiraEn: string }>(
      `/preinscripcion/${slug}`,
      { method: "POST", body: JSON.stringify(datos) },
    ),

  abrir: (token: string) => pedir<FichaAbierta>(`/completar/${token}`),

  guardarPersona: (token: string, datos: Record<string, unknown>) =>
    pedir<{ guardado: boolean }>(`/completar/${token}`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  guardarEmpresa: (token: string, datos: Record<string, unknown>) =>
    pedir<{ guardado: boolean; enlaceCerrado: boolean }>(`/completar/${token}/empresa`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  cerrar: (token: string) =>
    pedir<{ cerrado: boolean }>(`/completar/${token}/cerrar`, { method: "POST" }),
};
