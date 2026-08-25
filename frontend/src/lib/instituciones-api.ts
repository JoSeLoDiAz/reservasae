/** El maestro de organizaciones. */

import { ErrorApi } from "./api";

export type FuenteDato = "CARGA" | "RUES" | "WEB" | "HUMANO";

export type TamanoEmpresa = "MICROEMPRESA" | "PEQUENA" | "MEDIANA" | "GRANDE";

export type ClasificacionEmpresa =
  | "ASOCIACION"
  | "CENTRO_DESARROLLO_TECNOLOGICO"
  | "EMPRESA_ASOCIATIVA_DE_TRABAJO"
  | "EMPRESA_PRIVADA"
  | "EMPRESA_PUBLICA"
  | "ENTIDAD_ECONOMIA_SOLIDARIA"
  | "ENTIDAD_SIN_ANIMO_DE_LUCRO"
  | "ENTIDAD_TERRITORIAL"
  | "GREMIO"
  | "MIXTA";

export const ETIQUETA_FUENTE: Record<FuenteDato, string> = {
  CARGA: "Carga inicial",
  RUES: "Dato importado del RUES",
  WEB: "Dato importado desde la validación web",
  HUMANO: "Dato ingresado manualmente",
};

export const ETIQUETA_TAMANO: Record<TamanoEmpresa, string> = {
  MICROEMPRESA: "Microempresa",
  PEQUENA: "Pequeña",
  MEDIANA: "Mediana",
  GRANDE: "Grande",
};

/// Los rangos de la ley 590 de 2000, para poder avisar
/// cuando el numero de empleados no cuadra con el tamano.
export const TRABAJADORES_POR_TAMANO: Record<TamanoEmpresa, [number, number]> = {
  MICROEMPRESA: [1, 10],
  PEQUENA: [11, 50],
  MEDIANA: [51, 200],
  GRANDE: [201, Number.MAX_SAFE_INTEGER],
};

export const ETIQUETA_CLASIFICACION: Record<ClasificacionEmpresa, string> = {
  ASOCIACION: "Asociación",
  CENTRO_DESARROLLO_TECNOLOGICO: "Centro de Desarrollo Tecnológico (CDT)",
  EMPRESA_ASOCIATIVA_DE_TRABAJO: "Empresa asociativa de trabajo",
  EMPRESA_PRIVADA: "Empresa privada",
  EMPRESA_PUBLICA: "Empresa pública",
  ENTIDAD_ECONOMIA_SOLIDARIA: "Entidad de economía solidaria",
  ENTIDAD_SIN_ANIMO_DE_LUCRO: "Entidad sin ánimo de lucro",
  ENTIDAD_TERRITORIAL: "Entidad territorial — gobierno",
  GREMIO: "Gremio",
  MIXTA: "Mixta",
};

/// Como se llama cada campo en pantalla. Se usa tanto en la
/// ficha como en la bandeja de propuestas.
export const ETIQUETA_CAMPO: Record<string, string> = {
  razonSocial: "Razón social",
  nombreComercial: "Nombre comercial",
  fechaFundacion: "Fecha de fundación",
  direccion: "Dirección",
  telefono: "Teléfono",
  correo: "Correo",
  paginaWeb: "Página web",
  ciudadNombre: "Ciudad",
  departamentoNombre: "Departamento",
  tamano: "Tamaño",
  numeroEmpleados: "Número de empleados",
  clasificacion: "Clasificación",
  sectorEconomico: "Sector económico",
  codigoCiiu: "Código CIIU",
};

export type Institucion = {
  id: string;
  nit: string;
  razonSocial: string;
  nombreComercial: string | null;
  digitoDeclarado: string | null;
  fechaFundacion: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  paginaWeb: string | null;
  ciudadNombre: string | null;
  departamentoNombre: string | null;
  departamentoSepId: number | null;
  municipioSepId: number | null;
  tamano: TamanoEmpresa | null;
  numeroEmpleados: number | null;
  clasificacion: ClasificacionEmpresa | null;
  sectorEconomico: string | null;
  codigoCiiu: string | null;
  fuente: FuenteDato;
  /// Campo → de dónde salió.
  fuentePorCampo: Record<string, FuenteDato> | null;
  verificadaEn: string | null;
  verificadaPor: { nombre: string } | null;
  /// Lo que le falta para poder reportarse al SENA.
  falta: string[];
  /// Lo que trajo un buscador y nadie ha confirmado.
  sinConfirmar: string[];
  reportable: boolean;
  _count?: { empresas: number; propuestas: number };
};

export type Propuesta = {
  id: string;
  campos: Record<string, unknown>;
  fuente: FuenteDato;
  creadoEn: string;
};

export type ConsultaRues = {
  id: string;
  estado: "PENDIENTE" | "EN_CURSO" | "LISTA" | "SIN_RESULTADO" | "FALLIDA";
  ultimoError: string | null;
  resueltaEn: string | null;
  creadoEn: string;
};

/// Una entrada del control de cambios.
export type CambioRegistrado = {
  id: string;
  actorNombre: string;
  accion: string;
  /// Campo: valor anterior → valor nuevo.
  resumen: string | null;
  camposTocados: string[];
  creadoEn: string;
};

export type FichaInstitucion = Institucion & {
  digitoVerificacion: string;
  historial: CambioRegistrado[];
  empresas: Array<{ id: string; razonSocial: string; _count: { participantes: number } }>;
  propuestas: Propuesta[];
  consultas: ConsultaRues[];
};

export type Listado = {
  instituciones: Institucion[];
  total: number;
  pagina: number;
  porPagina: number;
};

export type ResumenInstituciones = {
  total: number;
  verificadas: number;
  sinVerificar: number;
  incompletas: number;
  sugeridas: number;
  propuestas: number;
};

export type PropuestaPendiente = Propuesta & {
  institucion: { id: string; nit: string; razonSocial: string };
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
    throw new ErrorApi(
      respuesta.status,
      mensaje ?? "No se pudo completar la operación.",
      cuerpo,
    );
  }

  return cuerpo as T;
}

export const institucionesApi = {
  listar: (filtros: {
    buscar?: string;
    incompletas?: boolean;
    sinVerificar?: boolean;
    sugeridos?: boolean;
    pagina?: number;
  }) => {
    const q = new URLSearchParams();
    if (filtros.buscar) q.set("buscar", filtros.buscar);
    if (filtros.incompletas) q.set("incompletas", "1");
    if (filtros.sinVerificar) q.set("sinVerificar", "1");
    if (filtros.sugeridos) q.set("sugeridos", "1");
    if (filtros.pagina && filtros.pagina > 1) q.set("pagina", String(filtros.pagina));
    const cola = q.toString();
    return pedir<Listado>(`/admin/instituciones${cola ? `?${cola}` : ""}`);
  },

  resumen: () => pedir<ResumenInstituciones>("/admin/instituciones/resumen"),

  pendientes: () => pedir<PropuestaPendiente[]>("/admin/instituciones/pendientes"),

  ver: (id: string) => pedir<FichaInstitucion>(`/admin/instituciones/${id}`),

  editar: (id: string, datos: Record<string, unknown>) =>
    pedir<Institucion>(`/admin/instituciones/${id}`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  verificar: (id: string) =>
    pedir<Institucion>(`/admin/instituciones/${id}/verificar`, { method: "POST" }),

  desverificar: (id: string) =>
    pedir<Institucion>(`/admin/instituciones/${id}/desverificar`, { method: "POST" }),

  aplicarPropuesta: (id: string, campos: string[]) =>
    pedir<{ aplicados: number; descartados: number }>(
      `/admin/instituciones/propuestas/${id}/aplicar`,
      { method: "POST", body: JSON.stringify({ campos }) },
    ),
};
