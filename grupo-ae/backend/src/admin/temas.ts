import { EsquemaColor } from '../../generated/prisma';

/** Los colores que personaliza el admin. */

export type GrupoToken =
  | 'MARCA'
  | 'SUPERFICIES'
  | 'TEXTO'
  | 'ENCABEZADO'
  | 'TABLAS'
  | 'CONTROLES'
  | 'ESTADOS'
  | 'ETAPAS';

export type DefinicionToken = {
  clave: string;
  /** Variable CSS que escribe el frontend. */
  variableCss: string;
  grupo: GrupoToken;
  etiqueta: string;
  ayuda?: string;
};

export const GRUPOS: Array<{ clave: GrupoToken; etiqueta: string; descripcion: string }> = [
  {
    clave: 'MARCA',
    etiqueta: 'Marca',
    descripcion: 'Botones, enlaces y todo lo que identifica a la marca.',
  },
  {
    clave: 'SUPERFICIES',
    etiqueta: 'Superficies',
    descripcion: 'El fondo de la página y las tarjetas que van encima.',
  },
  { clave: 'TEXTO', etiqueta: 'Texto', descripcion: 'Títulos, texto normal y ayudas.' },
  {
    clave: 'ENCABEZADO',
    etiqueta: 'Encabezado',
    descripcion: 'La barra superior del sitio y del panel.',
  },
  {
    clave: 'TABLAS',
    etiqueta: 'Tablas y listas',
    descripcion: 'Cabeceras, filas alternas y la fila señalada con el ratón.',
  },
  {
    clave: 'CONTROLES',
    etiqueta: 'Campos y botones',
    descripcion: 'Formularios: fondo de los campos y el aro de foco.',
  },
  {
    clave: 'ESTADOS',
    etiqueta: 'Estados',
    descripcion:
      'Cerrado ganado, en riesgo y cerrado perdido. También los mensajes de error. ' +
      'Cámbielos con cuidado: si pierden contraste, un aviso importante pasa desapercibido.',
  },
  {
    clave: 'ETAPAS',
    etiqueta: 'Etapas del CRM',
    descripcion:
      'Una por columna del tablero del embudo. La etiqueta siempre se lee, ' +
      'así que el color acompaña pero nunca es lo único que distingue una etapa.',
  },
];

export const TOKENS: DefinicionToken[] = [
  // Marca
  { clave: 'marca', variableCss: '--marca', grupo: 'MARCA', etiqueta: 'Principal', ayuda: 'Botones, enlaces y selección.' },
  { clave: 'marcaFuerte', variableCss: '--marca-fuerte', grupo: 'MARCA', etiqueta: 'Principal oscuro', ayuda: 'Al pasar el ratón por encima.' },
  { clave: 'marcaSuave', variableCss: '--marca-suave', grupo: 'MARCA', etiqueta: 'Fondo resaltado', ayuda: 'Zonas destacadas y pestaña activa.' },
  { clave: 'marcaTexto', variableCss: '--marca-texto', grupo: 'MARCA', etiqueta: 'Texto sobre la marca' },

  // Superficies
  { clave: 'fondo', variableCss: '--fondo', grupo: 'SUPERFICIES', etiqueta: 'Fondo de la página' },
  { clave: 'superficie', variableCss: '--superficie', grupo: 'SUPERFICIES', etiqueta: 'Tarjetas' },
  { clave: 'superficieAlterna', variableCss: '--superficie-alterna', grupo: 'SUPERFICIES', etiqueta: 'Superficie alterna', ayuda: 'Bloques secundarios dentro de una tarjeta.' },
  { clave: 'borde', variableCss: '--borde', grupo: 'SUPERFICIES', etiqueta: 'Bordes' },

  // Texto
  { clave: 'titulo', variableCss: '--titulo', grupo: 'TEXTO', etiqueta: 'Títulos' },
  { clave: 'texto', variableCss: '--texto', grupo: 'TEXTO', etiqueta: 'Texto normal' },
  { clave: 'textoSuave', variableCss: '--texto-suave', grupo: 'TEXTO', etiqueta: 'Texto secundario', ayuda: 'Ayudas bajo los campos y notas.' },

  // Encabezado
  { clave: 'encabezadoFondo', variableCss: '--encabezado-fondo', grupo: 'ENCABEZADO', etiqueta: 'Fondo' },
  { clave: 'encabezadoTexto', variableCss: '--encabezado-texto', grupo: 'ENCABEZADO', etiqueta: 'Texto' },
  { clave: 'encabezadoBorde', variableCss: '--encabezado-borde', grupo: 'ENCABEZADO', etiqueta: 'Línea inferior' },

  // Tablas
  { clave: 'tablaCabeceraFondo', variableCss: '--tabla-cabecera-fondo', grupo: 'TABLAS', etiqueta: 'Fondo de la cabecera' },
  { clave: 'tablaCabeceraTexto', variableCss: '--tabla-cabecera-texto', grupo: 'TABLAS', etiqueta: 'Texto de la cabecera' },
  { clave: 'tablaFilaAlterna', variableCss: '--tabla-fila-alterna', grupo: 'TABLAS', etiqueta: 'Fila alterna', ayuda: 'El sombreado de una fila sí y otra no.' },
  { clave: 'tablaFilaResaltada', variableCss: '--tabla-fila-resaltada', grupo: 'TABLAS', etiqueta: 'Fila bajo el ratón' },
  { clave: 'tablaBorde', variableCss: '--tabla-borde', grupo: 'TABLAS', etiqueta: 'Líneas de la tabla' },

  // Controles
  { clave: 'campoFondo', variableCss: '--campo-fondo', grupo: 'CONTROLES', etiqueta: 'Fondo de los campos' },
  { clave: 'campoBorde', variableCss: '--campo-borde', grupo: 'CONTROLES', etiqueta: 'Borde de los campos' },
  { clave: 'campoFoco', variableCss: '--campo-foco', grupo: 'CONTROLES', etiqueta: 'Aro de foco', ayuda: 'Marca el campo activo. Debe verse: es lo que guía a quien navega con el teclado.' },

  // Estados
  { clave: 'exito', variableCss: '--exito', grupo: 'ESTADOS', etiqueta: 'Disponible / confirmado' },
  { clave: 'exitoSuave', variableCss: '--exito-suave', grupo: 'ESTADOS', etiqueta: 'Fondo de disponible' },
  { clave: 'aviso', variableCss: '--aviso', grupo: 'ESTADOS', etiqueta: 'En riesgo / pendiente' },
  { clave: 'avisoSuave', variableCss: '--aviso-suave', grupo: 'ESTADOS', etiqueta: 'Fondo de en riesgo' },
  { clave: 'error', variableCss: '--error', grupo: 'ESTADOS', etiqueta: 'Perdido / error' },
  { clave: 'errorSuave', variableCss: '--error-suave', grupo: 'ESTADOS', etiqueta: 'Fondo de error' },

  // Etapas del CRM
  //
  // Las siete primeras se llaman como la etapa del NEGOCIO que
  // pintan, y desde el 18 sep 2026 la persona usa esas mismas
  // palabras, así que el nombre sirve para los dos lados. Las
  // cuatro últimas solo existen en la persona y se llaman como en
  // el Mailing: «Canceló» y «No aprobó la compra», no «Retirado» y
  // «No calificó», que eran palabras de aula. La CLAVE sigue
  // diciendo `etapaRetirado` y `etapaNoAprobo`: es la llave con la
  // que el color ya está guardado en el JSON de `Tema` (claro y
  // oscuro), y renombrarla dejaría sin su color a quien lo
  // personalizó.
  { clave: 'etapaInteresado', variableCss: '--etapa-interesado', grupo: 'ETAPAS', etiqueta: 'Solicitud de negocio' },
  { clave: 'etapaContactado', variableCss: '--etapa-contactado', grupo: 'ETAPAS', etiqueta: 'Contactado' },
  { clave: 'etapaDatosCompletos', variableCss: '--etapa-datos-completos', grupo: 'ETAPAS', etiqueta: 'Calificado' },
  { clave: 'etapaInscrito', variableCss: '--etapa-inscrito', grupo: 'ETAPAS', etiqueta: 'Cotización enviada' },
  { clave: 'etapaEnFormacion', variableCss: '--etapa-en-formacion', grupo: 'ETAPAS', etiqueta: 'En negociación' },
  { clave: 'etapaCertificado', variableCss: '--etapa-certificado', grupo: 'ETAPAS', etiqueta: 'Cerrado ganado' },
  { clave: 'etapaPerdido', variableCss: '--etapa-perdido', grupo: 'ETAPAS', etiqueta: 'Cerrado perdido' },
  { clave: 'etapaRetirado', variableCss: '--etapa-retirado', grupo: 'ETAPAS', etiqueta: 'Canceló' },
  { clave: 'etapaNoAprobo', variableCss: '--etapa-no-aprobo', grupo: 'ETAPAS', etiqueta: 'No aprobó la compra' },
  { clave: 'etapaDeserto', variableCss: '--etapa-deserto', grupo: 'ETAPAS', etiqueta: 'Desistió' },
  { clave: 'etapaAbandono', variableCss: '--etapa-abandono', grupo: 'ETAPAS', etiqueta: 'Dejó de responder' },
];

/** Los tokens de etapa, en el orden del embudo. */
export const CLAVES_ETAPA = TOKENS.filter((t) => t.grupo === 'ETAPAS').map((t) => t.clave);

export const CLAVES_TOKEN = new Set(TOKENS.map((t) => t.clave));

/** Pares que tienen que ser legibles. */
export const COMPROBACIONES_CONTRASTE: Array<{
  frente: string;
  fondo: string;
  descripcion: string;
  grande?: boolean;
  /// No es texto sobre fondo: son dos colores que tienen que
  /// poder distinguirse. El umbral es otro -- ver el frontend.
  entreEstados?: boolean;
}> = [
  { frente: 'texto', fondo: 'fondo', descripcion: 'Texto sobre el fondo' },
  { frente: 'texto', fondo: 'superficie', descripcion: 'Texto sobre las tarjetas' },
  { frente: 'textoSuave', fondo: 'superficie', descripcion: 'Texto secundario sobre las tarjetas' },
  { frente: 'titulo', fondo: 'fondo', descripcion: 'Títulos', grande: true },
  { frente: 'marcaTexto', fondo: 'marca', descripcion: 'Texto de los botones' },
  { frente: 'marca', fondo: 'superficie', descripcion: 'Enlaces sobre las tarjetas' },
  { frente: 'marca', fondo: 'marcaSuave', descripcion: 'Texto sobre el fondo resaltado' },
  { frente: 'encabezadoTexto', fondo: 'encabezadoFondo', descripcion: 'Texto del encabezado' },
  { frente: 'tablaCabeceraTexto', fondo: 'tablaCabeceraFondo', descripcion: 'Cabecera de tabla' },
  { frente: 'texto', fondo: 'tablaFilaAlterna', descripcion: 'Texto en la fila alterna' },
  { frente: 'texto', fondo: 'campoFondo', descripcion: 'Lo que se escribe en un campo' },
  /// Los estados se miden contra `superficie`, no contra su
  /// propio fondo tenido.
  ///
  /// El par `exito` / `exitoSuave` medía una pildora rellena, y
  /// esas ya no existen: el estado va en la LETRA sobre la
  /// banda. Seguir midiendo el par viejo daba por bueno un
  /// verde que se lee sobre su propio fondo claro y no sobre el
  /// blanco de la tabla, que es donde de verdad está.
  { frente: 'exito', fondo: 'superficie', descripcion: 'Estado «disponible» en una tabla' },
  { frente: 'aviso', fondo: 'superficie', descripcion: 'Estado «en riesgo» en una tabla' },
  { frente: 'error', fondo: 'superficie', descripcion: 'Estado «completo» o error' },

  /// Y DISTINGUIBLES ENTRE SÍ.
  ///
  /// Es la salvaguarda que pide DECISIONES 2 al dejar los tres
  /// editables: si alguien los repinta parecidos, un dato
  /// verificado y uno sin verificar acaban del mismo color y el
  /// color deja de significar nada.
  ///
  /// Se mide con la misma razón de la WCAG y no por diferencia
  /// de tono a propósito: dos colores pueden diferir mucho de
  /// tono y nada de luminosidad -- rojo y verde son el caso de
  /// libro -- y esa es justamente la pareja que no distingue
  /// quien tiene daltonismo. Midiendo luminosidad, el aviso
  /// salta también para ellos.
  {
    frente: 'exito',
    fondo: 'aviso',
    descripcion: 'Distinguir «al día» de «en riesgo»',
    entreEstados: true,
  },
  {
    frente: 'aviso',
    fondo: 'error',
    descripcion: 'Distinguir «en riesgo» de «vencido»',
    entreEstados: true,
  },
  {
    frente: 'exito',
    fondo: 'error',
    descripcion: 'Distinguir «disponible» de «completo»',
    entreEstados: true,
  },

  // la pildora tiñe la superficie con su propio color,
  // asi que el par que hay que medir es contra ella
  { frente: 'etapaInteresado', fondo: 'superficie', descripcion: 'Etiqueta de Solicitud de negocio' },
  { frente: 'etapaContactado', fondo: 'superficie', descripcion: 'Etiqueta de Contactado' },
  { frente: 'etapaDatosCompletos', fondo: 'superficie', descripcion: 'Etiqueta de Calificado' },
  { frente: 'etapaInscrito', fondo: 'superficie', descripcion: 'Etiqueta de Cotización enviada' },
  { frente: 'etapaEnFormacion', fondo: 'superficie', descripcion: 'Etiqueta de En negociación' },
  { frente: 'etapaCertificado', fondo: 'superficie', descripcion: 'Etiqueta de Cerrado ganado' },
  { frente: 'etapaPerdido', fondo: 'superficie', descripcion: 'Etiqueta de Cerrado perdido' },
  { frente: 'etapaRetirado', fondo: 'superficie', descripcion: 'Etiqueta de Canceló' },
  { frente: 'etapaNoAprobo', fondo: 'superficie', descripcion: 'Etiqueta de No aprobó la compra' },
  { frente: 'etapaDeserto', fondo: 'superficie', descripcion: 'Etiqueta de Desistió' },
  { frente: 'etapaAbandono', fondo: 'superficie', descripcion: 'Etiqueta de Dejó de responder' },
];

export type ColoresTema = Record<string, string>;

/** Los valores de fábrica. */
export const TEMAS_POR_DEFECTO: Record<EsquemaColor, ColoresTema> = {
  CLARO: {
    marca: '#1d4ed8',
    marcaFuerte: '#1e3a8a',
    marcaSuave: '#eff6ff',
    marcaTexto: '#ffffff',

    fondo: '#f6f7f9',
    superficie: '#ffffff',
    superficieAlterna: '#f4f6f9',
    borde: '#e2e8f0',

    titulo: '#0f172a',
    /// El cuerpo un punto por debajo del titulo.
    ///
    /// Estaban los dos en #0f172a, y con el mismo color no hay
    /// jerarquia que leer: el titulo pesaba igual que el dato.
    texto: '#1e293b',
    textoSuave: '#64748b',

    encabezadoFondo: '#ffffff',
    encabezadoTexto: '#0f172a',
    encabezadoBorde: '#e2e8f0',

    /// La cabecera de tabla se IGUALA a la superficie.
    ///
    /// Pasa a ser rotulo en versalita sobre blanco con una
    /// regla de 1px debajo. La franja tenida de cabecera estaba
    /// en nueve de las quince pantallas y a veces cinco veces en
    /// la misma: con cinco franjas azules ninguna es la
    /// importante.
    ///
    /// El token sigue aqui y sigue siendo editable desde
    /// Apariencia: quien quiera la cabecera tenida la tiene a un
    /// clic. Pero no es lo que sale de fabrica.
    tablaCabeceraFondo: '#ffffff',
    tablaCabeceraTexto: '#64748b',
    tablaFilaAlterna: '#f8fafc',
    tablaFilaResaltada: '#eff6ff',
    tablaBorde: '#e2e8f0',

    campoFondo: '#ffffff',
    campoBorde: '#cbd5e1',
    campoFoco: '#1d4ed8',

    // escalones medidos contra deuteranopia
    exito: '#047857',
    exitoSuave: '#ecfdf5',
    aviso: '#a16207',
    avisoSuave: '#fffbeb',
    error: '#be123c',
    errorSuave: '#fff1f2',

    /// Las etapas no son un arcoiris: son una RAMPA.
    ///
    /// Una etapa no es «otra cosa» que la anterior, es «mas
    /// adelante» que la anterior. De gris a azul profundo:
    /// cuanto mas oscuro, mas cerca del dinero. Una columna de
    /// cuarenta filas se lee de un vistazo aunque no se sepan
    /// los nombres, y quien no distingue colores ve igual la
    /// rampa de claro a oscuro.
    ///
    /// Ganado es el UNICO verde de la pantalla. Y Perdido se
    /// apaga en vez de gritar en rojo: en un embudo sano se
    /// pierden dos de cada tres negocios, y cuarenta filas rojas
    /// dicen que todo esta mal cuando todo esta normal.
    etapaInteresado: '#64748b',
    etapaContactado: '#5977a5',
    etapaDatosCompletos: '#3b6cc4',
    etapaInscrito: '#1d4ed8',
    etapaEnFormacion: '#1e3a8a',
    etapaCertificado: '#047857',
    /// Perdido se apaga: es la unica etapa SIN color.
    ///
    /// La direccion pide #94a3b8 y la intencion es correcta --
    /// en un embudo sano se pierden dos de cada tres negocios,
    /// y cuarenta filas rojas dicen que todo esta mal cuando
    /// todo esta normal --, pero ese gris da 2,56 sobre blanco
    /// y la casa exige 4,5 a toda etiqueta de etapa (lo prueba
    /// derivar.spec.ts, y lo rompia).
    ///
    /// «Apagado» se consigue igual sin bajar del suelo: se le
    /// quita el CROMA en vez de la luz. Captado es gris AZUL
    /// (#64748b); Perdido es gris a secas, la unica etapa a la
    /// que no le queda nada de color.
    etapaPerdido: '#6b7280',
    /// Las cuatro de abajo son vocabulario muerto de Convoca y
    /// el CRM no las usa: se dejan quietas y no se les inventa
    /// un uso. Pero SI se apartan del camino de la rampa nueva.
    /// «En negociacion» pasa a ser azul profundo y «Abandono»
    /// estaba en el mismo indigo (2,1 de distancia en OKLab:
    /// el mismo color); «Ganado» pasa a verde y «Desertó»
    /// estaba a 9,4 de él. Dos series de diez píxeles a esa
    /// distancia no son dos series, son una mancha.
    etapaRetirado: '#7a2e72',
    etapaNoAprobo: '#c22a1e',
    etapaDeserto: '#0f78a5',
    etapaAbandono: '#6d28d9',
  },
  OSCURO: {
    marca: '#60a5fa',
    marcaFuerte: '#93c5fd',
    marcaSuave: '#172554',
    marcaTexto: '#0b1220',

    fondo: '#0b1220',
    superficie: '#131c2e',
    superficieAlterna: '#1a2439',
    borde: '#26324a',

    titulo: '#f2f6ff',
    texto: '#e8edf7',
    textoSuave: '#9aa8c0',

    encabezadoFondo: '#131c2e',
    encabezadoTexto: '#e8edf7',
    encabezadoBorde: '#26324a',

    tablaCabeceraFondo: '#131c2e',
    tablaCabeceraTexto: '#9aa8c0',
    tablaFilaAlterna: '#101a2b',
    tablaFilaResaltada: '#172554',
    tablaBorde: '#26324a',

    campoFondo: '#0f1829',
    campoBorde: '#33405c',
    campoFoco: '#60a5fa',

    exito: '#34d399',
    exitoSuave: '#053225',
    aviso: '#fbbf24',
    avisoSuave: '#2e1f03',
    error: '#fb7185',
    errorSuave: '#3f0d16',

    // La misma rampa, GIRADA. En un fondo oscuro «mas cerca del
    // dinero» no puede ser mas oscuro -- se perderia contra el
    // fondo --, asi que la etapa se aclara segun avanza. El
    // orden que ve el ojo es el mismo.
    etapaInteresado: '#94a3b8',
    etapaContactado: '#93b4d8',
    etapaDatosCompletos: '#7ba3ea',
    etapaInscrito: '#60a5fa',
    etapaEnFormacion: '#bfdbfe',
    etapaCertificado: '#34d399',
    etapaPerdido: '#8b8f99',
    etapaRetirado: '#dfa0d8',
    etapaNoAprobo: '#f77a5c',
    etapaDeserto: '#22b8d8',
    etapaAbandono: '#8d9bf2',
  },
};

/** Completa lo que falte con el valor por defecto. */
export function conValoresPorDefecto(
  esquema: EsquemaColor,
  guardados: unknown,
): ColoresTema {
  const base = TEMAS_POR_DEFECTO[esquema];
  const validos =
    guardados && typeof guardados === 'object' ? (guardados as ColoresTema) : {};

  const resultado: ColoresTema = {};
  for (const token of TOKENS) {
    // solo tokens del catálogo
    resultado[token.clave] = validos[token.clave] ?? base[token.clave];
  }
  return resultado;
}
