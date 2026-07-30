/**
 * Cliente de la API. Siempre rutas relativas `/api/...`: en produccion las
 * enruta nginx y en local el rewrite de `next.config.ts` hace exactamente el
 * mismo salto, incluido quitar el prefijo. Por eso este archivo no necesita
 * saber en que entorno corre.
 */

export type Semaforo = "DISPONIBLE" | "ULTIMOS_CUPOS" | "COMPLETO";
/**
 * Las tres del formato SENA. `HIBRIDA` la llevan solo la acción y el grupo:
 * una oferta concreta siempre es presencial o virtual, porque o se va a la
 * sede o no.
 */
export type Modalidad = "PRESENCIAL" | "VIRTUAL" | "HIBRIDA";
export type TipoUbicacion = "CIUDAD" | "DEPARTAMENTO";
export type EstadoReserva = "CONFIRMADA" | "LISTA_ESPERA" | "CANCELADA";

export type Oferta = {
  id: string;
  modalidad: Modalidad;
  ubicacion: string;
  tipoUbicacion: TipoUbicacion;
  departamento: string | null;
  cuposMaximos: number;
  cuposDisponibles: number;
  estado: Semaforo;
};

export type Accion = {
  id: string;
  codigo: string;
  nombre: string;
  modalidad: Modalidad;
  evento: string | null;
  horas: number | null;
  objetivo: string | null;
  ofertas: Oferta[];
};

export type Catalogo = {
  slug: string;
  nombre: string;
  sigla: string | null;
  acciones: Accion[];
};

export type Reserva = {
  id: string;
  estado: EstadoReserva;
  cuposSolicitados: number;
  cuposConfirmados: number;
  cuposEnEspera: number;
  creadoEn: string;
  empresa: { nit: string; digitoVerificacion: string | null; razonSocial: string };
  contacto: {
    nombre: string;
    correo: string;
    celular: string | null;
    cargo: string | null;
  };
  oferta: {
    id: string;
    modalidad: Modalidad;
    ubicacion: string;
    tipoUbicacion: TipoUbicacion;
    cuposMaximos: number;
    cuposOcupados: number;
    accion: { codigo: string; nombre: string; horas: number | null };
    convenio: string;
  };
};

export type ConsultaPorNit = {
  empresa: {
    nit: string;
    digitoVerificacion: string | null;
    razonSocial: string;
    numeroColaboradores: number | null;
    redAsociada: string | null;
  } | null;
  reservas: Array<{
    id: string;
    estado: EstadoReserva;
    cuposSolicitados: number;
    cuposConfirmados: number;
    cuposEnEspera: number;
    creadoEn: string;
    oferta: {
      id: string;
      modalidad: Modalidad;
      ubicacion: string;
      tipoUbicacion: TipoUbicacion;
      accion: { codigo: string; nombre: string; horas: number | null };
      convenio: string;
    };
  }>;
  totalCupos: number;
};

/** Error con el mensaje que devolvio el backend, no uno generico. */
export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
    readonly cuerpo?: unknown,
  ) {
    super(mensaje);
  }
}

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch(`/api${ruta}`, {
    ...opciones,
    headers: { "content-type": "application/json", ...opciones?.headers },
  });

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    // Nest devuelve `message` como texto o como lista cuando falla la
    // validacion de varios campos a la vez.
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

export const api = {
  catalogo: (slug: string) => pedir<Catalogo>(`/catalogo/${slug}`),

  crearReserva: (datos: Record<string, unknown>) =>
    pedir<Reserva>("/reservas", { method: "POST", body: JSON.stringify(datos) }),

  consultarPorNit: (nit: string) =>
    pedir<ConsultaPorNit>(`/reservas?nit=${encodeURIComponent(nit)}`),

  editarReserva: (id: string, nit: string, cuposSolicitados: number) =>
    pedir<Reserva>(`/reservas/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ nit, cuposSolicitados }),
    }),

  cancelarReserva: (id: string, nit: string) =>
    pedir<Reserva>(`/reservas/${id}/cancelar`, {
      method: "POST",
      body: JSON.stringify({ nit }),
    }),
};

/**
 * Los nombres vienen EN MAYUSCULAS desde los proyectos oficiales. No se
 * cambian en la base (hay que reportar el texto original al SENA), asi que se
 * arreglan al mostrarlos.
 */
export function bonito(texto: string): string {
  if (texto !== texto.toUpperCase()) return texto;

  const minusculas = new Set(["de", "del", "la", "las", "los", "y", "en", "con", "para", "a", "el"]);
  return texto
    .toLowerCase()
    .split(" ")
    .map((palabra, indice) => {
      if (indice > 0 && minusculas.has(palabra)) return palabra;
      // "D.C" y demas siglas cortas se dejan como estaban.
      if (palabra.length <= 3 && palabra.includes(".")) return palabra.toUpperCase();
      return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    })
    .join(" ");
}
