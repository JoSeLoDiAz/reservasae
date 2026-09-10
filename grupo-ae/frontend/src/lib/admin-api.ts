/** Cliente del panel. Sesión en cookie. */

import { ErrorApi } from "./api";
import { pedir } from "./pedir";
import type { CatalogoColores, ColoresTema, Esquema } from "./tema";

export type RolAdmin = "SUPERADMIN" | "GESTOR" | "CONSULTA";

/// El espejo de backend/src/admin/permisos.ts. Aquí solo
/// deciden qué se dibuja; la cerradura está en el guard.
export type Area =
  | "reserva"
  | "inscripciones"
  | "inscritos"
  | "reportes"
  | "academico"
  | "configuracion";

export type Nivel = "NADA" | "VER" | "ESCRIBIR";

/// Cómo se llama cada área en pantalla. Las claves son las del
/// backend; esto es lo que lee una persona.
export const ETIQUETA_AREA: Record<Area, string> = {
  reserva: "Reservas y cronograma",
  inscripciones: "Gestión de inscripciones",
  inscritos: "Datos de los inscritos",
  reportes: "Reportes al SENA",
  academico: "Seguimiento académico",
  configuracion: "Configuración",
};

export const AREAS = Object.keys(ETIQUETA_AREA) as Area[];

/**
 * Qué puede hacer cada rol, para PINTARLO.
 *
 * Es el espejo de `PERMISOS` en `backend/src/admin/permisos.ts`
 * y no manda nada: la cerradura está en el guard del servidor.
 * Existe para que la pantalla de usuarios pueda enseñar la
 * tabla entera antes de conceder, en vez de una frase por rol.
 *
 * Si allí se cambia una casilla, aquí también. Es el precio de
 * no pedirle la tabla al servidor para dibujar una ayuda.
 */
export const PERMISOS_POR_ROL: Record<RolConvenio, Record<Area, Nivel>> = {
  GESTOR_INSCRIPCION: {
    reserva: "VER",
    inscripciones: "ESCRIBIR",
    inscritos: "VER",
    reportes: "VER",
    academico: "VER",
    configuracion: "NADA",
  },
  LIDER_INSCRIPCION: {
    reserva: "ESCRIBIR",
    inscripciones: "ESCRIBIR",
    inscritos: "VER",
    reportes: "ESCRIBIR",
    academico: "VER",
    configuracion: "NADA",
  },
  GESTOR_ACADEMICO: {
    reserva: "VER",
    inscripciones: "VER",
    inscritos: "VER",
    reportes: "NADA",
    academico: "ESCRIBIR",
    configuracion: "NADA",
  },
  LIDER_ACADEMICO: {
    reserva: "VER",
    inscripciones: "VER",
    inscritos: "VER",
    reportes: "NADA",
    academico: "ESCRIBIR",
    configuracion: "NADA",
  },
  LIDER_SISTEMAS: {
    reserva: "ESCRIBIR",
    inscripciones: "ESCRIBIR",
    inscritos: "VER",
    reportes: "ESCRIBIR",
    academico: "ESCRIBIR",
    configuracion: "ESCRIBIR",
  },
  CONSULTA: {
    reserva: "VER",
    inscripciones: "VER",
    inscritos: "VER",
    reportes: "NADA",
    academico: "VER",
    configuracion: "NADA",
  },
};

export type RolConvenio =
  | "LIDER_INSCRIPCION"
  | "GESTOR_INSCRIPCION"
  | "LIDER_ACADEMICO"
  | "GESTOR_ACADEMICO"
  | "LIDER_SISTEMAS"
  | "CONSULTA";

/** A qué convenio entra una cuenta y con qué rol. */
export type Concesion = {
  convenioId: string;
  rol: RolConvenio;
  slug?: string;
  sigla?: string;
};

/// Lo que se lee en el desplegable, en orden de mando.
export const ROLES_DE_CONVENIO: Array<{
  valor: RolConvenio;
  etiqueta: string;
  descripcion: string;
}> = [
  {
    valor: "LIDER_SISTEMAS",
    etiqueta: "Líder de sistemas de información",
    descripcion: "Configura la formación, el cronograma y los formularios.",
  },
  {
    valor: "LIDER_INSCRIPCION",
    etiqueta: "Líder de inscripciones",
    descripcion: "Todo lo del gestor, y descarga los reportes al SENA.",
  },
  {
    valor: "GESTOR_INSCRIPCION",
    etiqueta: "Gestor(a) de inscripciones",
    descripcion: "Inscribe personas y completa sus datos. No descarga el archivo.",
  },
  {
    valor: "LIDER_ACADEMICO",
    etiqueta: "Líder de seguimiento académico",
    descripcion: "Registra avance y es quien certifica o da por no aprobado.",
  },
  {
    valor: "GESTOR_ACADEMICO",
    etiqueta: "Gestor(a) de seguimiento académico",
    descripcion: "Registra el avance en el aula. No certifica.",
  },
  {
    valor: "CONSULTA",
    etiqueta: "Consulta",
    descripcion: "Solo mira. No modifica nada.",
  },
];

export type AdminActual = {
  id: string;
  correo: string;
  nombre: string;
  rol: RolAdmin;
  activo: boolean;
  debeCambiarClave: boolean;
  cargo: string | null;
  celular: string | null;
  organizacion: string | null;
  ultimoAcceso: string | null;
  creadoEn: string;
  convenios?: string[];
  permisos?: Record<Area, Nivel>;
  /// Lo que puede hacer, además de las áreas.
  ///
  /// Un gestor y un líder tienen los dos `inscripciones:
  /// ESCRIBIR`, así que el par área/nivel no los distingue.
  /// Esto es para no ofrecer un botón que el servidor va a
  /// rechazar — la cerradura sigue estando allá.
  puede?: { repartirFichas: boolean; sacarDeInscrito: boolean };
  concesiones?: Concesion[];
  /// Los gremios de esta cuenta, con lo que se lee de ellos.
  /// Vienen de `/admin/yo`, no de las concesiones: esas solo
  /// llegan en el listado de usuarios.
  gremios?: Array<{ convenioId: string; slug: string; sigla: string }>;
  /// Cuál está puesto ahora mismo, según lo dijo el backend.
  gremioElegido?: string | null;
  /// Si lo fija la DIRECCIÓN y no el desplegable. En el
  /// subdominio de un gremio no hay nada que elegir.
  gremioFijo?: boolean;
};

const ESCALA: Nivel[] = ["NADA", "VER", "ESCRIBIR"];

/** Si lo que tiene cubre lo que se le pide. */
export function alcanza(tiene: Nivel | undefined, pide: Nivel) {
  return ESCALA.indexOf(tiene ?? "NADA") >= ESCALA.indexOf(pide);
}

export type ModoPorDefecto = "SISTEMA" | "CLARO" | "OSCURO";

export type OrigenLogos = "GENERAL" | "FORMULARIO";

/** Tres caben en la cabecera; una cuarta no. */
export const MAXIMO_LOGOS = 3;

export type Logo = {
  id: string;
  etiqueta: string;
  tipoMime: string;
  nombre: string;
  version: number;
  orden: number;
};

export type Marca = {
  nombreApp: string;
  tituloPublico: string;
  subtituloPublico: string;
  mensajeEncabezado: string | null;
  piePagina: string | null;
  modoPorDefecto: ModoPorDefecto;
  permitirCambioDeModo: boolean;
  /** De quién es la apariencia. */
  ambito: "GENERAL" | "FORMULARIO";
  formularioSlug: string | null;
  /** El banner de la cabecera, en orden. */
  logos: Logo[];
  origenLogos: OrigenLogos;
  /** Tokens que sobreescribe el formulario. */
  sobreescritos?: Record<Esquema, string[]>;
  /** Las dos paletas juntas. */
  temas: Record<Esquema, ColoresTema>;
  /** Qué colores existen. Lo define el backend. */
  catalogoColores: CatalogoColores;
  actualizadoEn: string;
};

export type PlantillaTema = {
  clave: string;
  nombre: string;
  descripcion: string;
  principal: string;
  encabezadoDeColor: boolean;
  temas: Record<Esquema, ColoresTema>;
};

export type AccionAdmin = {
  id: string;
  codigo: string;
  nombre: string;
  evento: string | null;
  modalidad: "PRESENCIAL" | "VIRTUAL" | "HIBRIDA";
  horas: number | null;
  visible: boolean;
  convenio: string;
  convenioSigla: string | null;
  ofertas: number;
  cuposMaximos: number;
  cuposOcupados: number;
};



/** Qué formulario le da la marca a un gremio. */
export type MarcaDeGremio = {
  id: string;
  slug: string;
  sigla: string | null;
  nombre: string;
  /// La dirección por la que entra ese gremio.
  direccion: string;
  formularioMarcaId: string | null;
  formularios: Array<{
    id: string;
    slug: string;
    titulo: string;
    publicado: boolean;
  }>;
};

export const adminApi = {
  iniciarSesion: (correo: string, clave: string) =>
    pedir<AdminActual>("/admin/sesion", {
      method: "POST",
      body: JSON.stringify({ correo, clave }),
    }),

  cerrarSesion: () => pedir<{ cerrada: boolean }>("/admin/sesion", { method: "DELETE" }),

  yo: () => pedir<AdminActual>("/admin/yo"),

  cambiarClave: (claveActual: string, claveNueva: string) =>
    pedir<{ cambiada: boolean }>("/admin/clave", {
      method: "POST",
      body: JSON.stringify({ claveActual, claveNueva }),
    }),

  actualizarPerfil: (datos: Partial<Pick<AdminActual, "nombre" | "cargo" | "celular" | "organizacion">>) =>
    pedir<AdminActual>("/admin/perfil", { method: "PATCH", body: JSON.stringify(datos) }),

  usuarios: () => pedir<AdminActual[]>("/admin/usuarios"),

  crearUsuario: (
    correo: string,
    nombre: string,
    rol: RolAdmin,
    concesiones: Concesion[],
  ) =>
    pedir<{ admin: AdminActual; claveTemporal: string }>("/admin/usuarios", {
      method: "POST",
      body: JSON.stringify({ correo, nombre, rol, concesiones }),
    }),

  actualizarUsuario: (
    id: string,
    datos: { rol?: RolAdmin; activo?: boolean; concesiones?: Concesion[] },
  ) =>
    pedir<AdminActual>(`/admin/usuarios/${id}`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  reiniciarClave: (id: string) =>
    pedir<{ claveTemporal: string }>(`/admin/usuarios/${id}/clave`, { method: "POST" }),

  marca: () => pedir<Marca>("/admin/marca"),

  marcaDeGremios: () => pedir<MarcaDeGremio[]>("/admin/marca/gremios"),

  fijarMarcaDeGremio: (convenioId: string, formularioId: string | null) =>
    pedir<MarcaDeGremio[]>(`/admin/marca/gremios/${convenioId}`, {
      method: "PATCH",
      body: JSON.stringify({ formularioId }),
    }),

  actualizarMarca: (datos: Partial<Marca>) =>
    pedir<Marca>("/admin/marca", { method: "PATCH", body: JSON.stringify(datos) }),

  // el DTO espera { colores }, no el mapa plano
  actualizarTema: (esquema: Esquema, colores: Partial<ColoresTema>) =>
    pedir<Marca>(`/admin/marca/tema/${esquema}`, {
      method: "PATCH",
      body: JSON.stringify({ colores }),
    }),

  restablecerTema: (esquema: Esquema) =>
    pedir<Marca>(`/admin/marca/tema/${esquema}/restablecer`, { method: "POST" }),

  // logos: las mismas rutas para los dos ambitos
  logos: (formularioId?: string) =>
    pedir<Logo[]>(`/admin/logos${formularioId ? `?formularioId=${formularioId}` : ""}`),

  subirLogo: (archivo: File, etiqueta: string, formularioId?: string) => {
    const cuerpo = new FormData();
    cuerpo.append("logo", archivo);
    cuerpo.append("etiqueta", etiqueta);
    if (formularioId) cuerpo.append("formularioId", formularioId);
    // sin content-type: el navegador pone el boundary
    return pedir<Logo[]>("/admin/logos", { method: "POST", body: cuerpo });
  },

  actualizarLogo: (
    id: string,
    datos: { etiqueta?: string; direccion?: "IZQUIERDA" | "DERECHA" },
  ) => pedir<Logo[]>(`/admin/logos/${id}`, { method: "PATCH", body: JSON.stringify(datos) }),

  borrarLogo: (id: string) => pedir<Logo[]>(`/admin/logos/${id}`, { method: "DELETE" }),

  plantillas: () => pedir<PlantillaTema[]>("/admin/apariencia/plantillas"),

  derivar: (principal: string, encabezadoDeColor: boolean) =>
    pedir<Record<Esquema, ColoresTema>>("/admin/apariencia/derivar", {
      method: "POST",
      body: JSON.stringify({ principal, encabezadoDeColor }),
    }),

  corregirContraste: (colores: ColoresTema) =>
    pedir<ColoresTema>("/admin/apariencia/corregir", {
      method: "POST",
      body: JSON.stringify({ colores }),
    }),

  marcaDeFormulario: (slug: string) => pedir<Marca>(`/admin/marca/formulario/${slug}`),

  aparienciaDeFormulario: (
    id: string,
    datos: { coloresClaro?: ColoresTema | null; coloresOscuro?: ColoresTema | null },
  ) =>
    pedir<{ id: string }>(`/admin/formularios/${id}/apariencia`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  convenios: () =>
    pedir<
      Array<{ id: string; slug: string; nombre: string; sigla: string | null; activo: boolean }>
    >("/admin/convenios"),

  acciones: () => pedir<AccionAdmin[]>("/admin/acciones"),

  publicarAccion: (id: string, visible: boolean) =>
    pedir<{ id: string; visible: boolean }>(`/admin/acciones/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ visible }),
    }),
};

/** URL de un logo. El id la hace única. */
export function urlLogo(logo: Pick<Logo, "id" | "version">): string {
  return `/api/marca/logos/${logo.id}?v=${logo.version}`;
}

// cronograma

export type EstadoGrupo = "SIN_FECHAS" | "POR_EMPEZAR" | "EN_CURSO" | "TERMINADO";

export type GrupoCronograma = {
  id: string;
  numero: number;
  modalidad: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  horario: string | null;
  sepGrupoId: number | null;
  sede: string | null;
  estado: EstadoGrupo;
  cupos: number;
  inscritos: number;
  ubicaciones: Array<{
    id: string;
    nombre: string;
    tipo: string;
    cupos: number;
    /// El tope duro de esa sede, sobrecupo incluido.
    tope: number;
    inscritos: number;
  }>;
};

export type AccionCronograma = {
  id: string;
  codigo: string;
  nombre: string;
  horas: number;
  visible: boolean;
  convenio: string;
  grupos: GrupoCronograma[];
  cupos: number;
  inscritos: number;
  sinFechas: number;
};

export const ETIQUETA_ESTADO_GRUPO: Record<EstadoGrupo, string> = {
  SIN_FECHAS: "Sin fechas",
  POR_EMPEZAR: "Por empezar",
  EN_CURSO: "En curso",
  TERMINADO: "Terminado",
};

export const cronogramaApi = {
  listar: () => pedir<AccionCronograma[]>("/admin/cronograma"),

  actualizarGrupo: (
    id: string,
    datos: {
      fechaInicio?: string | null;
      fechaFin?: string | null;
      horario?: string;
      sepGrupoId?: number | null;
    },
  ) =>
    pedir<{ actualizado: boolean }>(`/admin/cronograma/grupos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  /// Los cupos de un grupo EN UNA SEDE.
  ///
  /// El tope de la oferta se recalcula solo como la suma de las suyas,
  /// y vuelve en la respuesta para poder ensenarlo sin recargar.
  actualizarCupos: (
    coberturaId: string,
    datos: { cuposBase?: number; cuposMaximos?: number },
  ) =>
    pedir<{
      coberturaId: string;
      cuposBase: number;
      cuposMaximos: number;
      topeDeLaOferta: number;
    }>(`/admin/cronograma/coberturas/${coberturaId}/cupos`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),
};
