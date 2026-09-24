/** Analiza lo que el asesor pega desde Excel, o lo que trae la plantilla. */

import { aCelularGuardable, celularUtil, celularValido } from '../comun/celular';
import { documentoValido, normalizarDocumento } from '../comun/documento';
import {
  DOCUMENTOS_DE_PERSONA,
  reconocerTipoDocumento,
  siglaDocumento,
} from './catalogos-sep';
import {
  codigoDeAccion,
  columnasDelEncabezado,
  leerDondeVive,
  leerEstrato,
  leerFechaDeNacimiento,
  leerGenero,
  leerNivelOcupacional,
  leerSiNo,
  ORDEN_ANTIGUO,
  type Campo,
  type Columnas,
} from './columnas-de-carga';

export type FilaCruda = {
  linea: number;
  tipoDocumento: string;
  numeroDocumento: string;
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  correo: string;
  celular: string;
};

export type FilaAnalizada = {
  linea: number;
  tipoDocumentoSepId: number;
  numeroDocumento: string;
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  correo: string | null;
  celular: string | null;
  /// Lo que trae la plantilla ancha. Null cuando la columna no vino:
  /// vacío es «no lo dijeron», y no se inventa nada.
  fechaNacimiento: string | null;
  generoSepId: number | null;
  departamentoSepId: number | null;
  municipioSepId: number | null;
  barrio: string | null;
  direccion: string | null;
  estrato: number | null;
  cargoEnEmpresa: string | null;
  nivelOcupacionalSepId: number | null;
  beneficiarioPrevio: boolean | null;
  /** El código («AF3») de la acción que pidió la persona. */
  accionCodigo: string | null;
  /** Lo que venía escrito en esa celda, para poder decirlo en pantalla. */
  accionTexto: string | null;
  problemas: string[];
};

/// Las ocho de siempre, en su orden, para lo que se pega sin encabezado.
export const COLUMNAS = ORDEN_ANTIGUO;

const PERMITIDOS = new Set(DOCUMENTOS_DE_PERSONA.map((t) => t.id));
/// Cedula de ciudadania: lo que trae casi toda fila.
const POR_DEFECTO = 1;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/// Excel copia con tabuladores; los .csv de por aqui
/// suelen venir con punto y coma por la coma decimal.
function partir(linea: string): string[] {
  const separador = linea.includes('\t') ? '\t' : linea.includes(';') ? ';' : ',';
  return linea.split(separador).map((c) => c.trim().replace(/^"|"$/g, ''));
}

/// Las posiciones del orden antiguo, para lo pegado sin encabezado.
const POR_POSICION: Columnas = ORDEN_ANTIGUO.reduce<Columnas>((m, campo, i) => {
  m[campo] = i;
  return m;
}, {});

export function analizar(texto: string): FilaAnalizada[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lineas.length === 0) return [];

  /// El encabezado decide QUÉ COLUMNA ES CADA CUAL. Sin él se lee el
  /// orden antiguo de ocho, que es lo que se pega a mano desde una hoja.
  const delEncabezado = columnasDelEncabezado(partir(lineas[0]));
  const columnas = delEncabezado ?? POR_POSICION;
  const desde = delEncabezado ? 1 : 0;

  return lineas.slice(desde).map((linea, i) => {
    const c = partir(linea);
    const problemas: string[] = [];
    /// Lo que no vino en el archivo es cadena vacía: así un campo que no
    /// existe se comporta igual que uno que vino en blanco.
    const dato = (campo: Campo): string => {
      const donde = columnas[campo];
      return donde === undefined ? '' : (c[donde] ?? '').trim();
    };
    /// Un problema por celda, y solo si la celda traía algo.
    const apuntar = (p: string | undefined) => {
      if (p) problemas.push(p);
    };

    const tipoTexto = dato('tipoDocumento');
    const reconocido = reconocerTipoDocumento(tipoTexto);
    const tipo = reconocido ?? POR_DEFECTO;
    if (tipoTexto && reconocido === null) {
      problemas.push(`«${tipoTexto}» no es un tipo de documento conocido; se asume C.C.`);
    } else if (reconocido !== null && !PERMITIDOS.has(reconocido)) {
      // tarjeta de identidad: un menor no entra
      problemas.push(`no se admite «${tipoTexto}» en esta formación`);
    }

    const numeroTexto = dato('numeroDocumento');
    const numero = normalizarDocumento(numeroTexto);
    if (!numero) problemas.push('falta el número de documento');
    else if (!documentoValido(tipo, numero)) {
      problemas.push(`«${numeroTexto}» no es válido para ${siglaDocumento(tipo)}`);
    }

    const primerNombre = dato('primerNombre');
    const primerApellido = dato('primerApellido');
    if (!primerNombre) problemas.push('falta el primer nombre');
    if (!primerApellido) problemas.push('falta el primer apellido');

    const correo = dato('correo').toLowerCase();
    if (correo && !CORREO.test(correo)) {
      problemas.push(`«${correo}» no parece un correo`);
    }

    const celular = aCelularGuardable(dato('celular')) as string;
    /// Aviso y no insalvable, igual que el correo: la fila se
    /// crea y el asesor lo corrige. Lo que no puede es contar
    /// como forma de contactar a nadie.
    if (celular && !celularValido(celular)) {
      problemas.push(`«${celular}» no parece un celular`);
    }

    if (!correo && !celularUtil(celular)) {
      problemas.push('sin correo ni celular no se podrá matricular');
    }

    const nacimiento = leerFechaDeNacimiento(dato('fechaNacimiento'));
    apuntar(nacimiento.problema);
    const genero = leerGenero(dato('genero'));
    apuntar(genero.problema);
    const vive = leerDondeVive(dato('departamento'), dato('municipio'));
    apuntar(vive.problema);
    const estrato = leerEstrato(dato('estrato'));
    apuntar(estrato.problema);
    const nivel = leerNivelOcupacional(dato('nivelOcupacional'));
    apuntar(nivel.problema);
    const beneficiario = leerSiNo(dato('beneficiarioPrevio'));
    apuntar(beneficiario.problema);

    const accionTexto = dato('accion');
    const accionCodigo = codigoDeAccion(accionTexto);
    if (accionTexto && !accionCodigo) {
      problemas.push(`«${accionTexto}» no dice de qué acción de formación es (falta su código, como «AF3»)`);
    }

    return {
      linea: i + desde + 1,
      tipoDocumentoSepId: tipo,
      numeroDocumento: numero ?? '',
      primerNombre,
      segundoNombre: dato('segundoNombre') || null,
      primerApellido,
      segundoApellido: dato('segundoApellido') || null,
      correo: correo || null,
      celular: celular || null,
      fechaNacimiento: nacimiento.iso,
      generoSepId: genero.id,
      departamentoSepId: vive.departamentoSepId,
      municipioSepId: vive.municipioSepId,
      barrio: dato('barrio') || null,
      direccion: dato('direccion') || null,
      estrato: estrato.valor,
      cargoEnEmpresa: dato('cargo') || null,
      nivelOcupacionalSepId: nivel.id,
      beneficiarioPrevio: beneficiario.valor,
      accionCodigo,
      accionTexto: accionTexto || null,
      problemas,
    };
  });
}

/** Las que no se pueden crear de ninguna manera. */
export function esInsalvable(f: FilaAnalizada): boolean {
  // el tipo no admitido tambien: avisarlo y crearla igual
  // dejaba entrar menores por la puerta de atras
  return (
    !f.numeroDocumento ||
    !f.primerNombre ||
    !f.primerApellido ||
    !PERMITIDOS.has(f.tipoDocumentoSepId)
  );
}

/** Documentos repetidos dentro del mismo pegado. */
export function repetidosEnElPegado(filas: FilaAnalizada[]): Set<string> {
  const vistos = new Set<string>();
  const repes = new Set<string>();
  for (const f of filas) {
    const clave = `${f.tipoDocumentoSepId}:${f.numeroDocumento}`;
    if (vistos.has(clave)) repes.add(clave);
    vistos.add(clave);
  }
  return repes;
}
