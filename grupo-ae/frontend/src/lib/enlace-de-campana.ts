/** La marca de campaña: lo único que ata un formulario con su pauta. */

/**
 * NO HAY `formularioId` EN UNA OPORTUNIDAD, Y POR ESO ESTO EXISTE.
 *
 * `Oportunidad` guarda `campana`, una cadena libre, y el resumen del
 * embudo (`porCampana`) agrupa por esa cadena y por nada más. No hay
 * columna que diga por qué puerta entró un negocio, así que la
 * pregunta del dueño —«¿cuántos leads trajo ESTE formulario?»— no
 * tiene respuesta contra la base tal como está.
 *
 * La respuesta que sí cabe es una CONVENCIÓN en la propia etiqueta:
 * el enlace se genera con la campaña prefijada por el identificador
 * del formulario, y entonces la etiqueta se lee sola.
 *
 *     empresas-2026/meta-octubre
 *     ^^^^^^^^^^^^^ ^^^^^^^^^^^^
 *     la puerta     el anuncio
 *
 * Todo lo que empiece por `empresas-2026/` entró por ese formulario.
 * Es una convención y no una llave: quien escriba la campaña a mano
 * en la ficha de una oportunidad puede poner lo que quiera, y
 * entonces no cuenta. A cambio, funciona hoy y sin tocar el backend.
 *
 * El separador es `/` a propósito: en el tablero del embudo la
 * etiqueta se lee entera y así se distingue de un vistazo la puerta
 * del anuncio, sin necesidad de leyenda.
 */

/**
 * LOS DOS PARÁMETROS SE LLAMAN COMO LOS CAMPOS DEL DTO, Y ES A
 * PROPÓSITO.
 *
 * `CaptarDto` —lo único que acepta `POST /captacion/:slug`, con
 * `whitelist` y `forbidNonWhitelisted`— declara `campana` y
 * `origen`, y el servicio los escribe tal cual en la oportunidad
 * que nace. Llamarlos igual aquí deja que la pantalla pública los
 * pase de la URL al cuerpo sin traducir nada.
 *
 * `utm_campaign` habría sido la costumbre de la industria y es
 * justo la que introduce la traducción: dos nombres para el mismo
 * dato, y una tabla de equivalencias que alguien mantiene a mano.
 */
export const PARAMETRO_CAMPANA = "campana";
export const PARAMETRO_ORIGEN = "origen";

const SEPARADOR = "/";

/// El backend guarda `campana` en 120 caracteres. Es el tope real y
/// se aplica ANTES de armar el enlace: recortar después dejaría una
/// dirección que promete una campaña y entrega otra.
export const LARGO_MAXIMO_CAMPANA = 120;

/** Lo que se escribe en `campana`: la puerta y, si lo hay, el anuncio. */
export function marcaDeCampana(slug: string, anuncio: string): string {
  const limpio = anuncio.trim().replace(/\s+/g, " ");
  return limpio ? `${slug}${SEPARADOR}${limpio}` : slug;
}

/** Cuánto anuncio cabe todavía, con la puerta ya puesta. */
export function cuantoCabeDeAnuncio(slug: string): number {
  return Math.max(0, LARGO_MAXIMO_CAMPANA - slug.length - SEPARADOR.length);
}

/** Si esa etiqueta de campaña salió de este formulario. */
export function esDeLaPuerta(slug: string, etiqueta: string): boolean {
  return etiqueta === slug || etiqueta.startsWith(`${slug}${SEPARADOR}`);
}

/**
 * El anuncio suelto, sin la puerta delante.
 *
 * Cadena vacía cuando el enlace se repartió sin anuncio: quien la
 * pinta decide cómo llamar a eso, que no es lo mismo en una tabla
 * que en una cifra.
 */
export function anuncioDe(slug: string, etiqueta: string): string {
  return etiqueta === slug ? "" : etiqueta.slice(slug.length + SEPARADOR.length);
}

/**
 * La dirección que se reparte.
 *
 * `ruta` entera y no el slug, porque las dos puertas del sistema no
 * viven en el mismo sitio: un formulario del constructor está en
 * `/<slug>` y el corto de un gremio en `/<gremio>/preinscripcion`.
 *
 * Sin `base` —el primer render del servidor, donde no hay `window`—
 * devuelve la ruta relativa. Es lo que se puede afirmar en ese
 * momento; inventarse un dominio daría un enlace que no lleva a
 * ninguna parte y que alguien acabaría copiando.
 */
export function enlaceConCampana(
  base: string,
  ruta: string,
  marca: string,
  origen?: string,
): string {
  const parametros = new URLSearchParams();
  if (marca) parametros.set(PARAMETRO_CAMPANA, marca);
  if (origen) parametros.set(PARAMETRO_ORIGEN, origen);
  const cola = parametros.toString();
  return `${base}${ruta}${cola ? `?${cola}` : ""}`;
}
