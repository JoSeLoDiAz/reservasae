/**
 * ¿QUÉ COLUMNAS DE LA BASE DEL CLIENTE SE RECONOCEN HOY?
 *
 * «¿Si quedó ajustado que cuando cargue el plano sí tome departamento
 * y demás ítems que rechaza, o tampoco?» (cliente, 7 oct 2026).
 *
 * Arma un Excel con los rótulos tal como vienen en su archivo y lo
 * pasa por el lector de verdad. Dice cuáles entran, cuáles no, y qué
 * pasa con las que no.
 *
 * SOLO LEE. No toca la base.
 *
 *   pnpm db:sondeo-columnas
 */

import * as ExcelJS from 'exceljs';

import { interpretarLaFila } from '../src/leads/cargue/datos-de-la-fila';
import { leerElCargue } from '../src/leads/cargue/lector-del-cargue';

/// Los rótulos tal como salen en su base.
const SUYAS = [
  'Nombre',
  'Apellidos',
  'Correo',
  'Celular',
  'Documento',
  'Departamento',
  'Ciudad o municipio',
  'Genero',
  'Accion de formacion de interes',
  'Fecha de nacimiento',
  'Estrato',
  'Barrio o vereda',
  'Direccion',
  'Cargo en la organizacion',
  'Nivel ocupacional',
  'Se ha beneficiado antes',
];

async function main() {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Hoja1');
  hoja.addRow(SUYAS);
  hoja.addRow([
    'Ana María',
    'Ruiz Gómez',
    'ana@ejemplo.test',
    '3001112233',
    '1020304050',
    'ANTIOQUIA',
    'MEDELLÍN',
    'Femenino',
    'AF1',
    '1990-04-12',
    '3',
    'La Candelaria',
    'Calle 10 # 5-20',
    'Coordinadora',
    'MEDIO',
    'No',
  ]);

  const leido = await leerElCargue(
    Buffer.from(await libro.xlsx.writeBuffer()),
    'prueba.xlsx',
  );

  console.log('\n═══ SUS COLUMNAS, UNA POR UNA ═══\n');
  const reconocidas = new Set(leido.columnasTraidas);
  const sin = new Set(leido.columnasQueNoSeReconocen);

  for (const r of SUYAS) {
    const fuera = sin.has(r);
    console.log(
      (fuera ? '  ✗  ' : '  ✓  ') +
        r.padEnd(34) +
        (fuera ? 'NO se reconoce' : 'SÍ entra'),
    );
  }

  const f = interpretarLaFila(leido.filas[0], []);
  console.log(
    `\n  Reconocidas: ${reconocidas.size}   ·   Sin reconocer: ${sin.size}\n`,
  );
  console.log('  Lo que NO se reconoce, ¿se pierde o se guarda?');
  console.log('     ' + JSON.stringify(leido.filas[0].extras) + '\n');
  console.log('  Y lo que queda en la ficha del lead:');
  console.log(
    '     nombre: ' + f.datos.nombreCompleto +
      '\n     documento: ' + f.datos.numeroDocumento +
      '\n     departamento: ' + f.datos.departamentoSepId +
      '\n     municipio: ' + f.datos.municipioSepId +
      '\n     género: ' + f.datos.generoSepId +
      '\n     acción pedida: ' + (f.datos.interes ?? '(ninguna)'),
  );
  if (f.avisos.length) console.log('\n  Avisos: ' + f.avisos.join(' | '));
  console.log('');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
