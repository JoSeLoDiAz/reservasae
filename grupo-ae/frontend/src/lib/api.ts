import { pedir } from "./pedir";

export { ErrorApi } from "./pedir";
/** Cliente de la API. Rutas relativas. */

export type Semaforo = "DISPONIBLE" | "ULTIMOS_CUPOS" | "COMPLETO";
/** `HIBRIDA` solo la llevan la acción y el grupo. */
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

/** Error con el mensaje del backend. */

/// La llave donde el panel guarda el gremio elegido. Se lee
/// aqui y no se recibe por parametro a proposito: si cada
/// llamada tuviera que acordarse de pasarlo, bastaria con
/// olvidarlo en una para mezclar los datos de los dos
/// gremios, que es justo lo que hay que impedir.
const LLAVE_GREMIO = "convoca:gremio";

function gremioElegido(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LLAVE_GREMIO);
  } catch {
    return null;
  }
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

/** Arregla los nombres en mayúsculas. */
/**
 * El nombre de una organización va SIEMPRE en mayúscula.
 *
 * En el NIT, en el RUES y en el F7 las razones sociales viven
 * en mayúscula, y son documentos legales: «Fundación Aspaen»
 * y «FUNDACIÓN ASPAEN» se leen como dos escrituras distintas
 * de lo mismo, y una de las dos no es la que dice la Cámara
 * de Comercio.
 *
 * Va aparte de `bonito`, que es lo contrario -- pasa a Título
 * lo que viene gritado -- y sirve para nombres de personas.
 */
export function enMayusculas(texto: string): string {
  return texto.trim().toUpperCase();
}

export function bonito(texto: string): string {
  if (texto !== texto.toUpperCase()) return texto;

  const minusculas = new Set(["de", "del", "la", "las", "los", "y", "en", "con", "para", "a", "el"]);
  return texto
    .toLowerCase()
    .split(" ")
    .map((palabra, indice) => {
      if (indice > 0 && minusculas.has(palabra)) return palabra;
      // las siglas cortas no se tocan
      if (palabra.length <= 3 && palabra.includes(".")) return palabra.toUpperCase();
      return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    })
    .join(" ");
}

/// Las siglas que de verdad aparecen en estos textos. Es una
/// lista y no una regla porque no hay regla: «IA» y «la» se
/// escriben igual de cortas, y adivinar cual es sigla se
/// equivoca en las dos direcciones.
const SIGLAS = [
  "SENA", "BRITCHAM", "ADEE", "ADECOPRIA", "SEP", "RUES", "NIT",
  "IA", "DEI", "TIC", "TICS", "LMS", "PDF", "ONG", "MIPYME", "MIPYMES",
  "PYME", "PYMES", "DANE", "DNP", "RUI", "CRM", "AF",
];

/**
 * Un texto que viene EN MAYÚSCULAS, devuelto como párrafo.
 *
 * `bonito` pone Título Capital, que está bien para el nombre de
 * un curso y mal para un párrafo de ocho renglones: deja todas
 * las palabras capitalizadas y se lee casi tan mal como el
 * original. Un párrafo se lee en minúscula, con mayúscula al
 * empezar cada frase.
 */
export function comoParrafo(texto: string): string {
  if (!texto || texto !== texto.toUpperCase()) return texto;

  const bajado = texto
    .toLowerCase()
    .replace(/(^\s*|[.!?]\s+)([a-záéíóúñü])/g, (_, antes, letra) => antes + letra.toUpperCase());

  /// Una pasada por sigla, no una por palabra: mas simple, y no
  /// depende de que el reemplazo con funcion se comporte igual
  /// despues de minificar.
  return SIGLAS.reduce(
    (texto, sigla) =>
      texto.replace(
        new RegExp(`(^|[^a-záéíóúñü])${sigla.toLowerCase()}(?![a-záéíóúñü])`, "gi"),
        (_, antes: string) => antes + sigla,
      ),
    bajado,
  );
}
