/** La cohorte, ejecutada en pg-mem. */

import { newDb } from 'pg-mem';

import { Prisma } from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import { despuesDelRegistro } from './despues-del-registro';

/// parámetros en línea, fechas en ISO
function enLinea(sql: Prisma.Sql): string {
  return sql.text.replace(/\$(\d+)/g, (_, i: string) => {
    const v = sql.values[Number(i) - 1];
    const t = v instanceof Date ? v.toISOString() : String(v);
    return `'${t.replace(/'/g, "''")}'`;
  });
}

type Ficha = { id: string; convenio?: string; creada: string };
type Enlace = { ficha: string; delRegistro?: boolean; usado?: string };

function base(fichas: Ficha[], enlaces: Enlace[]) {
  const db = newDb();
  db.public.none(
    `CREATE TABLE "participantes" ("id" text, "convenioId" text,
       "creadoEn" timestamptz)`,
  );
  db.public.none(
    `CREATE TABLE "enlaces_completado" ("id" text, "participanteId" text,
       "delRegistro" boolean, "usadoEn" timestamptz)`,
  );
  for (const f of fichas) {
    db.public.none(
      `INSERT INTO "participantes" VALUES ('${f.id}', '${f.convenio ?? 'c1'}',
         '${f.creada}')`,
    );
  }
  enlaces.forEach((e, i) => {
    db.public.none(
      `INSERT INTO "enlaces_completado" VALUES ('e${i}', '${e.ficha}',
         ${e.delRegistro ? 'TRUE' : 'FALSE'},
         ${e.usado ? `'${e.usado}'` : 'NULL'})`,
    );
  });
  const prisma = {
    $queryRaw: (sql: Prisma.Sql) => Promise.resolve(db.public.many(enLinea(sql))),
  } as unknown as PrismaService;
  return prisma;
}

const DESDE = new Date('2026-09-17T05:00:00Z');
const HASTA = new Date('2026-09-18T05:00:00Z');
const ARRANQUE = new Date('2026-09-14T23:02:00Z');
const DENTRO = '2026-09-17T15:00:00Z';

function contar(prisma: PrismaService, arranque: Date | null = ARRANQUE) {
  return despuesDelRegistro(prisma, ['c1'], DESDE, HASTA, arranque);
}

describe('después de preinscribirse', () => {
  it('cuenta la ficha con enlace del registro', async () => {
    const p = base(
      [{ id: 'a', creada: DENTRO }, { id: 'b', creada: DENTRO }],
      [{ ficha: 'a', delRegistro: true, usado: DENTRO }, { ficha: 'b', delRegistro: true }],
    );
    expect(await contar(p)).toEqual({ recibieron: 2, terminaron: 1 });
  });

  it('la ficha del asesor no entra', async () => {
    const p = base(
      [{ id: 'a', creada: DENTRO }],
      [{ ficha: 'a', delRegistro: false, usado: DENTRO }],
    );
    expect(await contar(p)).toEqual({ recibieron: 0, terminaron: 0 });
  });

  it('terminar por otro enlace cuenta, una vez', async () => {
    /// registro anulado, asesor reemite
    const p = base(
      [{ id: 'a', creada: DENTRO }],
      [
        { ficha: 'a', delRegistro: true },
        { ficha: 'a', usado: '2026-09-20T10:00:00Z' },
        { ficha: 'a', usado: '2026-09-21T10:00:00Z' },
      ],
    );
    expect(await contar(p)).toEqual({ recibieron: 1, terminaron: 1 });
  });

  it('nunca terminan más de los que recibieron', async () => {
    const p = base(
      [{ id: 'a', creada: DENTRO }, { id: 'b', creada: DENTRO }],
      [
        { ficha: 'a', delRegistro: true },
        { ficha: 'b', usado: DENTRO },
        { ficha: 'b', usado: DENTRO },
      ],
    );
    expect(await contar(p)).toEqual({ recibieron: 1, terminaron: 0 });
  });

  it('solo el gremio del ámbito', async () => {
    const p = base(
      [{ id: 'a', creada: DENTRO }, { id: 'b', convenio: 'c2', creada: DENTRO }],
      [{ ficha: 'a', delRegistro: true }, { ficha: 'b', delRegistro: true, usado: DENTRO }],
    );
    expect(await contar(p)).toEqual({ recibieron: 1, terminaron: 0 });
  });

  it('el periodo incluye su inicio y no su fin', async () => {
    const p = base(
      [
        { id: 'a', creada: DESDE.toISOString() },
        { id: 'b', creada: HASTA.toISOString() },
        { id: 'c', creada: '2026-09-16T12:00:00Z' },
      ],
      [
        { ficha: 'a', delRegistro: true },
        { ficha: 'b', delRegistro: true },
        { ficha: 'c', delRegistro: true },
      ],
    );
    expect(await contar(p)).toEqual({ recibieron: 1, terminaron: 0 });
  });

  it('se termina a hoy, aunque sea después', async () => {
    const p = base(
      [{ id: 'a', creada: DENTRO }],
      [{ ficha: 'a', delRegistro: true, usado: '2026-10-01T10:00:00Z' }],
    );
    expect(await contar(p)).toEqual({ recibieron: 1, terminaron: 1 });
  });

  it('nada antes del arranque del contador', async () => {
    /// «Desde el inicio»: desde es 1970
    const p = base(
      [
        { id: 'a', creada: '2026-09-10T12:00:00Z' },
        { id: 'b', creada: DENTRO },
      ],
      [
        { ficha: 'a', delRegistro: true, usado: DENTRO },
        { ficha: 'b', delRegistro: true },
      ],
    );
    const r = await despuesDelRegistro(p, ['c1'], new Date(0), HASTA, ARRANQUE);
    expect(r).toEqual({ recibieron: 1, terminaron: 0 });
  });

  it('sin contador no cuenta nada', async () => {
    const p = base(
      [{ id: 'a', creada: DENTRO }],
      [{ ficha: 'a', delRegistro: true, usado: DENTRO }],
    );
    expect(await contar(p, null)).toEqual({ recibieron: 0, terminaron: 0 });
  });
});
