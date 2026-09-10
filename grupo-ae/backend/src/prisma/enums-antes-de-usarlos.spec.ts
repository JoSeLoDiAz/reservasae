/** Ningun valor de enum se usa antes de existir. */

/**
 * Esta prueba existe por un despliegue concreto.
 *
 * La migracion `toques_de_origen` escribia `'IMPORTACION'::"OrigenLead"`,
 * y ese valor solo existia como tipo de TypeScript: al enum de Postgres
 * nunca se le habia anadido. Reventó con «invalid input value for enum»,
 * arrastró a las siguientes con P3009 y dejó el backend en bucle de
 * reinicio. En produccion habria pasado igual.
 *
 * Nada lo cazo antes: `tsc` no mira el SQL, y las pruebas no aplican
 * migraciones contra una base de verdad, asi que el build verde no
 * significaba nada para esto.
 *
 * Aqui se lee el SQL en el mismo orden en que Prisma lo aplica, sin
 * base de datos, y se modela la regla exacta que se rompio:
 *
 *   - `CREATE TYPE "X" AS ENUM (...)` -> sus valores sirven ya, incluso
 *     en esa misma migracion.
 *   - `ALTER TYPE "X" ADD VALUE 'V'`  -> 'V' NO sirve en esa misma
 *     migracion. Postgres no deja usar un valor recien anadido dentro de
 *     la transaccion que lo anade, y Prisma envuelve cada migracion en
 *     una. Por eso el valor va en su PROPIA migracion, ordenada antes.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRACIONES = join(__dirname, '..', '..', 'prisma', 'migrations');

type Falta = { migracion: string; enumero: string; valor: string; porque: string };

/// El SQL sin comentarios: un `--` puede nombrar un valor que no se usa.
const sinComentarios = (sql: string): string => sql.replace(/--[^\n]*/g, '');

function revisar(): { migraciones: number; faltas: Falta[] } {
  const carpetas = readdirSync(MIGRACIONES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort(); // el nombre empieza por la fecha: es el orden de aplicacion

  const disponibles = new Map<string, Set<string>>();
  const faltas: Falta[] = [];

  for (const migracion of carpetas) {
    let sql: string;
    try {
      sql = sinComentarios(readFileSync(join(MIGRACIONES, migracion, 'migration.sql'), 'utf8'));
    } catch {
      continue; // carpeta sin migration.sql
    }

    // CREATE TYPE: sus valores sirven en el acto
    for (const m of sql.matchAll(/CREATE\s+TYPE\s+"(\w+)"\s+AS\s+ENUM\s*\(([^)]*)\)/gi)) {
      const valores = [...m[2].matchAll(/'([^']*)'/g)].map((v) => v[1]);
      const set = disponibles.get(m[1]) ?? new Set<string>();
      valores.forEach((v) => set.add(v));
      disponibles.set(m[1], set);
    }

    // lo que ESTA migracion anade: sirve a partir de la siguiente
    const anadidos = new Map<string, Set<string>>();
    for (const m of sql.matchAll(
      /ALTER\s+TYPE\s+"(\w+)"\s+ADD\s+VALUE\s+(?:IF\s+NOT\s+EXISTS\s+)?'([^']*)'/gi,
    )) {
      const set = anadidos.get(m[1]) ?? new Set<string>();
      set.add(m[2]);
      anadidos.set(m[1], set);
    }

    // usos con cast explicito: 'VALOR'::"Enum"
    for (const m of sql.matchAll(/'([^']*)'\s*::\s*"(\w+)"/g)) {
      const [, valor, enumero] = m;
      const conocidos = disponibles.get(enumero);
      if (!conocidos) continue; // no es un enum nuestro
      if (conocidos.has(valor)) continue;

      faltas.push({
        migracion,
        enumero,
        valor,
        porque: anadidos.get(enumero)?.has(valor)
          ? 'lo anade esta misma migracion, y Postgres no deja usarlo en la transaccion que lo crea: sacalo a una migracion propia, ordenada antes'
          : 'no lo anade ninguna migracion anterior',
      });
    }

    for (const [enumero, vals] of anadidos) {
      const set = disponibles.get(enumero) ?? new Set<string>();
      vals.forEach((v) => set.add(v));
      disponibles.set(enumero, set);
    }
  }

  return { migraciones: carpetas.length, faltas };
}

describe('las migraciones no usan un valor de enum antes de existir', () => {
  const { migraciones, faltas } = revisar();

  it('hay migraciones que revisar', () => {
    expect(migraciones).toBeGreaterThan(0);
  });

  it('ningun valor se usa antes de que su migracion lo cree', () => {
    const detalle = faltas
      .map((f) => `  ${f.migracion}: '${f.valor}'::"${f.enumero}" -- ${f.porque}`)
      .join('\n');

    expect(detalle === '' ? '' : `\n${detalle}\n`).toBe('');
  });
});
