import { ErrorApi } from "./api";
import type { EstadoSemaforo } from "@/components/admin/graficos";

export type Modalidad = "PRESENCIAL" | "VIRTUAL" | "HIBRIDA";
export type EstadoReserva = "CONFIRMADA" | "LISTA_ESPERA" | "CANCELADA";

export type Resumen = {
  cupos: number;
  ocupados: number;
  disponibles: number;
  avance: number;
  /** La meta comprometida en los proyectos, sin el 30 % de sobrecupo. */
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
  reservas: number;
  confirmados: number;
  enEspera: number;
  cursos: string[];
  creadoEn: string;
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
  respuestas: Array<{ pregunta: string; valor: string }>;
};

export type PaginaReservas = {
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
  filas: FilaReserva[];
};

export type PuntoSerie = { dia: string; reservas: number; cupos: number };

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

async function pedir<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(`/api${ruta}`);
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
  empresas: (buscar?: string) =>
    pedir<FilaEmpresa[]>(`/admin/tableros/empresas${consulta({ buscar })}`),
  serie: (dias = 30) => pedir<PuntoSerie[]>(`/admin/tableros/serie${consulta({ dias })}`),
  reservas: (filtros: Record<string, string | number | undefined>) =>
    pedir<PaginaReservas>(`/admin/tableros/reservas${consulta(filtros)}`),
};

/**
 * La descarga va por navegación normal y no por `fetch`: así el navegador se
 * encarga del archivo (nombre, barra de descargas, reanudación) y la cookie de
 * sesión viaja sola. Con fetch habría que montar un blob a mano para nada.
 */
export function descargar(
  informe: "reservas" | "ocupacion" | "empresas",
  filtros: Record<string, string | number | undefined> = {},
) {
  window.location.href = `/api/admin/tableros/exportar/${informe}${consulta(filtros)}`;
}
