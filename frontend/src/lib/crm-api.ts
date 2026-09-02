import { ErrorApi } from "./api";
import { pedir } from "./pedir";

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
  | "EMPRESA" | "ASESOR" | "AUTOGESTION" | "REFERIDO" | "REDES"
  | "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "WHATSAPP" | "CORREO"
  | "EVENTO" | "OTRO";

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
/**
 * Las cinco del embudo de LEADS. Ni una más.
 *
 * Espejo de `ETAPAS_DEL_EMBUDO` del backend, que es la lista que
 * usa el filtro `tramo: "INSCRIPCION"` de esta misma pantalla.
 * Tienen que ser la misma o el embudo cuenta una cosa y la tabla
 * de debajo otra.
 *
 * Lo que va DESPUÉS de matricular —En formación, Certificado,
 * Retirado, No aprobó, Desertó, Abandonó— es de Gestión
 * Académica y no pinta nada aquí: son el seguimiento del grupo,
 * no el trabajo del asesor.
 */
export const ETAPAS_DEL_EMBUDO: Etapa[] = [
  "INTERESADO",
  "CONTACTADO",
  "DATOS_COMPLETOS",
  "INSCRITO",
  "PERDIDO",
];

export const ETAPAS_DE_INSCRIPCION: Etapa[] = [
  "INTERESADO",
  "CONTACTADO",
  "DATOS_COMPLETOS",
];

/**
 * Las únicas que se pueden elegir a mano.
 *
 * «Datos completos» no está: dejó de ser etapa para ser
 * estado calculado. Un estado que alguien puede poner a
 * dedo no prueba nada, y es justo lo que hace que la cifra
 * sirva. El backend lo rechaza aunque se mande.
 */
export const ETAPAS_A_MANO: Etapa[] = [
  "INTERESADO",
  "CONTACTADO",
  "INSCRITO",
  "PERDIDO",
];

/** Por dónde se contactó. Varios a la vez. */
export type CanalContacto = "CORREO" | "WHATSAPP" | "TEXTO" | "LLAMADA";

export const CANALES: CanalContacto[] = [
  "CORREO",
  "WHATSAPP",
  "TEXTO",
  "LLAMADA",
];

/// Nombre distinto a ETIQUETA_CANAL a propósito: ese es el
/// de la autorización de datos, y son dos cosas distintas.
export const ETIQUETA_CANAL_CONTACTO: Record<CanalContacto, string> = {
  CORREO: "Correo",
  WHATSAPP: "WhatsApp",
  TEXTO: "Texto",
  LLAMADA: "Llamada",
};

/** Cómo salió la gestión. */
export type ResultadoGestion = "CONTACTO" | "SIN_RESPUESTA" | "DATO_MALO";

export const RESULTADOS: ResultadoGestion[] = [
  "CONTACTO",
  "SIN_RESPUESTA",
  "DATO_MALO",
];

/// Cada uno lleva a una acción distinta, y por eso son tres y
/// no dos: "no contestó" se arregla volviendo a llamar y
/// "el número no sirve" se arregla pidiéndoselo a la empresa.
export const ETIQUETA_RESULTADO: Record<ResultadoGestion, string> = {
  CONTACTO: "Hablé con ella",
  SIN_RESPUESTA: "No contestó",
  DATO_MALO: "El dato no sirve",
};

export const TONO_RESULTADO: Record<ResultadoGestion, string> = {
  CONTACTO: "text-exito",
  SIN_RESPUESTA: "text-texto-suave",
  DATO_MALO: "text-error",
};

/** Lo que mandó el interesado y espera decisión. */
export type PropuestaDelInteresado = {
  id: string;
  creadoEn: string;
  campos: Array<{
    campo: string;
    etiqueta: string;
    actual: string | null;
    propuesto: string | null;
  }>;
};

/** En qué va la consulta al RUI de una ficha. */
export type EstadoRui =
  | "SIN_CONSULTA"
  | "PENDIENTE"
  | "EN_CURSO"
  | "LISTA"
  | "SIN_RESULTADO"
  | "FALLIDA";

export type ConsultaRui = {
  estado: EstadoRui;
  nombreEncontrado: string | null;
  nombreTecleado: string | null;
  nombreCoincide: boolean | null;
  resueltaEn: string | null;
  porDelante: number | null;
  /// El detector es el de mentira: no consultó el RUI.
  simulado: boolean;
  /// La cédula es inventada: no se consulta a propósito.
  esDePrueba: boolean;
  /// Por qué salió del simulador. Lo dice el servidor, que es
  /// quien conoce la regla.
  motivoSimulado: string | null;
};

export const ETIQUETA_RUI: Record<EstadoRui, string> = {
  SIN_CONSULTA: "Sin consultar",
  PENDIENTE: "En cola",
  EN_CURSO: "Consultando…",
  LISTA: "Validado por RUI",
  SIN_RESULTADO: "No aparece en el RUI",
  FALLIDA: "No se pudo consultar",
};

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
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  WHATSAPP: "WhatsApp",
  CORREO: "Correo",
  EVENTO: "Feria o evento",
  OTRO: "Otro",
};

export type FilaParticipante = {
  id: string;
  etapa: Etapa;
  origen: Origen;
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
  /** Cuándo se habló con ella. Nulo = nunca se ha logrado. */
  ultimoContacto: string | null;
  /** Intentos que no llegaron a nadie. */
  sinRespuesta: number;

  /// Lo que la tabla de leads pide por separado.
  tipoDocumento: string;
  numeroDocumento: string;
  /** Donde vive, no donde se dicta. */
  departamento: string | null;
  municipio: string | null;
  /** Solo el código: en una columna no cabe el nombre. */
  accionCodigo: string | null;
  gremio: string;
  /** De dónde llegó, en los tres que le sirven al asesor. */
  origenLead: "ORGANICO" | "PAUTA" | "IMPORTACION";
  ultimaActividad: string;
  /** De qué etapa viene. */
  etapaAnterior: Etapa | null;
  /** Cuántas veces se le movió la etapa. */
  cambios: number;
  datosEmpresa: "SIN" | "PARCIAL" | "COMPLETA";
  antiguedadDias: number;
};

export const ETIQUETA_ORIGEN_LEAD: Record<
  FilaParticipante["origenLead"],
  string
> = {
  ORGANICO: "Orgánico",
  PAUTA: "Pauta",
  IMPORTACION: "Importación",
};

export const ETIQUETA_DATOS_EMPRESA: Record<
  FilaParticipante["datosEmpresa"],
  string
> = {
  SIN: "Sin información",
  PARCIAL: "Información parcial",
  COMPLETA: "Información completa",
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
  /// Por donde vive la persona, no por donde se dicta.
  departamentos: Array<{ id: number | null; nombre: string; total: number }>;
};

export type Ficha = {
  id: string;
  etapa: Etapa;
  origen: Origen;
  creadoEn: string;
  faltantes: { bloquean: string[]; avisan: string[]; reporte: string[] };
  /// Lo que el enlace le va a pedir, en ese orden: primero lo
  /// de su organización y después lo suyo.
  faltaDeLaEmpresa: string[];
  faltaDeLaPersona: string[];
  /// En qué anda el último enlace que se le mandó.
  enlace: {
    estado: "SIN_ABRIR" | "ABIERTO" | "COMPLETADO" | "ANULADO" | "CADUCADO";
    creadoEn: string;
    expiraEn: string;
    abiertoEn: string | null;
    usadoEn: string | null;
    emitidoPor: string | null;
  } | null;
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
    /// Lo pregunta el formulario largo y no se veía en la
    /// ficha: el asesor no podía corroborarlo.
    nivelEducativo: string | null;
    participaciones: Array<{
      id: string;
      etapa: Etapa;
      convenio: { sigla: string | null };
      accionFormacion: { codigo: string; nombre: string } | null;
    }>;
    /// Vienen las vivas Y las revocadas, en orden.
    ///
    /// Solo llegaban las vivas, asi que tras revocar la ficha
    /// decia «todavia no ha autorizado» y ofrecia registrarla
    /// otra vez: la pantalla borraba de la vista un derecho que
    /// la persona acababa de ejercer.
    /// Sus marcas de caracterizacion, SOLO las amparadas por
    /// una autorizacion viva: una revocada no se enseña como si
    /// contara.
    caracterizaciones: Array<{ caracterizacionSepId: number }>;
    caracterizacionRechazada: boolean;
    /// Cuando se le pregunto. Null: nunca. Es lo que distingue
    /// «no se recogio» de «se recogio y no marco nada».
    caracterizacionPreguntada: string | null;
    autorizaciones: Array<{
      id: string;
      canal: Canal;
      otorgadaEn: string;
      revocadaEn: string | null;
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
  /// Su organización: los trece campos que pide el formulario
  /// largo. El backend los mandaba a medias y el tipo ni la
  /// declaraba, así que la ficha no podía enseñarlos.
  empresa: {
    id: string;
    nit: string;
    digitoVerificacion: string | null;
    razonSocial: string;
    direccion: string | null;
    telefono: string | null;
    departamentoSepId: number | null;
    municipioSepId: number | null;
    sectorEconomico: string | null;
    numeroTrabajadores: number | null;
    contactoNombre: string | null;
    contactoCargo: string | null;
    contactoCorreo: string | null;
  } | null;
  /// Su cédula es su RUT: no tiene empresa, es él mismo.
  trabajaPorSuCuenta: boolean;
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
  notas: Array<{
    id: string;
    autorNombre: string;
    texto: string;
    canales?: CanalContacto[];
    /// Nulo en las de antes y en las que escribe el sistema.
    resultado?: ResultadoGestion | null;
    creadoEn: string;
  }>;
  /** Cuántas veces se le intentó y si alguna se logró. */
  gestion: {
    intentos: number;
    /** Desde el último contacto, no desde siempre. */
    sinContacto: number;
    datoMalo: number;
    ultimoContacto: string | null;
  };
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

export type Rango =
  | "HOY"
  | "AYER"
  | "SEMANA"
  | "MES"
  | "MES_PASADO"
  | "TRIMESTRE"
  | "ANO"
  | "TODO"
  | "PERSONALIZADO";

export const ETIQUETA_RANGO: Record<Rango, string> = {
  HOY: "Hoy",
  AYER: "Ayer",
  SEMANA: "Últimos 7 días",
  MES: "Últimos 30 días",
  MES_PASADO: "El mes pasado",
  TRIMESTRE: "Últimos 90 días",
  ANO: "Últimos 12 meses",
  TODO: "Desde el principio",
  PERSONALIZADO: "Entre dos fechas",
};

/**
 * La ventana que aplicó el backend. Corta por la fecha en
 * que la persona quedó inscrita, que es la única fecha de
 * proceso que hay: hay que decirlo en pantalla.
 */
export type Ventana = {
  rango: string;
  etiqueta: string;
  /** Con qué se compara. Null si no hay con qué. */
  etiquetaAnterior: string | null;
  /** ISO yyyy-mm-dd, o null cuando no hay corte. */
  desde: string | null;
  hasta: string | null;
};

/** Fracción: 0.25 es un 25 % más. Null si antes no había. */
export type Variaciones = Record<string, number | null>;

/** Una fila de la tabla del Comité de Marketing. */
export type FilaDePlaneacion = {
  departamento: string;
  totalCupos: number;
  reservados: number;
  inscritos: number;
  leadsOrganicos: number;
  leadsImportados: number;
};

export type PlaneacionDePauta = {
  filas: FilaDePlaneacion[];
  totales: Omit<FilaDePlaneacion, "departamento">;
};

export type Corte = { etiqueta: string; total: number };

/** Un tramo de espera y cuántos llevan ahí. */
export type Tramo = {
  /** El piso del tramo en días: 0, 3, 8 o 15. */
  dias: number;
  total: number;
};

/** Cuánto convierte un origen, no cuánto trae. */
export type CorteOrigen = {
  etiqueta: string;
  /** Todos los que entraron por ahí. */
  leads: number;
  /** Los que de esos llegaron a inscrito. */
  inscritos: number;
  conversion: number;
};

/** Una organización, sus inscritos y sus cupos. */
export type CorteEmpresa = {
  nit: string;
  razonSocial: string;
  inscritos: number;
  cupos: number;
};

/** Cuánto convirtió un asesor de lo que lleva. */
export type CorteAsesor = Corte & {
  asesorId: string | null;
  /** Todas sus fichas del ámbito, sin ventana. */
  asignados: number;
  /** Los suyos inscritos, sin periodo. */
  inscritosSiempre: number;
  /** Sin periodo: inscritos/asignados. */
  conversion: number;
};

/** Las cifras de cabecera, que son las que se comparan. */
export type CabeceraControl = {
  /** Llegó a inscrito, no etapa de hoy. */
  total: number;
  /** Días medios de lead a inscrito. */
  diasHastaInscribir: number | null;
};

/** Lo que pinta el panel de Control de inscritos. */
export type Control = CabeceraControl & {
  /** Sale de reservas, así que nunca lleva ventana. */
  cuposConfirmados: number;
  /** Los beneficiarios comprometidos en los proyectos, sin sobrecupo. */
  metaComprometida: number;
  /** Inscritos con cupo reservado. */
  inscritosConReserva: number;
  /** Los que llegaron por su cuenta. */
  inscritosPorSuCuenta: number;
  /** Solo las cinco etapas de Inscripciones. */
  embudo: Array<{ etapa: Etapa; total: number }>;
  /** La primera cola del líder: leads sin dueño. */
  sinAsignar: number;
  /** Cuánto lleva esperando quien sigue en INTERESADO. */
  sinContactar: Tramo[];
  porAccion: Corte[];
  porUbicacion: Array<Corte & { tipo: string }>;
  /// `clave` es el id del grupo: dos gremios tienen AF1, y
  /// la numeración de grupos vuelve a empezar en cada uno.
  porGrupo: Array<Corte & { clave: string; inicio: string | null }>;
  porConvenio: Corte[];
  porAsesor: CorteAsesor[];
  /** El volumen que trae cada origen. */
  porOrigen: Corte[];
  /** Lo que convierte, que no es lo que trae. */
  conversionPorOrigen: CorteOrigen[];
  porModalidad: Corte[];
  /** Las diez con más inscritos, contra sus cupos. */
  topEmpresas: CorteEmpresa[];
  /** El día ya viene yyyy-mm-dd de Bogotá. */
  serie: Array<{ dia: string; total: number }>;
  /** Cuándo llegaron los leads, no cuándo se inscribieron. */
  leadsPorDia: Array<{ dia: string; total: number }>;
  ventana: Ventana;
  anterior: CabeceraControl | null;
  variacion: Variaciones;
};

/** Lo que se cuenta de un corte del aula. */
export type MetricasAula = {
  /** Todo el que pisó el aula, salidas incluidas. */
  enAula: number;
  /** Los que siguen dentro. */
  dentro: number;
  certificados: number;
  /** En formación que ya llegaron al mínimo. */
  listos: number;
  desertaron: number;
  abandonaron: number;
  retirados: number;
  noAprobaron: number;
  /** De 0 a 1, sobre los medibles. */
  avanceMedio: number;
  /** A cuántos se les puede medir. */
  medibles: number;
  /** Sin actividades: no se miden. */
  sinMedir: number;
  /** Obligatorias de la acción; null si son varias. */
  actividades: number | null;
};

export type FilaAccionAula = MetricasAula & { codigo: string; nombre: string };

export type FilaGrupoAula = FilaAccionAula & {
  /** null en la fila de quien no tiene grupo. */
  numero: number | null;
  inicio: string | null;
  fin: string | null;
};

export type FilaAsesorAula = MetricasAula & {
  asesorId: string | null;
  nombre: string;
};

/** Las cifras de cabecera del aula. */
export type CabeceraAcademica = {
  total: number;
  dentro: number;
  certificados: number;
  listos: number;
  salidas: number;
  /** Sobre los medibles, no sobre todo. */
  avanceMedio: number;
  /** A cuántos se les puede medir. */
  medibles: number;
  /** Sin actividades: no se miden. */
  sinMedir: number;
  /** certificados / total del aula */
  terminacion: number;
  /** las cuatro salidas / total del aula */
  desercion: number;
};

/** Un grupo que arranca pronto: la agenda. */
export type GrupoQueArranca = {
  codigo: string;
  numero: number;
  inicio: string;
  inscritos: number;
  /** Cuántos días faltan para que empiece. */
  dias: number;
};

/** Un grupo pasado de fecha con gente aún dentro. */
export type GrupoVencido = {
  codigo: string;
  numero: number;
  fin: string;
  enAula: number;
  certificados: number;
  /** Los que siguen EN_FORMACION con el grupo vencido. */
  sinCerrar: number;
};

/** Cuántos parados hay en cada tramo de días. */
export type TramoParados = {
  /** El primer día del tramo; -1 es «nunca entró». */
  dias: number;
  total: number;
};

/** El aula por acción, grupo y asesor. No por persona. */
export type TableroAcademico = CabeceraAcademica & {
  minimoParaCertificar: number;
  porAccion: FilaAccionAula[];
  porGrupo: FilaGrupoAula[];
  porAsesor: FilaAsesorAula[];
  /** Lo que empieza en 30 días. No es la cohorte. */
  gruposQueArrancan: GrupoQueArranca[];
  /** Terminaron en el papel y siguen con gente dentro. */
  gruposVencidos: GrupoVencido[];
  /** La cola de rescate del gestor académico. */
  paradosPorDias: TramoParados[];
  ventana: Ventana;
  anterior: CabeceraAcademica | null;
  variacion: Variaciones;
};

export type CatalogosSep = {
  documentosPersona: TipoDocumentoSep[];
  documentosEmpresa: TipoDocumentoSep[];
  generos: Array<{ id: number; etiqueta: string }>;
  /// Los 54 valores de caracterizacion de poblacion.
  caracterizaciones: Array<{ id: number; etiqueta: string }>;
  /// El id de «Ninguna», para poder avisar de lo que significa.
  caracterizacionNinguna: number;
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
  /**
   * Si la ficha esta entera o a medias. No es una columna:
   * el backend lo traduce a los diez datos que pide el reporte.
   */
  estado?: "COMPLETO" | "PARCIAL";
  /** Por donde vive la persona, no por donde se dicta. */
  departamentoSepId?: number;
  buscar?: string;
  pagina?: number;
  /** Cuántas filas por carga; el servidor lo topa. */
  limite?: number;
};

/**
 * Lo que se manda para pedir una ventana de tiempo.
 *
 * Con `contra` se comparan DOS periodos elegidos, que pueden
 * durar distinto; sin él, el backend compara contra el
 * inmediatamente previo y de la misma duración.
 */
export type FiltroVentana = {
  rango?: Rango;
  desde?: string;
  hasta?: string;
  /** El segundo periodo, el de la comparación. */
  contra?: Rango;
  contraDesde?: string;
  contraHasta?: string;
};

function consulta(filtros: Filtros | FiltroVentana): string {
  const p = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== "") {
      p.set(clave, String(valor));
    }
  }
  const s = p.toString();
  return s ? `?${s}` : "";
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

/// Una accion de formacion, YA resuelta contra donde vive la
/// persona. Una fila por accion -- no una por accion x sede.
export type OpcionAccion = {
  accionFormacionId: string;
  codigo: string;
  nombre: string;
  etiqueta: string;
  /// La oferta que le toca a esta persona. Null si su
  /// departamento no tiene cobertura para esta accion.
  ofertaId: string | null;
  ubicacion: string | null;
  cupos: number;
  disponibles: number;
  abierta: boolean;
  cubre: boolean;
  /// En cuantas sedes se dicta en total.
  sedes: number;
};

export type OpcionGrupo = {
  id: string;
  accionFormacionId: string;
  /// Donde se dicta. Es lo que deja casarlo con la oferta.
  ubicacion: string;
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
  /// Lo que se elige en la ficha: una fila por accion.
  acciones: OpcionAccion[];
  /// La tabla cruda accion x sede. Se conserva porque la usan
  /// las reservas de empresa y los informes.
  ofertas: OpcionOferta[];
  /// SOLO los que cubren donde vive la persona, cuando se
  /// pide para un lead concreto.
  grupos: OpcionGrupo[];
  /// Cuantos se dejaron fuera por estar en otra parte. Una
  /// lista que se acorta sola sin decir por que parece rota.
  gruposFueraDeCobertura?: number;
  domicilio?: { departamento: string | null; ciudad: string | null };
  /// Quien puede llevar leads en este convenio.
  asesores: Asesor[];
};

/** Un reparto: una etiqueta y su cifra. */
export type Reparto = { etiqueta: string; valor: number };

/** Los repartos del tablero de Inscripciones. */
export type MetricasInscripciones = {
  total: number;
  /// Las cuatro del embudo, en el orden del proceso.
  porEtapa: Reparto[];
  porEstado: Reparto[];
  /// Cuántos leads trae cada gremio. Para la gráfica.
  porGremioTotal: Reparto[];
  /// Un bloque por gremio: son dos convenios con acciones
  /// propias, y mezclarlas no compara nada. Lleva el id
  /// porque es lo que entiende el filtro.
  porGremio: Array<{
    convenioId: string;
    gremio: string;
    acciones: Reparto[];
    conversion: { inscritos: number; base: number; porcentaje: number };
  }>;
  /// Cuántos leads entran por día desde que entró el primero.
  promedioPorDia: { valor: number; dias: number };
  porDepartamento: Reparto[];
  /// Los que no tienen domicilio. Fuera del reparto a propósito.
  sinDepartamento: number;
  porAsesor: Reparto[];
  conversion: { inscritos: number; base: number; porcentaje: number };
};

/// Una fila del «Historial Logs»: qué decía antes un dato.
export type ValorAnterior = {
  id: string;
  campo: string;
  etiqueta: string;
  clase: string;
  valorAnterior: string | null;
  habiaValor: boolean;
  actorNombre: string;
  creadoEn: string;
  restauradoEn: string | null;
  restauradoPor: { nombre: string } | null;
  /// Por qué no hay valor, en palabras. Un hueco a secas se
  /// lee como un error.
  porQueSinValor: string | null;
  sePuedeRestablecer: boolean;
};

export const crmApi = {
  /// Los tres del jefe directo, desde la ficha del lead.
  /// La razón social NO va aquí: la valida el código.
  guardarContactoEmpresa: (
    id: string,
    datos: {
      contactoNombre?: string;
      contactoCargo?: string;
      contactoCorreo?: string;
    },
  ) =>
    pedir<unknown>(`/admin/participantes/${id}/empresa-contacto`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  historico: (id: string) =>
    pedir<ValorAnterior[]>(`/admin/participantes/${id}/historico`),

  restablecer: (id: string, valorId: string) =>
    pedir<{ restablecido: boolean; campo: string }>(
      `/admin/participantes/${id}/historico/${valorId}/restablecer`,
      { method: "POST" },
    ),

  borrarParticipacion: (id: string) =>
    pedir<{
      borrado: boolean;
      nombre: string;
      documento: string;
      avancesBorrados: number;
      notasBorradas: number;
    }>(`/admin/participantes/${id}`, { method: "DELETE" }),

  control: (ventana: FiltroVentana = {}) =>
    pedir<Control>(`/admin/participantes/control${consulta(ventana)}`),

  tableroAcademico: (ventana: FiltroVentana = {}) =>
    pedir<TableroAcademico>(`/admin/participantes/academico/tablero${consulta(ventana)}`),

  /// Con , los grupos vienen recortados a los
  /// que cubren donde vive esa persona.
  opciones: (convenioId: string, participanteId?: string) =>
    pedir<Opciones>(
      `/admin/participantes/opciones?convenioId=${convenioId}` +
        (participanteId ? `&participanteId=${participanteId}` : ""),
    ),

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

  metricas: (filtros: Filtros = {}) =>
    pedir<MetricasInscripciones>(`/admin/participantes/metricas${consulta(filtros)}`),

  planeacionDePauta: (accionFormacionId?: string, coberturaId?: string) =>
    pedir<PlaneacionDePauta>(
      `/admin/participantes/control/planeacion-de-pauta${
        accionFormacionId
          ? `?accionFormacionId=${accionFormacionId}${coberturaId ? `&coberturaId=${coberturaId}` : ""}`
          : ""
      }`,
    ),

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

  agregarNota: (
    id: string,
    texto: string,
    canales: CanalContacto[],
    resultado: ResultadoGestion,
  ) =>
    pedir<Record<string, unknown>>(`/admin/participantes/${id}/notas`, {
      method: "POST",
      body: JSON.stringify({ texto, canales, resultado }),
    }),

  /** Lo que mandó el interesado, si hay algo pendiente. */
  propuesta: (id: string) =>
    pedir<PropuestaDelInteresado | null>(`/admin/participantes/${id}/propuesta`),

  /** Qué campos del interesado se aceptan. */
  resolverPropuesta: (id: string, aceptados: string[]) =>
    pedir<Record<string, unknown>>(`/admin/participantes/${id}/propuesta`, {
      method: "POST",
      body: JSON.stringify({ aceptados }),
    }),

  /** En qué va la consulta al RUI de esta ficha. */
  estadoRui: (id: string) =>
    pedir<ConsultaRui>(`/admin/participantes/${id}/rui`),

  /** Vuelve a preguntarle al RUI. */
  reconsultarRui: (id: string) =>
    pedir<ConsultaRui>(`/admin/participantes/${id}/rui`, { method: "POST" }),

  /** Se queda con el nombre que devolvió el RUI. */
  tomarNombreDelRui: (id: string) =>
    pedir<Ficha>(`/admin/participantes/${id}/rui/tomar-nombre`, { method: "POST" }),

  /**
   * Revoca la autorización de tratamiento de datos.
   *
   * El motivo y el canal son obligatorios: lo que hay que poder
   * demostrar no es que se revocó, es cuándo y por dónde lo
   * pidió la persona.
   */
  revocarAutorizacion: (id: string, canal: Canal, motivo: string) =>
    pedir<Ficha>(`/admin/participantes/${id}/revocar-autorizacion`, {
      method: "POST",
      body: JSON.stringify({ canal, motivo }),
    }),

  /** Un enlace nuevo. El anterior deja de valer. */
  emitirEnlace: (id: string) =>
    pedir<{ token: string; expiraEn: string }>(
      `/admin/participantes/${id}/enlace`,
      { method: "POST" },
    ),
};

/** Días desde una fecha. Lo accionable no es cuándo entró. */
export function diasDesde(fecha: string): number {
  const ms = Date.now() - new Date(fecha).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Una importacion del historico. */
export type CargaDelHistorico = {
  id: string;
  creadoEn: string;
  autor: string;
  origen: "ARCHIVO" | "PEGADO";
  nombreArchivo: string | null;
  filas: number;
  creados: number;
  yaExistian: number;
  duplicados: number;
  descartados: number;
  fallidos: number;
  convenio: string;
  destino: string | null;
};

export const historicoDeCargas = (convenioId?: string) =>
  pedir<CargaDelHistorico[]>(
    `/admin/participantes/carga/historico${convenioId ? `?convenioId=${convenioId}` : ""}`,
  );
