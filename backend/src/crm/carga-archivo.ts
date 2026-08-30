import { Readable } from 'node:stream';

import ExcelJS from 'exceljs';

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

  const hoja = libro.worksheets[0];
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
