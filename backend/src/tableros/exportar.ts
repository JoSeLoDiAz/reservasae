import ExcelJS from 'exceljs';
import type { Response } from 'express';

/** Genera los .xlsx con exceljs. */

export type FormatoColumna = 'texto' | 'entero' | 'miles' | 'fecha';

const NUM_FMT: Record<FormatoColumna, string> = {
  texto: '@',
  // sin separador de miles: una cedula no lleva puntos
  entero: '0',
  miles: '#,##0',
  fecha: 'dd/mm/yyyy',
};

type Columna = {
  titulo: string;
  clave: string;
  ancho?: number;
  /** Escribe la columna como número. Alias de `miles`. */
  numero?: boolean;
  formato?: FormatoColumna;
};

export type Hoja = {
  nombre: string;
  columnas: Columna[];
  filas: Array<Record<string, unknown>>;
  /**
   * Sin adornos: ni relleno, ni negrita, ni autofiltro.
   * Para las hojas que alguien va a pegar dentro de su
   * propia plantilla.
   */
  crudo?: boolean;
};

export async function construirLibro(hojas: Hoja[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Convoca';
  libro.created = new Date();

  for (const definicion of hojas) {
    // nombre válido para Excel
    const hoja = libro.addWorksheet(definicion.nombre.replace(/[:\\/?*[\]]/g, '').slice(0, 31));

    hoja.columns = definicion.columnas.map((c) => ({
      header: c.titulo,
      key: c.clave,
      width: c.ancho ?? Math.max(12, Math.min(c.titulo.length + 4, 60)),
    }));

    hoja.addRows(definicion.filas);

    const cabecera = hoja.getRow(1);
    if (!definicion.crudo) {
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
    }

    for (const [indice, columna] of definicion.columnas.entries()) {
      const formato: FormatoColumna | null = columna.formato
        ? columna.formato
        : columna.numero
          ? 'miles'
          : null;
      if (!formato) continue;

      const col = hoja.getColumn(indice + 1);
      col.numFmt = NUM_FMT[formato];
      if (formato !== 'texto' && formato !== 'fecha') {
        col.alignment = { horizontal: 'right' };
      }

      // una columna puede traer numero y texto a la vez:
      // el documento es numero en una cedula y texto en un
      // pasaporte. Manda el tipo del valor, no la columna
      if (formato === 'entero' || formato === 'miles') {
        col.eachCell({ includeEmpty: false }, (celda, fila) => {
          if (fila === 1) return;
          if (typeof celda.value === 'string') celda.numFmt = '@';
        });
      }
    }
  }

  // exceljs devuelve un ArrayBuffer
  return Buffer.from(await libro.xlsx.writeBuffer());
}

/** `reservas-2026-07-30.xlsx` */
export function nombreArchivo(base: string): string {
  return `${base}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}

/** Lo manda por navegación, con su nombre. */
export function enviarLibro(res: Response, libro: Buffer, base: string) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(base)}"`);
  res.send(libro);
}

/**
 * Medianoche UTC. exceljs convierte con getTime() sin
 * desplazar por zona, así que un Date con hora local sale
 * con el día cambiado en medio mundo.
 */
export function soloFecha(valor: Date | null | undefined): Date | null {
  if (!valor) return null;
  return new Date(
    Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()),
  );
}
