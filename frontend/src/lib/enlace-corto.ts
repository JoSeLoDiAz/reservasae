/** El enlace corto: `?mailing18092026` en vez de dos `utm_`. */

/**
 * Lo pidio Mauricio el 18 sep 2026: el enlace del mailing salia
 * como `?utm_source=correo&utm_campaign=...` y en un correo a
 * ciudadanos eso se lee raro. El corto dice lo mismo en una
 * palabra: el PREFIJO es el canal y la palabra entera es el
 * nombre del envio.
 *
 * EL PREFIJO NO ES ADORNO. `procedenciaDe()` cuenta como pagada
 * toda visita que traiga nombre de campana, y sin canal una
 * visita abierta desde la app de Facebook caeria en META: un
 * mailing reenviado por Messenger se contaria como pauta. Por eso
 * no hay corto sin prefijo.
 *
 * `pauta` SI existe desde el 18 sep 2026, y cambia una regla de
 * José: antes la pauta solo la marcaba Ads Manager. Mauricio: «el
 * CRM debe saber sí o sí de dónde viene cada cosa». Con los
 * parámetros de Ads Manager sin poner, la pauta caía en orgánico,
 * y eso era peor que el riesgo que la regla evitaba. Ese riesgo
 * sigue ahí y se acepta a sabiendas: si el enlace del anuncio se
 * reenvía por WhatsApp, quien entre por él cuenta como pauta.
 * Va a `meta` y no a `facebook` o `instagram`: el enlace no
 * sabe en cuál de las dos se vio el anuncio.
 *
 * Sin importaciones a proposito: lo leen la baliza, el panel y un
 * spec del backend, que lo compila desde aqui.
 */

/// Prefijo del enlace corto → `utm_source` que el servidor ya
/// clasifica (`DICE_CORREO`, `DICE_WHATSAPP`, `DICE_QR`). El
/// `correo` va porque es lo que alguien escribiria a mano.
export const PREFIJOS: Readonly<Record<string, string>> = {
  mailing: "correo",
  correo: "correo",
  whatsapp: "whatsapp",
  qr: "qr",
  reserva: "reserva",
  pauta: "meta",
};

/// Lo que va delante segun el canal elegido en el panel.
export const PREFIJO_DEL_CANAL: Readonly<Record<string, string>> = {
  correo: "mailing",
  whatsapp: "whatsapp",
  qr: "qr",
  reserva: "reserva",
  meta: "pauta",
};

/// El mas largo primero: `correo` no se puede comer a nadie,
/// pero el dia que haya dos que empiecen igual, gana el entero.
const PATRON = new RegExp(
  `^(${Object.keys(PREFIJOS)
    .sort((a, b) => b.length - a.length)
    .join("|")})[a-z0-9._-]*$`,
);

/**
 * El canal y el envio de un `?mailing18092026`, o null.
 *
 * Solo cuenta una clave SIN valor: `?qr=1` o `?fbclid=...` no son
 * un enlace corto. Y si la URL ya trae `utm_source` o
 * `utm_campaign`, mandan esos: son mas explicitos y los puede
 * haber puesto el proveedor de envios.
 */
export function leerEnlaceCorto(
  busqueda: string,
): { fuente: string; campana: string | undefined } | null {
  const p = new URLSearchParams(busqueda);
  if (p.has("utm_source") || p.has("utm_campaign")) return null;

  for (const [clave, valor] of p) {
    if (valor !== "") continue;
    const palabra = clave.toLowerCase().slice(0, 60);
    const m = PATRON.exec(palabra);
    if (!m) continue;
    // `?mailing` a secas dice el canal y no el envio
    return { fuente: PREFIJOS[m[1]], campana: palabra === m[1] ? undefined : palabra };
  }
  return null;
}

/**
 * La palabra del enlace corto para un canal y un nombre ya
 * limpios (`comoViaja`), o null si el canal no tiene corto.
 *
 * Un nombre que ya empieza por el prefijo no se repite, y uno que
 * empieza por numero va pegado --`mailing18092026`, que es como lo
 * escribio quien lo pidio--; si empieza por letra lleva guion para
 * que se pueda leer.
 */
export function palabraCorta(canal: string, nombre: string): string | null {
  const prefijo = PREFIJO_DEL_CANAL[canal];
  if (!prefijo) return null;
  if (!nombre) return prefijo;
  if (PATRON.test(nombre) && PREFIJOS[nombre.match(PATRON)![1]] === PREFIJOS[prefijo]) {
    return nombre;
  }
  return /^[0-9]/.test(nombre) ? `${prefijo}${nombre}` : `${prefijo}-${nombre}`;
}
