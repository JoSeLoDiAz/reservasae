/** Prueba el buscador de verdad, con navegador. */

/// Este es el único pedazo que no se puede probar sin salir a
/// internet: si el buscador cambió su página, los selectores
/// de `proveedor-navegador.ts` dejan de encontrar la
/// respuesta. Correr esto lo dice en diez segundos, en vez de
/// que se descubra cuando un asesor le da al botón.
///
///   pnpm db:probar-navegador-web            (sin ver nada)
///   WEB_CON_CABEZA=1 pnpm db:probar-navegador-web   (viéndolo)
///
/// Se le puede pasar otro NIT:
///   pnpm db:probar-navegador-web 890900842

import { fichaAPropuesta } from '../src/instituciones/web/ficha-a-propuesta';
import { cuantosTrajo } from '../src/instituciones/web/leer-ficha-web';
import { ProveedorWebNavegador } from '../src/instituciones/web/proveedor-navegador';

/// El de ABC Laboratorios, que es del que tenemos la
/// respuesta buena para comparar.
const NIT = process.argv[2] ?? '860031945';

async function main() {
  console.log(`\n=== BUSCADOR WEB CON NAVEGADOR · NIT ${NIT} ===\n`);
  if (process.env.WEB_CON_CABEZA !== '1') {
    console.log('  (sin ventana. Para verlo: WEB_CON_CABEZA=1)\n');
  }

  const proveedor = new ProveedorWebNavegador();
  const empezo = Date.now();
  const r = await proveedor.consultar(NIT);
  const tardo = ((Date.now() - empezo) / 1000).toFixed(1);

  console.log(`  Tardó ${tardo} s · estado: ${r.estado}\n`);

  if (r.estado === 'FALLO') {
    console.log(`  ${r.error}\n`);
    console.log('  Si dice que pide aceptar algo o verificar que no es un');
    console.log('  robot: corra una vez con WEB_CON_CABEZA=1 y resuélvalo a');
    console.log('  mano. Si dice otra cosa, cambió la página del buscador y');
    console.log('  hay que mirar los selectores de proveedor-navegador.ts.\n');
    await proveedor.onModuleDestroy();
    process.exit(1);
  }

  if (r.estado === 'SIN_RESULTADO') {
    console.log('  Contestó, pero sin razón social reconocible.\n');
    console.log(`  --- lo que contestó (${r.crudo?.length ?? 0} letras) ---`);
    console.log(`  ${(r.crudo ?? '(nada)').replace(/\n/g, '\n  ')}\n`);
    await proveedor.onModuleDestroy();
    process.exit(1);
  }

  /// Dos columnas, porque no son lo mismo y confundirlas es
  /// justo el error que hay que evitar: a la izquierda lo que
  /// DIJO el buscador, a la derecha lo que se le propondría a
  /// una persona. Lo que no se puede traducir sin inventar --
  /// «1972» no es una fecha, «Mediana» no es una
  /// clasificación -- se queda por fuera a propósito.
  const propuesta = fichaAPropuesta(r.ficha);

  console.log(
    `  Contestó ${cuantosTrajo(r.ficha)} de 14 · se propondrían ` +
      `${Object.keys(propuesta).length}\n`,
  );
  console.log(`  ${'campo'.padEnd(20)}${'lo que dijo'.padEnd(34)}se propone`);
  console.log(`  ${'-'.repeat(78)}`);

  for (const [campo, dijo] of Object.entries(r.ficha)) {
    const sale = propuesta[campo];
    const marca =
      sale === undefined ? (dijo === null ? '  · ' : ' -- ') : ' OK ';
    console.log(
      `  ${marca}${campo.padEnd(20)}${String(dijo ?? '—')
        .slice(0, 32)
        .padEnd(34)}` + `${sale === undefined ? '—' : String(sale)}`,
    );
  }
  console.log(
    `\n  «--» = lo dijo pero no se propone: no se puede traducir sin inventar.`,
  );

  console.log(
    `\n  --- lo que contestó, tal cual (${r.crudo.length} letras) ---`,
  );
  console.log(`  ${r.crudo.slice(0, 900).replace(/\n/g, '\n  ')}\n`);

  await proveedor.onModuleDestroy();
  process.exit(0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
