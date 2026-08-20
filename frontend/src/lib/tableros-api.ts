import { ErrorApi } from "./api";
import type { EstadoSemaforo } from "@/components/admin/graficos";

export type Modalidad = "PRESENCIAL" | "VIRTUAL" | "HIBRIDA";
export type EstadoReserva = "CONFIRMADA" | "LISTA_ESPERA" | "CANCELADA";

export type Resumen = {
  cupos: number;
  ocupados: number;
  disponibles: number;
  avance: number;
  /** La meta comprometida, sin sobrecupo. */
  metaBase: number;
  avanceMeta: number;
  enEspera: number;
  reservas: number;
  canceladas: number;
  tasaCancelacion: number;
  cuposPorReserva: number;
  empresas: number;
  acciones: number;
  accionesPublicadas: number;
  ofertasSinReservas: number;
};

export type Analisis = {
  territorio: Array<{
    nombre: string;
    tipo: string;
    cupos: number;
    ocupados: number;
    disponibles: number;
    acciones: number;
    avance: number;
  }>;
  modalidad: Array<{
    nombre: Modalidad;
    cupos: number;
    ocupados: number;
    ofertas: number;
    avance: number;
  }>;
  gremio: Array<{ nombre: string; empresas: number; cupos: number }>;
  tamano: Array<{ nombre: string; empresas: number; cupos: number }>;
  concentracion: {
    totalCupos: number;
    organizaciones: number;
    diezMayores: Array<{ razonSocial: string; nit: string; cupos: number; porcentaje: number }>;
    porcentajeDiezMayores: number;
  };
  sinReservas: Array<{
    id: string;
    codigo: string;
    accion: string;
    ubicacion: string;
    modalidad: Modalidad;
    cupos: number;
  }>;
};

export type FilaAccion = {
  id: string;
  codigo: string;
  nombre: string;
  evento: string | null;
  modalidad: Modalidad;
  horas: number | null;
  visible: boolean;
  convenio: string;
  convenioSigla: string | null;
  ubicaciones: number;
  cupos: number;
  ocupados: number;
  disponibles: number;
  enEspera: number;
  avance: number;
  estado: EstadoSemaforo;
};

export type FilaUbicacion = {
  id: string;
  convenio: string;
  convenioSigla: string | null;
  codigo: string;
  accion: string;
  ubicacion: string;
  tipoUbicacion: "CIUDAD" | "DEPARTAMENTO";
  modalidad: Modalidad;
  cupos: number;
  ocupados: number;
  disponibles: number;
  avance: number;
  estado: EstadoSemaforo;
  abierta: boolean;
};

export type FilaEmpresa = {
  id: string;
  nit: string;
  digitoVerificacion: string | null;
  razonSocial: string;
  numeroColaboradores: number | null;
  redAsociada: string | null;
  redAsociadaOtra: string | null;
  departamento: string | null;
  municipio: string | null;
  direccion: string | null;
  telefono: string | null;
  contactoNombre: string | null;
  contactoCargo: string | null;
  contactoCorreo: string | null;
  sectorEconomico: string | null;
  clasificacion: string | null;
  numeroTrabajadores: number | null;
  tamanoSepId: number | null;
  /** qué le falta para poder ir en el F7 */
  faltaF7: string[];
  reservas: number;
  confirmados: number;
  enEspera: number;
  cursos: string[];
  creadoEn: string;
};

export type PaginaEmpresas = {
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
  filas: FilaEmpresa[];
};

export type FilaReserva = {
  id: string;
  estado: EstadoReserva;
  cuposSolicitados: number;
  cuposConfirmados: number;
  cuposEnEspera: number;
  creadoEn: string;
  canceladaEn: string | null;
  empresa: {
    nit: string;
    digitoVerificacion: string | null;
    razonSocial: string;
    numeroColaboradores: number | null;
    redAsociada: string | null;
    redAsociadaOtra: string | null;
  };
  contacto: {
    nombre: string;
    correo: string;
    celular: string | null;
    cargo: string | null;
  };
  oferta: {
    codigo: string;
    accion: string;
    ubicacion: string;
    modalidad: Modalidad;
    convenio: string;
    convenioSigla: string | null;
  };
  /// Por qué enlace entró. Null si es anterior al constructor.
  formulario: { slug: string; titulo: string } | null;
  respuestas: Array<{ pregunta: string; valor: string }>;
};

export type FilaFormulario = {
  slug: string;
  titulo: string;
  publicado: boolean;
  convenio: string;
  reservas: number;
  cupos: number;
};

export type PaginaReservas = {
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
  filas: FilaReserva[];
};

export type PuntoSerie = { dia: string; reservas: number; cupos: number };

export type EstadoProyeccion =
  | "CUMPLIDA"
  | "SIN_META"
  | "SIN_RITMO"
  | "RETROCEDE"
  | "MUY_LEJOS"
  | "ESTIMADA";

export type Proyeccion = {
  estado: EstadoProyeccion;
  confianza: "BAJA" | "NORMAL";
  origen: "MOVIMIENTOS" | "APROXIMADO";
  ocupados: number;
  meta: number;
  faltan: number;
  ritmoDiario: number;
  ritmo7: number;
  ritmo14: number;
  diasEstimados: number | null;
  fechaEstimada: string | null;
};

export type ProyeccionAccion = Proyeccion & {
  id: string;
  codigo: string;
  nombre: string;
  publicada: boolean;
  convenio: string;
};

export type InformeProyeccion = {
  dias: number;
  total: Proyeccion;
  acciones: ProyeccionAccion[];
};

export type PreguntaAgregada = {
  id: string;
  etiqueta: string;
  tipo: string;
  archivada: boolean;
  respondidas: number;
  tasaRespuesta: number;
  opciones?: Array<{
    valor: string;
    etiqueta: string;
    archivada: boolean;
    veces: number;
    porcentaje: number;
  }>;
  casilla?: { si: number; no: number };
  numero?: {
    media: number | null;
    mediana: number | null;
    minimo: number | null;
    maximo: number | null;
    suma: number;
  };
  texto?: string[];
};

export type InformeRespuestas = {
  formulario: { id: string; slug: string; titulo: string };
  totalReservas: number;
  preguntas: PreguntaAgregada[];
};

export type DetalleAccion = {
  id: string;
  codigo: string;
  nombre: string;
  evento: string | null;
  modalidad: Modalidad;
  metodologia: string | null;
  enfoque: string | null;
  horas: number | null;
  objetivo: string | null;
  ambiente: string | null;
  visible: boolean;
  convenio: { slug: string; sigla: string | null; nombre: string };
  cupos: number;
  ocupados: number;
  disponibles: number;
  metaBase: number;
  proyeccion: Proyeccion;
  avance: number;
  avanceMeta: number;
  enEspera: number;
  organizaciones: number;
  ofertas: Array<{
    id: string;
    ubicacion: string;
    tipoUbicacion: "CIUDAD" | "DEPARTAMENTO";
    departamento: string | null;
    modalidad: Modalidad;
    cupos: number;
    ocupados: number;
    disponibles: number;
    enEspera: number;
    avance: number;
    estado: EstadoSemaforo;
    abierta: boolean;
  }>;
  grupos: Array<{
    numero: number;
    modalidad: Modalidad;
    sede: string | null;
    fechaInicio: string | null;
    horario: string | null;
    cuposBase: number;
    cuposMaximos: number;
    coberturas: Array<{
      ubicacion: string;
      modalidad: Modalidad;
      cuposBase: number;
      cuposMaximos: number;
    }>;
  }>;
  reservas: Array<{
    id: string;
    estado: EstadoReserva;
    creadoEn: string;
    cuposConfirmados: number;
    cuposEnEspera: number;
    ubicacion: string;
    empresa: string;
    nit: string;
    contacto: string;
    correo: string;
  }>;
  serie: Array<{ dia: string; cupos: number }>;
};

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch(`/api${ruta}`, opciones);
  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const bruto = (cuerpo as { message?: string | string[] } | null)?.message;
    const mensaje = Array.isArray(bruto) ? bruto.join(". ") : bruto;
    throw new ErrorApi(respuesta.status, mensaje ?? "No se pudo cargar la información.");
  }
  return cuerpo as T;
}

export function consulta(filtros: Record<string, string | number | undefined>): string {
  const partes = Object.entries(filtros)
    .filter(([, v]) => v !== undefined && v !== "" && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return partes.length ? `?${partes.join("&")}` : "";
}

export const tablerosApi = {
  resumen: () => pedir<Resumen>("/admin/tableros/resumen"),
  analisis: () => pedir<Analisis>("/admin/tableros/analisis"),
  acciones: () => pedir<FilaAccion[]>("/admin/tableros/acciones"),
  accion: (id: string) => pedir<DetalleAccion>(`/admin/tableros/acciones/${id}`),
  ubicaciones: (convenio?: string) =>
    pedir<FilaUbicacion[]>(`/admin/tableros/ubicaciones${consulta({ convenio })}`),
  empresas: (filtros: { buscar?: string; pagina?: number; porPagina?: number } = {}) =>
    pedir<PaginaEmpresas>(`/admin/tableros/empresas${consulta(filtros)}`),
  serie: (dias = 30) => pedir<PuntoSerie[]>(`/admin/tableros/serie${consulta({ dias })}`),
  proyeccion: (dias = 14) =>
    pedir<InformeProyeccion>(`/admin/tableros/proyeccion${consulta({ dias })}`),
  respuestas: (formularioId: string) =>
    pedir<InformeRespuestas>(`/admin/tableros/respuestas/${formularioId}`),
  reservas: (filtros: Record<string, string | number | undefined>) =>
    pedir<PaginaReservas>(`/admin/tableros/reservas${consulta(filtros)}`),

  formularios: () => pedir<FilaFormulario[]>("/admin/tableros/formularios"),

  borrarReserva: (id: string) =>
    pedir<{
      borrada: boolean;
      cuposDevueltos: number;
      empresaBorrada: boolean;
      organizacion: string;
    }>(`/admin/tableros/reservas/${id}`, { method: "DELETE" }),
};

/** Descarga por navegación. */
export function descargar(
  informe: "reservas" | "ocupacion" | "empresas",
  filtros: Record<string, string | number | undefined> = {},
) {
  window.location.href = `/api/admin/tableros/exportar/${informe}${consulta(filtros)}`;
}
