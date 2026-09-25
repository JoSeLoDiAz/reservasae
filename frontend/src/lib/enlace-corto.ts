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
 * el corto solo existe para canales NUESTROS, y ninguno es de
 * Meta: la pauta la marca Ads Manager con sus `utm_`, y un
 * prefijo `pauta` dejaria marcar a mano como pagado un trafico
 * que no lo es.
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
  /// El enlace del anuncio. Trae el NOMBRE de la campaña; que
  /// cuente como pagada lo decide el servidor con su prueba
  /// (`pagadaSql`), no esta palabra.
  pauta: "pauta",
};

/// Lo que va delante segun el canal elegido en el panel.
export const PREFIJO_DEL_CANAL: Readonly<Record<string, string>> = {
  correo: "mailing",
  whatsapp: "whatsapp",
  qr: "qr",
  reserva: "reserva",
  pauta: "pauta",
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

/**
 * La palabra tal cual, para mandarla en el registro.
 *
 * `leerEnlaceCorto` devuelve el canal YA interpretado, y eso no
 * se le manda al servidor: quien decide si algo es pauta no puede
 * ser el cuerpo de la peticion --lo tiene escrito
 * `leads.service.ts`--. Aqui va la palabra cruda y el servidor la
 * valida contra su propia lista (`enlace-del-envio.ts`).
 *
 * Se lee aunque haya `utm_`: aquellos alimentan la baliza, y esto
 * es el respaldo de cuando la baliza no llega.
 */
export function marcaDelEnlaceCorto(busqueda: string): string | undefined {
  for (const [clave, valor] of new URLSearchParams(busqueda)) {
    if (valor !== "") continue;
    const palabra = clave.toLowerCase().slice(0, 60);
    if (PATRON.test(palabra)) return palabra;
  }
  return undefined;
}
