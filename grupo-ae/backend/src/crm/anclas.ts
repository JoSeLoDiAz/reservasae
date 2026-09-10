import { Prisma } from '../../generated/prisma';

/**
 * Cuándo pasó cada cosa, para poder cortar por periodo.
 *
 * Las anclas salen de `movimientos_participante` y no de
 * las columnas de fecha de `participantes`, por dos razones
 * que siguen en pie aunque esas columnas ya se escriban una
 * sola vez:
 *
 * 1. Las filas anteriores a ese cambio se matricularon con
 *    la fecha reescrita, así que su columna miente y su
 *    movimiento no.
 * 2. `fechaRetiro` sigue moviéndose a propósito —es la
 *    fecha del retiro vigente— y no hay columna alguna para
 *    «entró al aula», que es lo que ancla el académico.
 *
 * El movimiento no se reescribe nunca: es el registro de
 * auditoría. La PRIMERA vez que alguien llegó a una etapa
 * es un hecho que ya no cambia, y es lo único sobre lo que
 * se puede comparar un periodo con otro.
 */

/** La primera vez que cada quien llegó a INSCRITO. */
export const PRIMERA_MATRICULA = Prisma.sql`
  primera_matricula AS (
    SELECT m."participanteId" AS pid, MIN(m."creadoEn") AS momento
      FROM "movimientos_participante" m
     WHERE m."etapaDespues" = 'INSCRITO'::"EtapaParticipante"
       AND m."etapaAntes" IS DISTINCT FROM m."etapaDespues"
     GROUP BY 1
  )
`;

/**
 * La primera vez que cada quien pisó el aula.
 *
 * RETIRADO NO cuenta como pisarla: `cambiarEtapa` no
 * comprueba el orden del embudo y se puede salir desde
 * INSCRITO sin haber entrado nunca —la propia siembra lo
 * hace—, así que incluirlo fechaba a esa gente el día en
 * que se la retiró y la metía en una cohorte de aula donde
 * no estuvo, subiendo la deserción.
 *
 * Las otras cinco sí exigen haber entrado. Y se ancla aquí
 * y no en la matrícula porque nada obliga a pasar por
 * INSCRITO: un salto de DATOS_COMPLETOS a EN_FORMACION deja
 * a alguien dentro sin haberse matriculado, y anclar en la
 * matrícula lo haría invisible en cualquier ventana.
 */
export const PRIMERA_ENTRADA_AL_AULA = Prisma.sql`
  primera_entrada AS (
    SELECT m."participanteId" AS pid, MIN(m."creadoEn") AS momento
      FROM "movimientos_participante" m
     WHERE m."etapaDespues" IN (
       'EN_FORMACION'::"EtapaParticipante",
       'CERTIFICADO'::"EtapaParticipante",
       'NO_APROBO'::"EtapaParticipante",
       'DESERTO'::"EtapaParticipante",
       'ABANDONO'::"EtapaParticipante"
     )
       AND m."etapaAntes" IS DISTINCT FROM m."etapaDespues"
     GROUP BY 1
  )
`;

/**
 * El corte por periodo sobre un ancla ya unida como `an`.
 *
 * Sin ventana no filtra por fecha pero SÍ exige que el
 * hecho haya ocurrido: quien nunca llegó a inscrito no es
 * un inscrito, se mire el periodo que se mire.
 */
export function enPeriodo(
  desde: Date | null,
  hasta: Date | null,
): Prisma.Sql {
  if (!desde || !hasta) return Prisma.sql`AND an."momento" IS NOT NULL`;
  return Prisma.sql`AND an."momento" >= ${desde} AND an."momento" < ${hasta}`;
}
