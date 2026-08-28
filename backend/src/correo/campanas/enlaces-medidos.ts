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
