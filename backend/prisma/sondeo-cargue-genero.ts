/**
 * ¿LEE EL CARGUE EL GÉNERO, Y GUARDA LO QUE NO RECONOCE?
 *
 * Arma un Excel de mentira con una columna «Género» y otras tres que
 * el sistema NO conoce, lo pasa por el lector de verdad y enseña qué
 * salió. No toca la base: solo lee el archivo que él mismo escribe.
 *
 *   pnpm ts-node prisma/sondeo-cargue-genero.ts
 */

import * as ExcelJS from 'exceljs';

import { leerElCargue } from '../src/leads/cargue/lector-del-cargue';
import { interpretarLaFila } from '../src/leads/cargue/datos-de-la-fila';

async function main() {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Hoja1');

  /// Cuatro columnas que SÍ se reconocen y cuatro que no, que son de
  /// las que el cliente trae en su base.
  hoja.addRow([
    'Nombre',
    'Correo',
    'Celular',
    'Género',
    'Fecha de nacimiento',
    'Estrato',
    'Barrio o vereda',
    'Nivel ocupacional',
  ]);
  hoja.addRow([
    'Ana María Ruiz',
    'ana@ejemplo.test',
    '3001112233',
    'Femenino',
    '1990-04-12',
    '3',
    'La Candelaria',
    'MEDIO',
  ]);
  hoja.addRow([
    'Carlos Pérez',
    'carlos@ejemplo.test',
    '3004445566',
    'M',
    '1985-01-02',
    '2',
    'Belén',
    'ALTA DIRECCIÓN',
  ]);
  /// Y uno que no casa, para ver que avisa en vez de adivinar.
  hoja.addRow([
    'Sam Quiroga',
    'sam@ejemplo.test',
    '3007778899',
    'Otro',
    '',
    '',
    '',
    '',
  ]);

  const buffer = await libro.xlsx.writeBuffer();
  const leido = await leerElCargue(Buffer.from(buffer), 'prueba.xlsx');

  console.log('\n═══ SONDEO DEL CARGUE ═══\n');
  console.log(`  Columnas reconocidas: ${leido.columnasTraidas.join(', ')}`);
  console.log(`  Sin reconocer: ${leido.columnasQueNoSeReconocen.join(', ') || '(ninguna)'}`);
  console.log(`  Filas leídas: ${leido.filas.length}\n`);

  for (const cruda of leido.filas) {
    const f = interpretarLaFila(cruda, []);
    console.log(`  Fila ${cruda.fila}: ${f.datos.nombreCompleto}`);
    console.log(`     generoSepId: ${f.datos.generoSepId}`);
    console.log(`     archivado de lo no reconocido: ${JSON.stringify(cruda.extras)}`);
    if (f.avisos.length) console.log(`     avisos: ${f.avisos.join(' | ')}`);
    console.log('');
  }

  console.log(
    '  Lo que hay que ver: género 2 para «Femenino», 1 para «M», null y un\n' +
      '  aviso para «Otro»; y las cuatro columnas desconocidas guardadas en\n' +
      '  `extras` en vez de tiradas.\n',
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
