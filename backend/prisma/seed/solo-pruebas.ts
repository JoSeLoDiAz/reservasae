/** La guardia que impide sembrar datos inventados en producción. */

/**
 * Estaba escrita dentro de `prueba.ts` y por eso se saca aquí: en
 * cuanto hubo una segunda siembra hacía falta copiarla, y dos
 * copias de la misma decisión acaban discrepando — que es lo que
 * este repositorio lleva seis rondas documentando.
 *
 * Son DOS comprobaciones y hacen falta las dos. `ENTORNO` la pone
 * quien ejecuta y se puede exportar por costumbre; el nombre de la
 * base sale de la cadena de conexión y es lo que de verdad dice a
 * dónde se va a escribir. Apuntar a producción con la variable
 * puesta se niega igual.
 *
 * NO sustituye a `exigirBaseSegura`, que mira el PUERTO: aquella
 * ataja el túnel ssh del portátil, donde la base se llama igual que
 * la local. Las dos cubren agujeros distintos.
 */
export function soloEnPruebas(nombreDelGuion: string): void {
  const url = process.env.DATABASE_URL ?? '';
  const nombreBase = url.split('/').pop()?.split('?')[0] ?? '';

  const problemas: string[] = [];
  if (process.env.ENTORNO !== 'prueba') {
    problemas.push('ENTORNO no vale "prueba"');
  }
  if (!nombreBase.includes('prueba')) {
    problemas.push(`la base se llama "${nombreBase}" y no lleva "prueba"`);
  }

  if (problemas.length === 0) return;

  console.error(`\n✗ ${nombreDelGuion} inventa datos y NO debe tocar producción.`);
  for (const p of problemas) console.error(`  · ${p}`);
  // la imagen de produccion no trae ts-node: va desde
  // el clon del servidor, contra el puerto publicado
  console.error('\n  Se ejecuta desde /opt/sep/reservasae-prueba/backend así:');
  console.error('    export ENTORNO=prueba');
  console.error('    export DATABASE_URL=...@127.0.0.1:5434/reservasae_prueba');
  console.error(`    pnpm ${nombreDelGuion}\n`);
  process.exit(1);
}
