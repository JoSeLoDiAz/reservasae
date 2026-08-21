import { EtapaParticipante, Prisma } from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Control de inscritos: cuántos hay y cómo se reparten.
 *
 * Va aparte de `crm.service.ts` porque son once consultas
 * que no comparten nada con el resto del CRM, y aquel ya
 * pasa de mil quinientas líneas.
 *
 * Todo se agrupa en la base, no en Node: traer cinco mil
 * fichas para contarlas por departamento sería absurdo, y
 * es la misma regla que ya siguen los tableros.
 *
 * El denominador de los porcentajes es SIEMPRE el total de
 * inscritos, nunca el de cada corte: así las vistas del
 * mismo dato se pueden comparar entre sí.
 */

export type Corte = { etiqueta: string; total: number };

export type Control = {
  total: number;
  /** El techo contra el que se mide la captura. */
  cuposConfirmados: number;
  /** Días medios de lead a inscrito. Null si no hay ninguno. */
  diasHastaInscribir: number | null;
  embudo: Array<{ etapa: EtapaParticipante; total: number }>;
  porAccion: Corte[];
  porUbicacion: Array<Corte & { tipo: string }>;
  porGrupo: Array<Corte & { inicio: string | null }>;
  porConvenio: Corte[];
  porAsesor: Corte[];
  porOrigen: Corte[];
  porModalidad: Corte[];
  serie: Array<{ dia: string; total: number }>;
};

const VACIO: Control = {
  total: 0,
  cuposConfirmados: 0,
  diasHastaInscribir: null,
  embudo: [],
  porAccion: [],
  porUbicacion: [],
  porGrupo: [],
  porConvenio: [],
  porAsesor: [],
  porOrigen: [],
  porModalidad: [],
  serie: [],
};

export async function controlDeInscritos(
  prisma: PrismaService,
  ambito: string[],
): Promise<Control> {
  // con ámbito vacío no se consulta: un IN () es inválido
  if (ambito.length === 0) return VACIO;

  const suyos = Prisma.sql`p."convenioId" IN (${Prisma.join(ambito)})`;
  const inscritos = Prisma.sql`${suyos} AND p."etapa" = 'INSCRITO'::"EtapaParticipante"`;

  const [
    total,
    cupos,
    dias,
    embudo,
    porAccion,
    porUbicacion,
    porGrupo,
    porConvenio,
    porAsesor,
    porOrigen,
    porModalidad,
    serie,
  ] = await Promise.all([
    prisma.participante.count({
      where: { convenioId: { in: ambito }, etapa: 'INSCRITO' },
    }),

    prisma.$queryRaw<Array<{ cupos: bigint | null }>>`
      SELECT COALESCE(SUM(r."cuposConfirmados"), 0) AS cupos
        FROM "reservas" r
        JOIN "ofertas" o             ON o."id" = r."ofertaId"
        JOIN "acciones_formacion" af ON af."id" = o."accionFormacionId"
       WHERE af."convenioId" IN (${Prisma.join(ambito)})
         AND r."estado" <> 'CANCELADA'
    `,

    prisma.$queryRaw<Array<{ dias: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (p."fechaMatricula" - p."creadoEn")) / 86400) AS dias
        FROM "participantes" p
       WHERE ${inscritos} AND p."fechaMatricula" IS NOT NULL
    `,

    prisma.participante.groupBy({
      by: ['etapa'],
      where: { convenioId: { in: ambito } },
      _count: { _all: true },
    }),

    prisma.$queryRaw<Array<{ etiqueta: string; codigo: string; total: bigint }>>`
      SELECT af."nombre" AS etiqueta, af."codigo" AS codigo, COUNT(*) AS total
        FROM "participantes" p
        JOIN "acciones_formacion" af ON af."id" = p."accionFormacionId"
       WHERE ${inscritos}
       GROUP BY af."codigo", af."nombre"
       ORDER BY af."codigo"
    `,

    prisma.$queryRaw<Array<{ etiqueta: string; tipo: string; total: bigint }>>`
      SELECT u."nombre" AS etiqueta, u."tipo"::text AS tipo, COUNT(*) AS total
        FROM "participantes" p
        JOIN "ofertas" o     ON o."id" = p."ofertaId"
        JOIN "ubicaciones" u ON u."id" = o."ubicacionId"
       WHERE ${inscritos}
       GROUP BY u."nombre", u."tipo"
       ORDER BY COUNT(*) DESC
    `,

    prisma.$queryRaw<
      Array<{ numero: number; codigo: string; inicio: Date | null; total: bigint }>
    >`
      SELECT g."numero" AS numero, af."codigo" AS codigo,
             g."fechaInicio" AS inicio, COUNT(*) AS total
        FROM "participantes" p
        JOIN "grupos_cobertura" gc   ON gc."id" = p."coberturaId"
        JOIN "grupos" g              ON g."id" = gc."grupoId"
        JOIN "acciones_formacion" af ON af."id" = g."accionFormacionId"
       WHERE ${inscritos}
       GROUP BY af."codigo", g."numero", g."fechaInicio"
       ORDER BY af."codigo", g."numero"
    `,

    prisma.$queryRaw<Array<{ etiqueta: string; total: bigint }>>`
      SELECT COALESCE(c."sigla", c."nombre") AS etiqueta, COUNT(*) AS total
        FROM "participantes" p
        JOIN "convenios" c ON c."id" = p."convenioId"
       WHERE ${inscritos}
       GROUP BY 1 ORDER BY COUNT(*) DESC
    `,

    prisma.$queryRaw<Array<{ etiqueta: string; total: bigint }>>`
      SELECT COALESCE(a."nombre", 'Sin asignar') AS etiqueta, COUNT(*) AS total
        FROM "participantes" p
        LEFT JOIN "administradores" a ON a."id" = p."asesorId"
       WHERE ${inscritos}
       GROUP BY 1 ORDER BY COUNT(*) DESC
    `,

    prisma.$queryRaw<Array<{ etiqueta: string; total: bigint }>>`
      SELECT p."origen"::text AS etiqueta, COUNT(*) AS total
        FROM "participantes" p
       WHERE ${inscritos}
       GROUP BY 1 ORDER BY COUNT(*) DESC
    `,

    prisma.$queryRaw<Array<{ etiqueta: string; total: bigint }>>`
      SELECT o."modalidad"::text AS etiqueta, COUNT(*) AS total
        FROM "participantes" p
        JOIN "ofertas" o ON o."id" = p."ofertaId"
       WHERE ${inscritos}
       GROUP BY 1 ORDER BY COUNT(*) DESC
    `,

    // el ritmo de captura, por el día en que quedó inscrito
    prisma.$queryRaw<Array<{ dia: Date; total: bigint }>>`
      SELECT date_trunc('day', p."fechaMatricula") AS dia, COUNT(*) AS total
        FROM "participantes" p
       WHERE ${inscritos}
         AND p."fechaMatricula" >= NOW() - INTERVAL '60 days'
       GROUP BY 1 ORDER BY 1
    `,
  ]);

  const cifra = (f: { total: bigint }) => Number(f.total);
  const media = dias[0]?.dias;

  return {
    total,
    cuposConfirmados: Number(cupos[0]?.cupos ?? 0),
    diasHastaInscribir: media === null || media === undefined ? null : Number(media),
    embudo: embudo.map((f) => ({ etapa: f.etapa, total: f._count._all })),
    porAccion: porAccion.map((f) => ({
      etiqueta: `${f.codigo} · ${f.etiqueta}`,
      total: cifra(f),
    })),
    porUbicacion: porUbicacion.map((f) => ({
      etiqueta: f.etiqueta,
      tipo: f.tipo,
      total: cifra(f),
    })),
    porGrupo: porGrupo.map((f) => ({
      etiqueta: `${f.codigo} · grupo ${f.numero}`,
      inicio: f.inicio ? f.inicio.toISOString().slice(0, 10) : null,
      total: cifra(f),
    })),
    porConvenio: porConvenio.map((f) => ({ etiqueta: f.etiqueta, total: cifra(f) })),
    porAsesor: porAsesor.map((f) => ({ etiqueta: f.etiqueta, total: cifra(f) })),
    porOrigen: porOrigen.map((f) => ({ etiqueta: f.etiqueta, total: cifra(f) })),
    porModalidad: porModalidad.map((f) => ({ etiqueta: f.etiqueta, total: cifra(f) })),
    serie: serie.map((f) => ({
      dia: f.dia.toISOString().slice(0, 10),
      total: cifra(f),
    })),
  };
}
