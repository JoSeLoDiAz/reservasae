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
 * En qué estado está la autorización de esta persona.
 *
 * Son CUATRO y no dos, y la diferencia importa porque el motivo
 * se escribe en la fila y alguien lo va a leer.
 */
export type EstadoAutorizacion =
  /// La dio y sigue viva: se le puede escribir.
  | 'VIVA'
  /// La dio y la revocó. Es un derecho ejercido.
  | 'REVOCADA'
  /// Nunca hubo una. No es lo mismo que revocarla.
  | 'NUNCA'
  /// Sin ficha: los correos de una base subida.
  | 'SIN_FICHA';

/**
 * El estado de la autorización en ESE convenio.
 *
 * Antes devolvía `boolean | null` y `false` juntaba dos cosas
 * distintas: quien REVOCÓ y quien NUNCA autorizó. Los dos casos
 * se omiten igual —y hacen bien—, pero el motivo que se escribía
 * era «Revocó la autorización» para los dos. Un asesor crea una
 * ficha y la autorización se registra después, así que ese
 * motivo es falso justo en el caso más común, y queda escrito en
 * la fila de por qué no se mandó el correo.
 *
 * Es el mismo defecto que tenía el candado del RUI, y por eso se
 * arregla igual: distinguir «no la ha dado» de «la retiró».
 */
export async function estadoDeAutorizacion(
  prisma: PrismaService,
  participanteId: string | null,
): Promise<EstadoAutorizacion> {
  if (!participanteId) return 'SIN_FICHA';

  const p = await prisma.participante.findUnique({
    where: { id: participanteId },
    select: { personaId: true, convenioId: true },
  });
  if (!p) return 'SIN_FICHA';

  const suyas = await prisma.autorizacionDatos.findMany({
    where: { personaId: p.personaId, politica: { convenioId: p.convenioId } },
    select: { revocadaEn: true },
  });

  if (suyas.some((a) => a.revocadaEn === null)) return 'VIVA';
  return suyas.length > 0 ? 'REVOCADA' : 'NUNCA';
}

/** Si NO se le puede escribir en este convenio. */
export function noSeLePuedeEscribir(estado: EstadoAutorizacion): boolean {
  return estado === 'REVOCADA' || estado === 'NUNCA';
}

/// Lo que se le escribe en la fila cuando se omite. En
/// palabras, porque alguien va a leer esa lista y va a tener
/// que explicárselo a otro -- y por eso tiene que ser verdad.
export function porQueNoSeLeMando(estado: EstadoAutorizacion): string {
  return estado === 'REVOCADA'
    ? 'Revocó la autorización de tratamiento de datos en este convenio.'
    : 'No ha autorizado el tratamiento de sus datos en este convenio.';
}
