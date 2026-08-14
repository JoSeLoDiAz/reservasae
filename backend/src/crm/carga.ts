/** Analiza lo que el asesor pega desde Excel. */

import { TipoDocumento } from '../../generated/prisma';
import { documentoValido, normalizarDocumento } from '../comun/documento';

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
  tipoDocumento: TipoDocumento;
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

const TIPOS = new Set<string>(Object.values(TipoDocumento));
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/// Excel copia con tabuladores; los .csv de por aqui
/// suelen venir con punto y coma por la coma decimal.
function partir(linea: string): string[] {
  const separador = linea.includes('\t') ? '\t' : linea.includes(';') ? ';' : ',';
  return linea.split(separador).map((c) => c.trim().replace(/^"|"$/g, ''));
}

/// Se salta la fila de titulos si la trae.
function esEncabezado(celdas: string[]): boolean {
  const primera = (celdas[0] ?? '').toLowerCase();
  return (
    primera.includes('tipo') ||
    primera.includes('documento') ||
    primera.includes('cedula') ||
    primera.includes('cédula')
  );
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

    const tipoBruto = (c[0] ?? '').toUpperCase().replace(/[.\s]/g, '');
    const tipo: TipoDocumento = TIPOS.has(tipoBruto)
      ? (tipoBruto as TipoDocumento)
      : 'CC';
    if (c[0] && !TIPOS.has(tipoBruto)) {
      problemas.push(`«${c[0]}» no es un tipo de documento conocido; se asume CC`);
    }

    const numero = normalizarDocumento(c[1] ?? '');
    if (!numero) problemas.push('falta el número de documento');
    else if (!documentoValido(tipo, numero)) {
      problemas.push(`«${c[1]}» no es válido para ${tipo}`);
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
      tipoDocumento: tipo,
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
  return !f.numeroDocumento || !f.primerNombre || !f.primerApellido;
}

/** Documentos repetidos dentro del mismo pegado. */
export function repetidosEnElPegado(filas: FilaAnalizada[]): Set<string> {
  const vistos = new Set<string>();
  const repes = new Set<string>();
  for (const f of filas) {
    const clave = `${f.tipoDocumento}:${f.numeroDocumento}`;
    if (vistos.has(clave)) repes.add(clave);
    vistos.add(clave);
  }
  return repes;
}
