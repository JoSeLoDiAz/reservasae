/** El Bloque 3: la misma tabla del comité, abierta por los grupos de una acción. */

/**
 * «EL MISMO DETALLE PERO POR GRUPOS DE LA AF ELEGIDA» (cliente, 23 sep
 * 2026). Se abre pulsando una fila de «Cupos e inscritos por acción».
 *
 * MISMAS COLUMNAS, CON UNA SALVEDAD QUE HAY QUE DECIR EN VOZ ALTA.
 *
 * En la tabla por acción, «cupos reservados» sale de las reservas
 * confirmadas. Una reserva se hace sobre la OFERTA --acción más
 * ubicación-- y no sobre un grupo, así que ese número no se puede
 * repartir entre los grupos sin inventárselo: la empresa aparta veinte
 * cupos de AF1 en Bogotá y el sistema no sabe, ni tiene por qué saber
 * todavía, en cuál de los tres grupos de Bogotá van a caer.
 *
 * Aquí esa columna cuenta otra cosa, y por eso se llama distinto: las
 * personas que la empresa YA nominó con nombre propio y que están en
 * ese grupo. Es la parte de la reserva que ya aterrizó. El pie de la
 * tabla lo explica, porque si no la suma de los grupos no cuadra con
 * la fila de su acción, y eso es exactamente el ruido que el cliente
 * nos señaló en Tráfico.
 */

import { Prisma } from '../../generated/prisma';

export type FilaDeGrupo = {
  grupoId: string;
  numero: number;
  modalidad: string;
  sedes: string;
  /// UNO, no la lista. Una fila por departamento: ver el SQL.
  departamento: string;
  meta: number;
  nominadosPorEmpresa: number;
  campanaDigital: number;
  totalLeads: number;
  inscritosReservas: number;
  inscritosCampana: number;
  totalInscritos: number;
  conversion: number | null;
  cuposDisponibles: number;
  estado: 'ABIERTO' | 'CERRADO';
};

/// Las mismas tres etapas que ocupan silla en todo el sistema. Va
/// escrita aquí, y no importada de `etapas.ts`, porque lo que viaja
/// dentro del SQL es el texto del enum y no el arreglo.
const INSCRITAS = Prisma.sql`('INSCRITO','EN_FORMACION','CERTIFICADO')`;

/// A quién nominó una empresa.
const DE_RESERVA = Prisma.sql`'EMPRESA'`;

/**
 * Una fila por grupo de esa acción, en orden de número.
 *
 * Los dos conteos van en subconsultas separadas --y no en un solo JOIN
 * encadenado-- porque un grupo puede tener varias coberturas:
 * cruzarlas con los participantes multiplicaría la meta por el número
 * de sedes, y la tabla diría que hay el triple de cupos.
 */
/**
 * UNA FILA POR GRUPO Y DEPARTAMENTO, no una por grupo.
 *
 * «Si tengo Grupo 2 · ANTIOQUIA, MAGDALENA, esto va en dos filas,
 * porque se cuenta individual; igual la sumatoria va a dar 65, pero
 * se tiene que desglosar» (cliente, 24 sep 2026).
 *
 * Y la suma SIGUE dando lo mismo, que es lo que hace que esto sea un
 * desglose y no una cifra repetida: cada cobertura cuelga de UNA
 * ubicación y cada persona de UNA cobertura, así que partir por
 * departamento reparte los cupos y la gente, no los duplica. Antes
 * las dos subconsultas agrupaban solo por grupo y los nombres de los
 * departamentos se pegaban con STRING_AGG: la fila decía dónde se
 * dicta y no cuánto va en cada sitio.
 *
 * El grupo SIN coberturas sigue saliendo, con el departamento vacío:
 * es un grupo que existe y al que no se le puede meter a nadie
 * todavía, y esconderlo es como se pierde.
 */
export function resumenPorGrupoSql(accionFormacionId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT g."id"              AS "grupoId",
           g."numero"          AS numero,
           g."modalidad"::text AS modalidad,
           COALESCE(s.sedes, '')             AS sedes,
           COALESCE(s.departamento, '')      AS departamento,
           COALESCE(s.meta, 0)               AS meta,
           COALESCE(p."nominados", 0)        AS "nominadosPorEmpresa",
           COALESCE(p."campana", 0)          AS "campanaDigital",
           COALESCE(p."inscritosReserva", 0) AS "inscritosReservas",
           COALESCE(p."inscritosCampana", 0) AS "inscritosCampana"
      FROM "grupos" g

      -- LA META --con el 30 %-- Y DÓNDE SE DICTA, de las coberturas.
      LEFT JOIN (
        SELECT c."grupoId" AS gid,
               u."departamento" AS departamento,
               SUM(c."cuposMaximos")::int AS meta,
               -- Las SEDES sí se pegan: dentro de un departamento
               -- puede haber varias ciudades y siguen siendo la misma
               -- fila.
               STRING_AGG(DISTINCT u."nombre", ', ') AS sedes
          FROM "grupos_cobertura" c
          JOIN "ubicaciones" u ON u."id" = c."ubicacionId"
         GROUP BY 1, 2
      ) s ON s.gid = g."id"

      -- LAS PERSONAS DEL GRUPO, por dónde llegaron. Cuelgan de la
      -- cobertura, que es la que tiene el grupo.
      LEFT JOIN (
        SELECT c."grupoId" AS gid,
               u."departamento" AS departamento,
               COUNT(*) FILTER (WHERE pa."origen"::text = ${DE_RESERVA})::int AS "nominados",
               COUNT(*) FILTER (WHERE pa."origen"::text <> ${DE_RESERVA})::int AS "campana",
               COUNT(*) FILTER (
                 WHERE pa."origen"::text = ${DE_RESERVA}
                   AND pa."etapa"::text IN ${INSCRITAS}
               )::int AS "inscritosReserva",
               COUNT(*) FILTER (
                 WHERE pa."origen"::text <> ${DE_RESERVA}
                   AND pa."etapa"::text IN ${INSCRITAS}
               )::int AS "inscritosCampana"
          FROM "participantes" pa
          JOIN "grupos_cobertura" c ON c."id" = pa."coberturaId"
          JOIN "ubicaciones" u ON u."id" = c."ubicacionId"
         GROUP BY 1, 2
      ) p ON p.gid = g."id"
             -- IS NOT DISTINCT FROM y no =: el grupo sin coberturas
             -- trae el departamento en nulo por los dos lados, y con
             -- = ese cruce no casaría nunca.
             AND p.departamento IS NOT DISTINCT FROM s.departamento

     WHERE g."accionFormacionId" = ${accionFormacionId}
     ORDER BY g."numero" ASC, s.departamento ASC NULLS FIRST
  `;
}

type Cruda = {
  grupoId: string;
  numero: number;
  modalidad: string;
  sedes: string;
  /// UNO, no la lista. Una fila por departamento: ver el SQL.
  departamento: string;
  meta: number;
  nominadosPorEmpresa: number;
  campanaDigital: number;
  inscritosReservas: number;
  inscritosCampana: number;
};

/** Las cuatro columnas calculadas, con las mismas reglas que la tabla por acción. */
export function completarGrupo(f: Cruda): FilaDeGrupo {
  const totalLeads = f.nominadosPorEmpresa + f.campanaDigital;
  const totalInscritos = f.inscritosReservas + f.inscritosCampana;
  /// Meta menos INSCRITOS, no menos leads: el cupo se consume cuando
  /// la persona queda inscrita. Es la corrección que el cliente hizo
  /// ese mismo día en Comité Marketing.
  const cuposDisponibles = f.meta - totalInscritos;
  return {
    ...f,
    totalLeads,
    totalInscritos,
    conversion: totalLeads > 0 ? totalInscritos / totalLeads : null,
    cuposDisponibles,
    estado: cuposDisponibles <= 0 ? 'CERRADO' : 'ABIERTO',
  };
}
