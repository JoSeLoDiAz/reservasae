import ExcelJS from 'exceljs';

import { construirFormato, leerPlantilla } from '../../plantillas/plantillas';
import { revisarBase } from './base-cargada';

/// El viaje completo del archivo: el formato que se descarga,
/// lleno como lo llenaría una persona, y leído de vuelta.
///
/// Las tres piezas están probadas por separado y aun así
/// pueden no encajar: basta con que el título de una columna
/// no sea exactamente el mismo en el que se escribe y en el
/// que se lee, y entonces se sube una base buena y el sistema
/// dice que viene vacía.

const PLANTILLA = {
  nombre: 'Base',
  columnas: [
    { titulo: 'Correo', clave: 'correo' },
    { titulo: 'Primer nombre', clave: 'nombre' },
  ],
};

/// Llena el formato como lo llenaría alguien: abriendo el que
/// se descargó y escribiendo debajo de la cabecera.
async function llenar(filas: Array<[string, string]>): Promise<Buffer> {
  const formato = await construirFormato(PLANTILLA);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(formato as unknown as ArrayBuffer);
  const hoja = libro.worksheets[0];
  for (const [correo, nombre] of filas) hoja.addRow([correo, nombre]);
  return Buffer.from(await libro.xlsx.writeBuffer());
}

describe('el archivo va y vuelve', () => {
  it('lo que se escribe en el formato es lo que se lee', async () => {
    const archivo = await llenar([
      ['ana@ejemplo.com', 'Ana'],
      ['LUIS@EJEMPLO.COM', 'LUIS CARLOS'],
    ]);

    const lectura = await leerPlantilla(archivo, PLANTILLA);
    // la cabecera se reconoce: si esto falla, se sube una base
    // buena y el sistema dice que viene vacía
    expect(lectura.columnasTraidas).toContain('correo');
    expect(lectura.columnasTraidas).toContain('nombre');

    const r = revisarBase(
      lectura.filas.map((f) => ({
        fila: f.fila,
        correo: f.valores.correo ?? '',
        nombre: f.valores.nombre ?? '',
      })),
    );

    expect(r.listos).toHaveLength(2);
    expect(r.listos[0]).toMatchObject({
      correo: 'ana@ejemplo.com',
      nombre: 'Ana',
    });
    // en minúscula, y solo el primer nombre
    expect(r.listos[1]).toMatchObject({
      correo: 'luis@ejemplo.com',
      nombre: 'Luis',
    });
  });

  it('el formato vacío no trae ni una fila, pero sí sus columnas', async () => {
    // se descarga y se sube sin llenar: no es un error, es que
    // no hay nadie
    const formato = await construirFormato(PLANTILLA);
    const lectura = await leerPlantilla(formato, PLANTILLA);
    expect(lectura.columnasTraidas).toContain('correo');
    expect(revisarBase([]).listos).toHaveLength(0);
  });

  it('una fila mala señala su número de fila DEL EXCEL', async () => {
    const archivo = await llenar([
      ['bien@ejemplo.com', 'Ana'],
      ['roto', 'Luis'],
    ]);
    const lectura = await leerPlantilla(archivo, PLANTILLA);
    const r = revisarBase(
      lectura.filas.map((f) => ({
        fila: f.fila,
        correo: f.valores.correo ?? '',
        nombre: f.valores.nombre ?? '',
      })),
    );

    expect(r.descartados).toHaveLength(1);
    // la cabecera es la 1, así que la segunda fila de datos es
    // la 3. Si esto se desfasa, se manda a la persona a mirar
    // una fila que está bien.
    expect(r.descartados[0].fila).toBe(3);
  });
});
