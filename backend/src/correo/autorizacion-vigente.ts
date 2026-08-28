/** ¿Podemos escribirle a esta persona? */

/// Revocar la autorización es un derecho, no una preferencia:
/// artículo 8 de la Ley 1581. Si alguien la revoca y le
/// seguimos escribiendo, el derecho no existió.
///
/// Y el caso que lo hacía inevitable: la lista de una campaña
/// se CONGELA al lanzar. Quien revocaba el jueves seguía en la
/// lista congelada del martes y le llegaba igual. Por eso esto
/// se comprueba al MANDAR cada correo, no solo al armar la
/// lista: entre una cosa y otra pueden pasar días.
///
/// La autorización es POR CONVENIO. La misma persona puede
/// haberla dado a BRITCHAM y revocado a ADECOPRIA, y son dos
/// tratamientos distintos: cada gremio responde del suyo.

import type { PrismaService } from '../prisma/prisma.service';

/**
 * True si tiene una autorización viva en ESE convenio.
 *
 * Sin participante —los correos de una base subida— devuelve
 * `null`: no es que la haya revocado, es que nunca hubo una
 * que revocar. Quien llama decide qué hace con eso, porque no
 * es la misma conversación.
 */
export async function puedeRecibir(
  prisma: PrismaService,
  participanteId: string | null,
): Promise<boolean | null> {
  if (!participanteId) return null;

  const p = await prisma.participante.findUnique({
    where: { id: participanteId },
    select: { personaId: true, convenioId: true },
  });
  if (!p) return false;

  const vivas = await prisma.autorizacionDatos.count({
    where: {
      personaId: p.personaId,
      revocadaEn: null,
      politica: { convenioId: p.convenioId },
    },
  });

  return vivas > 0;
}

/// Lo que se le escribe en la fila cuando se omite. En
/// palabras, porque alguien va a leer esa lista y va a tener
/// que explicárselo a otro.
export const PORQUE_NO_SE_LE_MANDO =
  'Revocó la autorización de tratamiento de datos en este convenio.';
