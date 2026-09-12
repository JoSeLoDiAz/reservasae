/** Los sectores económicos que se le ofrecen a una organización. */

/**
 * La lista la fijó el cliente el 11 sep 2026. Antes eran TRES
 * —Comercio, Servicios, Manufactura— y con eso una constructora,
 * un colegio y una peluquería caían todas en «Servicios».
 *
 * Se guarda el TEXTO, no un código, y esa es la razón de que las
 * etiquetas estén escritas como se leen: este valor viaja tal cual
 * a la columna «SECTOR ECONÓMICO AL QUE PERTENECE» del formato F7
 * que se entrega al SENA (`backend/src/crm/sep/formato-f7.ts`).
 * Un código como `TURISMO_ALOJAMIENTO` llegaría así al archivo.
 *
 * Orden: el del cliente. No es alfabético a propósito —empieza por
 * los sectores con más organizaciones en los convenios— y
 * «Otro» cierra la lista.
 */
export const SECTORES = [
  "Comercio",
  "Industria y manufactura",
  "Construcción",
  "Agricultura y sector agropecuario",
  "Transporte y logística",
  "Turismo, alojamiento y gastronomía",
  "Tecnología y comunicaciones (TIC)",
  "Servicios profesionales",
  "Educación",
  "Salud",
  "Servicios financieros",
  "Entretenimiento, cultura y recreación",
  "Belleza y cuidado personal",
  "Emprendimiento y economía popular",
  "Otro",
] as const;

/**
 * La lista para un desplegable, con lo que ya estuviera guardado.
 *
 * Las fichas viejas tienen `COMERCIO`, `SERVICIOS` o `MANUFACTURA`
 * —los tres valores de antes—, y también hay organizaciones cuyo
 * sector llegó del RUES con sus propias palabras. Si la lista no
 * incluyera ese valor, el desplegable saldría en «Elija…» y al
 * guardar cualquier otro campo se borraría un dato que nadie
 * quiso tocar.
 */
export function sectoresConElActual(actual?: string | null): string[] {
  const limpio = (actual ?? "").trim();
  if (!limpio) return [...SECTORES];
  const yaEsta = SECTORES.some((s) => s.toLowerCase() === limpio.toLowerCase());
  return yaEsta ? [...SECTORES] : [...SECTORES, limpio];
}
