import { ErrorApi } from "./api";

export type Etapa =
  | "INTERESADO"
  | "CONTACTADO"
  | "DATOS_COMPLETOS"
  | "INSCRITO"
  | "EN_FORMACION"
  | "CERTIFICADO"
  | "PERDIDO"
  | "RETIRADO"
  | "NO_APROBO"
  | "DESERTO"
  | "ABANDONO";

/** El catálogo del SEP, servido por el backend. */
export type TipoDocumentoSep = {
  id: number;
  etiqueta: string;
  sigla: string;
};

export type Origen =
  | "EMPRESA" | "ASESOR" | "AUTOGESTION" | "REFERIDO" | "REDES" | "EVENTO" | "OTRO";

/** En orden de avance. Las salidas van aparte. */
export const ETAPAS_AVANCE: Etapa[] = [
  "INTERESADO",
  "CONTACTADO",
  "DATOS_COMPLETOS",
  "INSCRITO",
  "EN_FORMACION",
  "CERTIFICADO",
];

/**
 * Las que se ven en el tablero de inscripciones: hasta
 * matricular, que es donde acaba el trabajo del asesor.
 * En formación y Certificado se siguen en el módulo
 * académico, contra el calendario de su grupo.
 */
/**
 * El tablero del asesor. «Inscrito» NO está: al marcarlo,
 * la ficha sale de aquí y aparece en Inscritos. Dejarla en
 * las dos partes obliga a mirar dos sitios para saber si
 * queda trabajo pendiente.
 */
export const ETAPAS_DE_INSCRIPCION: Etapa[] = [
  "INTERESADO",
  "CONTACTADO",
  "DATOS_COMPLETOS",
];

/**
 * Lo que gobierna el académico. NO sale en Inscripciones:
 * ahí el trabajo del asesor acaba al marcar «Inscrito».
 */
export const ETAPAS_DEL_AULA: Etapa[] = [
  "EN_FORMACION",
  "CERTIFICADO",
  "RETIRADO",
  "NO_APROBO",
  "DESERTO",
  "ABANDONO",
];

/// La única salida del embudo del asesor.
export const ETAPAS_SALIDA: Etapa[] = ["PERDIDO"];

/// Las del aula, que exigen motivo igual que «No interesado».
export const SALIDAS_DEL_AULA: Etapa[] = [
  "RETIRADO",
  "NO_APROBO",
  "DESERTO",
  "ABANDONO",
];

export const ETIQUETA_ETAPA: Record<Etapa, string> = {
  INTERESADO: "Interesado",
  CONTACTADO: "Contactado",
  DATOS_COMPLETOS: "Datos completos",
  INSCRITO: "Inscrito",
  EN_FORMACION: "En formación",
  CERTIFICADO: "Certificado",
  PERDIDO: "No interesado",
  RETIRADO: "Retirado",
  NO_APROBO: "No aprobó",
  DESERTO: "Desertó",
  ABANDONO: "Abandonó",
};

/// Qué separa a los que se parecen.
export const AYUDA_ETAPA: Partial<Record<Etapa, string>> = {
  DESERTO: "Avisó que se retiraba.",
  ABANDONO: "Dejó de entrar al aula sin decir nada.",
  RETIRADO: "Se retiró antes de empezar la formación.",
  PERDIDO: "Se le contactó y no quiso seguir.",
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



export type Origen2 =
  | "EMPRESA" | "ASESOR" | "AUTOGESTION" | "REFERIDO" | "REDES"
  | "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "WHATSAPP" | "CORREO"
  | "EVENTO" | "OTRO";

export type FilaParticipante = {
  id: string;
  etapa: Etapa;
  origen: Origen2;
  /** Si la persona entregó su ficha entera o a medias. */
  datos: "PARCIALES" | "COMPLETOS";
  /** Qué le falta de lo suyo: lo que el asesor le pide. */
  faltaDeLaPersona: string[];
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
  faltantes: { bloquean: string[]; avisan: string[]; reporte: string[] };
  cargoEnEmpresa: string | null;
  nivelOcupacionalSepId: number | null;
  beneficiarioPrevio: boolean | null;
  sobrecupoMotivo: string | null;
  sobrecupoPor: { nombre: string } | null;
  persona: {
    id: string;
    tipoDocumentoSepId: number;
    documento: string;
    numeroDocumento: string;
    primerNombre: string;
    segundoNombre: string | null;
    primerApellido: string;
    segundoApellido: string | null;
    correo: string | null;
    celular: string | null;
    fechaNacimiento: string | null;
    generoSepId: number | null;
    estrato: number | null;
    departamentoSepId: number | null;
    municipioSepId: number | null;
    barrio: string | null;
    direccion: string | null;
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
    /// Lo que no es un cambio de etapa: el asesor, p. ej.
    nota: string | null;
    creadoEn: string;
    /// Null si lo movió el sistema, no una persona.
    admin: { nombre: string } | null;
  }>;
  notas: Array<{ id: string; autorNombre: string; texto: string; creadoEn: string }>;
};

export type EstadoAcademico =
  | "SIN_INGRESO"
  | "SIN_EMPEZAR"
  | "ATRASADO"
  | "AL_DIA"
  | "COMPLETADO"
  | "CERTIFICADO";

export const ETIQUETA_ACADEMICA: Record<EstadoAcademico, string> = {
  SIN_INGRESO: "Sin ingreso",
  SIN_EMPEZAR: "Sin empezar",
  ATRASADO: "Atrasado",
  AL_DIA: "Al día",
  COMPLETADO: "Listo para certificar",
  CERTIFICADO: "Certificado",
};

/// Qué significa cada uno, para no tener que adivinarlo.
export const AYUDA_ACADEMICA: Record<EstadoAcademico, string> = {
  SIN_INGRESO: "Su grupo ya empezó y nunca ha entrado al aula.",
  SIN_EMPEZAR: "Su grupo todavía no arranca: no se juzga.",
  ATRASADO: "Va dos actividades o más por debajo de lo que tocaría.",
  AL_DIA: "Avanza al ritmo que marca el calendario de su grupo.",
  COMPLETADO: "Aprobó el 80 % o más de lo obligatorio.",
  CERTIFICADO: "Terminó y se le certificó.",
};

export type FilaAcademica = {
  id: string;
  nombre: string;
  documento: string;
  etapa: Etapa;
  accion: string | null;
  accionFormacionId: string | null;
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
  listoParaCertificar: boolean;
  /** Si se fue, manda su etapa y no su ritmo. */
  salio: boolean;
  coberturaId: string | null;
  ultimoAcceso: string | null;
  diasSinEntrar: number | null;
  notaFinal: string | null;
  estado: EstadoAcademico;
};

export type Academico = {
  personas: FilaAcademica[];
  /** Solo lo que hay en el aula: filtrar por vacíos cansa. */
  acciones: Array<{ id: string; codigo: string; nombre: string }>;
  grupos: Array<{ id: string; numero: number; accionFormacionId: string | null }>;
  asesores: Array<{ id: string; nombre: string }>;
  sinAsesor: number;
  resumen: {
    total: number;
    /** Sobre cuántas se calculó el reparto: puede ser menos. */
    analizadas: number;
    /** Los seis se cuentan solo sobre quien sigue dentro. */
    enFormacion: number;
    sinIngreso: number;
    sinEmpezar: number;
    atrasados: number;
    alDia: number;
    completados: number;
    certificados: number;
    desertaron: number;
    abandonaron: number;
    retirados: number;
    noAprobaron: number;
  };
  criterio: {
    tolerancia: number;
    diasParado: number;
    minimoParaCertificar: number;
  };
};


export type Corte = { etiqueta: string; total: number };

/** Lo que pinta el panel de Control de inscritos. */
export type Control = {
  total: number;
  cuposConfirmados: number;
  diasHastaInscribir: number | null;
  embudo: Array<{ etapa: Etapa; total: number }>;
  porAccion: Corte[];
  porUbicacion: Array<Corte & { tipo: string }>;
  porGrupo: Array<Corte & { inicio: string | null }>;
  porConvenio: Corte[];
  porAsesor: Corte[];
  porOrigen: Corte[];
  porModalidad: Corte[];
  serie: Array<{ dia: string; total: number }>;
};

export type CatalogosSep = {
  documentosPersona: TipoDocumentoSep[];
  documentosEmpresa: TipoDocumentoSep[];
  generos: Array<{ id: number; etiqueta: string }>;
  nivelesOcupacionales: Array<{ id: number; etiqueta: string }>;
  tamanosEmpresa: Array<{ id: number; etiqueta: string }>;
  departamentos: Array<{ id: number; etiqueta: string }>;
  /** [id, departamentoId, nombre] */
  municipios: Array<[number, number, string]>;
  estrato: { minimo: number; maximo: number };
  edadMinima: number;
};

export type Filtros = {
  convenioId?: string;
  etapa?: Etapa;
  accionFormacionId?: string;
  grupoId?: string;
  asesorId?: string;
  /** «solo el embudo» o «solo el aula». */
  tramo?: "INSCRIPCION" | "INSCRITOS" | "AULA";
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

export type Asesor = { id: string; nombre: string; correo: string };

export type Opciones = {
  ofertas: OpcionOferta[];
  grupos: OpcionGrupo[];
  /// Quien puede llevar leads en este convenio.
  asesores: Asesor[];
};

export const crmApi = {
  borrarParticipacion: (id: string) =>
    pedir<{
      borrado: boolean;
      nombre: string;
      documento: string;
      avancesBorrados: number;
      notasBorradas: number;
    }>(`/admin/participantes/${id}`, { method: "DELETE" }),

  control: () => pedir<Control>("/admin/participantes/control"),

  opciones: (convenioId: string) =>
    pedir<Opciones>(`/admin/participantes/opciones?convenioId=${convenioId}`),

  asignarAsesorEnLote: (ids: string[], asesorId: string | null) =>
    pedir<{ cambiadas: number; fuera: number; sinCambio: number }>(
      "/admin/participantes/lote/asesor",
      { method: "PATCH", body: JSON.stringify({ ids, asesorId }) },
    ),

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

  catalogos: () => pedir<CatalogosSep>("/admin/participantes/catalogos"),

  resumen: (filtros: Filtros = {}) =>
    pedir<Resumen>(`/admin/participantes/resumen${consulta(filtros)}`),

  academico: (filtros: Filtros = {}) =>
    pedir<Academico>(`/admin/participantes/academico${consulta(filtros)}`),

  obtener: (id: string) => pedir<Ficha>(`/admin/participantes/${id}`),

  actualizar: (id: string, datos: Record<string, unknown>) =>
    pedir<Ficha>(`/admin/participantes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

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
