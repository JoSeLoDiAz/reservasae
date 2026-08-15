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
  /** Para los filtros: salen de la base, no de la página. */
  asesores: Array<{ id: string; nombre: string; total: number }>;
  acciones: Array<{ id: string; codigo: string; nombre: string; total: number }>;
  sinAsesor: number;
};

export type Ficha = {
  id: string;
  etapa: Etapa;
  origen: Origen;
  creadoEn: string;
  faltantes: { bloquean: string[]; avisan: string[] };
  cargoEnEmpresa: string | null;
  sobrecupoMotivo: string | null;
  sobrecupoPor: { nombre: string } | null;
  persona: {
    id: string;
    tipoDocumento: TipoDocumento;
    numeroDocumento: string;
    primerNombre: string;
    segundoNombre: string | null;
    primerApellido: string;
    segundoApellido: string | null;
    correo: string | null;
    celular: string | null;
    participaciones: Array<{
      id: string;
      etapa: Etapa;
      convenio: { sigla: string | null };
      accionFormacion: { codigo: string; nombre: string } | null;
    }>;
    autorizaciones: Array<{
      id: string;
      canal: Canal;
      otorgadaEn: string;
      politica: { version: number; destinatario: string; convenioId: string };
    }>;
  };
  convenio: { id: string; sigla: string | null; nombre: string };
  accionFormacion: { id: string; codigo: string; nombre: string } | null;
  oferta: { id: string; cuposMaximos: number; ubicacion: { nombre: string } } | null;
  cobertura: {
    id: string;
    grupo: {
      numero: number;
      fechaInicio: string | null;
      fechaFin: string | null;
      horario: string | null;
    };
  } | null;
  reserva: { id: string; empresa: { nit: string; razonSocial: string } } | null;
  asesor: { id: string; nombre: string } | null;
  movimientos: Array<{
    id: string;
    etapaAntes: Etapa | null;
    etapaDespues: Etapa;
    motivo: string | null;
    creadoEn: string;
  }>;
  notas: Array<{ id: string; autorNombre: string; texto: string; creadoEn: string }>;
};

export type EstadoAcademico =
  | "AL_DIA" | "ATRASADO" | "PARADO" | "CERTIFICADO" | "SALIO"
  | "SIN_EMPEZAR" | "SIN_FECHAS";

export const ETIQUETA_ACADEMICA: Record<EstadoAcademico, string> = {
  AL_DIA: "Al día",
  ATRASADO: "Atrasado",
  PARADO: "Parado",
  CERTIFICADO: "Certificado",
  SALIO: "Salió",
  SIN_EMPEZAR: "Sin empezar",
  SIN_FECHAS: "Sin fechas de grupo",
};

export type FilaAcademica = {
  id: string;
  nombre: string;
  documento: string;
  etapa: Etapa;
  accion: string | null;
  grupo: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  horario: string | null;
  asesor: { id: string; nombre: string } | null;
  total: number;
  hechas: number;
  esperadas: number | null;
  desfase: number | null;
  porcentaje: number;
  ultimoAcceso: string | null;
  diasSinEntrar: number | null;
  notaFinal: string | null;
  estado: EstadoAcademico;
};

export type Academico = {
  personas: FilaAcademica[];
  resumen: {
    total: number;
    alDia: number;
    atrasados: number;
    parados: number;
    certificados: number;
    salieron: number;
    sinEmpezar: number;
    sinFechas: number;
  };
  criterio: { tolerancia: number; diasParado: number };
};

export type Filtros = {
  convenioId?: string;
  etapa?: Etapa;
  accionFormacionId?: string;
  asesorId?: string;
  buscar?: string;
  pagina?: number;
  /** Cuántas filas por carga; el servidor lo topa. */
  limite?: number;
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

export type Canal =
  | "FORMULARIO_WEB" | "CARGA_EMPRESA" | "VERBAL_ASESOR" | "CORREO" | "PRESENCIAL";

export const ETIQUETA_CANAL: Record<Canal, string> = {
  FORMULARIO_WEB: "Lo aceptó en el formulario web",
  CARGA_EMPRESA: "Vino en la lista de la empresa",
  VERBAL_ASESOR: "Lo autorizó de viva voz al asesor",
  CORREO: "Lo autorizó por correo",
  PRESENCIAL: "Firmó en papel",
};

export type OpcionOferta = {
  id: string;
  accionFormacionId: string;
  etiqueta: string;
  ubicacion: string;
  modalidad: string;
  cupos: number;
  ocupados: number;
  disponibles: number;
  abierta: boolean;
};

export type OpcionGrupo = {
  id: string;
  accionFormacionId: string;
  etiqueta: string;
  modalidad: string;
  cupos: number;
  ocupados: number;
  fechaInicio: string | null;
  fechaFin: string | null;
  horario: string | null;
};

export type Opciones = { ofertas: OpcionOferta[]; grupos: OpcionGrupo[] };

export const crmApi = {
  opciones: (convenioId: string) =>
    pedir<Opciones>(`/admin/participantes/opciones?convenioId=${convenioId}`),

  asignar: (id: string, ofertaId: string, coberturaId?: string, sobrecupoMotivo?: string) =>
    pedir<Ficha>(`/admin/participantes/${id}/formacion`, {
      method: "PATCH",
      body: JSON.stringify({ ofertaId, coberturaId, sobrecupoMotivo }),
    }),

  autorizar: (id: string, canal: Canal, evidencia?: string) =>
    pedir<Ficha>(`/admin/participantes/${id}/autorizacion`, {
      method: "POST",
      body: JSON.stringify({ canal, evidencia }),
    }),

  listar: (filtros: Filtros = {}) =>
    pedir<Listado>(`/admin/participantes${consulta(filtros)}`),

  resumen: (filtros: Filtros = {}) =>
    pedir<Resumen>(`/admin/participantes/resumen${consulta(filtros)}`),

  academico: (filtros: Filtros = {}) =>
    pedir<Academico>(`/admin/participantes/academico${consulta(filtros)}`),

  obtener: (id: string) => pedir<Ficha>(`/admin/participantes/${id}`),

  crear: (datos: Record<string, unknown>) =>
    pedir<{ id: string }>("/admin/participantes", {
      method: "POST",
      body: JSON.stringify(datos),
    }),

  cambiarEtapa: (id: string, etapa: Etapa, motivo?: string) =>
    pedir<Ficha>(`/admin/participantes/${id}/etapa`, {
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
