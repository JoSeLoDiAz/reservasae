/** Si a este lead se le puede llamar, y por qué no. */

/**
 * Una sola regla, y la usan LAS DOS: la pantalla para pintar el
 * botón y el `POST :id/notas` para aceptar la nota. Un control que
 * solo está en el navegador no es un control — la ruta se llama
 * directo, y eso ya está escrito en `asignar()`.
 *
 * LO QUE BLOQUEA ES LA REVOCACIÓN, Y SOLO ESO.
 *
 * Es la distinción que hace correcta a esta función, y es fácil
 * equivocarse en ella:
 *
 *   - Quien **revocó** pidió que dejaran de usar sus datos. El
 *     artículo 8 de la Ley 1581 es de los dos lados, y llamarlo
 *     sería exactamente lo que pidió que no pasara.
 *   - Quien **todavía no ha autorizado** es el caso NORMAL de un
 *     lead recién llegado. Llamarlo es COMO SE CONSIGUE la
 *     autorización: bloquearlo dejaría el CRM sin su trabajo
 *     principal.
 *
 * Quien «arregle» esto bloqueando también al segundo habrá
 * apagado la mesa entera sin que nada falle. Por eso el spec lleva
 * el aserto que nadie escribe —que un lead sin ninguna revocación
 * SÍ se puede llamar—, que es el que protege del arreglo
 * excesivo.
 *
 * La decisión es PURA y los hechos se buscan aparte. Así se puede
 * fijar en un test sin levantar media aplicación, que es el mismo
 * criterio de `escalera.ts` y `completitud.ts`.
 */

export type PuedoContactar =
  /// Adelante.
  | 'SI'
  /// Pidió que dejaran de usar sus datos.
  | 'REVOCO'
  /// Ya se convirtió o se descartó: la gestión va en su ficha.
  | 'YA_NO_ESTA_EN_LA_MESA';

/// Lo mínimo que hace falta para decidir.
export type HechosParaContactar = {
  estado: string;
  participanteId: string | null;
  /// Si ALGUNA persona a la que este lead se parece revocó.
  /// Lo resuelve `hechosParaContactar` del servicio, que es quien
  /// puede preguntarle a la base.
  revoco: boolean;
};

export function puedoContactar(h: HechosParaContactar): PuedoContactar {
  /// Primero lo que saca al lead de la mesa: si ya tiene ficha, la
  /// gestión va allá y duplicarla aquí daría dos historiales de la
  /// misma persona.
  if (h.participanteId || h.estado !== 'PENDIENTE') {
    return 'YA_NO_ESTA_EN_LA_MESA';
  }
  if (h.revoco) return 'REVOCO';
  return 'SI';
}

/// La frase que ve el asesor. Vacía cuando se puede llamar.
export function porQueNoPuedoContactar(r: PuedoContactar): string | null {
  if (r === 'SI') return null;
  if (r === 'REVOCO') {
    return (
      'Esta persona revocó la autorización de tratamiento de sus datos. ' +
      'No se le puede contactar por esta vía.'
    );
  }
  return 'Este lead ya se atendió: la gestión va en su ficha.';
}
