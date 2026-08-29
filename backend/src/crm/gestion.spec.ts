/** Cuántas veces se intentó, y si alguna se logró. */

/**
 * Lo que fija este spec es una distinción, no un cálculo: los
 * intentos se cuentan DESDE el último contacto y no desde
 * siempre. A quien se le habló ayer no se le deben tres
 * llamadas por las tres de la semana pasada, y confundirlo
 * pondría en la lista de «insistirle hoy» justo a la gente con
 * la que ya se habló.
 *
 * El doble de Prisma APLICA los filtros de verdad sobre una
 * lista en memoria. No decide por el nombre del id ni devuelve
 * cifras fijas: si alguien le quita el `creadoEn: { gt: ... }`
 * al servicio, estos tests fallan. Ya se falló antes en esto —
 * un doble que decide por otra cosa que el filtro real prueba
 * el doble, no el candado.
 */

import { CrmService } from './crm.service';

type Nota = {
  participanteId: string;
  resultado: 'CONTACTO' | 'SIN_RESPUESTA' | 'DATO_MALO' | null;
  creadoEn: Date;
};

const DIA = 24 * 60 * 60 * 1000;
const HOY = new Date('2026-08-29T15:00:00Z');
const hace = (dias: number) => new Date(HOY.getTime() - dias * DIA);

/** El where de Prisma, aplicado de verdad. */
function cumple(n: Nota, where: Record<string, unknown>): boolean {
  if (where.participanteId && n.participanteId !== where.participanteId) {
    return false;
  }

  const r = where.resultado as
    | { not?: null; in?: string[] }
    | string
    | undefined;
  if (typeof r === 'string' && n.resultado !== r) return false;
  if (r && typeof r === 'object') {
    if ('not' in r && r.not === null && n.resultado === null) return false;
    if (r.in && !(n.resultado && r.in.includes(n.resultado))) return false;
  }

  const c = where.creadoEn as { gt?: Date } | undefined;
  if (c?.gt && !(n.creadoEn.getTime() > c.gt.getTime())) return false;

  return true;
}

function armar(notas: Nota[]) {
  const prisma = {
    notaParticipante: {
      findFirst: ({
        where,
        orderBy,
      }: {
        where: Record<string, unknown>;
        orderBy: { creadoEn: 'desc' | 'asc' };
      }) => {
        const hallados = notas
          .filter((n) => cumple(n, where))
          .sort((a, b) =>
            orderBy.creadoEn === 'desc'
              ? b.creadoEn.getTime() - a.creadoEn.getTime()
              : a.creadoEn.getTime() - b.creadoEn.getTime(),
          );
        return Promise.resolve(hallados[0] ?? null);
      },
      count: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(notas.filter((n) => cumple(n, where)).length),
    },
  };

  const s = new CrmService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );

  return (id: string) =>
    (
      s as unknown as {
        gestionDe: (id: string) => Promise<{
          intentos: number;
          sinContacto: number;
          datoMalo: number;
          ultimoContacto: Date | null;
        }>;
      }
    ).gestionDe(id);
}

const nota = (
  dias: number,
  resultado: Nota['resultado'],
  participanteId = 'p1',
): Nota => ({ participanteId, resultado, creadoEn: hace(dias) });

describe('a quien nunca se le ha logrado hablar', () => {
  it('cuenta todos los intentos', async () => {
    const gestion = armar([
      nota(10, 'SIN_RESPUESTA'),
      nota(6, 'SIN_RESPUESTA'),
      nota(2, 'SIN_RESPUESTA'),
    ]);

    expect(await gestion('p1')).toEqual({
      intentos: 3,
      sinContacto: 3,
      datoMalo: 0,
      ultimoContacto: null,
    });
  });

  it('sin ninguna nota, todo en cero', async () => {
    expect(await armar([])('p1')).toEqual({
      intentos: 0,
      sinContacto: 0,
      datoMalo: 0,
      ultimoContacto: null,
    });
  });
});

describe('el corte por el último contacto', () => {
  it('los intentos ANTERIORES al contacto no se cuentan', async () => {
    /// Es la regla entera. Sin el corte, esta ficha diría que
    /// lleva 3 intentos sin respuesta cuando ayer se habló con
    /// ella, y entraría en la lista de a quién insistirle.
    const gestion = armar([
      nota(10, 'SIN_RESPUESTA'),
      nota(8, 'SIN_RESPUESTA'),
      nota(5, 'CONTACTO'),
      nota(1, 'SIN_RESPUESTA'),
    ]);

    const g = await gestion('p1');
    expect(g.sinContacto).toBe(1);
    expect(g.intentos).toBe(4);
    expect(g.ultimoContacto).toEqual(hace(5));
  });

  it('si el contacto es lo último, no se debe ningún intento', async () => {
    const gestion = armar([
      nota(9, 'SIN_RESPUESTA'),
      nota(7, 'SIN_RESPUESTA'),
      nota(1, 'CONTACTO'),
    ]);

    expect((await gestion('p1')).sinContacto).toBe(0);
  });

  it('manda el contacto MÁS RECIENTE, no el primero', async () => {
    const gestion = armar([
      nota(20, 'CONTACTO'),
      nota(15, 'SIN_RESPUESTA'),
      nota(9, 'CONTACTO'),
      nota(3, 'SIN_RESPUESTA'),
    ]);

    const g = await gestion('p1');
    expect(g.ultimoContacto).toEqual(hace(9));
    expect(g.sinContacto).toBe(1);
  });
});

describe('qué cuenta como intento', () => {
  it('un contacto logrado NO es un intento sin respuesta', async () => {
    const gestion = armar([nota(4, 'CONTACTO'), nota(2, 'CONTACTO')]);
    expect((await gestion('p1')).sinContacto).toBe(0);
  });

  it('el dato malo cuenta como intento fallido Y aparte', async () => {
    /// Se cuenta en los dos porque son dos preguntas: cuántas
    /// veces se falló, y si hay que pedirle el número a la
    /// organización. La segunda se arregla de otra forma.
    const gestion = armar([nota(5, 'SIN_RESPUESTA'), nota(1, 'DATO_MALO')]);

    const g = await gestion('p1');
    expect(g.sinContacto).toBe(2);
    expect(g.datoMalo).toBe(1);
  });

  it('las notas del sistema no son intentos', async () => {
    /// Las que escribe el propio sistema —al registrar una
    /// autorización, por ejemplo— van sin resultado. Contarlas
    /// diría que se le llamó cuando no llamó nadie.
    const gestion = armar([
      nota(5, null),
      nota(3, null),
      nota(1, 'SIN_RESPUESTA'),
    ]);

    expect((await gestion('p1')).intentos).toBe(1);
  });
});

describe('cada ficha con lo suyo', () => {
  it('no se cuentan las notas de otra persona', async () => {
    const gestion = armar([
      nota(5, 'SIN_RESPUESTA', 'p1'),
      nota(4, 'SIN_RESPUESTA', 'p2'),
      nota(3, 'CONTACTO', 'p2'),
    ]);

    const g = await gestion('p1');
    expect(g.intentos).toBe(1);
    expect(g.ultimoContacto).toBeNull();
  });
});
