/** Leer el .xlsx de la BBDD de leads, sin interpretarlo todavía. */

/**
 * Esto NO decide nada: devuelve lo que trae el archivo y lo que no
 * se entendió. Quien decide si una fila sirve es `llaveDelLead`, y
 * quien decide si se escribe es el servicio. Separarlo es lo que
 * permite enseñar primero lo que va a pasar ---la vista previa que
 * el cliente pidió--- sin tener dos lectores, uno para ensayar y
 * otro para aplicar.
 *
 * SOLO .xlsx, y es la misma razón que ya está escrita en
 * `plantillas.ts`: un .csv se abre en Excel con el separador del
 * sistema y en Colombia eso parte «1.234,56» en dos celdas. Con
 * una base de leads el daño es peor: parte un celular.
 *
 * LA CABECERA SE BUSCA, no se supone en la fila 1. La hoja del
 * cliente no es una plantilla nuestra: lleva meses creciendo a mano
 * y arriba tiene un título, o una fila en blanco, o el logo del
 * gremio. Exigir la fila 1 convertiría «tengo la base ahí» en «la
 * base no se lee», y el cliente no tiene por qué rehacer su
 * archivo. Se mira entre las primeras filas y se queda la que
 * reconoce MÁS columnas: es lo único que distingue una cabecera de
 * verdad de un título que casualmente dice «Nombre».
 */

import ExcelJS from 'exceljs';

/// Los tres IMPORTADOS y no copiados: el tope de filas y el de
/// peso son del sistema, no de este cargue, y dos topes distintos
/// para lo mismo acaban discrepando el día que alguien suba uno.
import {
  MAXIMO_ARCHIVO_CARGA,
  MAXIMO_FILAS_ARCHIVO,
  textoDeCelda,
} from '../../crm/carga-archivo';

import {
  COLUMNAS_DEL_CARGUE,
  columnaDelRotulo,
  type ClaveDeColumna,
} from './columnas-del-cargue';

export { MAXIMO_ARCHIVO_CARGA, MAXIMO_FILAS_ARCHIVO };

/// Hasta dónde se busca la cabecera. Diez filas cubren un título,
/// un subtítulo, un par de blancos y la fecha de corte que la
/// gente pone arriba; más abajo ya no es una cabecera, es que el
/// archivo no tiene ninguna.
const HASTA_DONDE_SE_BUSCA_LA_CABECERA = 10;

/**
 * Cuántas columnas reconocidas hacen de una fila una cabecera.
 *
 * EN LA FILA 1 BASTA UNA, Y MÁS ABAJO HACEN FALTA DOS. No es una
 * concesión: son dos situaciones distintas.
 *
 * En la fila 1, una columna reconocida es una cabecera de una
 * columna, y existen ---el cliente puede mandar una lista de solo
 * celulares, y ese archivo tiene que cargarse: es el caso más «no
 * restrictivo» de todos---. Exigir dos lo rechazaría entero
 * diciendo que no encuentra los títulos, que es un mensaje
 * incomprensible delante de un archivo que SÍ los tiene.
 *
 * Más abajo, una sola coincidencia es casi siempre un título que
 * casualmente dice «Nombre» o «Contacto». Ahí sí hace falta la
 * segunda para no leer el título como si fuera una persona.
 */
function minimoParaSerCabecera(fila: number): number {
  return fila === 1 ? 1 : 2;
}

export type FilaCruda = {
  /// El número de fila EN EL EXCEL, para poder señalarla.
  ///
  /// No el índice dentro de las filas que entraron: el cliente
  /// busca «la 147» en su archivo, y si se le dice «la 103»
  /// porque arriba había 44 vacías, no la encuentra.
  fila: number;
  valores: Partial<Record<ClaveDeColumna, string>>;
};

export type ReparoDelCargue = {
  /// 0 cuando el reparo es del archivo entero y no de una fila.
  fila: number;
  problema: string;
};

export type LecturaDelCargue = {
  filas: FilaCruda[];
  /// En qué fila del Excel estaba la cabecera, para poder decirlo.
  filaDeLaCabecera: number;
  /// Las columnas conocidas que el archivo trajo.
  columnasTraidas: ClaveDeColumna[];
  /// Los rótulos que venían y no se reconocen. NO son un error:
  /// se dicen para que el cliente vea que ese dato no se cargó, y
  /// no lo descubra meses después mirando una ficha vacía.
  columnasQueNoSeReconocen: string[];
  reparos: ReparoDelCargue[];
};

const VACIA: Omit<LecturaDelCargue, 'reparos'> = {
  filas: [],
  filaDeLaCabecera: 0,
  columnasTraidas: [],
  columnasQueNoSeReconocen: [],
};

/** Lee el archivo. No lanza por el contenido: lo reporta. */
export async function leerElCargue(
  datos: Buffer,
  nombre: string,
): Promise<LecturaDelCargue> {
  if (!/\.xlsx$/i.test(nombre)) {
    return {
      ...VACIA,
      reparos: [
        {
          fila: 0,
          problema:
            'Solo se admite .xlsx. Si lo tiene en .csv o en .xls, ábralo en ' +
            'Excel y guárdelo como «Libro de Excel (.xlsx)»: en .csv el ' +
            'separador del sistema puede partirle un celular en dos celdas.',
        },
      ],
    };
  }

  if (datos.length > MAXIMO_ARCHIVO_CARGA) {
    return {
      ...VACIA,
      reparos: [
        {
          fila: 0,
          problema:
            `El archivo pesa más de ${Math.round(MAXIMO_ARCHIVO_CARGA / (1024 * 1024))} MB. ` +
            'Una lista de leads no pesa tanto: lo que pesa son las imágenes ' +
            'o las hojas de cálculo pegadas dentro. Pártalo o guárdelo limpio.',
        },
      ],
    };
  }

  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(datos as unknown as ExcelJS.Buffer);
  } catch {
    /// Un .xlsx que no se abre no es un 500: casi siempre es un
    /// .xls renombrado a mano, o un archivo a medio descargar de
    /// Drive. Decirlo así es lo que permite arreglarlo sin
    /// escribirle a nadie.
    return {
      ...VACIA,
      reparos: [
        {
          fila: 0,
          problema:
            'El archivo no se puede abrir como .xlsx. Suele pasar cuando es ' +
            'un .xls al que le cambiaron el nombre, o cuando la descarga se ' +
            'cortó. Ábralo en Excel y vuelva a guardarlo como .xlsx.',
        },
      ],
    };
  }

  /// La PRIMERA hoja y no todas: una base de leads tiene una hoja
  /// de leads y, a veces, hojas de cuentas aparte. Recorrerlas
  /// todas cargaría como personas lo que no lo es.
  const hoja = libro.worksheets[0];
  if (!hoja) {
    return {
      ...VACIA,
      reparos: [{ fila: 0, problema: 'El archivo no tiene ninguna hoja.' }],
    };
  }

  const cabecera = buscarLaCabecera(hoja);
  if (!cabecera) {
    return {
      ...VACIA,
      reparos: [
        {
          fila: 0,
          problema:
            'No se encontró la fila de títulos. Se buscó en las primeras ' +
            `${HASTA_DONDE_SE_BUSCA_LA_CABECERA} filas y ninguna trae columnas ` +
            'reconocibles. Baje la plantilla, pegue sus datos debajo de los ' +
            'títulos y vuelva a subirla.',
        },
      ],
    };
  }

  const reparos: ReparoDelCargue[] = [];
  const filas: FilaCruda[] = [];
  /// Se cuentan las que había DE MÁS, para poder decir cuántas se
  /// quedaron fuera. «Hay más de 5000» no dice si sobraban tres o
  /// tres mil, y de eso depende si se parte el archivo en dos o
  /// en veinte.
  let sobrantes = 0;

  for (let n = cabecera.fila + 1; n <= hoja.rowCount; n += 1) {
    const fila = hoja.getRow(n);
    const valores: Partial<Record<ClaveDeColumna, string>> = {};
    let algo = false;

    for (const [clave, columna] of cabecera.donde) {
      const texto = textoDeCelda(fila.getCell(columna).value);
      if (texto === '') continue;
      valores[clave] = texto;
      algo = true;
    }

    /// Una fila entera en blanco NO es un error: Excel guarda
    /// filas vacías por debajo de los datos sin avisar, y
    /// reportarlas llenaría el informe de cientos de reparos que
    /// no son de nadie. Se salta en silencio, igual que en
    /// `leerPlantilla`.
    if (!algo) continue;

    if (filas.length >= MAXIMO_FILAS_ARCHIVO) {
      sobrantes += 1;
      continue;
    }
    filas.push({ fila: n, valores });
  }

  if (sobrantes > 0) {
    reparos.push({
      fila: 0,
      problema:
        `El archivo trae ${filas.length + sobrantes} filas con datos y el tope es ` +
        `${MAXIMO_FILAS_ARCHIVO}. Se leyeron las primeras ${MAXIMO_FILAS_ARCHIVO} y ` +
        `quedaron ${sobrantes} fuera. Pártalo y suba el resto en otro cargue: ` +
        'el cargue es idempotente, así que repetir las que ya entraron no las duplica.',
    });
  }

  if (filas.length === 0) {
    reparos.push({
      fila: 0,
      problema:
        `Se encontraron los títulos en la fila ${cabecera.fila}, pero debajo no ` +
        'hay ninguna fila con datos.',
    });
  }

  return {
    filas,
    filaDeLaCabecera: cabecera.fila,
    columnasTraidas: [...cabecera.donde.keys()],
    columnasQueNoSeReconocen: cabecera.sinReconocer,
    reparos,
  };
}

type Cabecera = {
  fila: number;
  /// Clave de columna -> número de columna en el Excel.
  donde: Map<ClaveDeColumna, number>;
  sinReconocer: string[];
};

/**
 * La fila de títulos: la que reconoce más columnas.
 *
 * Se queda con la MEJOR y no con la primera que reconozca algo. Un
 * archivo cuyo título es «BASE DE DATOS LEADS ADECOPRIA - CELULAR
 * 3001112222 PARA DUDAS» reconocería «celular» en la fila 1, y
 * entonces la cabecera de verdad ---la fila 3, con nueve
 * columnas--- se leería como un lead llamado «Nombres».
 *
 * Y la primera columna gana si dos rótulos casan con la misma
 * clave. El archivo del cliente trae «Celular» y «Celular 2»: el
 * segundo normaliza igual que ningún alias, así que no entra, pero
 * si entrara pisaría al primero y se cargaría el número de
 * respaldo como si fuera el principal.
 */
function buscarLaCabecera(hoja: ExcelJS.Worksheet): Cabecera | null {
  let mejor: Cabecera | null = null;
  const hasta = Math.min(HASTA_DONDE_SE_BUSCA_LA_CABECERA, hoja.rowCount);

  for (let n = 1; n <= hasta; n += 1) {
    const fila = hoja.getRow(n);
    const donde = new Map<ClaveDeColumna, number>();
    const sinReconocer: string[] = [];

    fila.eachCell({ includeEmpty: false }, (celda, columna) => {
      const rotulo = textoDeCelda(celda.value);
      if (!rotulo) return;
      const cual = columnaDelRotulo(rotulo);
      if (!cual) {
        sinReconocer.push(rotulo);
        return;
      }
      /// La primera gana: ver el comentario de arriba.
      if (!donde.has(cual.clave)) donde.set(cual.clave, columna);
    });

    if (donde.size < minimoParaSerCabecera(n)) continue;
    if (!mejor || donde.size > mejor.donde.size) {
      mejor = { fila: n, donde, sinReconocer };
    }
  }

  return mejor;
}

/** Los rótulos oficiales, para poder decirlos en un error. */
export function rotulosQueSeEsperan(): string[] {
  return COLUMNAS_DEL_CARGUE.map((c) => c.titulo);
}
