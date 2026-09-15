/** Convierte el registro de nginx en SQL para el histórico. */

/**
 * NO escribe en ninguna base: escupe SQL. Es a propósito.
 *
 * El registro vive en el servidor y la base a la que hay que
 * llevarlo puede ser la de producción, donde un guion de
 * TypeScript ni siquiera corre --el clon se instala sin las
 * dependencias de desarrollo--. Un archivo `.sql` se lee
 * antes de aplicarlo, se aplica con el `psql` del contenedor
 * y deja constancia de qué se metió.
 *
 *   ssh sep-vm 'docker logs reservasae_nginx' > registro.txt
 *   pnpm --filter backend db:reconstruir-trafico registro.txt \
 *     historico.sql --hasta 2026-09-14T23:02:00Z
 *   # se mira el archivo, y solo entonces:
 *   ssh sep-vm 'docker compose exec -T db psql -U ... ' < historico.sql
 *
 * `--hasta` es el instante en que arrancó el contador, y no
 * tiene valor por defecto: sin él, el mismo día se contaría
 * dos veces por dos caminos distintos.
 */

import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

import { reconstruir } from '../src/embudo/reconstruir/leer-registro';

function texto(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

async function main(): Promise<void> {
  /// Los DOS archivos van POSICIONALES y no en banderas.
  /// `pnpm run` se come algunas antes de pasarlas al guion, y
  /// el sintoma es un .sql con el encabezado de pnpm dentro
  /// que psql rechaza en la primera linea.
  const [archivo, salidaEn, ...resto] = process.argv.slice(2);
  const i = resto.indexOf('--hasta');
  const hasta = i >= 0 ? Date.parse(resto[i + 1] ?? '') : NaN;

  if (!archivo || !salidaEn || Number.isNaN(hasta)) {
    console.error(
      'Uso: db:reconstruir-trafico <registro.txt> <salida.sql> --hasta <ISO>\n' +
        '  <ISO> es cuando arrancó el contador, p. ej. 2026-09-14T23:02:00Z.\n' +
        '  Lo posterior a esa hora ya está medido y no se reconstruye.',
    );
    process.exit(1);
  }

  const lineas: string[] = [];
  const lector = createInterface({
    input: createReadStream(archivo),
    crlfDelay: Infinity,
  });
  for await (const linea of lector) lineas.push(linea);

  const filas = reconstruir(lineas, hasta);
  if (filas.length === 0) {
    console.error('El registro no trae ninguna visita antes de esa hora.');
    process.exit(1);
  }

  const dias = filas.map((f) => f.dia).sort();
  const slugs = [...new Set(filas.map((f) => f.slug))];

  const salida: string[] = [
    `-- ${filas.length} filas de ${lineas.length} lineas de registro`,
    `-- del ${dias[0]} al ${dias[dias.length - 1]}, hasta ${new Date(hasta).toISOString()}`,
    'BEGIN;',
    '',
    '-- se rehace el tramo entero: correrlo dos veces deja lo mismo',
    `DELETE FROM visitas_reconstruidas`,
    ` WHERE slug IN (${slugs.map(texto).join(', ')})`,
    `   AND dia BETWEEN DATE ${texto(dias[0])} AND DATE ${texto(dias[dias.length - 1])};`,
    '',
  ];

  filas.forEach((f, n) => {
    salida.push(
      `INSERT INTO visitas_reconstruidas`,
      `  (id, dia, slug, "convenioId", referente, "utmFuente", "huboFbclid", navegador, visitas, envios)`,
      `SELECT ${texto(`vr${String(n).padStart(5, '0')}${f.dia.replace(/-/g, '')}`)},` +
        ` DATE ${texto(f.dia)}, ${texto(f.slug)}, c.id, ${texto(f.referente)},` +
        ` ${texto(f.utmFuente)}, ${f.huboFbclid}, ${texto(f.navegador)}, ${f.visitas}, ${f.envios}`,
      /// Sin el convenio NO entra: una fila sin gremio es
      /// invisible para el ambito y quedaria contada en
      /// ninguna parte.
      `  FROM convenios c WHERE c.slug = ${texto(f.slug)};`,
      '',
    );
  });

  salida.push('COMMIT;', '');
  writeFileSync(salidaEn, salida.join('\n'), 'utf8');

  const visitas = filas.reduce((t, f) => t + f.visitas, 0);
  const envios = filas.reduce((t, f) => t + f.envios, 0);
  console.error(
    `${visitas} visitas y ${envios} envios entre ${dias[0]} y ${dias[dias.length - 1]}.`,
  );
}

void main();
