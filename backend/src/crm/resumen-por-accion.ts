/** La tabla del comité: una fila por acción de formación. */

/**
 * ES EL EXCEL QUE EL CLIENTE LLEVA A MANO.
 *
 * Nos lo pasó el 23 de septiembre de 2026 con una instrucción clara:
 * «esto es como la tabla que te compartí; el resumen es lo gráfico, ya
 * el detalle es la tabla». Sus columnas, y de dónde sale cada una:
 *
 * | Columna              | De dónde |
 * |----------------------|----------|
 * | Meta                 | Cronograma: la suma de `cuposMaximos` de las coberturas de sus grupos --o sea, CON el 30 %--. «Ahí tienes Grupo (departamento del grupo) y cantidad de cupos: ahí tienes el insumo». |
 * | Cupos reservados     | Reservas CONFIRMADAS de sus ofertas, sumando `cuposConfirmados`. |
 * | Campaña digital      | Personas que llegaron por su cuenta --formulario, pauta, mailing, WhatsApp--, o sea todas menos las que nominó una empresa. |
 * | Inscritos reservas   | De las nominadas por empresa, las que ya están inscritas. |
 * | Inscritos campaña    | Lo mismo, de las que llegaron por su cuenta. |
 * | % de conversión      | Total inscritos sobre cupos reservados + campaña digital. |
 * | Cupos disponibles    | Meta menos total de inscritos. |
 * | Estado               | CERRADO cuando no quedan cupos. |
 *
 * DOS DECISIONES QUE NO SON OBVIAS:
 *
 * 1. `cuposMaximos` y no `cuposBase`. O sea, CON el 30 % de sobrecupo:
 *    «esto es con el 30 %, tanto en la general como en la que se ve
 *    por AF» (cliente, 23 sep 2026).
 *
 *    Esto estuvo al revés y hay que decir por qué, porque el
 *    argumento de entonces suena sensato y volverá: se puso
 *    `cuposBase` razonando que la meta es lo comprometido ante el SENA
 *    y que el 30 % es margen de gestión. El cliente lo corrigió, y su
 *    Excel le da la razón: ahí AF1 son 520 = 8 grupos × 65, que es el
 *    máximo, no la base. La meta con la que él trabaja es hasta dónde
 *    se puede llenar, no el mínimo que hay que entregar.
 *
 * 2. Los cupos disponibles NO descuentan los reservados. Es la misma
 *    regla que el cliente corrigió ese día en Comité Marketing: una
 *    reserva es una intención, y el cupo se consume cuando la persona
 *    queda inscrita. En su propio Excel se ve: AF2 con meta 520, 76
 *    reservados y 524 inscritos da −4 disponibles, o sea meta menos
 *    inscritos.
 */

import { Prisma } from '../../generated/prisma';

export type FilaDeAccion = {
  accionFormacionId: string;
  codigo: string;
  nombre: string;
  meta: number;
  cuposReservados: number;
  campanaDigital: number;
  inscritosReservas: number;
  inscritosCampana: number;
  /// `campanaDigital + cuposReservados`, para no repetir la suma en
  /// tres sitios de la pantalla.
  totalLeads: number;
  totalInscritos: number;
  /// Nulo cuando no hay de dónde dividir: un porcentaje sobre cero es
  /// el `#DIV/0!` que su Excel enseña en tres filas.
  conversion: number | null;
  cuposDisponibles: number;
  estado: 'ABIERTO' | 'CERRADO';
};

/// Las etapas que ya ocupan una silla. Se repite aquí --y no se importa
/// de `etapas.ts`-- porque va dentro de un SQL y lo que viaja es el
/// texto del enum, no el arreglo.
const INSCRITAS = Prisma.sql`('INSCRITO','EN_FORMACION','CERTIFICADO')`;

/// De quién dice el sistema que «lo nominó la empresa»: es lo que en la
/// tabla del comité cuenta como reserva.
const DE_RESERVA = Prisma.sql`'EMPRESA'`;

/**
 * Una fila por acción de formación del ámbito, con todo lo de arriba.
 *
 * En una sola consulta y no en cinco: son cuatro conteos sobre las
 * mismas dos tablas, y traerlos por separado obligaba a cuadrarlos en
 * memoria --que es justo donde se cuela un desfase cuando alguien se
 * inscribe entre una consulta y la siguiente--.
 */
export function resumenPorAccionSql(ambito: string[], convenioElegido: string | null): Prisma.Sql {
  const delGremio = convenioElegido
    ? Prisma.sql`AND a."convenioId" = ${convenioElegido}`
    : Prisma.empty;

  return Prisma.sql`
    SELECT a."id"      AS "accionFormacionId",
           a."codigo"  AS codigo,
           a."nombre"  AS nombre,
           COALESCE(m.meta, 0)            AS meta,
           COALESCE(r.reservados, 0)      AS "cuposReservados",
           COALESCE(p.campana, 0)         AS "campanaDigital",
           COALESCE(p."inscritosReserva", 0) AS "inscritosReservas",
           COALESCE(p."inscritosCampana", 0) AS "inscritosCampana"
      FROM "acciones_formacion" a

      -- LA META, DEL CRONOGRAMA Y CON EL 30 % (cliente, 23 sep 2026).
      -- Una acción sin grupos todavía da cero, y eso es cierto: no hay
      -- cupos abiertos.
      LEFT JOIN (
        SELECT g."accionFormacionId" AS aid, SUM(c."cuposMaximos")::int AS meta
          FROM "grupos" g
          JOIN "grupos_cobertura" c ON c."grupoId" = g."id"
         GROUP BY 1
      ) m ON m.aid = a."id"

      -- LOS CUPOS APARTADOS, solo de reservas confirmadas: los de una
      -- cancelada volvieron a la oferta.
      LEFT JOIN (
        SELECT o."accionFormacionId" AS aid, SUM(res."cuposConfirmados")::int AS reservados
          FROM "reservas" res
          JOIN "ofertas" o ON o."id" = res."ofertaId"
         WHERE res."estado" = 'CONFIRMADA'
         GROUP BY 1
      ) r ON r.aid = a."id"

      -- LAS PERSONAS, partidas en dos: las que nominó una empresa y
      -- las que llegaron por su cuenta.
      LEFT JOIN (
        SELECT pa."accionFormacionId" AS aid,
               COUNT(*) FILTER (WHERE pa."origen"::text <> ${DE_RESERVA})::int AS campana,
               COUNT(*) FILTER (
                 WHERE pa."origen"::text = ${DE_RESERVA}
                   AND pa."etapa"::text IN ${INSCRITAS}
               )::int AS "inscritosReserva",
               COUNT(*) FILTER (
                 WHERE pa."origen"::text <> ${DE_RESERVA}
                   AND pa."etapa"::text IN ${INSCRITAS}
               )::int AS "inscritosCampana"
          FROM "participantes" pa
         WHERE pa."accionFormacionId" IS NOT NULL
         GROUP BY 1
      ) p ON p.aid = a."id"

     WHERE a."convenioId" IN (${Prisma.join(ambito)})
       ${delGremio}
     ORDER BY a."codigo" ASC
  `;
}

type Cruda = {
  accionFormacionId: string;
  codigo: string;
  nombre: string;
  meta: number;
  cuposReservados: number;
  campanaDigital: number;
  inscritosReservas: number;
  inscritosCampana: number;
};

/**
 * Las cuatro columnas calculadas.
 *
 * Aparte del SQL a propósito: son las que el cliente lee y discute, y
 * aquí se pueden probar sin base de datos.
 */
export function completarFila(f: Cruda): FilaDeAccion {
  const totalLeads = f.cuposReservados + f.campanaDigital;
  const totalInscritos = f.inscritosReservas + f.inscritosCampana;
  const cuposDisponibles = f.meta - totalInscritos;
  return {
    ...f,
    totalLeads,
    totalInscritos,
    /// Sobre los leads --reservados más campaña-- y no sobre la meta:
    /// la conversión responde «de los que llegaron, cuántos entraron».
    conversion: totalLeads > 0 ? totalInscritos / totalLeads : null,
    cuposDisponibles,
    /// Cerrada cuando no queda cupo. Sin fecha de por medio: una acción
    /// con cupos y sin grupos abiertos sigue admitiendo gente, y las
    /// fechas las dice el cronograma.
    estado: cuposDisponibles <= 0 ? 'CERRADO' : 'ABIERTO',
  };
}
