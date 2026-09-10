/**
 * «Nombres» es un campo para la persona y dos para el SEP.
 *
 * El reporte pide `NOMBRES`, `PRIMER APELLIDO` y `SEGUNDO
 * APELLIDO`, y la base guarda el nombre partido en dos. Pero
 * nadie sabe cuál de los suyos es «el segundo»: se escribe
 * «Juan Carlos» de un tirón. Se pide entero y se parte aquí,
 * por el primer espacio, para que la regla viva en un sitio
 * y los dos formularios la apliquen igual.
 *
 * «María del Carmen» queda como María + del Carmen, que es
 * lo que se quiere: el resto va junto, no se trocea más.
 */

const limpio = (n: string) => n.trim().replace(/\s+/g, " ");

/** El primero. Vacío si no escribió nada. */
export function primero(nombres: string): string {
  return limpio(nombres).split(" ")[0] ?? "";
}

/** Lo que sigue, o undefined si solo puso uno. */
export function resto(nombres: string): string | undefined {
  const partes = limpio(nombres).split(" ");
  return partes.length > 1 ? partes.slice(1).join(" ") : undefined;
}

/** Los dos otra vez juntos, para volver a pintarlos. */
export function juntar(
  primerNombre: string | null | undefined,
  segundoNombre: string | null | undefined,
): string {
  return [primerNombre, segundoNombre].filter(Boolean).join(" ");
}
