/** El cargue lee el género y archiva lo que no reconoce. */

/**
 * Dos defectos de la misma familia, los dos del barrido del 7 oct 2026.
 *
 * 1 · EL GÉNERO NO SE PODÍA CARGAR aunque el lead tiene dónde ponerlo
 *     ---`generoSepId` lleva en el modelo desde siempre---. Su columna
 *     caía entre las «sin reconocer».
 *
 * 2 · Y LO QUE NO SE RECONOCE SE TIRABA. El lector solo leía las
 *     celdas de las columnas conocidas, así que el informe decía «8
 *     columnas sin reconocer» y su contenido no quedaba en ninguna
 *     parte.
 *
 * El segundo es el que de verdad duele: convierte un «todavía no
 * sabemos guardarlo» en un «se perdió». Lo primero se arregla con una
 * migración y los datos siguen ahí; lo segundo obliga a volver a
 * pedirle el archivo al cliente.
 */

import * as ExcelJS from 'exceljs';

import { interpretarLaFila } from './datos-de-la-fila';
import { leerElCargue } from './lector-del-cargue';

async function leer(cabecera: string[], ...filas: string[][]) {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Hoja1');
  hoja.addRow(cabecera);
  for (const f of filas) hoja.addRow(f);
  const buffer = await libro.xlsx.writeBuffer();
  return leerElCargue(Buffer.from(buffer), 'prueba.xlsx');
}

const CABECERA = ['Nombre', 'Correo', 'Género', 'Estrato', 'Barrio o vereda'];

describe('el género se carga', () => {
  it('reconoce la palabra entera y la letra sola', async () => {
    const leido = await leer(
      CABECERA,
      ['Ana Ruiz', 'ana@ejemplo.test', 'Femenino', '', ''],
      ['Carlos Pérez', 'carlos@ejemplo.test', 'M', '', ''],
    );
    const g = leido.filas.map((f) => interpretarLaFila(f, []).datos.generoSepId);
    expect(g).toEqual([2, 1]);
  });

  /**
   * Y LO QUE NO CASA NO SE ADIVINA. Es una columna del reporte al
   * SENA: meter «MASCULINO» porque empieza por eme es reportarle al
   * Estado algo que nadie dijo.
   */
  it('y lo que no casa avisa en vez de adivinar', async () => {
    const leido = await leer(CABECERA, [
      'Sam Quiroga',
      'sam@ejemplo.test',
      'Otro',
      '',
      '',
    ]);
    const f = interpretarLaFila(leido.filas[0], []);
    expect(f.datos.generoSepId).toBeNull();
    expect(f.avisos.join(' ')).toContain('no es un género del SEP');
  });

  /// Y «Sexo» también, que es como lo titula media Colombia.
  it('y entiende que la columna se llame «Sexo»', async () => {
    const leido = await leer(
      ['Nombre', 'Correo', 'Sexo'],
      ['Ana Ruiz', 'ana@ejemplo.test', 'FEMENINO'],
    );
    expect(leido.columnasTraidas).toContain('genero');
    expect(interpretarLaFila(leido.filas[0], []).datos.generoSepId).toBe(2);
  });
});

describe('lo que no se reconoce queda archivado', () => {
  it('las columnas desconocidas viajan con su rótulo', async () => {
    const leido = await leer(CABECERA, [
      'Ana Ruiz',
      'ana@ejemplo.test',
      'Femenino',
      '3',
      'La Candelaria',
    ]);
    expect(leido.columnasQueNoSeReconocen).toEqual([
      'Estrato',
      'Barrio o vereda',
    ]);
    expect(leido.filas[0].extras).toEqual({
      Estrato: '3',
      'Barrio o vereda': 'La Candelaria',
    });
  });

  /// Y acaban en `crudo`, que es lo que se archiva con el lead.
  it('y llegan a `crudo`, que es lo que se guarda', async () => {
    const leido = await leer(CABECERA, [
      'Ana Ruiz',
      'ana@ejemplo.test',
      'Femenino',
      '3',
      'La Candelaria',
    ]);
    const f = interpretarLaFila(leido.filas[0], []);
    expect(f.crudo).toMatchObject({ Estrato: '3' });
    /// Y sin pisar lo reconocido, que es lo que de verdad se usa.
    expect(f.crudo).toMatchObject({ correo: 'ana@ejemplo.test' });
  });

  /**
   * Y UNA FILA QUE SOLO TRAE COLUMNAS DESCONOCIDAS SIGUE SIN CONTAR.
   * Si contara, se crearía un lead sin nombre, sin correo y sin
   * celular: una ficha fantasma por cada renglón suelto del Excel.
   */
  it('pero una fila sin nada reconocible no entra', async () => {
    const leido = await leer(CABECERA, ['', '', '', '3', 'La Candelaria']);
    expect(leido.filas).toHaveLength(0);
  });
});
