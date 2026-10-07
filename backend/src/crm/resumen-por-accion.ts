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

import { PRIMERA_MATRICULA } from './anclas';
import { cumplimiento } from './proyeccion-metas';

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
/** Lo que recorta la pantalla: los cinco filtros y la ventana. */
export type RecorteDelResumen = {
  accionFormacionId?: string;
  grupoId?: string;
  asesorId?: string;
  departamentoSepId?: number;
  /**
   * Instantes. Y recortan DOS COSAS DISTINTAS, que es lo que arregla
   * «no tengo certeza de inscripciones realizadas en control de
   * inscritos» (cliente, 5 oct 2026):
   *
   *   - los LEADS, por cuándo entró la persona;
   *   - los INSCRITOS, por cuándo se inscribió.
   */
  desde?: string;
  hasta?: string;
};

export function resumenPorAccionSql(
  ambito: string[],
  convenioElegido: string | null,
  recorte: RecorteDelResumen = {},
): Prisma.Sql {
  const delGremio = convenioElegido
    ? Prisma.sql`AND a."convenioId" = ${convenioElegido}`
    : Prisma.empty;

  /// EL MISMO RECORTE QUE EL RESTO DE LA PANTALLA (cliente, 23 sep
  /// 2026: «los filtros deben ser funcionales, hasta el momento no los
  /// entiendo para nada»). Esta tabla no obedecía a nada --ni a los
  /// cinco filtros ni al periodo--, así que con «Hoy» arriba decía una
  /// persona y aquí abajo doscientas siete.
  ///
  /// La META NO se recorta: los cupos comprometidos son los que son
  /// hoy y ayer. Lo que se recorta es la GENTE.
  const gente = Prisma.join(
    [
      Prisma.sql`pa."accionFormacionId" IS NOT NULL`,
      recorte.grupoId
        ? Prisma.sql`pa."coberturaId" IN (SELECT c."id" FROM "grupos_cobertura" c WHERE c."grupoId" = ${recorte.grupoId})`
        : null,
      recorte.asesorId ? Prisma.sql`pa."asesorId" = ${recorte.asesorId}` : null,
      recorte.departamentoSepId !== undefined
        ? Prisma.sql`pa."personaId" IN (SELECT p."id" FROM "personas" p WHERE p."departamentoSepId" = ${recorte.departamentoSepId})`
        : null,
    ].filter((x): x is Prisma.Sql => x !== null),
    ' AND ',
  );

  /**
   * CUÁNDO ENTRÓ LA PERSONA, para los leads.
   *
   * INSTANTES, no días, y el de arriba EXCLUSIVO: es lo mismo que hace
   * `donde()` con `gte`/`lt`. Comparando días de calendario el último
   * entraba entero y esta tabla contaba un día más que la tira de
   * arriba.
   */
  const llegoEnLaVentana = Prisma.join(
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

  /**
   * CUÁNDO SE APARTARON LOS CUPOS, para la columna de reservas.
   *
   * «Los filtros de tiempo o de fecha no funcionan, y ya lo había
   * reiterado en muchas ocasiones» (cliente, 7 oct 2026). Tenía razón
   * y el defecto estaba AQUÍ, no en la pantalla: la subconsulta de
   * reservas no llevaba ventana ninguna.
   *
   * Con «Ayer» puesto, AF1 enseñaba «Leads por su cuenta 0, Inscritos
   * 0, Cupos reservados 33» ---los 33 de siempre, los de toda la
   * vida---, y como `totalLeads` los suma, la fila decía 33 leads de
   * un día en que no entró nadie. Medido en el navegador.
   *
   * Se fecha por `creadoEn` y no por una fecha de confirmación porque
   * no la hay: una reserva NACE confirmada ---`estado` tiene
   * `@default(CONFIRMADA)`---, así que el día en que se creó es el día
   * en que esa empresa apartó esos cupos.
   *
   * Y NO ES LO MISMO QUE `cuposDisponibles`, que es la confusión que
   * costó esta columna: aquello es un SALDO ---cuántas sillas quedan
   * libres hoy--- y por eso no lleva ventana nunca, decisión tomada a
   * propósito y escrita en `completarFila`. Esto es un FLUJO: cuántos
   * cupos se apartaron EN EL PERIODO.
   */
  const seReservoEnLaVentana = Prisma.join(
    [
      Prisma.sql`res."estado" = 'CONFIRMADA'`,
      recorte.desde
        ? Prisma.sql`res."creadoEn" >= ${recorte.desde}::timestamptz`
        : null,
      recorte.hasta
        ? Prisma.sql`res."creadoEn" < ${recorte.hasta}::timestamptz`
        : null,
    ].filter((x): x is Prisma.Sql => x !== null),
    ' AND ',
  );

  /**
   * CUÁNDO SE INSCRIBIÓ, para los inscritos. Y es OTRA fecha.
   *
   * «No tengo certeza de inscripciones realizadas en control de
   * inscritos» (cliente, 5 oct 2026). No la tenía con razón: esta
   * tabla contaba como inscrito del periodo a quien LLEGÓ en el
   * periodo y está inscrito HOY. De ahí salían tres cosas torcidas:
   *
   *   - quien llegó en agosto y se inscribió hoy NO contaba hoy: con
   *     «Hoy» arriba, un día de veinte inscripciones podía salir en
   *     cero;
   *   - quien llegó y se inscribió el mismo día contaba, así que el
   *     número no era cero del todo y parecía creíble;
   *   - y una inscripción se BORRABA del pasado al desertar la
   *     persona, porque se miraba la etapa de hoy. El comité de
   *     septiembre cambiaba en octubre.
   *
   * Ahora se cuenta por el ancla ---la PRIMERA vez que la ficha llegó
   * a INSCRITO, que es un movimiento y no se reescribe nunca---, y eso
   * arregla las dos primeras. Es lo mismo que ya hacen el control de
   * inscripciones y el informe de reservas; esta tabla era la que iba
   * por su cuenta.
   *
   * LA TERCERA SE QUEDA, Y ES A PROPÓSITO.
   *
   * Aquí decía yo que una inscripción no se borra del pasado al
   * desertar la persona, y que mirar la etapa de hoy era el defecto.
   * Era mi razonamiento, y el cliente lo corrigió:
   *
   *   «Toma esto del historial, pero siempre y cuando el estado del
   *   lead sea inscrito, porque si lo estuvo y cambió su estado no
   *   aplica. Esto ya lo había solicitado reiteradamente pero no
   *   quedó» (cliente, 7 oct 2026).
   *
   * Y tiene razón, porque la pregunta que contesta esta tabla no es
   * «cuántas inscripciones se firmaron ese día»: es cuánta gente tiene
   * HOY esa acción, que es con lo que se responde ante el SENA y lo
   * que tiene que cuadrar con los cupos disponibles de al lado.
   *
   * Así que son DOS condiciones y cada una hace su parte: EL ANCLA
   * PONE LA FECHA Y LA ETAPA DE HOY DECIDE SI CUENTA. Quien se
   * inscribió en septiembre y desertó en octubre deja de salir en el
   * comité de septiembre, y eso es lo pedido.
   *
   * SI ESTO VUELVE A PARECER UN FALLO, NO LO REVIERTA. Está fijado en
   * `resumen-por-accion.spec.ts` con el porqué dentro, y el Resumen General
   * de esta misma pantalla cuadra con esta regla y no con la otra
   * ---comprobado en cuatro ventanas: 1292/1292, 1212/1212, 0/0 y
   * 1221/1221---.
   *
   * Y SIN VENTANA NO SE EXIGE EL ANCLA, solo la etapa: el movimiento
   * sirve para FECHAR, y sin periodo no hay nada que fechar. Pidiéndolo
   * igual, una ficha inscrita a la que le falte el movimiento ---las
   * hay, el sondeo las lista--- se caía del total, y el Resumen General
   * decía doce más.
   */
  /// Cada punta por su lado, igual que la de los leads: con media
  /// ventana ---solo `desde`--- el otro extremo queda abierto, y no
  /// como «todo el histórico».
  /**
   * Y SIGUE INSCRITO HOY. Es la corrección del cliente (7 oct 2026):
   * «toma esto del historial, pero siempre y cuando el estado del
   * lead sea inscrito, porque si lo estuvo y cambió su estado no
   * aplica».
   *
   * La fecha sale del historial ---el movimiento, que no se reescribe
   * nunca--- y la etapa de HOY decide si cuenta. Quien se inscribió en
   * septiembre y desertó sale de esta cifra y de los cupos
   * disponibles a la vez, que es lo coherente: la tabla responde
   * cuánta gente tiene hoy esa acción.
   *
   * SIN VENTANA NO SE EXIGE EL ANCLA, y exigirla costaba gente: el
   * movimiento sirve para FECHAR, y sin periodo no hay nada que
   * fechar. Pidiéndolo igual, una ficha inscrita a la que le falte
   * ---las hay, el sondeo de integridad las lista--- se caía del
   * total, y el Resumen General de la misma pantalla decía doce más.
   */
  const seInscribioEnLaVentana = Prisma.join(
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

  return Prisma.sql`
    WITH ${PRIMERA_MATRICULA}
    SELECT a."id"      AS "accionFormacionId",
           a."codigo"  AS codigo,
           a."nombre"  AS nombre,
           COALESCE(m.meta, 0)            AS meta,
           COALESCE(r.reservados, 0)      AS "cuposReservados",
           COALESCE(p.campana, 0)         AS "campanaDigital",
           COALESCE(p."inscritosReserva", 0) AS "inscritosReservas",
           COALESCE(p."inscritosCampana", 0) AS "inscritosCampana",
           COALESCE(v."inscritosVigentes", 0) AS "inscritosVigentes"
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

      -- LOS CUPOS APARTADOS EN EL PERIODO, solo de reservas
      -- confirmadas: los de una cancelada volvieron a la oferta.
      LEFT JOIN (
        SELECT o."accionFormacionId" AS aid, SUM(res."cuposConfirmados")::int AS reservados
          FROM "reservas" res
          JOIN "ofertas" o ON o."id" = res."ofertaId"
         WHERE ${seReservoEnLaVentana}
         GROUP BY 1
      ) r ON r.aid = a."id"

      -- LAS PERSONAS, partidas en dos: las que nominó una empresa y
      -- las que llegaron por su cuenta.
      LEFT JOIN (
        SELECT pa."accionFormacionId" AS aid,
               -- LOS LEADS, por cuando ENTRO la persona.
               COUNT(*) FILTER (
                 WHERE pa."origen"::text <> ${DE_RESERVA}
                   AND ${llegoEnLaVentana}
               )::int AS campana,
               -- LOS INSCRITOS: el ancla pone la FECHA y la etapa de
               -- hoy decide si CUENTA. Quien se inscribio en
               -- septiembre y deserto en octubre deja de salir en el
               -- comite de septiembre, que es lo que pidio el cliente
               -- el 7 oct 2026. El docblock de arriba lo explica, y
               -- el spec lo sujeta: no lo revierta.
               COUNT(*) FILTER (
                 WHERE pa."origen"::text = ${DE_RESERVA}
                   AND ${seInscribioEnLaVentana}
               )::int AS "inscritosReserva",
               COUNT(*) FILTER (
                 WHERE pa."origen"::text <> ${DE_RESERVA}
                   AND ${seInscribioEnLaVentana}
               )::int AS "inscritosCampana"
          FROM "participantes" pa
          LEFT JOIN primera_matricula an ON an."pid" = pa."id"
         WHERE ${gente}
         GROUP BY 1
      ) p ON p.aid = a."id"

      -- LOS QUE OCUPAN SILLA HOY, y es OTRA subconsulta: no lleva la
      -- ventana NI LOS CINCO FILTROS.
      --
      -- De aqui salen los cupos disponibles, y un cupo es del grupo,
      -- no de quien lo mire: filtrando por una asesora, contar solo
      -- SUS inscritos decia que en una accion llena quedan 519 cupos
      -- libres. La meta no se recorta, asi que lo que se le resta
      -- tampoco puede recortarse.
      LEFT JOIN (
        SELECT pa."accionFormacionId" AS aid,
               COUNT(*) FILTER (
                 WHERE pa."etapa"::text IN ${INSCRITAS}
               )::int AS "inscritosVigentes"
          FROM "participantes" pa
         WHERE pa."accionFormacionId" IS NOT NULL
         GROUP BY 1
      ) v ON v.aid = a."id"

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
  /**
   * Los que ocupan silla HOY, sin ventana.
   *
   * No sale a la pantalla: es solo para los cupos disponibles. Si
   * saliera, habría dos columnas de inscritos en la misma tabla y la
   * pregunta «¿y entonces cuántos son?» no tendría respuesta buena.
   */
  inscritosVigentes: number;
};

/**
 * Las cuatro columnas calculadas.
 *
 * Aparte del SQL a propósito: son las que el cliente lee y discute, y
 * aquí se pueden probar sin base de datos.
 */
export function completarFila(f: Cruda): FilaDeAccion {
  /// `inscritosVigentes` se saca aparte para que NO viaje en la fila:
  /// es el insumo de los cupos, no una columna de la pantalla.
  const { inscritosVigentes, ...columnas } = f;
  const totalLeads = columnas.cuposReservados + columnas.campanaDigital;
  const totalInscritos = columnas.inscritosReservas + columnas.inscritosCampana;

  /**
   * LOS CUPOS DISPONIBLES NO LLEVAN VENTANA, y antes sí la llevaban.
   *
   * Salían de `meta - totalInscritos`, y la meta no se recorta nunca
   * mientras los inscritos sí: con «Hoy» arriba, una acción llena
   * enseñaba sus 520 cupos libres y el estado ABIERTO. Ahora se
   * restan los que ocupan silla HOY, que es la pregunta que esta
   * columna contesta.
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
    /// Cerrada cuando no queda cupo. Sin fecha de por medio: una acción
    /// con cupos y sin grupos abiertos sigue admitiendo gente, y las
    /// fechas las dice el cronograma.
    estado: cuposDisponibles <= 0 ? 'CERRADO' : 'ABIERTO',
  };
}
