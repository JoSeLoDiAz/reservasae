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
  /**
   * Relleno propio de la cabecera de ESTA columna (ARGB).
   *
   * Existe porque hay hojas donde un BLOQUE de columnas tiene que
   * distinguirse del resto --«de un color lo que entró, de otro lo
   * que se inscribió» (cliente, 30 sep 2026)-- y el color del
   * bloque es de las columnas, no de la hoja. Sin esto habría que
   * pintar la cabecera a mano después de `construirLibro`, o sea
   * tener dos sitios donde se decide cómo se ve una cabecera.
   */
  relleno?: string;
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
  /**
   * La cabecera a medida, cuando la hoja tiene que salir igual que
   * un fichero que entregó el cliente.
   *
   * Sin esto, toda descarga de la casa sale con el azul de marca y
   * Calibri, que es lo que se quiere en las hojas nuestras. La hoja
   * «Por organización» no es nuestra: se coteja columna por columna
   * contra la que él entregó, y el color y la tipografía son lo
   * primero que se ve distinto (30 sep 2026).
   */
  cabecera?: {
    /** ARGB. Por omisión, el azul de marca. */
    relleno?: string;
    fuente?: string;
    tamano?: number;
    alto?: number;
  };
  /** La misma tipografía para las filas de datos. Ver `cabecera`. */
  cuerpo?: { fuente?: string; tamano?: number };
  /**
   * Cuántas columnas quedan congeladas a la izquierda.
   *
   * Con veintiuna columnas, al desplazarse a las últimas se pierde
   * de vista de quién es la fila que se está mirando.
   */
  congelarColumnas?: number;
  /**
   * El ancho de las columnas que no declaran el suyo.
   *
   * HACE FALTA POR UN DETALLE DE exceljs: el ancho 9 es su propio
   * valor por omisión, así que lo DESCARTA al escribir el fichero
   * --no sale ningún `<col>`-- y entonces Excel usa el suyo, que es
   * 8,43. Las trece columnas AF del modelo del cliente, que van a 9,
   * salían todas un poco más estrechas que en su hoja. Declarándolo
   * aquí, el 9 viaja en la hoja y las columnas descartadas salen con
   * él (30 sep 2026).
   */
  anchoPorOmision?: number;
};

export async function construirLibro(hojas: Hoja[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Convoca CRM';
  libro.created = new Date();

  for (const definicion of hojas) {
    // nombre válido para Excel
    const hoja = libro.addWorksheet(
      definicion.nombre.replace(/[:\\/?*[\]]/g, '').slice(0, 31),
      definicion.anchoPorOmision
        ? { properties: { defaultColWidth: definicion.anchoPorOmision } }
        : undefined,
    );

    hoja.columns = definicion.columnas.map((c) => ({
      header: c.titulo,
      key: c.clave,
      width: c.ancho ?? Math.max(12, Math.min(c.titulo.length + 4, 60)),
    }));

    hoja.addRows(definicion.filas);

    /**
     * El cuerpo se viste ANTES que la cabecera, y el orden importa:
     * exceljs aplica el estilo de una fila celda por celda, así que
     * hacerlo después --o ponerlo en la columna, que alcanza a la
     * fila 1-- le quitaría a la cabecera su negrita y su blanco.
     */
    const cuerpo = definicion.cuerpo;
    if (cuerpo) {
      hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
        if (numero === 1) return;
        fila.font = {
          ...(cuerpo.fuente ? { name: cuerpo.fuente } : {}),
          ...(cuerpo.tamano ? { size: cuerpo.tamano } : {}),
        };
        fila.alignment = { vertical: 'middle', wrapText: true };
      });
    }

    const cabecera = hoja.getRow(1);
    if (!definicion.crudo) {
      const estilo = definicion.cabecera;
      cabecera.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        ...(estilo?.fuente ? { name: estilo.fuente } : {}),
        ...(estilo?.tamano ? { size: estilo.tamano } : {}),
      };
      cabecera.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: estilo?.relleno ?? 'FF1E3A8A' },
      };
      // centrada y con los rótulos partidos solo cuando la hoja pide
      // cabecera a medida: las demás descargas se quedan como estaban
      cabecera.alignment = estilo
        ? { horizontal: 'center', vertical: 'middle', wrapText: true }
        : { vertical: 'middle' };
      cabecera.height = estilo?.alto ?? 22;

      // El color del BLOQUE, encima del de la hoja: va después para
      // que gane, y celda por celda porque es de unas columnas y no
      // de todas.
      for (const [indice, columna] of definicion.columnas.entries()) {
        if (!columna.relleno) continue;
        cabecera.getCell(indice + 1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: columna.relleno },
        };
      }

      // cabecera fija y autofiltro
      hoja.views = [
        {
          state: 'frozen',
          ySplit: 1,
          ...(definicion.congelarColumnas
            ? { xSplit: definicion.congelarColumnas }
            : {}),
        },
      ];
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
