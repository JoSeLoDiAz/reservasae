import ExcelJS from 'exceljs';

import { textoDeCelda, textoDelArchivo } from './carga-archivo';

/** Un .xlsx con huecos DE VERDAD: la celda no existe. */
async function libroConHuecos(fila: Array<[number, unknown]>): Promise<Buffer> {
  const l = new ExcelJS.Workbook();
  const h = l.addWorksheet('Hoja1');
  const f = h.getRow(1);
  fila.forEach(([col, v]) => {
    f.getCell(col).value = v as ExcelJS.CellValue;
  });
  f.commit();
  return Buffer.from(await l.xlsx.writeBuffer());
}

/** Un .xlsx de verdad, en memoria. */
async function libro(filas: unknown[][]): Promise<Buffer> {
  const l = new ExcelJS.Workbook();
  const h = l.addWorksheet('Hoja1');
  filas.forEach((f) => h.addRow(f));
  return Buffer.from(await l.xlsx.writeBuffer());
}

describe('textoDeCelda', () => {
  it('deja el texto plano tal cual, sin espacios de sobra', () => {
    expect(textoDeCelda('  Laura ')).toBe('Laura');
  });

  it('un numero se vuelve su texto, no notacion cientifica', () => {
    expect(textoDeCelda(1019456782)).toBe('1019456782');
  });

  it('el texto con formato se pega entero', () => {
    expect(
      textoDeCelda({ richText: [{ text: 'Gómez' }, { text: ' Rojas' }] }),
    ).toBe('Gómez Rojas');
  });

  it('una formula vale por su resultado', () => {
    expect(textoDeCelda({ formula: 'A1&B1', result: '3001234567' })).toBe(
      '3001234567',
    );
  });

  it('un correo con enlace da el texto que se ve', () => {
    expect(
      textoDeCelda({ text: 'laura@empresa.com', hyperlink: 'mailto:laura@empresa.com' }),
    ).toBe('laura@empresa.com');
  });

  it('una celda con error no inventa nada', () => {
    expect(textoDeCelda({ error: '#N/A' })).toBe('');
  });

  it('vacia es cadena vacia, nunca "undefined"', () => {
    expect(textoDeCelda(undefined)).toBe('');
    expect(textoDeCelda(null)).toBe('');
  });
});

describe('textoDelArchivo', () => {
  it('un .xlsx sale como el texto que se pegaria', async () => {
    const t = await textoDelArchivo(
      await libro([
        ['CC', 1019456782, 'Laura', 'Camila', 'Gómez', 'Rojas', 'l@e.com', '3001234567'],
      ]),
      'lista.xlsx',
    );
    expect(t).toBe(
      'CC\t1019456782\tLaura\tCamila\tGómez\tRojas\tl@e.com\t3001234567',
    );
  });

  /// El defecto caro: las ocho columnas van POR POSICION. Si una
  /// vacia de en medio se cae, el apellido entra donde va el
  /// nombre y la persona se guarda mal sin que nada falle.
  it('una columna vacia de EN MEDIO se conserva', async () => {
    const t = await textoDelArchivo(
      await libroConHuecos([
        [1, 'CC'],
        [2, '1019456782'],
        [3, 'Laura'],
        // 4 (segundo nombre) NO se toca: no existe en el archivo
        [5, 'Gómez'],
        // 6 (segundo apellido) tampoco
        [7, 'l@e.com'],
        [8, '3001234567'],
      ]),
      'lista.xlsx',
    );
    expect(t.split('\t')).toEqual([
      'CC', '1019456782', 'Laura', '', 'Gómez', '', 'l@e.com', '3001234567',
    ]);
    expect(t.split('\t')[4]).toBe('Gómez');
  });

  it('las vacias de la DERECHA sí se quitan', async () => {
    const t = await textoDelArchivo(
      await libroConHuecos([
        [1, 'CC'], [2, '1019456782'], [3, 'Laura'], [4, 'Camila'],
        [5, 'Gómez'], [6, 'Rojas'], [8, ''],
      ]),
      'lista.xlsx',
    );
    expect(t.endsWith('Rojas')).toBe(true);
  });

  it('una fila en blanco no cuenta', async () => {
    const t = await textoDelArchivo(
      await libro([
        ['CC', '1', 'Ana', '', 'Ruiz'],
        ['', '', '', '', ''],
        ['CC', '2', 'Luis', '', 'Paz'],
      ]),
      'lista.xlsx',
    );
    expect(t.split('\n')).toHaveLength(2);
  });

  it('un .csv da lo mismo que el .xlsx', async () => {
    const t = await textoDelArchivo(
      Buffer.from('CC,1019456782,Laura,Camila,Gómez,Rojas\n', 'utf8'),
      'lista.csv',
    );
    expect(t).toBe('CC\t1019456782\tLaura\tCamila\tGómez\tRojas');
  });

  /// Se queda aunque el guardia propio se quitara: lo que
  /// comprueba es que la primera celda llega limpia, lo garantice
  /// quien lo garantice. Si exceljs deja de hacerlo, salta aqui.
  it('la marca de orden de Excel no ensucia la primera celda', async () => {
    const t = await textoDelArchivo(
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from('CC,1019456782,Laura\n', 'utf8'),
      ]),
      'lista.csv',
    );
    expect(t.split('\t')[0]).toBe('CC');
  });

  it('un libro sin hojas no revienta', async () => {
    const l = new ExcelJS.Workbook();
    const vacio = Buffer.from(await l.xlsx.writeBuffer());
    await expect(textoDelArchivo(vacio, 'x.xlsx')).resolves.toBe('');
  });
});
