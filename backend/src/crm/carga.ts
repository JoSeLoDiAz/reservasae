/** Analiza lo que el asesor pega desde Excel. */

import { documentoValido, normalizarDocumento } from '../comun/documento';
import {
  DOCUMENTOS_DE_PERSONA,
  reconocerTipoDocumento,
  siglaDocumento,
} from './catalogos-sep';

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
  problemas: string[];
};

export const COLUMNAS = [
  'tipoDocumento',
  'numeroDocumento',
  'primerNombre',
  'segundoNombre',
  'primerApellido',
  'segundoApellido',
  'correo',
  'celular',
] as const;

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

/// Se salta la fila de titulos si la trae. Mira tambien
/// la segunda celda: un titulo no lleva un documento al
/// lado, y sin eso una fila con "Cedula" en la primera
/// columna se perderia en silencio.
function esEncabezado(celdas: string[]): boolean {
  const primera = (celdas[0] ?? '').toLowerCase();
  const suena =
    primera.includes('tipo') ||
    primera.includes('documento') ||
    primera.includes('cedula') ||
    primera.includes('cédula') ||
    primera.includes('identificacion') ||
    primera.includes('identificación');

  if (!suena) return false;

  const segunda = (celdas[1] ?? '').replace(/[\s.\-_]/g, '');
  return !/^\d{4,}$/.test(segunda);
}

export function analizar(texto: string): FilaAnalizada[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lineas.length === 0) return [];

  const primeras = partir(lineas[0]);
  const desde = esEncabezado(primeras) ? 1 : 0;

  return lineas.slice(desde).map((linea, i) => {
    const c = partir(linea);
    const problemas: string[] = [];

    const reconocido = reconocerTipoDocumento(c[0] ?? '');
    const tipo = reconocido ?? POR_DEFECTO;
    if (c[0] && reconocido === null) {
      problemas.push(`«${c[0]}» no es un tipo de documento conocido; se asume C.C.`);
    } else if (reconocido !== null && !PERMITIDOS.has(reconocido)) {
      // tarjeta de identidad: un menor no entra
      problemas.push(`no se admite «${c[0]}» en esta formación`);
    }

    const numero = normalizarDocumento(c[1] ?? '');
    if (!numero) problemas.push('falta el número de documento');
    else if (!documentoValido(tipo, numero)) {
      problemas.push(`«${c[1]}» no es válido para ${siglaDocumento(tipo)}`);
    }

    const primerNombre = (c[2] ?? '').trim();
    const primerApellido = (c[4] ?? '').trim();
    if (!primerNombre) problemas.push('falta el primer nombre');
    if (!primerApellido) problemas.push('falta el primer apellido');

    const correo = (c[6] ?? '').trim().toLowerCase();
    if (correo && !CORREO.test(correo)) {
      problemas.push(`«${correo}» no parece un correo`);
    }

    const celular = (c[7] ?? '').replace(/[\s()-]/g, '').trim();

    if (!correo && !celular) {
      problemas.push('sin correo ni celular no se podrá matricular');
    }

    return {
      linea: i + desde + 1,
      tipoDocumentoSepId: tipo,
      numeroDocumento: numero ?? '',
      primerNombre,
      segundoNombre: (c[3] ?? '').trim() || null,
      primerApellido,
      segundoApellido: (c[5] ?? '').trim() || null,
      correo: correo || null,
      celular: celular || null,
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
