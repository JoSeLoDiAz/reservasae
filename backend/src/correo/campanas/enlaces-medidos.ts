/** Los enlaces del correo, pasando por nuestro servidor. */

/// Es la única medición que no miente: el píxel de apertura
/// lo dispara Gmail solo, pero un clic lo da una persona.
///
/// Vive aparte para poder probarlo. Estaba metido dentro de
/// `armarHtml`, que además arma el banner y el píxel, y ahí
/// dentro no se podía comprobar lo único que de verdad tiene
/// reglas.

const ENLACE = /(https?:\/\/[^\s<]+)/g;

/**
 * Reescribe los enlaces de un texto YA ESCAPADO.
 *
 * Importa que llegue escapado: así se sabe que lo que hay no
 * es marcado, y lo único que se inserta es lo que pone esta
 * función.
 */
export function reescribirEnlaces(
  escapado: string,
  baseUrl: string,
  campanaId: string,
  destinatarioId: string,
): string {
  return escapado.replace(ENLACE, (url) => {
    /// El «&» ya viene escapado, y una URL con parámetros
    /// lleva «&» de verdad.
    ///
    /// Sin deshacerlo, `?utm_source=x&utm_medium=y` viajaba
    /// como `?utm_source=x&amp;utm_medium=y` y la persona
    /// aterrizaba en una dirección corrupta: la página cargaba
    /// sin la mitad de sus parámetros, o no cargaba. Y el
    /// clic SÍ quedaba contado, así que en el informe se veía
    /// interés donde solo hubo una página rota.
    const real = url.replace(/&amp;/g, '&');

    const destino = `${baseUrl}/campanas/${campanaId}/clic/${destinatarioId}?a=${encodeURIComponent(real)}`;

    /// El texto visible se deja COMO ESTABA, escapado. Lo que
    /// se cambia es a dónde lleva, no lo que la persona lee:
    /// si en el correo pone una dirección y al pasar el ratón
    /// sale otra, eso es lo que hace un correo de phishing.
    return `<a href="${destino}">${url}</a>`;
  });
}

/**
 * Los enlaces que de verdad lleva un texto.
 *
 * Se usa para comprobar, al pulsar, que el destino que viene
 * en la URL es uno de los que la campaña escribió.
 */
export function enlacesDe(texto: string): string[] {
  return [...new Set(texto.match(ENLACE) ?? [])];
}

/**
 * ¿Es este destino uno de los de la campaña?
 *
 * Antes solo se comprobaba que empezara por http, y con eso
 * el dominio del gremio redirigía a donde le pidieran. El
 * propio comentario del código lo advertía —«sería abrirle la
 * puerta a que usen nuestro dominio»— pero la comprobación no
 * lo hacía.
 *
 * Importa porque quien recibe el correo YA confía en ese
 * remitente: le escribió sobre su inscripción al SENA. Un
 * enlace que sale del dominio del gremio y termina en una
 * página de estafa no le resulta raro a nadie, y la marca del
 * gremio queda pegada al fraude.
 *
 * No hace falta guardar nada aparte: los enlaces están en el
 * cuerpo de la campaña, que es la fuente de la verdad.
 */
export function destinoPermitido(
  cuerpoDeLaCampana: string,
  destino: string | undefined,
): string | null {
  if (!destino) return null;

  /// El esquema se sigue exigiendo: es lo que descarta
  /// `javascript:` y `data:`.
  if (!/^https?:\/\//i.test(destino)) return null;

  /// Y ahora lo que faltaba: que esté en la lista. Comparación
  /// exacta, sin normalizar: el que se reescribió salió de
  /// este mismo texto, así que si no coincide letra por letra
  /// es que alguien lo cambió por el camino.
  return enlacesDe(cuerpoDeLaCampana).includes(destino) ? destino : null;
}
