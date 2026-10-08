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

import { PRIMERA_MATRICULA } from './anclas';
import type { RecorteDelResumen } from './resumen-por-accion';
import { cumplimiento } from './proyeccion-metas';

/**
 * UNA SEDE DEL GRUPO, CON SU ID, PARA PODER EDITARLE LA META.
 *
 * «Que la meta sea modificable manual» (Josse, 7 oct 2026). La celda
 * de Meta enseña la SUMA del departamento, y con dos sedes dentro no
 * se puede escribir encima ---habria que decidir como se parte, y eso
 * es decidir por quien escribe---. Asi que la fila lleva sus sedes y
 * la pantalla edita la que toque, con la ruta que ya existia para el
 * cronograma (`PATCH coberturas/:id/cupos`): una sola regla, dos
 * puertas.
 *
 * Medido sobre el catalogo: de 113 filas, 112 son UNA cobertura. La
 * que no es AF7 grupo 1 ANTIOQUIA, que junta Medellin presencial con
 * la virtual del departamento.
 */
export type SedeDelGrupo = {
  coberturaId: string;
  ubicacionId: string;
  ubicacion: string;
  modalidad: string;
  cuposBase: number;
  cuposMaximos: number;
};

export type FilaDeGrupo = {
  grupoId: string;
  numero: number;
  modalidad: string;
  sedes: string;
  /// UNO, no la lista. Una fila por departamento: ver el SQL.
  departamento: string;
  meta: number;
  /// Sus sedes, una a una: es lo que hace editable la meta.
  coberturas: SedeDelGrupo[];
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
/**
 * Y OBEDECE AL MISMO RECORTE QUE LA TABLA DE ARRIBA.
 *
 * «No es confiable los filtros en los tableros» (cliente, 5 oct
 * 2026). Este bloque no obedecía a NADA: ni al periodo ni a los cinco
 * filtros. Se abría pulsando una fila de la tabla de arriba ---que sí
 * los obedece--- así que los dos bloques, pegados en la misma
 * pantalla, contaban gente distinta para la misma acción. Quien
 * filtraba por una asesora veía su fila con 12 inscritos y, al
 * abrirla, grupos que sumaban 85.
 *
 * Las dos ventanas son las de la tabla de arriba, por lo mismo: los
 * LEADS por cuándo entró la persona, y los INSCRITOS por cuándo se
 * inscribió ---el ancla, que es un movimiento y no se reescribe---.
 *
 * LA META Y LAS SEDES NO SE RECORTAN NUNCA, igual que arriba: los
 * cupos de un grupo son los que son, los mire quien los mire.
 */
export function resumenPorGrupoSql(
  accionFormacionId: string,
  recorte: RecorteDelResumen = {},
): Prisma.Sql {
  /// Los cortes que miran a la PERSONA. El grupo no entra aquí: ese
  /// recorta qué filas se enseñan, no a quién se cuenta.
  const gente = Prisma.join(
    [
      Prisma.sql`TRUE`,
      recorte.asesorId ? Prisma.sql`pa."asesorId" = ${recorte.asesorId}` : null,
      recorte.departamentoSepId !== undefined
        ? Prisma.sql`pa."personaId" IN (SELECT p2."id" FROM "personas" p2 WHERE p2."departamentoSepId" = ${recorte.departamentoSepId})`
        : null,
    ].filter((x): x is Prisma.Sql => x !== null),
    ' AND ',
  );

  /// Cuándo ENTRÓ la persona, para los leads.
  const llego = Prisma.join(
    [
      Prisma.sql`TRUE`,
      recorte.desde
        ? Prisma.sql`pa."creadoEn" >= ${recorte.desde}::timestamptz`
        : null,
      recorte.hasta
        ? Prisma.sql`pa."creadoEn" < ${recorte.hasta}::timestamptz`
        : null,
    ].filter((x): x is Prisma.Sql => x !== null),
    ' AND ',
  );

  /// Cuándo SE INSCRIBIÓ, para los inscritos.
  /// Y SIGUE INSCRITO HOY, y sin ventana no se exige el ancla.
  /// Las dos son del cliente (7 oct 2026) y el porqué largo está
  /// en `resumen-por-accion.ts`.
  const seInscribio = Prisma.join(
    [
      Prisma.sql`pa."etapa"::text IN ${INSCRITAS}`,
      recorte.desde || recorte.hasta
        ? Prisma.sql`an."momento" IS NOT NULL`
        : null,
      recorte.desde
        ? Prisma.sql`an."momento" >= ${recorte.desde}::timestamptz`
        : null,
      recorte.hasta
        ? Prisma.sql`an."momento" < ${recorte.hasta}::timestamptz`
        : null,
    ].filter((x): x is Prisma.Sql => x !== null),
    ' AND ',
  );

  /// Y si arriba se eligió UN grupo, aquí se enseña solo ese: las
  /// otras filas serían grupos que el filtro dice no mirar.
  const soloEseGrupo = recorte.grupoId
    ? Prisma.sql`AND g."id" = ${recorte.grupoId}`
    : Prisma.empty;

  return Prisma.sql`
    WITH ${PRIMERA_MATRICULA}
    SELECT g."id"              AS "grupoId",
           g."numero"          AS numero,
           g."modalidad"::text AS modalidad,
           COALESCE(s.sedes, '')             AS sedes,
           COALESCE(s.departamento, '')      AS departamento,
           COALESCE(s.meta, 0)               AS meta,
           COALESCE(s.coberturas, '[]'::json) AS coberturas,
           COALESCE(p."nominados", 0)        AS "nominadosPorEmpresa",
           COALESCE(p."campana", 0)          AS "campanaDigital",
           COALESCE(p."inscritosReserva", 0) AS "inscritosReservas",
           COALESCE(p."inscritosCampana", 0) AS "inscritosCampana",
           COALESCE(v."inscritosVigentes", 0) AS "inscritosVigentes"
      FROM "grupos" g

      -- LA META --con el 30 %-- Y DÓNDE SE DICTA, de las coberturas.
      --
      -- Y LAS COBERTURAS UNA A UNA, que es lo que hace editable la
      -- meta. La celda enseña la SUMA del departamento, así que con
      -- dos sedes dentro no se puede escribir encima: habría que
      -- decidir cómo se parte, y eso es decidir por quien escribe.
      -- Medido sobre el catálogo: de 113 filas, 112 son una sola
      -- cobertura y la que no es AF7 grupo 1 ANTIOQUIA, que junta
      -- Medellín presencial con la virtual del departamento.
      LEFT JOIN (
        SELECT c."grupoId" AS gid,
               u."departamento" AS departamento,
               SUM(c."cuposMaximos")::int AS meta,
               -- Las SEDES sí se pegan: dentro de un departamento
               -- puede haber varias ciudades y siguen siendo la misma
               -- fila.
               STRING_AGG(DISTINCT u."nombre", ', ') AS sedes,
               JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'coberturaId', c."id",
                   'ubicacionId', u."id",
                   'ubicacion',   u."nombre",
                   'modalidad',   c."modalidad"::text,
                   'cuposBase',   c."cuposBase",
                   'cuposMaximos', c."cuposMaximos"
                 ) ORDER BY u."nombre"
               ) AS coberturas
          FROM "grupos_cobertura" c
          JOIN "ubicaciones" u ON u."id" = c."ubicacionId"
         GROUP BY 1, 2
      ) s ON s.gid = g."id"

      -- LAS PERSONAS DEL GRUPO, por dónde llegaron. Cuelgan de la
      -- cobertura, que es la que tiene el grupo.
      LEFT JOIN (
        SELECT c."grupoId" AS gid,
               u."departamento" AS departamento,
               -- LOS LEADS, por cuando ENTRO la persona.
               COUNT(*) FILTER (
                 WHERE pa."origen"::text = ${DE_RESERVA} AND ${llego}
               )::int AS "nominados",
               COUNT(*) FILTER (
                 WHERE pa."origen"::text <> ${DE_RESERVA} AND ${llego}
               )::int AS "campana",
               -- LOS INSCRITOS: el ancla pone la FECHA y la etapa de
               -- hoy decide si CUENTA, igual que en la tabla por
               -- accion. Si las dos no dicen lo mismo, el desglose por
               -- grupos no suma su propia fila, que es justo el ruido
               -- que el cliente nos señalo en Trafico. El porque esta
               -- en el docblock de resumen-por-accion.ts.
               COUNT(*) FILTER (
                 WHERE pa."origen"::text = ${DE_RESERVA}
                   AND ${seInscribio}
               )::int AS "inscritosReserva",
               COUNT(*) FILTER (
                 WHERE pa."origen"::text <> ${DE_RESERVA}
                   AND ${seInscribio}
               )::int AS "inscritosCampana"
          FROM "participantes" pa
          JOIN "grupos_cobertura" c ON c."id" = pa."coberturaId"
          JOIN "ubicaciones" u ON u."id" = c."ubicacionId"
          LEFT JOIN primera_matricula an ON an."pid" = pa."id"
         WHERE ${gente}
         GROUP BY 1, 2
      ) p ON p.gid = g."id"
             -- IS NOT DISTINCT FROM y no =: el grupo sin coberturas
             -- trae el departamento en nulo por los dos lados, y con
             -- = ese cruce no casaría nunca.
             AND p.departamento IS NOT DISTINCT FROM s.departamento

      -- LOS QUE OCUPAN SILLA HOY, y es OTRA subconsulta: no lleva la
      -- ventana NI LOS FILTROS.
      --
      -- De aqui salen los cupos disponibles, y un cupo es del grupo,
      -- no de quien lo mire: filtrando por una asesora, contar solo
      -- SUS inscritos decia que en un grupo lleno quedan 64 cupos
      -- libres. La meta no se recorta, asi que lo que se le resta
      -- tampoco puede recortarse.
      LEFT JOIN (
        SELECT c."grupoId" AS gid,
               u."departamento" AS departamento,
               COUNT(*) FILTER (
                 WHERE pa."etapa"::text IN ${INSCRITAS}
               )::int AS "inscritosVigentes"
          FROM "participantes" pa
          JOIN "grupos_cobertura" c ON c."id" = pa."coberturaId"
          JOIN "ubicaciones" u ON u."id" = c."ubicacionId"
         GROUP BY 1, 2
      ) v ON v.gid = g."id"
             AND v.departamento IS NOT DISTINCT FROM s.departamento

     WHERE g."accionFormacionId" = ${accionFormacionId}
       ${soloEseGrupo}
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
  /// Sus sedes, una a una: es lo que hace editable la meta.
  coberturas: SedeDelGrupo[];
  nominadosPorEmpresa: number;
  campanaDigital: number;
  inscritosReservas: number;
  inscritosCampana: number;
  /// Los que ocupan silla HOY. No sale a la pantalla: es el insumo de
  /// los cupos disponibles, igual que en la tabla por acción.
  inscritosVigentes: number;
};

/** Las cuatro columnas calculadas, con las mismas reglas que la tabla por acción. */
export function completarGrupo(f: Cruda): FilaDeGrupo {
  const { inscritosVigentes, ...columnas } = f;
  const totalLeads = columnas.nominadosPorEmpresa + columnas.campanaDigital;
  const totalInscritos =
    columnas.inscritosReservas + columnas.inscritosCampana;
  /**
   * Meta menos quien OCUPA SILLA HOY, no menos los inscritos del
   * periodo. El cupo se consume cuando la persona queda inscrita ---la
   * corrección que el cliente hizo en Comité Marketing--- y se libera
   * cuando se va; lo que no puede es depender de la ventana que se
   * esté mirando: con «Hoy» arriba, un grupo lleno enseñaba sus 65
   * cupos libres.
   */
  const cuposDisponibles = columnas.meta - inscritosVigentes;
  return {
    ...columnas,
    totalLeads,
    totalInscritos,
    /**
     * CONVERSION = INSCRITOS SOBRE LA META, no sobre los leads.
     *
     * Lo pidio Josse el 7 oct 2026 mirando la pantalla: «la conversion
     * debe ser el total de inscritos sobre la meta, porque el porcentaje
     * que esta actualmente esta mal». La pregunta que se hace con esta
     * tabla es si se va a cumplir, no que parte de los leads cuaja.
     *
     * Y POR ESO DESAPARECE EL GUARD DE «NO PASARSE». Con los leads de
     * denominador, pasar del 100 % era un sinsentido ---dos poblaciones
     * distintas bajo una ventana--- y se imprimia nulo. Contra la meta
     * es al reves: 120 % es la noticia buena y esconderla seria esconder
     * justo lo que se mira. Lo unico que sigue siendo nulo es la meta en
     * cero, porque ahi no hay contra que medir.
     *
     * La regla vive en cumplimiento() y no aqui: su gemela por grupo
     * hacia la misma division con su propia copia, y el panel una
     * tercera sin el guard. Tres copias de una cifra que tiene que ser
     * la misma en dos pantallas.
     */
    conversion: cumplimiento(totalInscritos, columnas.meta),
    cuposDisponibles,
    estado: cuposDisponibles <= 0 ? 'CERRADO' : 'ABIERTO',
  };
}
