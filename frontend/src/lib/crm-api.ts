import { ErrorApi } from "./api";

export type Etapa =
  | "NUEVO"
  | "CONTACTADO"
  | "DATOS_COMPLETOS"
  | "MATRICULADO"
  | "EN_FORMACION"
  | "CERTIFICADO"
  | "PERDIDO"
  | "RETIRADO"
  | "NO_APROBO";

export type TipoDocumento =
  | "CC" | "CE" | "TI" | "PA" | "PEP" | "PPT" | "RC" | "NIT" | "OTRO";

export type Origen =
  | "EMPRESA" | "ASESOR" | "AUTOGESTION" | "REFERIDO" | "REDES" | "EVENTO" | "OTRO";

/** En orden de avance. Las salidas van aparte. */
export const ETAPAS_AVANCE: Etapa[] = [
  "NUEVO",
  "CONTACTADO",
  "DATOS_COMPLETOS",
  "MATRICULADO",
  "EN_FORMACION",
  "CERTIFICADO",
];

export const ETAPAS_SALIDA: Etapa[] = ["PERDIDO", "RETIRADO", "NO_APROBO"];

export const ETIQUETA_ETAPA: Record<Etapa, string> = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  DATOS_COMPLETOS: "Datos completos",
  MATRICULADO: "Matriculado",
  EN_FORMACION: "En formación",
  CERTIFICADO: "Certificado",
  PERDIDO: "Perdido",
  RETIRADO: "Retirado",
  NO_APROBO: "No aprobó",
};

export const ETIQUETA_ORIGEN: Record<Origen, string> = {
  EMPRESA: "La empresa lo nominó",
  ASESOR: "Lo capturó un asesor",
  AUTOGESTION: "Se inscribió solo",
  REFERIDO: "Referido",
  REDES: "Redes sociales",
  EVENTO: "Feria o evento",
  OTRO: "Otro",
};

export const ETIQUETA_DOCUMENTO: Record<TipoDocumento, string> = {
  CC: "Cédula de ciudadanía",
  CE: "Cédula de extranjería",
  TI: "Tarjeta de identidad",
  PA: "Pasaporte",
  PEP: "Permiso especial de permanencia",
  PPT: "Permiso por protección temporal",
  RC: "Registro civil",
  NIT: "NIT",
  OTRO: "Otro",
};

export type FilaParticipante = {
  id: string;
  etapa: Etapa;
  creadoEn: string;
  documento: string;
  nombre: string;
  correo: string | null;
  celular: string | null;
  convenio: string;
  accion: string | null;
  ubicacion: string | null;
  asesor: { id: string; nombre: string } | null;
  notas: number;
};

export type Listado = {
  total: number;
  pagina: number;
  paginas: number;
  participantes: FilaParticipante[];
};

export type Resumen = {
  etapas: Array<{ etapa: Etapa; total: number }>;
  total: number;
};

export type Filtros = {
  convenioId?: string;
  etapa?: Etapa;
  accionFormacionId?: string;
  asesorId?: string;
  buscar?: string;
  pagina?: number;
};

function consulta(filtros: Filtros): string {
  const p = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== "") {
      p.set(clave, String(valor));
    }
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

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

export const crmApi = {
  listar: (filtros: Filtros = {}) =>
    pedir<Listado>(`/admin/participantes${consulta(filtros)}`),

  resumen: (filtros: Filtros = {}) =>
    pedir<Resumen>(`/admin/participantes/resumen${consulta(filtros)}`),

  obtener: (id: string) => pedir<Record<string, unknown>>(`/admin/participantes/${id}`),

  crear: (datos: Record<string, unknown>) =>
    pedir<{ id: string }>("/admin/participantes", {
      method: "POST",
      body: JSON.stringify(datos),
    }),

  cambiarEtapa: (id: string, etapa: Etapa, motivo?: string) =>
    pedir<Record<string, unknown>>(`/admin/participantes/${id}/etapa`, {
      method: "PATCH",
      body: JSON.stringify({ etapa, motivo }),
    }),

  agregarNota: (id: string, texto: string) =>
    pedir<Record<string, unknown>>(`/admin/participantes/${id}/notas`, {
      method: "POST",
      body: JSON.stringify({ texto }),
    }),
};

/** Días desde una fecha. Lo accionable no es cuándo entró. */
export function diasDesde(fecha: string): number {
  const ms = Date.now() - new Date(fecha).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
