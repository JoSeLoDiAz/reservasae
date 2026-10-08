import { pedir } from "./pedir";

/** Lo que devuelve el embudo del formulario publico. */
export type EmbudoPublico = {
  etiqueta: string;
  /// El rotulo del segundo periodo, cuando se comparan dos.
  etiquetaAnterior: string | null;
  /// Solo el embudo y de donde venian: comparar es responder
  /// «mejoro o empeoro», no mirar un periodo por dentro.
  comparado: {
    hitos: Array<{ paso: string; visitas: number }>;
    procedencia: CorteDeVisitas[];
  } | null;
  /// Desde cuando hay contador. Antes de esto no es que no
  /// hubiera gente: es que no se contaba.
  contandoDesde: string | null;
  hitos: Array<{ paso: string; visitas: number }>;
  /// Las llegadas que hizo alguien. Fuera de `hitos` porque NO es
  /// un peldano de la escalera: meterlo alli lo pondria en el
  /// embudo, y esto no es un paso que la persona da.
  personas: number;
  /// Dia a dia desde que arranco el contador: el comparativo.
  ///
  /// Una serie por tarjeta, cada una con la regla de su cifra, y
  /// la suma de los dias da el total de arriba: `personas` son las
  /// mismas llegadas que `personas`, y `eligieron` el mismo peldaño
  /// `ELIGIO_ACCION` de `hitos`. Antes solo venian las aperturas y
  /// las preinscripciones, y dos chispas dibujaban la serie de otra
  /// cifra.
  porDia: Array<{
    dia: string;
    llegaron: number;
    personas: number;
    eligieron: number;
    preinscritos: number;
  }>;
  caidaMayor: { de: string; a: string; sePerdieron: number } | null;
  /// Fichas del registro que terminaron.
  despues: { recibieron: number; terminaron: number };
  /// De donde venian. Ver `backend/src/embudo/procedencia.ts`.
  /// NO se llama «canal»: esa palabra ya la usa /admin/control
  /// para otra cosa sobre las mismas personas.
  procedencia: CorteDeVisitas[];
  dispositivo: CorteDeVisitas[];
  /// Por que direccion de NUESTRO sitio entraron.
  entrada: CorteDeVisitas[];
  campana: CorteDeVisitas[];
  /// Que curso eligio cada visita, con el catalogo entero detras
  /// --las que nadie eligio salen en CERO, que es la mitad
  /// accionable--. NO son «paginas visitadas»: el sitio publico
  /// no tiene una pagina por accion.
  ///
  /// Opcional, como `cuposConNombre`: un backend sin reiniciar no
  /// lo manda, y entonces el bloque no se pinta en vez de decir
  /// que nadie eligio nada.
  porAccion?: Array<{
    codigo: string;
    nombre: string;
    /// Ya no se ofrece, pero alguien la eligio cuando si: su
    /// cuenta no se tira, se marca.
    oculta: boolean;
    visitas: number;
  }>;
  /// Lo de antes del contador, o null si no se importo nada.
  historico: HistoricoDeTrafico | null;
  /// Personas de HOY por un enlace sin marcar, sea cual sea el
  /// periodo elegido. Opcional: la respuesta vacia no lo trae.
  sinMarcarHoy?: {
    personas: number;
    umbral: number;
    /// Los sitios desde donde llegaron, cuando hay referente.
    desde: Array<{ sitio: string; personas: number }>;
  };
};

/// `Corte` ya existe en este archivo y significa otra cosa.
/// El trafico de ANTES del contador, sacado del registro del
/// servidor. Va aparte y NO se suma a nada de arriba: alli las
/// cifras son medidas y estas son reconstruidas.
export type HistoricoDeTrafico = {
  desde: string;
  hasta: string;
  visitas: number;
  envios: number;
  porDia: Array<{ dia: string; llegaron: number; preinscritos: number }>;
  /// SIN `tocaron`, y no es un olvido: esto sale del registro
  /// del servidor, que guarda peticiones y no peldanos. Alli no
  /// hay forma de saber quien toco el formulario, y un campo que
  /// hubiera que inventar seria la segunda verdad de siempre.
  procedencia: FilaDelHistorico[];
};

/// Una fila del historico. Es `CorteDeVisitas` menos lo que el
/// registro no puede saber.
export type FilaDelHistorico = Omit<CorteDeVisitas, "tocaron">;

export type CorteDeVisitas = {
  valor: string | null;
  /// Aperturas. Incluye maquinas: el escaner de enlaces de un
  /// proveedor de correo abre cada enlace del envio.
  visitas: number;
  /// Las que hizo alguien: seguia ahi pasados unos segundos, o
  /// toco el formulario.
  personas: number;
  /// Las que pasaron del primer peldano que exige un gesto.
  /// Es un SUELO de las personas, no una cuenta: quien abre,
  /// mira y se va escribe lo mismo que un escaner.
  tocaron: number;
  envios: number;
};

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
  | "EMPRESA"
  | "ASESOR"
  | "AUTOGESTION"
  | "REFERIDO"
  | "REDES"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "LINKEDIN"
  | "WHATSAPP"
  | "CORREO"
  | "EVENTO"
  | "OTRO";

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
/**
 * Y «EN FORMACIÓN» SÍ ESTÁ, que faltaba.
 *
 * El servidor la admite ---`ETAPAS_A_MANO` de `crm.service.ts`--- y
 * dice para qué: «el ingreso tardío y la matrícula adelantada, que el
 * calendario no cubre». Normalmente se pasa sola cuando arranca el
 * grupo, pero esos dos casos existen y no tenían forma de registrarse.
 *
 * Esta lista es una COPIA A MANO de la del servidor, y le faltaba una.
 * El síntoma no era un error en pantalla: era que una cosa que el
 * sistema permite no se podía hacer, y nadie sabía por qué.
 *
 * Hay una prueba que compara las dos listas, por lo mismo que la de
 * los permisos: dos copias sin nada que las sujete acaban discrepando.
 */
export const ETAPAS_A_MANO: Etapa[] = [
  "INTERESADO",
  "CONTACTADO",
  "INSCRITO",
  "EN_FORMACION",
  "PERDIDO",
];

/** Por dónde se contactó. Varios a la vez. */
export type CanalContacto = "CORREO" | "WHATSAPP" | "TEXTO" | "LLAMADA";

/**
 * LOS QUE SE OFRECEN AL ANOTAR UNA GESTIÓN.
 *
 * «TEXTO» NO ESTÁ, Y SE OCULTA, NO SE BORRA (cliente, 30 sep 2026:
 * «quita esta opción por el momento u ocúltala, y que quede no texto
 * sino mensaje de texto, pero quedará oculto»).
 *
 * El CRM no manda SMS y no tiene con qué; ese botón solo registraba
 * que el asesor escribió desde su propio teléfono, y al lado de
 * «Correo» ---que el sistema sí manda--- se leía como un envío.
 *
 * NO SE QUITA DEL TIPO NI DE LA BASE, y ahí está la diferencia entre
 * ocultar y borrar: las notas que YA tienen «TEXTO» anotado siguen
 * existiendo, y al leerlas hay que saber cómo se llama ese canal. Por
 * eso `ETIQUETA_CANAL_CONTACTO` lo conserva con su nombre nuevo,
 * «Mensaje de texto». Lo único que desaparece es la posibilidad de
 * anotarlo de aquí en adelante.
 *
 * Para devolverlo: se añade "TEXTO" a esta lista y ya está.
 */
export const CANALES: CanalContacto[] = ["CORREO", "WHATSAPP", "LLAMADA"];

/// Nombre distinto a ETIQUETA_CANAL a propósito: ese es el
/// de la autorización de datos, y son dos cosas distintas.
export const ETIQUETA_CANAL_CONTACTO: Record<CanalContacto, string> = {
  CORREO: "Correo",
  WHATSAPP: "WhatsApp",
  /// «Mensaje de texto» y no «Texto» a secas: al lado de «Correo»
  /// ---que el CRM sí manda--- «Texto» se leía como un SMS que el
  /// sistema enviaba. No envía ninguno: esto es el registro de lo que
  /// hizo el asesor desde su propio teléfono.
  TEXTO: "Mensaje de texto",
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
/// «Con la persona» y no «con ella»: en el CRM hay hombres y
/// mujeres, y el femenino estaba escrito a fuego para todo el
/// mundo --se veía en la ficha de un señor--. Lo pidió Josse el
/// 24 sep 2026. No es adivinar el género: es no nombrarlo, que
/// es lo único que acierta siempre.
export const ETIQUETA_RESULTADO: Record<ResultadoGestion, string> = {
  CONTACTO: "Hablé con la persona",
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
  /// Por que no se pudo, en una frase. Solo si FALLIDA.
  motivoFallo: string | null;
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
  CORREO: "Correo electrónico",
  EVENTO: "Feria o evento",
  OTRO: "Otro",
};

export type FilaParticipante = {
  id: string;
  etapa: Etapa;
  origen: Origen;
  /** Si la ficha está entera o a medias: la persona Y su organización. */
  datos: "PARCIALES" | "COMPLETOS";
  /** Qué le falta de lo suyo: lo que el asesor le pide. */
  faltaDeLaPersona: string[];
  /**
   * Y qué le falta de su organización.
   *
   * VIAJA APARTE Y NO SUMADA: `datos` sale de las dos, pero el
   * panel tiene que poder decir QUÉ falta y DE QUIÉN. Llegó el 24
   * sep 2026; un backend sin reiniciar no la manda, y por eso se
   * lee siempre con `?? []`.
   */
  faltaDeLaEmpresa?: string[];
  /**
   * Si lo que falta le impide ENTRAR o solo le falta para que se la
   * pueda REPORTAR al SENA.
   *
   * Opcional porque un backend sin reiniciar no la manda; sin ella
   * la pantalla se comporta como antes.
   */
  paraQueFalta?: "INSCRIBIR" | "REPORTE";
  creadoEn: string;
  documento: string;
  nombre: string;
  correo: string | null;
  /// CUÁNDO NO SALIÓ EL ÚLTIMO CORREO a esa dirección, y por qué.
  /// Nulo = nunca ha fallado, o no se sabe. Llegó el 6 oct 2026;
  /// un backend sin reiniciar no los manda.
  correoFallaEn?: string | null;
  correoFalloMotivo?: string | null;
  celular: string | null;
  convenio: string;
  accion: string | null;
  ubicacion: string | null;
  asesor: { id: string; nombre: string } | null;
  notas: number;
  /** Cuándo se habló con la persona. Nulo = nunca se ha logrado. */
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
  /** El número de su grupo. Nulo mientras no se le asigne uno. */
  grupo: number | null;
  gremio: string;
  /** De dónde llegó, en los tres que le sirven al asesor. */
  origenLead: "ORGANICO" | "PAUTA" | "IMPORTACION";
  /** El envío con el que entró (`mailing18092026`). Nulo si su enlace no traía etiqueta. */
  campanaDeEntrada: string | null;
  ultimaActividad: string;
  /** De qué etapa viene. */
  etapaAnterior: Etapa | null;
  /** Cuántas veces se le movió la etapa. */
  cambios: number;
  datosEmpresa: "SIN" | "PARCIAL" | "COMPLETA";
  /**
   * De QUÉ organización es esta persona, no solo si está completa.
   *
   * El NIT viene con su dígito cuando lo tiene ---«890982209-4»---,
   * que es como se escribe y como se busca en Empresas registradas.
   *
   * Opcionales porque un backend viejo no los manda: la columna
   * enseña un guion y no rompe nada.
   */
  empresaNit?: string | null;
  /**
   * Por qué formulario entró, cuando se sabe.
   *
   * El título del formulario si vino por una reserva ---es el único
   * sitio donde se guarda--- y «Preinscripción pública» si se
   * inscribió sola. Nulo para el resto.
   *
   * Distinta de `fuenteFormulario`, que dice el CANAL: una persona
   * puede llegar por Instagram a la preinscripción pública.
   */
  formularioDeEntrada?: string | null;
  /// LA MARCA DEL ENLACE CORTO por el que entró. Otra cosa que el
  /// formulario: el mismo formulario se reparte por varios enlaces,
  /// y «cuántos trajo este enlace» es la pregunta que se hace al
  /// pagar pauta. Llegó el 6 oct 2026; un backend sin reiniciar no
  /// la manda, y por eso es opcional.
  enlaceDeEntrada?: string | null;
  empresaNombre?: string | null;
  antiguedadDias: number;

  /**
   * De qué importación salió la ficha, cuando salió de una.
   *
   * OPCIONAL A PROPÓSITO, con el mismo criterio que
   * `faltaDeLaEmpresa`: la arma `listar()` desde
   * `Participante.cargaId`, y un backend que todavía no la manda
   * tiene que dejar la columna diciendo «No importado», no romper
   * la tabla. Se lee siempre con `?? null`.
   *
   * Nula = no vino de un archivo: entró por el formulario público,
   * por una reserva de empresa o la escribió un asesor a mano.
   *
   * Los recuentos son DE LA CARGA, no de esta fila: son el mismo
   * resumen que se le enseñó a quien confirmó la importación, y son
   * lo único que contesta «cómo le fue» sin abrir el histórico.
   */
  carga?: {
    id: string;
    /** El archivo tal como se subió. Nulo si se pegó la tabla. */
    nombreArchivo: string | null;
    origen: "ARCHIVO" | "PEGADO";
    /** Cuándo se confirmó la importación. */
    creadoEn: string;
    /**
     * Quién la hizo, congelado en texto: el histórico tiene que
     * poder decirlo aunque la cuenta ya no exista.
     */
    autor: string;
    filas: number;
    creados: number;
    yaExistian: number;
    fallidos: number;
  } | null;
};

export const ETIQUETA_ORIGEN_LEAD: Record<
  FilaParticipante["origenLead"],
  string
> = {
  ORGANICO: "Orgánico",
  PAUTA: "Pauta",
  IMPORTACION: "Importación",
};

/**
 * Mailing, pauta u orgánico: la pregunta de «Fuente formulario».
 *
 * La pauta va PRIMERO porque es la única con prueba de pago. El
 * correo se saca de su canal, no de la tricotomía, porque allí
 * un mailing es «orgánico» --no se pagó-- y eso es justo lo que
 * esta columna existe para separar.
 */
export function fuenteDelFormulario(f: FilaParticipante): string {
  if (f.origenLead === "PAUTA") return "Pauta";
  if (f.origen === "CORREO") return "Mailing";
  /// «La empresa lo nominó»: por el enlace de su reserva, o
  /// porque la empresa mandó su nombre. Las dos son la reserva.
  if (f.origen === "EMPRESA") return "Reserva";
  if (f.origen === "WHATSAPP") return "WhatsApp";
  /// «Se inscribió solo» sin ninguna etiqueta NO es un dato de
  /// orgánico: es no saber. Llegó por un enlace sin marcar --un
  /// mailing, un anuncio sin parámetros-- o antes del 17 sep. Decir
  /// «Orgánico» ahí hacía creer que la pauta no traía a nadie.
  if (f.origen === "AUTOGESTION" && !f.campanaDeEntrada) return "Sin etiqueta";
  /// El QR no tiene palabra en la ficha: se sabe por su enlace.
  if (f.origen === "AUTOGESTION" && f.campanaDeEntrada?.startsWith("qr"))
    return "QR impreso";
  return ETIQUETA_ORIGEN_LEAD[f.origenLead];
}

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

/**
 * UNA CONVERSACIÓN DE LUCID QUE NO SE PEGÓ SOLA.
 *
 * «No está llegando las conversaciones de Lucid; dice que llega 200
 * pero no queda» (cliente, 5 oct 2026). Llegaban y se guardaban: lo
 * que faltaba era una pantalla que leyera esa tabla.
 */
export type ConversacionEnEspera = {
  id: string;
  /// `SIN_DUENO` = ese número no es de nadie del gremio.
  /// `AMBIGUA` = toca a más de una persona y el sistema no elige.
  estado: "SIN_DUENO" | "AMBIGUA";
  celular: string;
  resumen: string;
  cuando: string;
  /// Si la fecha es la que dio Lucid o la de cuando nos llegó. En
  /// pantalla cambia el rótulo: decir «ocurrió» de la hora en que
  /// nos llegó sería inventar un dato.
  cuandoEsDeLucid: boolean;
  convenioSigla: string | null;
  candidatos: Array<{
    tipo: "FICHA" | "LEAD";
    id: string;
    nombre: string | null;
    documento: string | null;
    etapa: string | null;
  }>;
};

export type Resumen = {
  etapas: Array<{ etapa: Etapa; total: number }>;
  total: number;
  /**
   * PARA EL FILTRO: los que YA tienen fichas.
   *
   * Salen de la base y no de la página. Filtrar por alguien con cero
   * filas no devuelve nada, así que aquí esa lista es la correcta.
   */
  asesores: Array<{ id: string; nombre: string; total: number }>;
  /**
   * PARA ASIGNAR: los que PUEDEN llevar fichas, tengan o no.
   *
   * Es otra pregunta y por eso es otra lista. Las dos salían de la
   * de arriba, y eso dejaba un círculo sin salida: para aparecer en
   * el desplegable de «Asignar a» había que tener ya un lead, y para
   * tener el primero había que aparecer en el desplegable. Una cuenta
   * recién creada no podía recibir ninguno.
   */
  /**
   * OPCIONAL, Y POR LA VENTANA DEL DESPLIEGUE.
   *
   * Iba obligatorio y se recorría sin guarda. Durante un despliegue
   * ---frontend nuevo contra backend viejo, o un backend
   * reiniciando--- llega `undefined`, y `undefined.map` deja Gestión
   * de leads EN BLANCO para quien reparte. Lo vio José el 2 oct
   * 2026; es el mismo caso que `porAsesor.pendientes`, que ya está
   * documentado como opcional justo por esto.
   *
   * Una lista vacía deja el desplegable sin nombres, que se arregla
   * recargando. Una pantalla en blanco no se entiende ni se
   * recupera.
   */
  asesoresAsignables?: Array<{ id: string; nombre: string }>;
  acciones: Array<{
    id: string;
    codigo: string;
    nombre: string;
    total: number;
  }>;
  /// Para el filtro de grupo. `accion` es el codigo de su acción
  /// de formación: «Grupo 1» existe en las quince y sin él no se
  /// distinguen.
  grupos: Array<{ id: string; numero: number; accion: string; total: number }>;
  /// Los gremios, para que su desplegable cuente la MISMA gente
  /// que el bloque. La cuenta salía de `/metricas`, que recorta
  /// por etapa, y ofrecía «ADECOPRIA · 98» para que el bloque
  /// contestara 103: la diferencia era la gente que ya pasó al
  /// aula. `nombre` es la sigla cuando la hay.
  convenios: Array<{ id: string; nombre: string; total: number }>;
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
  oferta: {
    id: string;
    cuposMaximos: number;
    ubicacion: { nombre: string };
  } | null;
  cobertura: {
    id: string;
    grupo: {
      numero: number;
      fechaInicio: string | null;
      fechaFin: string | null;
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
    /// La clasificación, con su NOMBRE y no solo el id: con el id la
    /// pantalla tendría que cargar el catálogo entero --incluido lo
    /// oculto-- solo para pintar una nota vieja.
    ///
    /// Nulas las dos en todas las notas de antes del catálogo, y en
    /// las que escribe el sistema. Se pinta lo que haya.
    categoria?: { id: string; nombre: string } | null;
    subcategoria?: { id: string; nombre: string } | null;
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
  /**
   * Si su oferta admite inscripciones, y si no, por qué.
   *
   * Llega en la ficha para poder decirlo ANTES de que lo
   * intente. El servidor lo comprueba igual al inscribir, pero
   * enterarse al guardar significa un recuadro rojo encima del
   * nombre de la persona por algo que no tiene que ver con ella.
   */
  inscripcion: {
    admite: boolean;
    porQueNo: string | null;
    /**
     * Dónde se arregla: en la oferta o ampliando cupos.
     *
     * Solo quedan dos, y es una decisión de José del 3 sep 2026
     * (081fcbc): el cronograma AVISA, NO BLOQUEA. `SIN_GRUPOS`,
     * `SIN_FECHAS` y `VENTANA_CERRADA` se quitaron —bloquear la
     * captura por unas fechas que pone el SENA cuando puede es
     * hacer el sistema más rígido que el proceso—. Si alguien
     * los devuelve aquí, que sea sabiendo que los quitó una
     * orden del cliente.
     */
    motivo: "OFERTA_CERRADA" | "LLENO" | "SIN_OFERTA" | null;
  };
};

export type EstadoAcademico =
  /// El aula no ha dicho NADA de esa acción todavía: ni una
  /// actividad publicada ni un acceso de nadie.
  | "SIN_DATOS_DEL_AULA"
  | "SIN_INGRESO"
  | "SIN_EMPEZAR"
  | "ATRASADO"
  | "AL_DIA"
  | "COMPLETADO"
  | "CERTIFICADO";

export const ETIQUETA_ACADEMICA: Record<EstadoAcademico, string> = {
  SIN_DATOS_DEL_AULA: "Sin datos del aula",
  SIN_INGRESO: "Sin ingreso",
  /// «SIN ACTIVIDADES» Y NO «SIN EMPEZAR» (cliente, 24 sep 2026).
  /// Es como él nombró el estado en su lista, y describe mejor lo que
  /// pasa: la persona puede haber entrado al aula y no haber hecho
  /// nada, que no es lo mismo que «no ha empezado el curso».
  SIN_EMPEZAR: "Sin actividades",
  ATRASADO: "Atrasado",
  AL_DIA: "Al día",
  COMPLETADO: "Listo para certificar",
  CERTIFICADO: "Certificado",
};

/// Qué significa cada uno, para no tener que adivinarlo.
export const AYUDA_ACADEMICA: Record<EstadoAcademico, string> = {
  /**
   * LO QUE FALTA SON LOS DATOS, NO LA GENTE.
   *
   * Sin esto, el día que un grupo arranca con el aula aún sin
   * cargar, todos sus inscritos salen «Sin ingreso» y en rojo:
   * señalados por algo que no han hecho. Pasa el 13 de octubre
   * con los cuatro primeros grupos de AF1 y sus 116 personas.
   *
   * Se apaga solo en cuanto llegue la primera actividad o el
   * primer acceso.
   */
  SIN_DATOS_DEL_AULA:
    "El aula todavía no ha reportado nada de esta acción: ni actividades ni ingresos. No es que no hayan entrado, es que aún no se sabe.",
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
  /// Por donde se le escribe. Columna de la tabla del aula.
  correo: string | null;
  /// Dónde quedó: el departamento de SU cobertura, no el de su
  /// cédula. Nulo si su grupo no tiene cobertura cargada.
  departamento: string | null;
  /// Cuántas veces lo ha tocado el asesor, y cuándo fue la última.
  /// Es lo único de esta tabla que no manda el aula.
  notas: number;
  ultimaNota: string | null;
  /// Desde que entró ---la fecha del lead si vino por uno, y si no
  /// la de su ficha--- hasta hoy. Lo calcula el SERVIDOR: con la
  /// hora del navegador, dos asesores verían números distintos para
  /// la misma fila.
  diasDeAntiguedad: number;
  /// Desde la última nota. Sin ninguna nota se cuenta desde que
  /// entró: a quien nunca se ha tocado es al que más falta le hace
  /// salir arriba en esa ordenación.
  diasSinGestion: number;
  /// Su avance ACTIVIDAD POR ACTIVIDAD, en el orden del curso: es lo
  /// que pivota a una columna por cada una --UT1, UT2… EVAL FINAL--.
  /// Vienen TODAS las del curso, hechas o no: la que no tiene avance
  /// es «no iniciada» y también ocupa su columna.
  actividades: Array<{
    orden: number;
    titulo: string;
    obligatoria: boolean;
    completada: boolean;
  }>;
};

export type Academico = {
  personas: FilaAcademica[];
  /** Solo lo que hay en el aula: filtrar por vacíos cansa. */
  acciones: Array<{ id: string; codigo: string; nombre: string }>;
  grupos: Array<{
    id: string;
    numero: number;
    accionFormacionId: string | null;
    /// Cuántos caben: la suma de sus coberturas VIRTUALES, que es la
    /// misma regla con la que se cuenta quién está dentro. OPCIONALES
    /// en el contrato --un backend sin reiniciar no las manda-- y por
    /// eso la tarjeta dice «40» a secas en vez de «40 de 0».
    cupos?: number;
    /// Lo comprometido con el SENA, sin el 30 % de sobrecupo.
    meta?: number;
  }>;
  asesores: Array<{ id: string; nombre: string }>;
  sinAsesor: number;
  resumen: {
    total: number;
    /** Sobre cuántas se calculó el reparto: puede ser menos. */
    analizadas: number;
    /** Los seis se cuentan solo sobre quien sigue dentro. */
    enFormacion: number;
    /// Los que esperan a que el aula reporte algo. Opcional: un
  /// backend sin reiniciar no lo manda, y entonces la tarjeta sale
  /// en cero en vez de romper la pantalla.
  sinDatosDelAula?: number;
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
  /// NO «entre dos fechas»: sonaba a comparación --«si escojo
  /// esas dos fechas, esa es la comparativa, ¿no?» (cliente, 20
  /// sep 2026)-- y son el principio y el fin de UN periodo.
  PERSONALIZADO: "Un rango de fechas",
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
  /**
   * Los bordes exactos (ISO con hora), `hasta` fuera. Para que
   * otra consulta corte por la MISMA ventana sin recalcularla.
   */
  instantes?: {
    actual: { desde: string; hasta: string } | null;
    anterior: { desde: string; hasta: string } | null;
  };
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
  /** A los que ya se les habló: pasaron de INTERESADO. */
  contactados?: number;
  /** Los que siguen esperando la primera llamada. */
  pendientes?: number;
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
  /** Lo que le queda por trabajar: la cola, no lo cerrado. */
  pendientes?: number;
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
  /// Los cupos con y sin nombre, por cupo y reserva por reserva: la
  /// cuenta del informe «Reservas» (control.ts, `cuentaDeNombres`).
  /// Opcionales: un servidor sin reiniciar no los manda.
  cuposConNombre?: number;
  cuposSinNombre?: number;
  nombresDeMas?: number;
  empresaQueMasDebe?: {
    razonSocial: string;
    sinNombre: number;
    cupos: number;
  } | null;
  /// Las siglas de los gremios que entraron en los cupos.
  gremios?: string[];
  /** El día ya viene yyyy-mm-dd de Bogotá. */
  serie: Array<{ dia: string; total: number }>;
  /** La misma, abierta por origen: la acumulada por canal. */
  seriePorOrigen?: Array<{ etiqueta: string; dia: string; total: number }>;
  /** Cuándo llegaron los leads, no cuándo se inscribieron. */
  leadsPorDia: Array<{ dia: string; total: number }>;
  /**
   * El embudo DÍA POR DÍA: de los que entraron cada día, en qué
   * paso van hoy. Acumulado, como el del periodo.
   */
  embudoPorDia: Array<{
    dia: string;
    entraron: number;
    contactados: number;
    conDatos: number;
    inscritos: number;
  }>;
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

export type GrupoDeCaracterizacion = {
  clave: string;
  etiqueta: string;
  ids: readonly number[];
};

export type CatalogosSep = {
  documentosPersona: TipoDocumentoSep[];
  documentosEmpresa: TipoDocumentoSep[];
  generos: Array<{ id: number; etiqueta: string }>;
  /// Los 54 valores de caracterizacion de poblacion.
  caracterizaciones: Array<{ id: number; etiqueta: string }>;
  /// El id de «Ninguna», para poder avisar de lo que significa.
  caracterizacionNinguna: number;
  /// Los grupos en que se enseñan, SOLO de pantalla: no se
  /// mandan al SENA ni se guardan. Los decide el backend para
  /// que el panel y el formulario de completar ficha enseñen lo
  /// mismo.
  gruposCaracterizacion: GrupoDeCaracterizacion[];
  nivelesOcupacionales: Array<{ id: number; etiqueta: string }>;
  tamanosEmpresa: Array<{ id: number; etiqueta: string }>;
  departamentos: Array<{ id: number; etiqueta: string }>;
  /** [id, departamentoId, nombre] */
  municipios: Array<[number, number, string]>;
  /// Los TRES del Decreto 957, no las 21 del CIIU: el tamaño
  /// del SEP ya viene cruzado con el sector, y con la lista
  /// larga los dos datos no cuadrarían.
  sectoresEconomicos: Array<{ id: number; etiqueta: string }>;
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
  /**
   * Solo lo que queda por trabajar: las tres primeras etapas.
   *
   * Se cruza con `tramo`, que incluye los dos desenlaces
   * —inscrito y perdido—. Es la condición con la que `control`
   * cuenta su cola, y hace falta para que un enlace que sale de
   * esa cifra lleve exactamente a esa gente.
   */
  cola?: "POR_TRABAJAR";
  /** Cuándo llegó el lead: instantes ISO, `llegoHasta` fuera. */
  llegoDesde?: string;
  llegoHasta?: string;
  /**
   * POR DÓNDE ENTRÓ: el enlace corto y el formulario personalizado.
   *
   * «Si o sí el sistema debe decirme de qué link de formulario entró»
   * (cliente, 5 oct 2026). Son dos y no uno: el mismo formulario se
   * reparte por varios enlaces ---uno por campaña, uno por gremio---
   * así que «cuántos trajo este enlace» no se contesta con el
   * formulario.
   *
   * `SIN_DATO` pide las que no lo tienen: las de antes del 5 oct, a
   * las que no se les inventó de dónde vinieron.
   */
  enlaceDeEntrada?: string;
  formularioDeEntrada?: string;
  /**
   * A QUIÉN NO SE LE PUEDE ESCRIBIR.
   *
   * `FALLA` son las direcciones a las que no se pudo la última
   * vez que se intentó; `SIN_CORREO`, las que no dejaron ninguna.
   * Son la misma pregunta por dos caminos.
   */
  correo?: "FALLA" | "SIN_CORREO";
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
  | "FORMULARIO_WEB"
  | "CARGA_EMPRESA"
  | "VERBAL_ASESOR"
  | "CORREO"
  | "PRESENCIAL";

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
  /// El TOPE, con el 30 % de sobrecupo ya dentro. Es la columna con
  /// la que mide el candado del servidor.
  cupos: number;
  /// Lo comprometido en el proyecto, sin sobrecupo.
  comprometidos: number;
  /// Los que consumen aula.
  ocupados: number;
  /// Los que tienen esta cohorte escrita y no han salido. Son DOS
  /// preguntas distintas y hacen falta las dos.
  apuntados: number;
  /// Cuantos QUEDAN. Es lo que hay que ver al asignar.
  caben: number;
  fechaInicio: string | null;
  fechaFin: string | null;
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

/// Una celda de grupo: grupo x sede x modalidad. Es lo que de
/// verdad se llena, y lo que lleva su propio cupo.
export type CeldaDeGrupo = {
  coberturaId: string;
  numero: number;
  fechaInicio: string | null;
  horario: string | null;
  /// El tope, con el 30 % de sobrecupo ya dentro.
  tope: number;
  comprometidos: number;
  /// Los que tienen esta celda escrita y no han salido.
  apuntados: number;
  /// Los que ademas consumen aula. Son DOS preguntas distintas.
  sillasOcupadas: number;
  caben: number;
};

export type OfertaSinGrupo = {
  ofertaId: string;
  convenioId: string;
  accion: string;
  sede: string;
  tipoDeSede: string;
  modalidad: string;
  sinGrupo: number;
  celdas: CeldaDeGrupo[];
};

export type CandidatoDeGrupo = {
  id: string;
  etapa: Etapa;
  creadoEn: string;
  persona: {
    primerNombre: string;
    primerApellido: string;
    numeroDocumento: string;
    correo: string | null;
    celular: string | null;
  };
  asesor: { nombre: string } | null;
};

export type CandidatosDeGrupo = {
  ofertaId: string;
  accion: string;
  sede: string;
  modalidad: string;
  total: number;
  candidatos: CandidatoDeGrupo[];
};

export type FilaDeAccion = {
  accionFormacionId: string;
  codigo: string;
  nombre: string;
  meta: number;
  cuposReservados: number;
  campanaDigital: number;
  inscritosReservas: number;
  inscritosCampana: number;
  totalLeads: number;
  totalInscritos: number;
  /// Nulo cuando no hay leads de los que convertir: la pantalla pinta
  /// una raya en vez del «#DIV/0!» de su hoja.
  conversion: number | null;
  cuposDisponibles: number;
  estado: "ABIERTO" | "CERRADO";
};

/**
 * Las siete cifras macro del Resumen General, una fila por acción de
 * formación. Qué significa cada una y por qué no suman todas igual
 * está en `backend/src/crm/resumen-general.ts`.
 */
export type FilaResumenGeneral = {
  accionFormacionId: string;
  codigo: string;
  nombre: string;
  /// La sigla del gremio: los dos numeran sus acciones desde AF1.
  gremio: string;
  leads: number;
  datosCompletos: number;
  datosParciales: number;
  enProceso: number;
  sinGestion: number;
  inscritos: number;
  noInteresados: number;
};

/** Una fila por grupo de una acción: el Bloque 3 de Control de inscritos. */
export type FilaDeGrupo = {
  grupoId: string;
  numero: number;
  modalidad: string;
  sedes: string;
  /// UNO, y no la lista: el servidor manda una fila por grupo y
  /// departamento desde el 24 sep 2026.
  departamento: string;
  meta: number;
  /// En los grupos NO son cupos reservados sino personas ya nominadas
  /// por la empresa: una reserva se hace sobre la oferta, no sobre un
  /// grupo. Lo explica `backend/src/crm/resumen-por-grupo.ts`.
  nominadosPorEmpresa: number;
  campanaDigital: number;
  totalLeads: number;
  inscritosReservas: number;
  inscritosCampana: number;
  totalInscritos: number;
  conversion: number | null;
  cuposDisponibles: number;
  estado: "ABIERTO" | "CERRADO";
};

/** El ritmo de un asesor contra su fecha. Lo calcula el servidor:
    la regla vive en `seguimiento-de-asesores.ts` con sus pruebas. */
export type RitmoDeAsesor = {
  pendientes: number;
  diasHabiles: number | null;
  exigidoPorDia: number | null;
  realPorDia: number | null;
  estado:
    "AL_DIA" | "AJUSTADO" | "EN_RIESGO" | "VENCIDO" | "SIN_PLAZO" | "TERMINADO";
};

/**
 * LO QUE UN ASESOR LLEVA EN UNA ACCIÓN DE FORMACIÓN.
 *
 * Por ACCIÓN y no por grupo, y el porqué está en el backend
 * (`asesores-datos.ts`): lo que aprieta a un asesor es la fecha de
 * cierre, y esa es de la acción. Por grupo salen filas de uno o dos
 * leads y ninguna responde «dónde se le está acumulando».
 */
export type CargaEnUnaAccion = {
  accionFormacionId: string | null;
  codigo: string | null;
  /// Hace falta para distinguir: hay dos acciones con código «AF1».
  nombre: string | null;
  total: number;
  gestionados: number;
  resueltos: number;
  /// Los dos lados de «resuelto», por separado: quien entró y quien
  /// se cayó. Sumados dan `resueltos`.
  inscritos: number;
  descartados: number;
  pendientes: number;
};

/** Una ficha de alguien que está repetido. */
export type FichaRepetida = {
  id: string;
  codigo: string | null;
  accion: string | null;
  etapa: string;
  asesor: string | null;
  empresa: string | null;
  creadoEn: string;
  notas: number;
  avances: number;
};

export type PersonaRepetida = {
  personaId: string;
  nombre: string;
  documento: string;
  correo: string | null;
  fichas: FichaRepetida[];
};

export type FilaDeAsesor = {
  asesorId: string | null;
  nombre: string;
  carga: { total: number; resueltos: number; gestionados: number };
  inscritos?: number;
  descartados?: number;
  ritmo: RitmoDeAsesor;
  antiguedadMedia: number | null;
  /**
   * A CUÁNTAS FICHAS TOCÓ DENTRO DEL PERIODO.
   *
   * «No me está mostrando lo gestionado el viernes y lo gestionado
   * hoy» (cliente, 5 oct 2026). `carga.gestionados` no lo podía
   * decir: cuenta, de los leads que LLEGARON en el periodo, a
   * cuántos se ha tocado alguna vez, y eso no cambia de un día a
   * otro si los leads llegaron en agosto.
   *
   * Nulo = sin periodo puesto. Opcional porque un backend sin
   * reiniciar no lo manda.
   */
  gestionadosEnElPeriodo?: number | null;
  /**
   * A CUÁNTA GENTE INSCRIBIÓ DENTRO DEL PERIODO.
   *
   * «Debo saber cuánto hizo cada asesora ayer, antier, hoy»
   * (cliente, 7 oct 2026). La columna `inscritos` no lo contesta:
   * cuenta, de los leads que LLEGARON en el periodo, cuántos están
   * inscritos hoy.
   *
   * Nulo sin periodo puesto. Opcional porque un backend sin
   * reiniciar no lo manda.
   */
  inscritosEnElPeriodo?: number | null;
  limite: string | null;
  /// SU CARGA REPARTIDA POR ACCIÓN, que es el desglose que se abre al
  /// pulsar la fila: «con al menos dos métricas, y como la tablita
  /// que cuando uno da clic sale el desglose detallado» (cliente, 23
  /// sep 2026).
  ///
  /// El servidor lleva mandándolo desde entonces y el frontend ni lo
  /// declaraba, así que viajaba y se tiraba. Va OPCIONAL: un backend
  /// sin reiniciar no lo trae, y entonces el cajón lo dice en vez de
  /// pintar una tabla vacía.
  ///
  /// Con esto el filtro por acción no necesita al servidor: cada fila
  /// ya sabe lo suyo en cada acción.
  porAccion?: CargaEnUnaAccion[];
};

/**
 * El periodo, tal como viaja al servidor.
 *
 * Instantes ISO ya resueltos en hora de Bogotá por `ventanaDe`. No se
 * manda el rango en crudo a propósito: si el servidor volviera a
 * decidir qué es «hoy», habría dos sitios decidiéndolo y el día que
 * discrepen nadie sabría cuál manda.
 */
export type VentanaDeLlegada = { llegoDesde?: string; llegoHasta?: string };

/** Si una acción llega a sus cupos antes de cerrar, y con qué holgura. */
export type Veredicto =
  "SIN_FECHA" | "CERRADO" | "CUBIERTO" | "LLEGA" | "APRETADO" | "NO_LLEGA";

/** Una acción de formación, proyectada hasta su cierre. */
export type FilaDeProyeccion = {
  accionFormacionId: string;
  codigo: string | null;
  nombre: string | null;
  /// Lo comprometido con el SENA. Es el denominador de todo.
  cupos: number;
  inscritos: number;
  faltan: number;
  leads: number;
  /// Los que siguen sin resolver: la materia prima que ya se tiene.
  abiertos: number;
  cierre: string | null;
  /// Días de trabajo ---lunes a sábado--- hasta el cierre.
  diasRestantes: number | null;
  ritmoReal: number;
  /// Cuántos se inscribieron dentro de la ventana de ritmo, sin dividir.
  inscritosVentana: number;
  metaDiaria: number | null;
  proyeccion: number;
  conversion: number;
  /// Si la conversión es la suya o la del promedio general.
  conversionPropia: boolean;
  leadsNecesarios: number;
  leadsPorConseguir: number;
  veredicto: Veredicto;

  /// LO DE LA CUENTA DE JOSSE, que el admin pone y el sistema deriva.
  /// # asesores que puso el admin. Nulo = sin configurar.
  asesores: number | null;
  /// Los días que el admin tecleó, o null si no puso ninguno.
  diasConfigurados: number | null;
  /// La fecha de cierre que el admin fijó (ISO), o null. Editable e
  /// independiente; de referencia, no manda sobre los días.
  cierreProyeccion: string | null;
  /**
   * TODAS las fechas en que cierra esta accion, en orden.
   *
   * Una sola = la accion cierra entera. Dos o mas = cierra POR
   * PARTES, y entonces `cierre` ---la que manda en los dias y en la
   * meta diaria--- es solo la primera de ellas.
   */
  cierresDeLosGrupos: string[];
  /// Los días EFECTIVOS --los del admin si los puso, si no los del
  /// cronograma--. Nulo si no hay ninguno.
  diasParaCierre: number | null;
  /// Meta diaria en coma flotante, para redondear al pintar; sale de
  /// los días efectivos.
  metaDiariaFlotante: number | null;
  /// Meta de cada asesor: meta diaria / # asesores. Nula sin asesores
  /// configurados, que no es cero.
  metaPorAsesor: number | null;
};

/**
 * Una acción, proyectada hasta el FIN DEL CURSO.
 *
 * La hermana de `FilaDeProyeccion`, con otro reloj y otro numerador:
 * allí son sillas que llenar antes del cierre de inscripciones, aquí
 * personas que certificar antes de que acabe el curso.
 */
export type FilaDeProyeccionAcademica = {
  accionFormacionId: string;
  codigo: string | null;
  nombre: string | null;
  /// Quién está dentro del aula. El denominador.
  enElAula: number;
  certificados: number;
  porCertificar: number;
  /// Los que ya no van a certificarse: no aprobaron, desertaron,
  /// abandonaron o se retiraron.
  salieron: number;
  finDelCurso: string | null;
  diasRestantes: number | null;
  certificadosVentana: number;
  ritmoReal: number;
  metaDiaria: number | null;
  proyeccion: number;
  veredicto: Veredicto;
};

export type FilaDeAsesorAcademico = FilaDeAsesor & {
  grupos: number;
  certificados: number;
  conSeguimiento: number;
};

export const crmApi = {
  /// Los datos de la empresa, desde la ficha del lead.
  ///
  /// Se manda SOLO lo que cambió: una clave ausente es «no lo
  /// toque» y una en null es «quítalo». El servidor depende de
  /// esa diferencia, así que no se rellena el objeto con los
  /// valores que ya estaban.
  ///
  /// El NIT no va: es la llave de la fila y la fila la
  /// comparten todas las fichas de esa empresa.
  guardarDatosEmpresa: (
    id: string,
    datos: {
      nit?: string;
      razonSocial?: string;
      digitoVerificacion?: string;
      direccion?: string;
      telefono?: string;
      departamentoSepId?: number | null;
      municipioSepId?: number | null;
      sectorEconomico?: string;
      numeroTrabajadores?: number | null;
      contactoNombre?: string;
      contactoCargo?: string;
      contactoCorreo?: string;
    },
  ) =>
    pedir<unknown>(`/admin/participantes/${id}/empresa`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  /**
   * MOVER ESTA FICHA A UNA ORGANIZACIÓN QUE YA EXISTE.
   *
   * Es OTRA puerta, no un caso de la de arriba, y la diferencia
   * importa: corregir el NIT cambia la organización y con ella
   * TODAS las fichas que cuelgan de esa fila; mover cambia SOLO
   * esta ficha.
   *
   * Hace falta cuando la organización buena ya está registrada:
   * ahí no hay nada que corregir —el NIT bueno ya es de alguien—
   * y lo que se necesita es mudar a la persona.
   */
  mudarDeOrganizacion: (id: string, nit: string) =>
    pedir<{ movida: boolean; razonSocial: string; nit: string }>(
      `/admin/participantes/${id}/organizacion`,
      { method: "PATCH", body: JSON.stringify({ nit }) },
    ),

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

  /// La ventana Y los cortes: el backend acepta los dos desde
  /// que la pantalla filtra entera. Antes solo tomaba fechas,
  /// y media cifra respondia al filtro y media no.
  control: (ventana: FiltroVentana & Filtros = {}) =>
    pedir<Control>(`/admin/participantes/control${consulta(ventana)}`),

  /// EL TABLERO DE ASESORES, en sus subvistas.
  /// LAS TRES ACEPTAN PERIODO. Son dos instantes ya resueltos en
  /// hora de Bogotá por el filtro compartido del panel; sin ellos la
  /// consulta sale igual que siempre.
  asesoresDeInscripciones: (v: VentanaDeLlegada = {}) =>
    pedir<FilaDeAsesor[]>(
      `/admin/participantes/asesores/inscripciones${consulta(v)}`,
    ),
  asesoresAcademicos: (v: VentanaDeLlegada = {}) =>
    pedir<FilaDeAsesorAcademico[]>(
      `/admin/participantes/asesores/academicos${consulta(v)}`,
    ),
  /// La proyección: aquí el asesor pasa a segundo plano y lo macro es
  /// la acción de formación.
  proyeccionAcademica: (v: VentanaDeLlegada = {}) =>
    pedir<FilaDeProyeccionAcademica[]>(
      `/admin/participantes/asesores/proyeccion-academica${consulta(v)}`,
    ),
  proyeccionDeInscripciones: (v: VentanaDeLlegada = {}) =>
    pedir<FilaDeProyeccion[]>(
      `/admin/participantes/asesores/proyeccion${consulta(v)}`,
    ),

  /// El admin fija el # de asesores y los días para el cierre de la
  /// proyección de una acción. `null` vacía el campo; ausente es «no
  /// lo toques».
  configurarProyeccion: (
    accionId: string,
    cambios: {
      asesores?: number | null;
      dias?: number | null;
      cierre?: string | null;
    },
  ) =>
    pedir<{ guardado: boolean }>(
      `/admin/participantes/asesores/proyeccion/${accionId}`,
      { method: "PATCH", body: JSON.stringify(cambios) },
    ),

  /// EL RESUMEN GENERAL: siete cifras macro por acción de formación.
  /// Toma los mismos cortes que el resto de la pantalla.
  resumenGeneral: (filtros: Filtros & { desde?: string; hasta?: string } = {}) =>
    pedir<FilaResumenGeneral[]>(
      `/admin/participantes/control/resumen-general${consulta(filtros)}`,
    ),

  /// EL DETALLE POR GRUPOS de una acción (Bloque 3).
  ///
  /// CON EL MISMO RECORTE QUE LA TABLA DE ARRIBA, desde el 6 oct
  /// 2026: este bloque no obedecía a ninguno, y se abre pulsando
  /// una fila de esa tabla, que sí los obedece. Los dos, pegados en
  /// la misma pantalla, contaban gente distinta para la misma
  /// acción: con una asesora filtrada, su fila decía 12 inscritos y
  /// sus grupos sumaban 85.
  resumenPorGrupo: (
    accionFormacionId: string,
    recorte: Filtros & { desde?: string; hasta?: string } = {},
  ) =>
    pedir<FilaDeGrupo[]>(
      `/admin/participantes/resumen-por-accion/${accionFormacionId}/grupos${consulta(recorte)}`,
    ),

  /// LA TABLA DEL COMITÉ: una fila por acción de formación. Es el
  /// Excel que el cliente llevaba a mano (23 sep 2026).
  /// Con el MISMO recorte que el resto de la pantalla: los cinco
  /// filtros y la ventana. Sin ellos, con «Hoy» arriba decía una
  /// persona y esta tabla doscientas siete.
  resumenPorAccion: (
    recorte: Filtros & { desde?: string; hasta?: string } = {},
  ) =>
    pedir<FilaDeAccion[]>(
      `/admin/participantes/resumen-por-accion${consulta(recorte)}`,
    ),

  tableroAcademico: (ventana: FiltroVentana = {}) =>
    pedir<TableroAcademico>(
      `/admin/participantes/academico/tablero${consulta(ventana)}`,
    ),

  /// Con , los grupos vienen recortados a los
  /// que cubren donde vive esa persona.
  opciones: (convenioId: string, participanteId?: string) =>
    pedir<Opciones>(
      `/admin/participantes/opciones?convenioId=${convenioId}` +
        (participanteId ? `&participanteId=${participanteId}` : ""),
    ),

  /// Las ofertas con gente sin grupo, y las celdas que las sirven.
  ///
  /// La unidad es la OFERTA y no el grupo: varias celdas comparten
  /// oferta, y abriendo grupo por grupo se verian los mismos
  /// candidatos dos veces.
  gruposPendientes: () =>
    pedir<{ ofertas: OfertaSinGrupo[] }>(
      "/admin/participantes/grupos/pendientes",
    ),

  candidatosDeGrupo: (ofertaId: string) =>
    pedir<CandidatosDeGrupo>(
      `/admin/participantes/grupos/candidatos/${ofertaId}`,
    ),

  asignarGrupoEnLote: (coberturaId: string, ids: string[]) =>
    pedir<{
      asignadas: number;
      fuera: number;
      sinCupo: number;
      cabenAhora: number;
    }>("/admin/participantes/grupos/lote", {
      method: "PATCH",
      body: JSON.stringify({ coberturaId, ids }),
    }),

  /// Borra varias fichas. Solo SUPERADMIN, igual que borrar una.
  ///
  /// Devuelve las dos cifras a propósito: `pedidas` puede ser mayor que
  /// `borradas` si en la selección iba algo de otro gremio, y la
  /// pantalla tiene que poder decirlo en vez de dar un «listo».
  borrarEnLote: (ids: string[]) =>
    pedir<{ borradas: number; pedidas: number }>(
      "/admin/participantes/lote/borrar",
      { method: "POST", body: JSON.stringify({ ids }) },
    ),

  /**
   * LAS PERSONAS QUE ESTÁN EN MÁS DE UNA ACCIÓN DE FORMACIÓN.
   *
   * Cada una con sus fichas: en qué acción, en qué etapa, con qué
   * asesora y cuánta gestión lleva encima. Con eso se decide a cuál va
   * de verdad, que es la pregunta que la pantalla hace.
   */
  repetidas: () => pedir<PersonaRepetida[]>("/admin/participantes/repetidas"),

  /**
   * Une dos fichas de la misma persona.
   *
   * `deDonde` es el «cómo fusionarlos»: por campo, el id de la ficha
   * de la que sale su valor. Lo que no se nombre se queda como está en
   * la que sobrevive.
   */
  unirFichas: (
    conservarId: string,
    absorberId: string,
    deDonde: Record<string, string>,
  ) =>
    pedir<{
      unidas: boolean;
      seQueda: string | null;
      seAbsorbio: string | null;
      notas: number;
      movimientos: number;
      avancesQueSePierden: number;
    }>("/admin/participantes/unir", {
      method: "POST",
      body: JSON.stringify({ conservarId, absorberId, deDonde }),
    }),

  asignarAsesorEnLote: (ids: string[], asesorId: string | null) =>
    pedir<{ cambiadas: number; fuera: number; sinCambio: number }>(
      "/admin/participantes/lote/asesor",
      { method: "PATCH", body: JSON.stringify({ ids, asesorId }) },
    ),

  asignar: (
    id: string,
    ofertaId: string,
    coberturaId?: string,
    sobrecupoMotivo?: string,
  ) =>
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

  /// LA BANDEJA DE CONVERSACIONES: las de Lucid que no se pegaron
  /// solas. Las pegadas no salen: es una cola de trabajo, no un
  /// historial.
  conversacionesEnEspera: () =>
    pedir<ConversacionEnEspera[]>("/admin/conversaciones"),

  /// Pegarla a una ficha o a un lead. UNO de los dos: una
  /// conversación pasó con una persona.
  pegarConversacion: (
    id: string,
    destino: { participanteId?: string; leadId?: string },
  ) =>
    pedir<{ pegada: boolean; notaId: string }>(
      `/admin/conversaciones/${id}/pegar`,
      { method: "POST", body: JSON.stringify(destino) },
    ),

  catalogos: () => pedir<CatalogosSep>("/admin/participantes/catalogos"),

  metricas: (filtros: Filtros = {}) =>
    pedir<MetricasInscripciones>(
      `/admin/participantes/metricas${consulta(filtros)}`,
    ),

  /// El embudo del formulario publico. Una sola llamada.
  /// Con `contraDesde` y `contraHasta` compara dos periodos
  /// elegidos del calendario, no uno contra su previo.
  embudoPublico: (p: {
    rango?: string;
    desde?: string;
    hasta?: string;
    contraDesde?: string;
    contraHasta?: string;
  }) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) if (v) q.set(k, v);
    return pedir<EmbudoPublico>(`/admin/embudo-publico?${q.toString()}`);
  },

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

  /// LA FILA DEL AULA DE UNA SOLA PERSONA, para su vista individual.
  /// La calcula el mismo sitio que la lista, así que su estado y su
  /// avance no pueden discrepar de los de la tabla.
  academicoDeUno: (id: string) =>
    pedir<Academico>(`/admin/participantes/academico/persona/${id}`),

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

  /// YA NO SE MANDA `resultado`, y es a propósito.
  ///
  /// El 30 sep 2026 el cliente señaló que al anotar se preguntaba lo
  /// mismo dos veces: «Cómo salió» --[Hablé con la persona] [No
  /// contestó] [El dato no sirve]-- y debajo «Clasificación», cuyas
  /// categorías son esas mismas tres más «Seguimiento». Textual:
  /// «Ese "Cómo salió" es la "Clasificación"».
  ///
  /// El dato sigue existiendo en la nota --de él cuelgan los
  /// informes y la cuenta de intentos sin respuesta-- pero lo DERIVA
  /// EL SERVIDOR de la categoría elegida, que ahora declara qué
  /// significa. Mandarlo desde aquí sería un segundo sitio
  /// decidiéndolo, y un día dirían cosas distintas. El servidor
  /// además lo RECHAZA si llega (`forbidNonWhitelisted`).
  ///
  /// La clasificación sigue siendo OPCIONAL en el DTO: las notas que
  /// escribe el sistema no las clasifica nadie. Que elegir categoría
  /// sea obligatorio se decide en la pantalla, donde se puede
  /// acompañar con un motivo.
  agregarNota: (
    id: string,
    texto: string,
    canales: CanalContacto[],
    clasificacion?: {
      categoriaId: string | null;
      subcategoriaId: string | null;
    },
  ) =>
    pedir<Record<string, unknown>>(`/admin/participantes/${id}/notas`, {
      method: "POST",
      body: JSON.stringify({
        texto,
        canales,
        /// Sin la llave cuando no hay nada elegido, en vez de con
        /// `null`: el DTO la declara `@IsOptional`, y un `null`
        /// explícito no es «no vino».
        ...(clasificacion?.categoriaId
          ? { categoriaId: clasificacion.categoriaId }
          : {}),
        ...(clasificacion?.subcategoriaId
          ? { subcategoriaId: clasificacion.subcategoriaId }
          : {}),
      }),
    }),

  /** Lo que mandó el interesado, si hay algo pendiente. */
  propuesta: (id: string) =>
    pedir<PropuestaDelInteresado | null>(
      `/admin/participantes/${id}/propuesta`,
    ),

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
    pedir<Ficha>(`/admin/participantes/${id}/rui/tomar-nombre`, {
      method: "POST",
    }),

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
