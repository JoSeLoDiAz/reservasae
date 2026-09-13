/** El error del robot, dicho en una frase que sirva. */

/// `ultimoError` guarda lo que lanzo el navegador, y eso es un
/// rastro de Playwright: «locator.click: Timeout 30000ms
/// exceeded. Call log: - waiting for getByText(...)». A quien
/// lleva la ficha eso no le dice nada y parece que el sistema se
/// rompio.
///
/// Es el mismo criterio que `explicar()` con el 535 del SMTP:
/// traducir el error del tercero a la instruccion concreta. Aqui
/// la instruccion casi siempre es «no es su cedula, es el portal:
/// vuelva a consultar mas tarde», que es justo lo que estaba
/// pasando el 13 sep 2026 --el portal del DNP en mantenimiento y
/// cuatro fichas marcadas «No se pudo consultar» sin mas.

/// El portal no contesto o cambio de pantalla.
const NO_CONTESTO = /timeout|timed out|net::|ERR_|navigation|ECONNRESET|ETIMEDOUT/i;

/// El navegador ni siquiera arranco.
const SIN_NAVEGADOR = /executable|browser|chromium|launch/i;

export function porQueFallo(error: string | null | undefined): string | null {
  if (!error) return null;

  if (SIN_NAVEGADOR.test(error) && !NO_CONTESTO.test(error)) {
    return 'El navegador del servidor no arrancó. Es cosa nuestra, no de la cédula: avise a soporte.';
  }

  if (NO_CONTESTO.test(error)) {
    return 'El portal del DNP no respondió. Suele ser mantenimiento de ellos: vuelva a consultar más tarde.';
  }

  return 'No se pudo consultar y no sabemos por qué. Vuelva a intentarlo; si sigue igual, avise a soporte.';
}
