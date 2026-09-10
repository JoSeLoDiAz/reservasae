/** Aplica una migración .sql escrita a mano, en una transacción. */

/// `prisma migrate deploy` no sirve aquí: la migración se
/// escribió a mano para que `directorio_nit` se RENOMBRE en
/// vez de borrarse y crearse, y Prisma ya la tiene marcada
/// como aplicada. Esto la corre de verdad.
///
/// Todo o nada: si una sentencia falla, no queda media
/// migración puesta.

import { readFileSync } from 'node:fs';

import { PrismaClient } from '../generated/prisma/index.js';

const ruta = process.argv[2];
if (!ruta) {
  console.error('Uso: node prisma/aplicar-migracion.mjs <ruta al migration.sql>');
  process.exit(1);
}

/// Los comentarios se quitan ANTES de partir por `;`.
///
/// Al revés no funciona: un comentario que lleve un punto y
/// coma dentro parte en dos, y la mitad de atrás se queda
/// pegada al SQL siguiente como si fuera código.
function sentencias(sql) {
  return sql
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((trozo) => trozo.trim())
    .filter(Boolean);
}

const lista = sentencias(readFileSync(ruta, 'utf8'));
console.log(`${lista.length} sentencias`);

const prisma = new PrismaClient();

try {
  await prisma.$transaction(
    lista.map((s) => prisma.$executeRawUnsafe(s)),
    { timeout: 120_000 },
  );
  console.log('aplicada');
} catch (e) {
  console.error('FALLÓ, nada quedó aplicado:');
  console.error(e.message.split('\n').slice(0, 6).join('\n'));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
