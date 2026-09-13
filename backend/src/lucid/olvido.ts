/** Las conversaciones de nadie no se guardan para siempre. */

/**
 * Decision del cliente, 13 sep 2026: SESENTA DIAS.
 *
 * Una `SIN_DUENO` es una conversacion de WhatsApp de alguien de
 * quien no consta autorizacion y a quien ni siquiera podemos
 * identificar. Guardarla indefinidamente no se sostiene.
 *
 * SOLO SIN_DUENO, y las otras dos NO por motivos distintos:
 *
 *   PEGADA  sostiene la idempotencia. Borrarla haria que un
 *           reintento tardio dejara una segunda nota, que es
 *           justo lo que la fila existe para impedir. Y el
 *           texto ya vive en la nota, que no se borra.
 *   AMBIGUA SI es de alguien --de varios, por eso no se
 *           eligio--. Borrarla tira la conversacion de una
 *           persona que esta en el CRM. Esas se resuelven
 *           mirandolas, no dejandolas caducar.
 */

export const DIAS_QUE_SE_GUARDAN = 60;

/** Antes de esta fecha, se olvidan. */
export function limiteDelOlvido(hoy: Date): Date {
  return new Date(hoy.getTime() - DIAS_QUE_SE_GUARDAN * 24 * 60 * 60 * 1000);
}
