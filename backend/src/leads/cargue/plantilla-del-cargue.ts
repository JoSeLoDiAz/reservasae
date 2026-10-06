/** El .xlsx que se baja para llenar la BBDD de leads. */

/**
 * POR QUÉ NO SE USA `construirFormato` DE `src/plantillas/**`.
 *
 * Se leyó, y hace casi todo esto: cabecera en negrita, notas en las
 * celdas, todo en formato texto para que Excel no se coma el cero
 * de la izquierda, y una hoja «Cómo llenarlo» aparte. Reutilizarla
 * era la primera idea.
 *
 * Lo que no se puede reutilizar es su hoja de instrucciones, y no
 * es un detalle de redacción: dice «Lo que cargue reemplaza lo que
 * había» y «Una celda que deje en blanco NO borra el dato». La
 * primera frase es FALSA aquí ---este cargue no reemplaza nada: lo
 * vacío se rellena y lo distinto se deja constancia y no se pisa---
 * y la segunda es verdad por un motivo distinto. Mandarle al
 * cliente un archivo que le promete que su cargue va a sobrescribir
 * la base es peor que no mandarle instrucciones: va a subir el
 * archivo creyendo que corrige, y lo que hace es dejar avisos.
 *
 * Y la plantilla de empresas exige una columna llave. Esta no exige
 * ninguna, que es el punto del encargo. Una plantilla que no se
 * puede explicar con las reglas de la otra no es la otra.
 *
 * Así que se construye aquí, con las reglas de aquí dentro del
 * archivo. Las reglas viajan DENTRO ---esa parte sí se copia, y es
 * de las mejores decisiones de aquel módulo---: en un correo se
 * leen una vez y se olvidan; en una hoja del mismo libro siguen ahí
 * el día que alguien reusa la plantilla seis meses después.
 */

import ExcelJS from 'exceljs';

import {
  COLUMNAS_DEL_CARGUE,
  type ColumnaDelCargue,
} from './columnas-del-cargue';
import { MAXIMO_FILAS_ARCHIVO } from './lector-del-cargue';

const COMO_LLENARLA = [
  'CÓMO LLENAR ESTA PLANTILLA',
  '',
  'NO HACE FALTA QUE TENGA TODOS LOS DATOS. Esa es la idea de este cargue.',
  '',
  '1. Basta UNO de estos cuatro para que la persona entre: correo, celular,',
  '   número de documento o nombre. Lo demás puede ir vacío.',
  '2. Si una fila no trae ninguno de los cuatro, no se puede guardar sin',
  '   duplicarla al recargar el archivo. Esa fila se le reporta con su número',
  '   y las demás entran igual: una fila mala no tumba el cargue.',
  '3. Puede quitar las columnas que no tenga, y puede cambiarlas de orden. Se',
  '   reconocen por el título, no por la posición.',
  '4. Puede dejar sus propios títulos si se parecen («CELULAR / WhatsApp»,',
  '   «Nro documento»). Lo que no se reconozca se le dice en el informe.',
  '5. Puede tener filas de título encima: la fila de los rótulos se busca.',
  '',
  'QUÉ PASA CON LOS REPETIDOS',
  '',
  '6. Si la persona ya está en la mesa de entrada de este gremio —se cruza por',
  '   documento, por correo o por celular— NO se crea otra vez.',
  '7. Lo que en el lead guardado esté VACÍO se rellena con lo de su archivo.',
  '8. Lo que esté DISTINTO no se pisa: queda una nota de gestión en ese lead',
  '   con los dos valores, igual que cuando la persona vuelve a llenar el',
  '   formulario. Decide el asesor, no el archivo.',
  '',
  'ANTES DE ESCRIBIR, SE ENSEÑA',
  '',
  '9. El cargue tiene dos pasos. El primero no escribe nada: dice cuántas',
  '   entrarían nuevas, cuántas ya están, qué se rellenaría y qué choca. El',
  '   segundo aplica. Nadie debería descubrir lo que hizo un cargue después',
  '   de hacerlo.',
  '',
  'LO DE SIEMPRE',
  '',
  `10. Guarde en .xlsx. No .csv, no .xls. En .csv el separador del sistema`,
  '    puede partirle un celular en dos celdas.',
  `11. El tope es ${MAXIMO_FILAS_ARCHIVO} filas por archivo. Si tiene más, pártalo: repetir`,
  '    las que ya entraron no las duplica.',
  '12. Los leads que entren por aquí quedan PENDIENTES en la mesa de entrada,',
  '    marcados como cargue del equipo, para que no se mezclen con los de la',
  '    pauta pagada.',
];

/** La plantilla, con una fila de ejemplo. */
export async function construirPlantillaDelCargue(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Convoca CRM';
  libro.created = new Date();

  /// El nombre de la hoja es el que pidió el cliente para la
  /// pantalla, recortado a los 31 caracteres que admite Excel.
  const hoja = libro.addWorksheet('BBDD Leads'.slice(0, 31));
  hoja.columns = COLUMNAS_DEL_CARGUE.map((c) => ({
    header: c.titulo,
    key: c.clave,
    width: c.ancho,
  }));

  const cabecera = hoja.getRow(1);
  cabecera.font = { bold: true };
  cabecera.alignment = { vertical: 'middle', wrapText: true };
  cabecera.height = 30;

  COLUMNAS_DEL_CARGUE.forEach((c: ColumnaDelCargue, i: number) => {
    const celda = cabecera.getCell(i + 1);
    /// Todas del mismo color, y eso dice algo: en la plantilla de
    /// empresas el gris marca lo que no se carga y el azul lo que
    /// sí. Aquí se cargan todas y ninguna es obligatoria, así que
    /// dos colores inventarían una jerarquía que no existe.
    celda.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E7FF' },
    };
    celda.note = c.ayuda;

    /// TODO como texto, y esto no es cosmético: sin el formato
    /// texto Excel convierte «3001112222» en notación científica y
    /// se come el cero de la izquierda de una cédula que empiece
    /// por cero. Un documento con un dígito menos es otra persona.
    hoja.getColumn(i + 1).numFmt = '@';
  });

  /// Una fila de ejemplo, y SOLO una.
  ///
  /// Con el ejemplo dentro nadie pregunta si el celular va con el
  /// +57 ni si el curso va por código o por nombre. Con varias,
  /// alguien las deja ahí y se cargan tres personas inventadas: es
  /// el caso que hay que evitar, no el de que falte el ejemplo.
  const ejemplo = hoja.addRow(
    Object.fromEntries(COLUMNAS_DEL_CARGUE.map((c) => [c.clave, c.ejemplo])),
  );
  ejemplo.font = { italic: true, color: { argb: 'FF888888' } };
  /// Dicho DENTRO de la fila y no solo en las instrucciones: quien
  /// pega sus datos encima de ella no va a abrir la otra hoja.
  ejemplo.getCell(1).note =
    'Esta fila es un ejemplo. Bórrela antes de subir el archivo, o se ' +
    'cargará como si fuera una persona.';

  const guia = libro.addWorksheet('Cómo llenarla');
  guia.columns = [{ width: 100 }];
  for (const linea of COMO_LLENARLA) guia.addRow([linea]);
  guia.getRow(1).font = { bold: true, size: 13 };

  return Buffer.from(await libro.xlsx.writeBuffer());
}
