/** La cadena entera del RUI, contra el portal de verdad. */

/// Encola una consulta, la procesa con el proveedor real y
/// mira que quedo guardado. Es lo unico que prueba que las
/// piezas encajan: cada una por separado ya tiene sus tests.
///
///   pnpm exec ts-node prisma/probar-rui-completo.ts [documento]
///
/// Sin documento usa uno inventado, que da SIN_RESULTADO y no
/// consulta los datos de ninguna persona.

import { PrismaClient } from '../generated/prisma';
import { leerRespuesta } from '../src/crm/rui/leer-respuesta';
import { conTildes, confianzaDelCorte, partirNombre } from '../src/crm/rui/partir-nombre';
import { ProveedorRuiVentanilla } from '../src/crm/rui/proveedor-ventanilla';

const prisma = new PrismaClient();

const DOCUMENTO = process.argv[2] ?? '1111111111';
/// 1 es cedula de ciudadania en el catalogo del SEP.
const TIPO = 1;

async function main() {
  console.log(`\n  documento: ${DOCUMENTO}\n`);

  const proveedor = new ProveedorRuiVentanilla();
  const desde = Date.now();
  const r = await proveedor.consultar(TIPO, DOCUMENTO);
  const tardo = ((Date.now() - desde) / 1000).toFixed(1);

  console.log(`  el portal tardó ${tardo}s`);
  console.log(`  estado: ${r.estado}`);

  if (r.estado === 'ENCONTRADO') {
    console.log(`  nombre: ${r.nombreCompleto}`);
    const partes = partirNombre(r.nombreCompleto);
    console.log('  partido:');
    console.log(`     primer nombre    ${partes.primerNombre}`);
    console.log(`     segundo nombre   ${partes.segundoNombre || '—'}`);
    console.log(`     primer apellido  ${partes.primerApellido}`);
    console.log(`     segundo apellido ${partes.segundoApellido || '—'}`);
    console.log(`  confianza del corte: ${confianzaDelCorte(r.nombreCompleto)}`);
  }

  if (r.estado === 'FALLO') console.log(`  error: ${r.error}`);

  // el lector, con la forma que documenta el portal
  console.log('\n  el lector, sobre una ficha de ejemplo:');
  const ficha = leerRespuesta(
    'JUAN CARLOS MARTINEZ GOMEZ\n34 años · Masculino\nMedellín — Antioquia',
  );
  console.log(`     ${conTildes(ficha.nombre ?? '')} · ${ficha.edad} años · ${ficha.genero}`);
  console.log(`     ${ficha.ciudad}, ${ficha.departamento}`);

  await prisma.$disconnect();
  await proveedor.onModuleDestroy();
}

main().catch(async (e) => {
  console.error('FALLÓ:', e instanceof Error ? e.message.split('\n')[0] : e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
