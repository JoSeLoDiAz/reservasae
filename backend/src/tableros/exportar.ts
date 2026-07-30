import ExcelJS from 'exceljs';

/**
 * Generación de los .xlsx.
 *
 * Se usa `exceljs` y no un CSV disfrazado: quien recibe esto lo abre en Excel
 * y espera columnas con ancho, cabecera fija y números que sumen. Un CSV con
 * extensión .xls es justo lo que hace que se rompan los acentos y que las
 * cifras se lean como texto.
 */

type Columna = {
  titulo: string;
  clave: string;
  ancho?: number;
  /** Los números van como números, no como texto: así el Excel los suma. */
  numero?: boolean;
};

export async function construirLibro(
  hojas: Array<{ nombre: string; columnas: Columna[]; filas: Array<Record<string, unknown>> }>,
): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Convoca';
  libro.created = new Date();

  for (const definicion of hojas) {
    // Excel rechaza los nombres de hoja de más de 31 caracteres y los que
    // llevan : \ / ? * [ ]
    const hoja = libro.addWorksheet(definicion.nombre.replace(/[:\\/?*[\]]/g, '').slice(0, 31));

    hoja.columns = definicion.columnas.map((c) => ({
      header: c.titulo,
      key: c.clave,
      width: c.ancho ?? Math.max(12, Math.min(c.titulo.length + 4, 60)),
    }));

    hoja.addRows(definicion.filas);

    const cabecera = hoja.getRow(1);
    cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cabecera.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    cabecera.alignment = { vertical: 'middle' };
    cabecera.height = 22;

    // Fija la cabecera y activa los filtros: sin esto, una hoja de 2000 filas
    // es inmanejable.
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
    hoja.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: definicion.columnas.length },
    };

    for (const [indice, columna] of definicion.columnas.entries()) {
      if (columna.numero) {
        hoja.getColumn(indice + 1).numFmt = '#,##0';
        hoja.getColumn(indice + 1).alignment = { horizontal: 'right' };
      }
    }
  }

  // exceljs devuelve un ArrayBuffer aunque el tipo diga Buffer.
  return Buffer.from(await libro.xlsx.writeBuffer());
}

/** `reservas-2026-07-30.xlsx` */
export function nombreArchivo(base: string): string {
  return `${base}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
