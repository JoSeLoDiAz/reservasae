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
    descripcion: 'Botones, enlaces y todo lo que identifica a la entidad.',
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
      'Confirmado, lista de espera y completo. También los mensajes de error. ' +
      'Cámbielos con cuidado: si pierden contraste, un aviso importante pasa desapercibido.',
  },
  {
    clave: 'ETAPAS',
    etiqueta: 'Etapas del CRM',
    descripcion:
      'Una por columna del tablero de inscripciones. La etiqueta siempre se lee, ' +
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
  { clave: 'aviso', variableCss: '--aviso', grupo: 'ESTADOS', etiqueta: 'Últimos cupos / en espera' },
  { clave: 'avisoSuave', variableCss: '--aviso-suave', grupo: 'ESTADOS', etiqueta: 'Fondo de últimos cupos' },
  { clave: 'error', variableCss: '--error', grupo: 'ESTADOS', etiqueta: 'Completo / error' },
  { clave: 'errorSuave', variableCss: '--error-suave', grupo: 'ESTADOS', etiqueta: 'Fondo de error' },

  // Etapas del CRM
  { clave: 'etapaNuevo', variableCss: '--etapa-nuevo', grupo: 'ETAPAS', etiqueta: 'Nuevo' },
  { clave: 'etapaContactado', variableCss: '--etapa-contactado', grupo: 'ETAPAS', etiqueta: 'Contactado' },
  { clave: 'etapaDatosCompletos', variableCss: '--etapa-datos-completos', grupo: 'ETAPAS', etiqueta: 'Datos completos' },
  { clave: 'etapaMatriculado', variableCss: '--etapa-matriculado', grupo: 'ETAPAS', etiqueta: 'Matriculado' },
  { clave: 'etapaEnFormacion', variableCss: '--etapa-en-formacion', grupo: 'ETAPAS', etiqueta: 'En formación' },
  { clave: 'etapaCertificado', variableCss: '--etapa-certificado', grupo: 'ETAPAS', etiqueta: 'Certificado' },
  { clave: 'etapaPerdido', variableCss: '--etapa-perdido', grupo: 'ETAPAS', etiqueta: 'Perdido' },
  { clave: 'etapaRetirado', variableCss: '--etapa-retirado', grupo: 'ETAPAS', etiqueta: 'Retirado' },
  { clave: 'etapaNoAprobo', variableCss: '--etapa-no-aprobo', grupo: 'ETAPAS', etiqueta: 'No aprobó' },
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
  { frente: 'exito', fondo: 'exitoSuave', descripcion: 'Etiqueta de disponible' },
  { frente: 'aviso', fondo: 'avisoSuave', descripcion: 'Etiqueta de últimos cupos' },
  { frente: 'error', fondo: 'errorSuave', descripcion: 'Mensaje de error' },

  // la pildora tiñe la superficie con su propio color,
  // asi que el par que hay que medir es contra ella
  { frente: 'etapaNuevo', fondo: 'superficie', descripcion: 'Etiqueta de Nuevo' },
  { frente: 'etapaContactado', fondo: 'superficie', descripcion: 'Etiqueta de Contactado' },
  { frente: 'etapaDatosCompletos', fondo: 'superficie', descripcion: 'Etiqueta de Datos completos' },
  { frente: 'etapaMatriculado', fondo: 'superficie', descripcion: 'Etiqueta de Matriculado' },
  { frente: 'etapaEnFormacion', fondo: 'superficie', descripcion: 'Etiqueta de En formación' },
  { frente: 'etapaCertificado', fondo: 'superficie', descripcion: 'Etiqueta de Certificado' },
  { frente: 'etapaPerdido', fondo: 'superficie', descripcion: 'Etiqueta de Perdido' },
  { frente: 'etapaRetirado', fondo: 'superficie', descripcion: 'Etiqueta de Retirado' },
  { frente: 'etapaNoAprobo', fondo: 'superficie', descripcion: 'Etiqueta de No aprobó' },
];

export type ColoresTema = Record<string, string>;

/** Los valores de fábrica. */
export const TEMAS_POR_DEFECTO: Record<EsquemaColor, ColoresTema> = {
  CLARO: {
    marca: '#1d4ed8',
    marcaFuerte: '#1e3a8a',
    marcaSuave: '#eff6ff',
    marcaTexto: '#ffffff',

    fondo: '#f8fafc',
    superficie: '#ffffff',
    superficieAlterna: '#f1f5f9',
    borde: '#e2e8f0',

    titulo: '#0f172a',
    texto: '#0f172a',
    textoSuave: '#64748b',

    encabezadoFondo: '#ffffff',
    encabezadoTexto: '#0f172a',
    encabezadoBorde: '#e2e8f0',

    tablaCabeceraFondo: '#f1f5f9',
    tablaCabeceraTexto: '#334155',
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

    etapaNuevo: '#5b6472',
    etapaContactado: '#1f4e85',
    etapaDatosCompletos: '#4c3a8c',
    etapaMatriculado: '#1a6e58',
    etapaEnFormacion: '#8a5a12',
    etapaCertificado: '#2c6b1f',
    etapaPerdido: '#9c3126',
    etapaRetirado: '#7a2e72',
    etapaNoAprobo: '#a3431c',
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

    tablaCabeceraFondo: '#1a2439',
    tablaCabeceraTexto: '#c3cee0',
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

    // aclaradas: las del claro no llegan al minimo
    etapaNuevo: '#a3aec0',
    etapaContactado: '#7cb2f0',
    etapaDatosCompletos: '#b3a4f0',
    etapaMatriculado: '#5ec6a8',
    etapaEnFormacion: '#e0b155',
    etapaCertificado: '#86cf72',
    etapaPerdido: '#f2938a',
    etapaRetirado: '#dfa0d8',
    etapaNoAprobo: '#f0a077',
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
