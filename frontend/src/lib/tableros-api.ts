import { ErrorApi } from "./api";
import { pedir } from "./pedir";
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
  /** Personas inscritas en adelante: el cupo usado de verdad. */
  inscritos: number;
  avanceInscritos: number;
  avanceInscritosMeta: number;
  enEspera: number;
  reservas: number;
  canceladas: number;
  tasaCancelacion: number;
  cuposPorReserva: number;
  empresas: number;
  acciones: number;
  accionesPublicadas: number;
  ofertasSinReservas: number;
  /**
   * Lo de arriba, abierto por gremio.
   *
   * Para poder ver la suma COMO suma: con las dos filas al lado,
   * un gremio parado se explica solo. Va vacío si el ámbito no
   * tiene ninguno, y con una sola fila cuando la dirección fija
   * el gremio —ahí no hay nada que sumar—.
   */
  porGremio: Array<{
    slug: string;
    sigla: string;
    meta: number;
    tope: number;
    reservado: number;
    inscritos: number;
  }>;
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
  tamano: {
    filas: Array<{ nombre: string; empresas: number; cupos: number }>;
    /// La cifra que los proyectos comprometen: micro + pequena
    /// + mediana, ya sumada.
    mipymes: { empresas: number; cupos: number };
    /// Con que criterio se clasifico cada organizacion. Se
    /// ensena: los proyectos comprometen un numero de mipymes y
    /// una cifra mezclada sin decirlo no sirve para decidir.
    criterio: { DECRETO_957: number; EMPLEADOS: number; SIN_DATO: number };
  };
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

/// En que punto va la ventana de inscripcion de un grupo.
export type EstadoVentana =
  | "SIN_FECHAS"
  | "ABIERTA"
  | "POR_AVISAR"
  | "AVISANDO"
  | "CERRADA";

/// COMO VA un grupo, no como esta repartido.
///
/// `inscritos` son participantes en etapa de las que ocupan
/// silla --INSCRITO, EN_FORMACION, CERTIFICADO--, que es la
/// misma definicion con la que el backend gobierna la
/// inscripcion. No son reservas: son personas dentro.
export type GrupoDeAccion = {
  numero: number;
  modalidad: Modalidad;
  sede: string | null;
  /// Los que ya estan dentro.
  inscritos: number;
  cuposMaximos: number;
  /// Lo que le queda por llenar al grupo.
  faltan: number;
  /// Leads del grupo que todavia se pueden trabajar: ni estan
  /// inscritos ni estan perdidos. Con estos se llena `faltan`.
  porDepurar: number;
  fechaInicio: string | null;
  /// Cinco habiles antes del arranque.
  cierre: string | null;
  /// Habiles que quedan para inscribir. Negativo si ya cerro.
  diasHabilesRestantes: number | null;
  estadoVentana: EstadoVentana;
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
  grupos: GrupoDeAccion[];
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

/* ── Reservas unificadas: una fila por organización ──────────────
   Espejo de `backend/src/tableros/reservas-agrupadas.ts`. Si se
   cambia uno, se cambia el otro. */

/**
 * Una columna AF de la tabla unificada.
 *
 * La llave es `accionFormacionId` y no el código: «AF1» se repite
 * entre gremios y no significa lo mismo. `ambiguo` avisa de cuándo
 * hay dos con el mismo código a la vista y la cabecera tiene que
 * decir de cuál habla.
 */
export type ColumnaAccion = {
  accionFormacionId: string;
  codigo: string;
  nombre: string;
  convenio: string;
  convenioSigla: string | null;
  modalidad: Modalidad;
  ambiguo: boolean;
};

/** Una reserva suelta, dentro de la celda de su acción. */
export type ReservaEnCelda = {
  reservaId: string;
  estado: EstadoReserva;
  cuposSolicitados: number;
  cuposConfirmados: number;
  cuposEnEspera: number;
  /** Cuántos de sus cupos ya tienen persona. MISMO CRITERIO que
      «Control de Reservas»: quien alguna vez llegó a inscrito. Lo
      calcula el servidor; una segunda cuenta aquí sería la que se
      queda vieja. Cancelada = 0. */
  conNombre: number;
  /** `max(0, cuposConfirmados − conNombre)`, acotado en la reserva. */
  sinNombre: number;
  creadoEn: string;
  canceladaEn: string | null;
  ubicacion: string;
  modalidad: Modalidad;
  contactoNombre: string;
  contactoCorreo: string;
  contactoCelular: string | null;
  contactoCargo: string | null;
  formulario: { slug: string; titulo: string } | null;
};

/**
 * Lo que una organización tiene en UNA acción de formación.
 *
 * Lleva una LISTA: la misma acción puede dictarse en dos sedes y la
 * empresa apartar en las dos, y entonces son dos reservas en la
 * misma columna. Quedarse con una dejaba la otra contando en los
 * totales de la fila sin verse en ninguna celda.
 */
export type CeldaReserva = {
  reservas: ReservaEnCelda[];
  /// Cuando las suyas no coinciden, manda la que más sitio tiene.
  estado: EstadoReserva;
  /// Si sus reservas no están todas en el mismo estado.
  mixta: boolean;
  cuposSolicitados: number;
  cuposConfirmados: number;
  cuposEnEspera: number;
  conNombre: number;
  sinNombre: number;
  primera: string;
  ultima: string;
};

export type ContactoConsolidado = {
  nombre: string;
  correo: string;
  celular: string | null;
  cargo: string | null;
  /// En qué acciones aparece: el contacto es por reserva, así que
  /// una empresa con cuatro AF puede traer cuatro personas.
  codigos: string[];
};

export type FilaAgrupada = {
  empresaId: string;
  nit: string;
  digitoVerificacion: string | null;
  razonSocial: string;
  numeroColaboradores: number | null;
  redAsociada: string | null;
  redAsociadaOtra: string | null;
  primeraReserva: string;
  ultimaReserva: string;
  contactos: ContactoConsolidado[];
  formularios: Array<{ slug: string; titulo: string; codigos: string[] }>;
  totalReservas: number;
  reservasVivas: number;
  reservasCanceladas: number;
  cuposConfirmados: number;
  cuposEnEspera: number;
  cuposSolicitados: number;
  /** «Cupos ocupados» y «Pendientes» de la pantalla. */
  conNombre: number;
  sinNombre: number;
  porAccion: Record<string, CeldaReserva>;
};

export type ReservasAgrupadas = {
  total: number;
  truncado: boolean;
  acciones: ColumnaAccion[];
  filas: FilaAgrupada[];
};

/* ═══════════════════════════════════════════════════════════════
   INFORME DE RESERVAS  (Control › Informes › Reservas)

   GET /admin/tableros/informe-reservas — espejo de
   backend/src/tableros/informe-de-reservas.ts. Si se cambia uno,
   se cambia el otro.

   UNA sola petición, a propósito: con una por tabla, cada cambio de
   filtro disparaba esperas distintas y durante un segundo se veía
   media pantalla con las cifras nuevas y media con las viejas, con
   el pie afirmando que las dos mitades son lo mismo.

   Todo sale de las mismas filas en el servidor, así que la suma de
   `porAccion`, la de `cruce`, la de `porOrganizacion` y `totales`
   dan lo mismo en reservas, cupos, espera, conNombre, sinNombre y
   nombresDeMas (lo fija el-informe-de-reservas-cuadra.spec.ts). Si
   en pantalla no cuadran, el defecto está en la pantalla.
   ═══════════════════════════════════════════════════════════════ */

export type FiltrosInformeReservas = {
  /**
   * El gremio, por id. Es el que trae el enlace «Ver reservas» del
   * bloque de cupos de Control: sin él se hacía clic en los 149 cupos
   * de ADECOPRIA y el informe abría con los 539 de los dos gremios.
   * El servidor lo interseca con el ámbito de la sesión: uno ajeno
   * devuelve un informe vacío con `recorte.convenios` vacío.
   */
  convenioId?: string;
  /** El mismo corte por slug. Si llegan los dos, manda convenioId. */
  convenio?: string;
  /** Una acción de otro gremio del ámbito da cero; una que no es de
      ningún gremio suyo, 404. */
  accionFormacionId?: string;
  /** Dónde se dicta (Oferta.ubicacionId), no dónde vive nadie. */
  ubicacionId?: string;
  /**
   * El departamento donde se dicta, por su NOMBRE.
   *
   * Un escalón por encima de `ubicacionId`: la ciudad de Medellín y
   * el departamento de Antioquia son dos ubicaciones distintas, y
   * este filtro las junta. Va por nombre porque el departamento de
   * una ubicación es un texto, no una tabla con ids.
   */
  departamento?: string;
  /** Una sola institución, por su id de empresa. */
  empresaId?: string;
  /**
   * Días de calendario de BOGOTÁ, «YYYY-MM-DD», los dos inclusive.
   * Texto y no instante ISO: convertirlo a instante en el navegador
   * es volver a meter la zona por la puerta de atrás. Una fecha mal
   * escrita, o desde > hasta, es un 400 y no un informe sin recorte.
   */
  desde?: string;
  hasta?: string;
  /** Por omisión false. Las canceladas se cuentan aparte SIEMPRE. */
  incluirCanceladas?: boolean;
};

/** Lo que se reparte igual en las tres tablas. */
export type CifrasInformeReservas = {
  reservas: number;
  cuposConfirmados: number;
  cuposEnEspera: number;
  /** Cupos con una persona matriculada detrás: quien alguna vez llegó
      a INSCRITO, el mismo criterio del bloque «Cupos apartados». */
  conNombre: number;
  /**
   * Los de esos que siguen DENTRO hoy: inscrito, en formación o
   * certificado, la misma lista que cuenta la ocupación.
   *
   * `conNombre` incluye a quien se retiró o desertó, y es la que
   * alimenta la brecha de nombres y el informe que se le reporta al
   * SENA; esta las descuenta. Las dos son ciertas, así que NUNCA se
   * llaman igual en la misma pantalla.
   */
  dentro: number;
  /**
   * Cupos confirmados sin persona, acotado a cero RESERVA POR RESERVA
   * y luego sumado. Por eso se puede sumar en cualquier sentido: dos
   * personas de más en un curso no llenan las sillas de otro.
   *
   * OJO: con sobrantes, `sinNombre` es MAYOR que
   * `cuposConfirmados − conNombre`. El bloque de Control resta a
   * secas; la diferencia es exactamente `nombresDeMas`.
   */
  sinNombre: number;
  /** Personas matriculadas por encima de los cupos de su reserva.
      sinNombre = cuposConfirmados − conNombre + nombresDeMas. */
  nombresDeMas: number;
};

/** Una fila de la Tabla 1 del PDF: RESUMEN POR ACCIÓN DE FORMACIÓN.
    Trae TODAS las acciones del recorte, también las que no tienen
    reservas (reservas = 0), para que el techo cuadre con el total. */
export type FilaInformeAccion = CifrasInformeReservas & {
  /** La llave. El código solo es único por convenio: con los dos
      gremios hay dos «AF1» distintos. */
  accionFormacionId: string;
  codigo: string;
  nombre: string;
  convenio: string;
  convenioSigla: string | null;
  modalidad: Modalidad;
  horas: number | null;
  /** Cuántas organizaciones distintas la reservaron. */
  organizaciones: number;
  /** Techo de inscripción: suma de Oferta.cuposMaximos. */
  cuposDelProyecto: number;
  /** Lo comprometido ante el SENA, sin el 30 % de sobrecupo. */
  metaComprometida: number;
  /** Aparte y siempre, aunque `incluirCanceladas` sea false. */
  reservasCanceladas: number;
  /** Los cupos SOLICITADOS de las canceladas. */
  cuposCancelados: number;
};

/** Una fila de la Tabla 2 del PDF: el resumen abierto por organización.
    Viene agrupada por acción en el orden de la Tabla 1. */
export type FilaInformeCruce = CifrasInformeReservas & {
  accionFormacionId: string;
  codigo: string;
  accion: string;
  empresaId: string;
  /** Solo dígitos. */
  nit: string;
  digitoVerificacion: string | null;
  razonSocial: string;
  /** Puede ser mayor que 1: la misma acción en dos ubicaciones. */
  reservas: number;
  ubicaciones: string[];
  /** Días de Bogotá «YYYY-MM-DD». */
  primeraReserva: string;
  ultimaReserva: string;
  /** En qué punto del plazo del 30 de septiembre va esta fila. Lo
      calcula el servidor: la regla vive en `plazo-de-reservas.ts` y
      una segunda copia aquí sería la que se queda vieja. */
  estadoPlazo: "COMPLETA" | "EN_PLAZO" | "POR_VENCER" | "VENCIDA";
};

/** El mismo cruce visto por organización, la que más nombres debe
    arriba. */
export type FilaInformeOrganizacion = CifrasInformeReservas & {
  empresaId: string;
  nit: string;
  razonSocial: string;
  /** Códigos ordenados. Si reservó dos «AF1» de gremios distintos,
      llevan el gremio pegado: «AF1 · ADECOPRIA». */
  acciones: string[];
};

export type InformeReservas = {
  /** Instante ISO. Va al pie del papel: un PDF sin fecha no sirve de
      soporte. */
  generadoEn: string;
  /** Hasta cuándo tienen las instituciones para entregar los nombres
      de sus cupos, a cuántos días del corte se avisa, y qué día de
      Bogotá era cuando se calculó. Viaja aquí para que la pantalla y
      el papel digan la misma fecha. */
  plazo: { entregaNombres: string; diasDeAviso: number; hoy: string };
  /** El recorte con el que se calculó, resuelto a nombres, para el
      encabezado de impresión. */
  recorte: {
    /** Los que de verdad entraron: ámbito ∩ filtro. Vacío = ninguno. */
    convenios: Array<{ id: string; slug: string; sigla: string | null; nombre: string }>;
    accion: { id: string; codigo: string; nombre: string } | null;
    ubicacion: { id: string; nombre: string } | null;
    /// Por nombre: el departamento de una ubicación es un texto, no
    /// una tabla de la que colgar un id.
    departamento: string | null;
    institucion: { id: string; nit: string; razonSocial: string } | null;
    desde: string | null;
    hasta: string | null;
    incluyeCanceladas: boolean;
  };
  totales: CifrasInformeReservas & {
    cuposSolicitados: number;
    reservasCanceladas: number;
    cuposCancelados: number;
    /** Acciones CON reservas (no las filas de porAccion). */
    acciones: number;
    organizaciones: number;
    /** Filas del cruce: los pares acción-organización. Se cuenta
        antes del tope, así que con `truncado` es mayor que
        cruce.length. */
    pares: number;
    /** De TODAS las acciones del recorte, tengan o no reservas. Sin
        fechas: el techo y la meta no son hechos fechados. */
    cuposDelProyecto: number;
    metaComprometida: number;
  };
  porAccion: FilaInformeAccion[];
  cruce: FilaInformeCruce[];
  porOrganizacion: FilaInformeOrganizacion[];
  porUbicacion: Array<{
    ubicacionId: string;
    nombre: string;
    tipo: "CIUDAD" | "DEPARTAMENTO";
    reservas: number;
    cuposConfirmados: number;
  }>;
  /** El mismo reparto, un escalón más arriba: por departamento. La
      ciudad de Medellín y el departamento de Antioquia son dos filas
      en `porUbicacion` y una sola aquí. */
  porDepartamento: Array<{
    departamento: string;
    reservas: number;
    organizaciones: number;
    cuposConfirmados: number;
    conNombre: number;
    sinNombre: number;
  }>;
  /** Siempre los tres estados, en este orden: CONFIRMADA,
      LISTA_ESPERA, CANCELADA. Con los tres el donut suma el total de
      verdad. */
  porEstado: Array<{
    estado: EstadoReserva;
    reservas: number;
    cuposConfirmados: number;
    cuposEnEspera: number;
  }>;
  /** Solo los días con algo, ascendente. Los huecos los rellena la
      pantalla. Recortada por el MISMO filtro que las tablas. */
  porDia: PuntoSerie[];
  /** true si el cruce se cortó en el tope (1.000 pares). Los totales
      NO se cortan: son siempre los de verdad. */
  truncado: boolean;
};

export type PuntoSerie = { dia: string; reservas: number; cupos: number };

export type EstadoProyeccion =
  | "CUMPLIDA"
  | "SIN_META"
  | "SIN_RITMO"
  | "RETROCEDE"
  | "MUY_LEJOS"
  | "ESTIMADA";

/// El veredicto contra el cronograma.
///
/// OJO con SIN_CRONOGRAMA: no es un error, es que nadie cargo
/// la fecha de inicio del grupo --el esquema las deja
/// opcionales, «los proyectos no traen fechas»--.
export type VeredictoCronograma =
  | "SIN_CRONOGRAMA"
  | "CERRADA"
  | "ALCANZA"
  | "NO_ALCANZA";

export type Proyeccion = {
  estado: EstadoProyeccion;
  confianza: "BAJA" | "NORMAL";
  origen: "MOVIMIENTOS" | "APROXIMADO";
  ocupados: number;
  meta: number;
  faltan: number;
  ritmoDiario: number;
  /// NULL cuando la ventana pedida es mas corta que el ritmo:
  /// un numero seria uno falso.
  ritmo7: number | null;
  ritmo14: number | null;
  diasEstimados: number | null;
  fechaEstimada: string | null;

  // el plazo del cronograma, que es el que manda

  /// El ultimo dia en que se puede inscribir: cinco habiles
  /// antes de que arranque el grupo.
  cierre: string | null;
  /// Dias de calendario hasta el cierre. Negativo si ya paso.
  diasAlCierre: number | null;
  /// Cuantos cupos faltarian el dia del cierre, al ritmo de hoy.
  faltaranAlCierre: number | null;
  cronograma: VeredictoCronograma;
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
  /// Con el objetivo forman «Información Acción de Formación», el
  /// apartado editable del Catálogo (cliente, 13 sep 2026).
  contenido: string | null;
  competencia: string | null;
  ambiente: string | null;
  /// Las dos líneas que ve quien se preinscribe.
  resumenPublico: string | null;
  visible: boolean;
  convenio: { slug: string; sigla: string | null; nombre: string };
  cupos: number;
  /// PERSONAS inscritas. No las sillas apartadas.
  ocupados: number;
  /// Apartadas por empresas, sin nombre todavia.
  reservados: number;
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

  /// El informe entero en una respuesta. `incluirCanceladas` viaja
  /// como texto y solo cuando es true: `consulta()` descarta lo vacío,
  /// y un «false» explícito no aporta nada porque es la omisión.
  informeReservas: (filtros: FiltrosInformeReservas = {}) => {
    const { incluirCanceladas, ...resto } = filtros;
    return pedir<InformeReservas>(
      `/admin/tableros/informe-reservas${consulta({
        ...resto,
        incluirCanceladas: incluirCanceladas ? "true" : undefined,
      })}`,
    );
  },

  /// Cancelar, no borrar: borrar se llevaba el historial de cupos y,
  /// si era la ultima reserva de la empresa, la empresa entera.
  cancelarReserva: (id: string) =>
    pedir<{
      cancelada: boolean;
      yaEstaba: boolean;
      cuposDevueltos: number;
      organizacion: string;
    }>(`/admin/tableros/reservas/${id}/cancelar`, { method: "POST" }),

  /// Las mismas reservas, con una fila por organización y la acción
  /// de formación como columna. No pagina: el agrupado tiene que
  /// partir de todas las del recorte o una empresa se rompe en dos.
  reservasAgrupadas: (filtros: Record<string, string | undefined> = {}) =>
    pedir<ReservasAgrupadas>(`/admin/tableros/reservas-agrupadas${consulta(filtros)}`),

  /**
   * Cambia el estado de una reserva a mano.
   *
   * `estado` es el que se PIDE. El que queda lo deciden los cupos:
   * confirmar sobre una oferta llena devuelve LISTA_ESPERA con
   * `recortado: true`, y la pantalla tiene que decirlo.
   */
  cambiarEstadoReserva: (id: string, estado: EstadoReserva) =>
    pedir<{
      estado: EstadoReserva;
      yaEstaba: boolean;
      cuposConfirmados: number;
      cuposEnEspera: number;
      recortado: boolean;
      organizacion: string;
      codigo: string;
    }>(`/admin/tableros/reservas/${id}/estado`, {
      method: "POST",
      body: JSON.stringify({ estado }),
    }),
};

/** Descarga por navegación. */
export function descargar(
  informe: "reservas" | "ocupacion" | "empresas",
  filtros: Record<string, string | number | undefined> = {},
) {
  window.location.href = `/api/admin/tableros/exportar/${informe}${consulta(filtros)}`;
}
