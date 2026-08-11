import ExcelJS from 'exceljs';

/** Genera los .xlsx. Con exceljs, no un CSV disfrazado. */

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
    // Excel: 31 caracteres y sin : \ / ? * [ ]
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

    // cabecera fija y autofiltro
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
