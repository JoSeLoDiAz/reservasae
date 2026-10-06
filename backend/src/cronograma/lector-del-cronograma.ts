/** El cronograma del proyecto, tal como lo lleva el cliente. */

/**
 * SE LEE EL EXCEL PORQUE ES DONDE SE DECIDE.
 *
 * El cronograma de ADECOPRIA vive en una hoja de cálculo que el cliente
 * mueve a mano, y es la que se negocia con el SENA. El CRM nunca lo ha
 * leído: derivaba el cierre de la fecha de inicio del grupo con una
 * regla fija. La regla es una buena aproximación y no es el cronograma
 * ---allí las distancias entre cierre y arranque van de 5 a 11 días---,
 * así que las dos cosas decían fechas distintas de lo mismo.
 *
 * LA FORMA DE LA HOJA, que es lo que hay que entender para tocar esto:
 *
 *   - Columnas A..O: quién es el grupo. Gremio, código de la acción,
 *     nombre, grupo/ciudad, horario, modalidad, #hrs, #días, meta.
 *   - Columna P en adelante: el calendario, UN DÍA POR COLUMNA. El mes
 *     va en la fila 2, el día de la semana en la 3 y el número en la 4.
 *   - Filas 5 en adelante: un grupo por fila.
 *
 * Y dentro de la fila, dos lenguajes a la vez:
 *
 *   - EL NÚMERO SON HORAS DE SESIÓN. 2 en las virtuales, 8 o 16 en las
 *     presenciales, 2 en el foro.
 *   - EL COLOR ES LA UNIDAD TEMÁTICA. Las virtuales llevan cinco
 *     colores seguidos: cinco unidades, 40 horas, 20 sesiones.
 *
 * Los colores con significado propio están en la leyenda de la hoja, en
 * C1..J3, y son los de abajo.
 *
 * CÓMO SE COMPRUEBA QUE LA LECTURA ES FIEL: las horas que se suman de
 * las celdas tienen que cuadrar con las que la fila declara en su
 * columna #HRS. Cuadran en los 28 grupos. Si un día dejan de cuadrar,
 * la hoja cambió de forma y esto hay que mirarlo, no parchearlo.
 */

import * as ExcelJS from 'exceljs';

/// Rojo: cierre de inscripciones. Es el que importa.
const ROJO = 'FFFF0000';
/// Magenta: lanzamiento de la campaña de mailing.
const MAGENTA = 'FFFF00FF';

const MESES: Record<string, number> = {
  ENERO: 1,
  FEBRERO: 2,
  MARZO: 3,
  ABRIL: 4,
  MAYO: 5,
  JUNIO: 6,
  JULIO: 7,
  AGOSTO: 8,
  SEPTIEMBRE: 9,
  OCTUBRE: 10,
  NOVIEMBRE: 11,
  DICIEMBRE: 12,
};

/// La primera fila de grupos y la primera columna del calendario.
const FILA_PRIMER_GRUPO = 5;
const COLUMNA_PRIMER_DIA = 16;

/// Dónde está cada dato en las columnas de identidad.
const COL = {
  gremio: 1,
  af: 2,
  nombre: 3,
  grupo: 4,
  horario: 6,
  evento: 9,
  modalidad: 10,
  horas: 13,
  dias: 14,
  meta: 15,
} as const;

/** Una unidad temática: un tramo de sesiones del mismo color. */
export type UnidadTematica = {
  numero: number;
  desde: string;
  hasta: string;
  sesiones: number;
  horas: number;
};

/** Una fila del cronograma, ya entendida. */
export type GrupoDelCronograma = {
  fila: number;
  gremio: string;
  /// El código de la acción tal como lo escribe la hoja: «AF1».
  af: string;
  nombre: string;
  /// «AF1.G1 Bogotá». De aquí sale el número de grupo.
  grupo: string;
  /// El número que lleva dentro del rótulo, o null si no se puede leer.
  numeroDeGrupo: number | null;
  modalidad: string;
  meta: number | null;
  horasDeclaradas: number | null;
  /// Sumadas de las celdas. Si no cuadra con la declarada, se avisa.
  horasContadas: number;
  sesiones: number;
  inicio: string | null;
  fin: string | null;
  cierreInscripciones: string | null;
  lanzamiento: string | null;
  unidades: UnidadTematica[];
};

export type LecturaDelCronograma = {
  hoja: string;
  grupos: GrupoDelCronograma[];
  /// Lo que no cuadra. Nunca tumba la lectura: se informa y se decide.
  avisos: string[];
};

const relleno = (c: ExcelJS.Cell): string | null => {
  const f = c.fill;
  if (!f || f.type !== 'pattern' || !f.fgColor) return null;
  return f.fgColor.argb ?? null;
};

const texto = (c: ExcelJS.Cell): string => (c.text ?? '').trim();

const numero = (c: ExcelJS.Cell): number | null => {
  const t = texto(c);
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * El número de grupo que lleva el rótulo.
 *
 * La hoja los escribe de varias formas ---«AF1.G1 Bogotá», «AF1.G3.
 * Antioquia», «AF3.G2 Medellín (Antioquia)»--- y lo único estable es
 * la G seguida de dígitos. Por eso no se parte por puntos ni por
 * espacios: se busca justo eso.
 */
export function numeroDeGrupo(rotulo: string): number | null {
  const m = /\bG\s*(\d+)/i.exec(rotulo);
  return m ? Number(m[1]) : null;
}

/**
 * Qué día es cada columna del calendario.
 *
 * El año no está escrito en ninguna parte de la cabecera: la hoja
 * cubre de septiembre a diciembre y se da por sabido. Por eso entra
 * como parámetro, y los meses de enero a marzo ---que aparecen en la
 * hoja de prórroga--- se entienden del año siguiente.
 */
function fechasDeLasColumnas(
  hoja: ExcelJS.Worksheet,
  anio: number,
): Map<number, string> {
  const fechas = new Map<number, string>();
  for (let c = COLUMNA_PRIMER_DIA; c <= hoja.columnCount; c++) {
    const nombreMes = texto(hoja.getRow(2).getCell(c)).toUpperCase();
    const mes = MESES[nombreMes];
    const dia = Number(texto(hoja.getRow(4).getCell(c)));
    if (!mes || !Number.isFinite(dia) || dia < 1) continue;
    /// La prórroga sigue en el año siguiente: los meses tempranos no
    /// pueden ser del mismo año que septiembre.
    const suyo = mes <= 3 ? anio + 1 : anio;
    fechas.set(
      c,
      `${suyo}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
    );
  }
  return fechas;
}

/**
 * Las columnas cuyo rojo es un hito del PROYECTO, no el cierre de nadie.
 *
 * Y es la trampa de esta hoja. Varias columnas de octubre están rojas
 * en la cabecera porque marcan hitos ---SUSCRIPCIÓN, PÓLIZA,
 * APROBACIONES, ENTIDAD CAPACITADORA---, y filtrar por «rojo en la
 * fila 3» se come los cierres reales del 13 y el 15 de octubre, que
 * caen justo ahí.
 *
 * El hito global de verdad pinta de rojo también la FILA 4, la de los
 * números del día, y solo lo hace el cierre del proyecto.
 */
function hitosGlobales(
  hoja: ExcelJS.Worksheet,
  fechas: Map<number, string>,
): Set<string> {
  const globales = new Set<string>();
  for (const [c, fecha] of fechas) {
    if (relleno(hoja.getRow(4).getCell(c)) === ROJO) globales.add(fecha);
  }
  return globales;
}

/** Lee una hoja del cronograma. */
export function leerCronograma(
  libro: ExcelJS.Workbook,
  nombreDeHoja: string,
  anio: number,
): LecturaDelCronograma {
  const hoja = libro.getWorksheet(nombreDeHoja);
  if (!hoja) {
    throw new Error(
      `El archivo no trae ninguna hoja «${nombreDeHoja}». ` +
        `Trae: ${libro.worksheets.map((h) => h.name).join(', ')}.`,
    );
  }

  const fechas = fechasDeLasColumnas(hoja, anio);
  const globales = hitosGlobales(hoja, fechas);
  const avisos: string[] = [];
  if (fechas.size === 0) {
    avisos.push(
      'No se reconoció ninguna fecha en la cabecera: se esperaba el mes ' +
        'en la fila 2 y el día en la fila 4, desde la columna P.',
    );
  }

  const grupos: GrupoDelCronograma[] = [];
  for (let f = FILA_PRIMER_GRUPO; f <= hoja.rowCount; f++) {
    const fila = hoja.getRow(f);
    const rotulo = texto(fila.getCell(COL.grupo));
    if (!rotulo) continue;

    const sesiones: Array<{
      fecha: string;
      horas: number;
      color: string | null;
    }> = [];
    let cierre: string | null = null;
    let lanzamiento: string | null = null;

    for (const [c, fecha] of fechas) {
      const celda = fila.getCell(c);
      const horas = numero(celda);
      const color = relleno(celda);
      if (horas !== null && horas > 0) {
        sesiones.push({ fecha, horas, color });
        continue;
      }
      /// Un color sin número es una marca, no una sesión.
      if (color === ROJO && !globales.has(fecha)) cierre ??= fecha;
      else if (color === MAGENTA) lanzamiento ??= fecha;
    }

    /// Las unidades son tramos SEGUIDOS del mismo color. Dos tramos del
    /// mismo color separados por otro son dos unidades, no una: es un
    /// repaso, y así lo cuenta quien lo dicta.
    const unidades: UnidadTematica[] = [];
    let anterior: string | null | undefined;
    for (const s of sesiones) {
      const ultima = unidades[unidades.length - 1];
      if (ultima && s.color === anterior) {
        ultima.hasta = s.fecha;
        ultima.sesiones++;
        ultima.horas += s.horas;
      } else {
        unidades.push({
          numero: unidades.length + 1,
          desde: s.fecha,
          hasta: s.fecha,
          sesiones: 1,
          horas: s.horas,
        });
      }
      anterior = s.color;
    }

    const horasContadas = sesiones.reduce((t, s) => t + s.horas, 0);
    const horasDeclaradas = numero(fila.getCell(COL.horas));
    if (horasDeclaradas !== null && horasContadas !== horasDeclaradas) {
      avisos.push(
        `${rotulo}: la hoja declara ${horasDeclaradas} horas y las celdas ` +
          `suman ${horasContadas}. Se leyó lo que dicen las celdas.`,
      );
    }

    grupos.push({
      fila: f,
      gremio: texto(fila.getCell(COL.gremio)),
      af: texto(fila.getCell(COL.af)),
      nombre: texto(fila.getCell(COL.nombre)),
      grupo: rotulo,
      numeroDeGrupo: numeroDeGrupo(rotulo),
      modalidad: texto(fila.getCell(COL.modalidad)),
      meta: numero(fila.getCell(COL.meta)),
      horasDeclaradas,
      horasContadas,
      sesiones: sesiones.length,
      inicio: sesiones[0]?.fecha ?? null,
      fin: sesiones[sesiones.length - 1]?.fecha ?? null,
      cierreInscripciones: cierre,
      lanzamiento,
      unidades,
    });
  }

  if (grupos.length === 0) {
    avisos.push(
      'No se encontró ningún grupo: se esperaba el rótulo del grupo en la ' +
        'columna D, desde la fila 5.',
    );
  }

  return { hoja: nombreDeHoja, grupos, avisos };
}

/** Las hojas de cronograma que trae el libro. */
export function hojasDeCronograma(libro: ExcelJS.Workbook): string[] {
  return libro.worksheets
    .map((h) => h.name)
    .filter((n) => n.toUpperCase().startsWith('CRONOGRAMA'));
}
