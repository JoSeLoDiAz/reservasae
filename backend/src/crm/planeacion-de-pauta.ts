import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { origenDeLeadSql } from './origen-del-lead';

/**
 * La tabla del Comité de Marketing: cuánta pauta hay que
 * comprar, por departamento, para cerrar lo que falta.
 *
 * El eje es el departamento DONDE SE DICTA, no dónde vive el
 * lead. Es lo que hace que la fila cuadre consigo misma: los
 * cupos salen de la oferta, que tiene sede; mezclarlos con
 * leads contados por el domicilio de la persona daría una fila
 * cuyas columnas hablan de dos sitios distintos.
 *
 * Por eso NO reemplaza a `tablero-af`, que sí va por domicilio
 * y responde otra pregunta: de dónde salió la gente.
 */

export type FilaDePlaneacion = {
  departamento: string;
  totalCupos: number;
  reservados: number;
  inscritos: number;
  leadsOrganicos: number;
  leadsImportados: number;
};

export type PlaneacionDePauta = {
  filas: FilaDePlaneacion[];
  totales: Omit<FilaDePlaneacion, 'departamento'>;
};

/// Las etapas que cuentan como «ya está dentro».
const LLEGO_A_INSCRITO = [
  'INSCRITO',
  'EN_FORMACION',
  'CERTIFICADO',
  'NO_APROBO',
  'DESERTO',
  'ABANDONO',
  'RETIRADO',
];

const VACIO: PlaneacionDePauta = {
  filas: [],
  totales: {
    totalCupos: 0,
    reservados: 0,
    inscritos: 0,
    leadsOrganicos: 0,
    leadsImportados: 0,
  },
};

/// El departamento de una oferta: el nombre si la sede ya es un
/// departamento, y el suyo si es una ciudad.
const DEPARTAMENTO_DE_LA_SEDE = Prisma.sql`
  CASE WHEN u."tipo"::text = 'CIUDAD'
       THEN COALESCE(u."departamento", u."nombre")
       ELSE u."nombre"
  END`;

export async function planeacionDePauta(
  prisma: PrismaService,
  ambito: string[],
  filtros: { accionFormacionId?: string; coberturaId?: string },
): Promise<PlaneacionDePauta> {
  if (ambito.length === 0 || !filtros.accionFormacionId) return VACIO;

  const deLaAccion = Prisma.sql`
    o."accionFormacionId" = ${filtros.accionFormacionId}
    AND af."convenioId" IN (${Prisma.join(ambito)})`;

  /**
   * Los cupos y lo reservado, por sede.
   *
   * `reservados` son los cupos apartados que TODAVÍA no tienen
   * nombre: los confirmados menos quien ya quedó inscrito por
   * esa reserva. Sin restarlos, el mismo cupo se contaría dos
   * veces —una como reservado y otra como inscrito— y «cupos
   * pendientes» saldría más bajo de lo que es.
   */
  const cupos = await prisma.$queryRaw<
    Array<{ departamento: string; cupos: bigint; reservados: bigint }>
  >(Prisma.sql`
    SELECT
      ${DEPARTAMENTO_DE_LA_SEDE} AS departamento,
      COALESCE(SUM(o."cuposMaximos"), 0) AS cupos,
      GREATEST(
        COALESCE(SUM(res."confirmados"), 0) - COALESCE(SUM(ins."dentro"), 0),
        0
      ) AS reservados
    FROM "ofertas" o
    JOIN "ubicaciones" u          ON u."id" = o."ubicacionId"
    JOIN "acciones_formacion" af  ON af."id" = o."accionFormacionId"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(r."cuposConfirmados"), 0) AS confirmados
        FROM "reservas" r
       WHERE r."ofertaId" = o."id" AND r."estado" <> 'CANCELADA'
    ) res ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS dentro
        FROM "participantes" p
       WHERE p."ofertaId" = o."id"
         AND p."reservaId" IS NOT NULL
         AND p."etapa"::text IN (${Prisma.join(LLEGO_A_INSCRITO)})
    ) ins ON TRUE
    WHERE ${deLaAccion}
    GROUP BY 1
  `);

  const condiciones: Prisma.Sql[] = [Prisma.sql`${deLaAccion}`];
  if (filtros.coberturaId) {
    condiciones.push(Prisma.sql`p."coberturaId" = ${filtros.coberturaId}`);
  }

  /**
   * La gente, por la sede de SU oferta.
   *
   * Quien todavía no tiene oferta asignada no aparece: no se
   * le puede atribuir un departamento sin inventárselo.
   */
  const gente = await prisma.$queryRaw<
    Array<{
      departamento: string;
      inscritos: bigint;
      organicos: bigint;
      importados: bigint;
    }>
  >(Prisma.sql`
    SELECT
      ${DEPARTAMENTO_DE_LA_SEDE} AS departamento,
      COUNT(*) FILTER (
        WHERE p."etapa"::text IN (${Prisma.join(LLEGO_A_INSCRITO)})
      ) AS inscritos,
      COUNT(*) FILTER (
        WHERE ${origenDeLeadSql('p')} <> 'IMPORTACION'
      ) AS organicos,
      COUNT(*) FILTER (
        WHERE ${origenDeLeadSql('p')} = 'IMPORTACION'
      ) AS importados
    FROM "participantes" p
    JOIN "ofertas" o              ON o."id" = p."ofertaId"
    JOIN "ubicaciones" u          ON u."id" = o."ubicacionId"
    JOIN "acciones_formacion" af  ON af."id" = o."accionFormacionId"
    WHERE ${Prisma.join(condiciones, ' AND ')}
    GROUP BY 1
  `);

  const porDepto = new Map<string, FilaDePlaneacion>();
  const fila = (nombre: string) => {
    const ya = porDepto.get(nombre);
    if (ya) return ya;
    const nueva: FilaDePlaneacion = {
      departamento: nombre,
      totalCupos: 0,
      reservados: 0,
      inscritos: 0,
      leadsOrganicos: 0,
      leadsImportados: 0,
    };
    porDepto.set(nombre, nueva);
    return nueva;
  };

  for (const c of cupos) {
    const f = fila(c.departamento);
    f.totalCupos += Number(c.cupos);
    f.reservados += Number(c.reservados);
  }
  for (const g of gente) {
    const f = fila(g.departamento);
    f.inscritos += Number(g.inscritos);
    f.leadsOrganicos += Number(g.organicos);
    f.leadsImportados += Number(g.importados);
  }

  /// Por cupos, de mayor a menor: la tabla se lee para saber
  /// dónde hay más que llenar.
  const filas = [...porDepto.values()].sort((a, b) => b.totalCupos - a.totalCupos);

  const totales = filas.reduce(
    (t, f) => ({
      totalCupos: t.totalCupos + f.totalCupos,
      reservados: t.reservados + f.reservados,
      inscritos: t.inscritos + f.inscritos,
      leadsOrganicos: t.leadsOrganicos + f.leadsOrganicos,
      leadsImportados: t.leadsImportados + f.leadsImportados,
    }),
    VACIO.totales,
  );

  return { filas, totales };
}
