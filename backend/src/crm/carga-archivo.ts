import { Readable } from 'node:stream';

import ExcelJS from 'exceljs';

import type { OrganizacionCruda } from './organizacion-de-carga';

/// tope de filas que se leen de un archivo
export const MAXIMO_FILAS_ARCHIVO = 5000;

/// 5 MB: una lista de nombres no pesa mas
export const MAXIMO_ARCHIVO_CARGA = 5 * 1024 * 1024;

/** El valor de una celda, ya como texto plano. */
export function textoDeCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object') {
    const o = valor as Record<string, unknown>;
    // texto con formato: se pegan los trozos
    if (Array.isArray(o.richText)) {
      // se recorta al final, NO por trozo: recortando cada uno
      // «Gómez» + « Rojas» sale pegado
      return o.richText
        .map((t) => String((t as Record<string, unknown>).text ?? ''))
        .join('')
        .trim();
    }
    // una formula vale por su resultado, no por la formula
    if ('result' in o) return textoDeCelda(o.result);
    if ('error' in o) return '';
    if (typeof o.text === 'string') return o.text.trim();
    if (typeof o.hyperlink === 'string') return o.hyperlink.trim();
    return '';
  }
  return String(valor).trim();
}

/// El nombre de la hoja de la organización, con o sin tilde.
const ES_HOJA_DE_ORGANIZACION = /organizaci[oó]n/i;

/// Los rótulos de la hoja «Organización», en su orden. Van en la
/// columna A y el dato en la B: una ficha de cinco renglones se llena
/// sin equivocarse de columna, y cinco columnas a lo ancho con una
/// sola fila se leían como una tabla a la que le faltan filas.
export const ROTULOS_DE_ORGANIZACION = [
  'NIT',
  'Razón social',
  'Nombre del jefe inmediato',
  'Cargo del jefe inmediato',
  'Correo del jefe inmediato',
] as const;

/// Sin tildes ni mayúsculas, para casar el rótulo aunque lo hayan
/// reescrito a mano.
function llano(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Los datos de la hoja «Organización», si el archivo la trae llena.
 *
 * Por el RÓTULO y no por la posición: si alguien borra un renglón o
 * los cambia de orden, el NIT sigue siendo el NIT. Null si no hay
 * hoja, si es un .csv (no tiene hojas) o si está en blanco --que es
 * como viene en la plantilla--: una hoja vacía no dice que la carga
 * sea de una organización.
 */
export async function organizacionDelArchivo(
  datos: Buffer,
  nombre: string,
): Promise<OrganizacionCruda | null> {
  if (!/\.xlsx$/i.test(nombre)) return null;
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(datos as unknown as ExcelJS.Buffer);
  const hoja = libro.worksheets.find((h) => ES_HOJA_DE_ORGANIZACION.test(h.name));
  if (!hoja) return null;

  const leida: OrganizacionCruda = {};
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    const rotulo = llano(textoDeCelda(fila.getCell(1).value));
    const valor = textoDeCelda(fila.getCell(2).value);
    if (!rotulo || !valor) return;
    if (rotulo === 'nit' || rotulo.startsWith('nit ')) leida.nit = valor;
    else if (rotulo.includes('razon social') || rotulo === 'nombre' || rotulo.includes('nombre de la organizacion')) {
      leida.razonSocial = valor;
    } else if (rotulo.includes('jefe') && rotulo.includes('nombre')) leida.jefeNombre = valor;
    else if (rotulo.includes('jefe') && rotulo.includes('cargo')) leida.jefeCargo = valor;
    else if (rotulo.includes('jefe') && rotulo.includes('correo')) leida.jefeCorreo = valor;
  });

  return Object.values(leida).some(Boolean) ? leida : null;
}

/** Un .xlsx o un .csv, vuelto el texto que se pegaria a mano. */
export async function textoDelArchivo(datos: Buffer, nombre: string): Promise<string> {
  const libro = new ExcelJS.Workbook();
  if (/\.csv$/i.test(nombre)) {
    // la marca de orden de Excel la quita exceljs: se probo
    // por mutacion y quitarla aqui no cambia nada
    await libro.csv.read(Readable.from(datos));
  } else {
    await libro.xlsx.load(datos as unknown as ExcelJS.Buffer);
  }

  /// La de participantes es la primera que NO es la de la organización.
  /// La plantilla trae «Organización» de segunda, pero quien reordena
  /// las pestañas en Excel no puede acabar importando el NIT y el
  /// jefe como si fueran personas.
  const hoja = libro.worksheets.find((h) => !ES_HOJA_DE_ORGANIZACION.test(h.name));
  if (!hoja) return '';

  const lineas: string[] = [];
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    if (lineas.length >= MAXIMO_FILAS_ARCHIVO) return;
    const celdas: string[] = [];
    fila.eachCell({ includeEmpty: true }, (celda) => {
      celdas.push(textoDeCelda(celda.value));
    });
    // las columnas van por posicion: se quitan las de la
    // derecha, nunca las de en medio
    const linea = celdas.join('\t').replace(/\t+$/, '');
    if (linea.trim()) lineas.push(linea);
  });

  return lineas.join('\n');
}
