/** El grupo elegido acota TODAS las consultas, no solo una. */

/**
 * El defecto: elegir un grupo filtraba la gente pero no los cupos.
 *
 * `planeacionDePauta` hace dos consultas y las junta por departamento.
 * La de gente aplicaba `coberturaId`; la de cupos, no. Al juntarlas
 * salían los nueve departamentos de la acción --con sus cupos y sin
 * nadie dentro-- y el filtro parecía no hacer nada. Se vio en pantalla:
 * «Grupo 1 · BOGOTÁ D.C» seguía enseñando Antioquia, Córdoba, Risaralda,
 * Valle, Cauca, Huila, Magdalena y Santander.
 *
 * Un grupo del desplegable es un `GrupoCobertura`, que va atado a UNA
 * ubicación, así que elegir uno tiene que dejar UN departamento.
 *
 * Aquí no hay base de datos: se le pasa un Prisma falso que apunta el
 * SQL que se le pide, y se mira que la consulta de cupos lleve la
 * restricción. Es la misma idea que `colas-se-recuperan.spec`.
 */

import { planeacionDePauta } from './planeacion-de-pauta';

/// Apunta las consultas y no devuelve filas: lo que se prueba es QUÉ se
/// pregunta, no qué contesta la base.
function prismaEspia() {
  const consultas: string[] = [];
  const prisma = {
    $queryRaw: (sql: { sql?: string; strings?: string[] }) => {
      consultas.push(sql.sql ?? (sql.strings ?? []).join(' ? '));
      return Promise.resolve([]);
    },
  };
  return { prisma, consultas };
}

const ACCION = 'af-1';
const AMBITO = ['convenio-1'];

describe('la planeación de pauta, al elegir un grupo', () => {
  it('acota también los cupos, no solo la gente', async () => {
    const { prisma, consultas } = prismaEspia();

    await planeacionDePauta(prisma as never, AMBITO, {
      accionFormacionId: ACCION,
      coberturaId: 'cobertura-1',
    });

    /// La primera es la de cupos: sale de `ofertas`.
    const cupos = consultas.find((c) => c.includes("AS reservados"));
    expect(cupos).toBeDefined();
    expect(cupos).toContain('grupos_cobertura');
    expect(cupos).toContain('ubicacionId');
  });

  it('sin grupo, los cupos salen de toda la acción', async () => {
    const { prisma, consultas } = prismaEspia();

    await planeacionDePauta(prisma as never, AMBITO, { accionFormacionId: ACCION });

    const cupos = consultas.find((c) => c.includes("AS reservados"));
    expect(cupos).toBeDefined();
    expect(cupos).not.toContain('grupos_cobertura');
  });

  /// Lo que ya funcionaba y no se puede romper al arreglar lo otro.
  it('la gente sigue filtrándose por el grupo', async () => {
    const { prisma, consultas } = prismaEspia();

    await planeacionDePauta(prisma as never, AMBITO, {
      accionFormacionId: ACCION,
      coberturaId: 'cobertura-1',
    });

    /// Ojo al buscarla: la de cupos TAMBIÉN nombra «participantes» y
    /// «etapa» en su LATERAL, para descontar los cupos que ya tienen
    /// nombre. La de gente es la que cuenta orgánicos e importados.
    const gente = consultas.find((c) => c.includes('AS organicos'));
    expect(gente).toBeDefined();
    expect(gente).toContain('coberturaId');
  });

  it('sin acción de formación no se consulta nada', async () => {
    const { prisma, consultas } = prismaEspia();

    await planeacionDePauta(prisma as never, AMBITO, {});

    expect(consultas).toHaveLength(0);
  });
});
