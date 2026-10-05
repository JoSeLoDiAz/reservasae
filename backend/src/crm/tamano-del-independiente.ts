/** El tamaño SEP de quien trabaja con su propio RUT. */

/**
 * SIEMPRE MICROEMPRESA (cliente, 1 oct 2026: «tamaño va a ser
 * microempresa cuando es RUT»).
 *
 * Y es verdad por definición: una persona natural que factura con su
 * cédula no llega al techo de ingresos de ninguna de las otras
 * categorías. La duda no es el tamaño, es CUÁL de las tres: el SEP no
 * tiene una «microempresa» a secas, la parte por sector ---manufactura,
 * servicios y comercio--- porque el umbral de ingresos es distinto en
 * cada uno.
 *
 * De ahí este mapa. El sector sí se pregunta en el formulario, pero la
 * lista de la casa tiene QUINCE opciones y el SEP solo tres casillas,
 * así que hay que decidir a cuál va cada una. Se decide aquí, escrito,
 * y no repartido por el código:
 *
 *   - Comercio -> comercio.
 *   - Industria y manufactura -> manufactura.
 *   - TODO LO DEMÁS -> servicios, que es la casilla residual del SEP.
 *     Construcción y agricultura no son ni lo uno ni lo otro y no hay
 *     una cuarta donde ponerlas; servicios es la que menos miente.
 *
 * SIN SECTOR NO SE ADIVINA: devuelve `null` y el campo se queda vacío,
 * que es lo honesto. Poner una de las tres al azar mete un dato
 * inventado en el archivo que se le entrega al SENA.
 */

/// Los tres de `TAMANOS_EMPRESA_SEP`. Van por id y no por etiqueta: la
/// etiqueta lleva las cifras de los umbrales y cambia cada año.
export const MICROEMPRESA_MANUFACTURA = 43;
export const MICROEMPRESA_SERVICIOS = 44;
export const MICROEMPRESA_COMERCIO = 45;

/// Sin tildes y en minúscula: las fichas viejas traen «COMERCIO» en
/// mayúsculas y las nuevas «Comercio», y del RUES llegan con sus
/// propias palabras.
const limpiar = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function tamanoDeIndependiente(
  sectorEconomico: string | null | undefined,
): number | null {
  if (!sectorEconomico) return null;
  const s = limpiar(sectorEconomico);

  if (s.includes('comercio')) return MICROEMPRESA_COMERCIO;
  if (s.includes('manufactura') || s.includes('industria')) {
    return MICROEMPRESA_MANUFACTURA;
  }
  return MICROEMPRESA_SERVICIOS;
}
