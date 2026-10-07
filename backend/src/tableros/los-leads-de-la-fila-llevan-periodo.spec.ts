/** En Reservas, las dos mitades de la fila miran el mismo periodo. */

/**
 * Lo encontró el barrido del 7 oct 2026 buscando hermanos del defecto
 * de «cupos reservados», y es el mismo: la vista «Por organización»
 * aplicaba el filtro de fechas a las RESERVAS y no a los LEADS.
 *
 * Con «Ayer» puesto, la fila ponía los cupos de ayer al lado de los
 * leads de toda la vida. Y «Cupos pendientes» ---que resta una cosa de
 * la otra--- salía casi siempre en cero, porque restaba una cifra de
 * ayer menos una de siempre.
 *
 * Media fila obedeciendo al periodo es peor que ninguna, porque parece
 * que sí obedece.
 *
 * Se mira el SQL que sale y no el resultado, que es lo único que
 * distingue «el recorte se añade» de «el recorte no está»: el mismo
 * método que usa `resumen-por-accion.spec.ts`.
 */

import { Prisma } from '../../generated/prisma';

import { cifrasDeLeadsPorEmpresa } from './reservas-agrupadas';

/// Un doble de Prisma que solo guarda la consulta que le mandan.
function arnes() {
  const vistas: string[] = [];
  const prisma = {
    $queryRaw: (q: Prisma.Sql) => {
      vistas.push(q.sql);
      return Promise.resolve([]);
    },
  };
  return { prisma, vistas };
}

const sql = async (ventana: { desde?: string; hasta?: string }) => {
  const { prisma, vistas } = arnes();
  await cifrasDeLeadsPorEmpresa(
    prisma as never,
    ['e1'],
    ['c1'],
    ventana,
  );
  return vistas[0] ?? '';
};

describe('las cifras de leads por organización llevan el periodo', () => {
  it('con periodo, el recorte va en la consulta', async () => {
    const q = await sql({
      desde: '2026-10-06T05:00:00.000Z',
      hasta: '2026-10-07T05:00:00.000Z',
    });
    expect(q).toContain('p."creadoEn" >=');
    expect(q).toContain('p."creadoEn" <');
  });

  /**
   * Y CADA PUNTA POR SU LADO. Con media ventana ---solo `desde`--- el
   * otro extremo queda abierto, no como «todo el histórico».
   */
  it('y media ventana recorta solo por ese lado', async () => {
    const q = await sql({ desde: '2026-10-06T05:00:00.000Z' });
    expect(q).toContain('p."creadoEn" >=');
    expect(q).not.toContain('p."creadoEn" <');
  });

  /**
   * Y SIN PERIODO SIGUEN SIENDO TODOS. El recorte se AÑADE, no
   * sustituye: «Desde el principio» tiene que seguir dando el total de
   * siempre, que es con lo que el cliente cuadra sus cifras.
   */
  it('sin periodo no se recorta nada', async () => {
    const q = await sql({});
    expect(q).not.toContain('p."creadoEn"');
    /// Pero el ámbito y las organizaciones siguen puestos: lo que se
    /// añade es la fecha, no se reescribe la consulta.
    expect(q).toContain('"convenioId"');
    expect(q).toContain('empresaId');
  });
});
