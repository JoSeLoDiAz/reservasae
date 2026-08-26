/** Cargar datos desde una plantilla de Excel. */

/// Las tres reglas que gobiernan esto, y por qué:
///
/// 1. SOLO .xlsx. Un .csv se abre en Excel con el separador
///    del sistema, y en Colombia eso parte «1.234,56» en dos
///    celdas. El .xlsx lleva los tipos dentro.
///
/// 2. SOBRESCRIBE, PERO DEJA HUELLA. Cargar es corregir en
///    masa, así que tiene que pisar lo que hay. Lo que no
///    puede es pisar sin dejar dicho quién, cuándo y qué:
///    cada campo tocado queda en la auditoría.
///
/// 3. UNA CELDA VACÍA NUNCA BORRA. Si el archivo trae una
///    celda en blanco, ese dato se queda como estaba: vacío
///    significa «esto no lo toque», no «bórrelo».
///
///    Es la regla que impide que alguien vacíe media base por
///    haber arrastrado mal una fórmula, o por subir el mismo
///    formato que descargó -- que viene con huecos, porque
///    los datos tienen huecos.
///
///    Se cuenta cuántas se saltaron y se dice: una regla que
///    protege en silencio es una regla que nadie sabe que
///    existe hasta que le sorprende.

import ExcelJS from 'exceljs';

/** Una columna de la plantilla. */
export type ColumnaPlantilla = {
  /// Como sale en la cabecera del Excel.
  titulo: string;
  /// El campo al que corresponde.
  clave: string;
  /// Sin ella la fila no se puede identificar.
  llave?: boolean;
  /// No se puede cargar: se muestra para orientar.
  soloLectura?: boolean;
  ancho?: number;
  ayuda?: string;
};

export type Plantilla = {
  nombre: string;
  columnas: ColumnaPlantilla[];
};

export type FilaLeida = {
  /// El número de fila en el Excel, para poder señalarla.
  fila: number;
  valores: Record<string, string>;
};

export type Reparo = {
  fila: number;
  columna: string;
  problema: string;
};

export type Lectura = {
  filas: FilaLeida[];
  reparos: Reparo[];
  /// Las columnas que traía el archivo, de las conocidas.
  columnasTraidas: string[];
  /// Celdas en blanco que se saltaron. No borraron nada.
  vacias: number;
};

const TOPE_FILAS = 5000;

/**
 * Lee un .xlsx contra una plantilla.
 *
 * No escribe nada: devuelve lo que trae y lo que está mal.
 * Quien llama decide si aplica. Separarlo permite enseñar
 * primero lo que va a pasar, que es lo que uno quiere ver
 * antes de dejar que algo pise dos mil filas.
 */
export async function leerPlantilla(
  archivo: Buffer,
  plantilla: Plantilla,
): Promise<Lectura> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(archivo as unknown as ArrayBuffer);

  const hoja = libro.worksheets[0];
  if (!hoja) {
    return {
      filas: [],
      reparos: [
        { fila: 0, columna: '', problema: 'El archivo no tiene ninguna hoja.' },
      ],
      columnasTraidas: [],
      vacias: 0,
    };
  }

  // la cabecera manda: se busca cada título, no se confía en
  // el orden. Quien reordena columnas en Excel no espera que
  // eso rompa nada
  const cabecera = hoja.getRow(1);
  const donde = new Map<string, number>();
  cabecera.eachCell((celda, n) => {
    const titulo = String(celda.value ?? '')
      .trim()
      .toLowerCase();
    const col = plantilla.columnas.find(
      (c) => c.titulo.toLowerCase() === titulo,
    );
    if (col && !col.soloLectura) donde.set(col.clave, n);
  });

  const columnasTraidas = [...donde.keys()];
  const reparos: Reparo[] = [];
  /// Cuántas celdas venían en blanco y no se tocaron.
  let vacias = 0;

  for (const k of plantilla.columnas.filter((c) => c.llave)) {
    if (!donde.has(k.clave)) {
      reparos.push({
        fila: 1,
        columna: k.titulo,
        problema: `Falta la columna «${k.titulo}», que es la que identifica cada fila.`,
      });
    }
  }
  if (reparos.length > 0) return { filas: [], reparos, columnasTraidas, vacias: 0 };

  const filas: FilaLeida[] = [];

  for (let n = 2; n <= hoja.rowCount && filas.length <= TOPE_FILAS; n += 1) {
    const fila = hoja.getRow(n);
    const valores: Record<string, string> = {};
    let algo = false;

    for (const [clave, col] of donde) {
      const texto = leerCelda(fila.getCell(col).value);
      valores[clave] = texto;
      if (texto !== '') algo = true;
    }

    // una fila entera en blanco es el final del archivo, no
    // un error: Excel guarda filas vacías por debajo sin avisar
    if (!algo) continue;

    /// Aquí vive la regla 3.
    ///
    /// Las celdas vacías se QUITAN de la fila. Lo que no
    /// viaja, no se escribe, y el dato que había se queda
    /// donde estaba. Borrar por descuido no se distingue de
    /// borrar a propósito, así que no se permite ninguno de
    /// los dos por esta vía.
    for (const clave of Object.keys(valores)) {
      if (valores[clave] === '') {
        delete valores[clave];
        vacias += 1;
      }
    }

    filas.push({ fila: n, valores });
  }

  if (filas.length > TOPE_FILAS) {
    reparos.push({
      fila: 0,
      columna: '',
      problema: `El archivo trae más de ${TOPE_FILAS} filas. Pártalo en varios.`,
    });
  }

  return { filas, reparos, columnasTraidas, vacias };
}

/// Excel devuelve números, fechas, fórmulas y enlaces. Todo
/// se lee como texto y se recorta: quien decide qué es cada
/// cosa es el que aplica, no el que lee.
function leerCelda(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);

  if (typeof v === 'object') {
    // una fórmula vale por su resultado, no por la fórmula
    if ('result' in v) return leerCelda(v.result as ExcelJS.CellValue);
    if ('text' in v) return String(v.text).trim();
    if ('richText' in v) {
      return (v.richText as Array<{ text: string }>)
        .map((t) => t.text)
        .join('')
        .trim();
    }
  }
  return String(v).trim();
}

/// Las reglas viajan DENTRO del archivo.
///
/// En un correo se leen una vez y se olvidan; en una hoja del
/// mismo libro siguen ahí el día que alguien reusa la
/// plantilla seis meses después.
const COMO_LLENARLO = [
  'CÓMO LLENAR ESTA PLANTILLA',
  '',
  '1. No cambie los títulos de la primera fila. Es por ahí que el sistema reconoce cada columna.',
  '2. Puede reordenar las columnas o quitar las que no vaya a corregir: solo se carga lo que venga.',
  '3. Una celda que deje en blanco NO borra el dato: se queda como estaba.',
  '   Si quiere corregir algo, escríbalo. Si quiere dejarlo como está, no lo toque.',
  '4. Las columnas en gris no se cargan. Están para que usted reconozca la fila.',
  '5. Lo que cargue reemplaza lo que había, y queda registrado quién lo hizo y cuándo.',
  '6. Guarde en formato .xlsx. No .csv, no .xls.',
];

/** El archivo que se descarga para llenar. */
export async function construirFormato(
  plantilla: Plantilla,
  filas?: Array<Record<string, unknown>>,
): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Convoca';
  libro.created = new Date();

  const hoja = libro.addWorksheet(plantilla.nombre.slice(0, 31));
  hoja.columns = plantilla.columnas.map((c) => ({
    header: c.titulo,
    key: c.clave,
    width: c.ancho ?? 22,
  }));

  const cabecera = hoja.getRow(1);
  cabecera.font = { bold: true };
  cabecera.alignment = { vertical: 'middle', wrapText: true };
  cabecera.height = 28;

  plantilla.columnas.forEach((c, i) => {
    const celda = cabecera.getCell(i + 1);
    celda.fill = {
      type: 'pattern',
      pattern: 'solid',
      // un gris para lo que no se carga, azul para lo que sí
      fgColor: { argb: c.soloLectura ? 'FFEDEDED' : 'FFD9E7FF' },
    };
    if (c.soloLectura) {
      celda.note = 'Esta columna NO se carga: está para que usted reconozca la fila.';
    } else if (c.ayuda) {
      celda.note = c.ayuda;
    }
    // todo como texto: sin esto Excel se come el cero de la
    // izquierda de un NIT y convierte las fechas a números
    hoja.getColumn(i + 1).numFmt = '@';
  });

  for (const fila of filas ?? []) hoja.addRow(fila);

  const guia = libro.addWorksheet('Cómo llenarlo');
  guia.columns = [{ width: 104 }];
  for (const linea of COMO_LLENARLO) guia.addRow([linea]);
  guia.getRow(1).font = { bold: true, size: 13 };

  return Buffer.from(await libro.xlsx.writeBuffer());
}
