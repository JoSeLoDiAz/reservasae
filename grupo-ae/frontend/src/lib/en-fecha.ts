/** El contrato de fecha del panel, y no hay un segundo. */

/// EL PANEL TENÍA TRES FORMATOS DE FECHA EN TRES PANTALLAS.
///
/// `9/09/2026, 9:55 p. m.` en Campañas, `30 de sept` en Leads y
/// `9 de sept de 2026` en Plantillas. La misma clase de dato se
/// leía distinto según dónde estuviera, y en una columna eso
/// obliga a releer cada fila para saber qué se está mirando.
///
/// El contrato es uno: día, mes en tres letras y en minúscula, y
/// año. Sin punto, sin coma y sin la preposición.
///
/// Y vive en `lib/` a propósito, no dentro de un componente: lo
/// necesitan tanto la pieza `<Fecha>` como los sitios donde la
/// fecha va dentro de una frase —«Creada el …»—, y con dos copias
/// la frase y la columna acabarían diciéndolo distinto.

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/// Una fecha de CALENDARIO no tiene hora, y no se lee del reloj.
///
/// `new Date('2026-10-24')` es medianoche en Londres, o sea el 23
/// a las siete de la tarde en Colombia: el cierre esperado que el
/// asesor escribió salía un día antes.
function esDeCalendario(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T00:00:00(\.000)?Z?)?$/.test(iso);
}

function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * `9 sep 2026`. Día, mes en tres letras y en minúscula, año.
 *
 * A mano y no con `toLocaleDateString`, que en español escribe
 * «sept» o «30 de sept» según la versión del navegador:
 * septiembre es el único mes que se sale de la medida, y en una
 * columna de fechas alineadas el año se corría una posición solo
 * en septiembre. El punto además cambia según el motor.
 */
export function enFecha(valor: string | Date): string {
  if (typeof valor === "string" && esDeCalendario(valor)) {
    const [a, m, d] = valor.slice(0, 10).split("-").map(Number);
    return `${d} ${MESES[m - 1]} ${a}`;
  }

  const cuando = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(cuando.getTime())) return "—";
  return `${cuando.getDate()} ${MESES[cuando.getMonth()]} ${cuando.getFullYear()}`;
}

/**
 * Lo mismo, pero LO DE HOY NO SE FECHA: se mira la hora.
 *
 * «9 sep 2026» a las nueve de la noche del 9 de septiembre no
 * dice nada que quien mira no sepa ya; de un dato recién tocado
 * lo que se pregunta es a qué hora entró, y eso decide si hay que
 * llamar ahora o mañana. Dos días y ni uno más: a partir del
 * tercero la fecha vuelve a ser lo que orienta.
 *
 * Se comparan DÍAS DEL CALENDARIO y no las últimas 24 horas: algo
 * de las once de anoche es «ayer» a las siete de la mañana aunque
 * hayan pasado ocho horas, porque quien lo mira piensa en días.
 *
 * Una fecha de calendario no pasa por aquí: un cierre esperado no
 * tiene hora, y escribirlo «hoy 00:00» sería inventarse una.
 *
 * En prosa —«Creada el …»— se usa `enFecha` y no esto: «Creada el
 * hoy 14:32» no está en español.
 */
export function enMomento(valor: string | Date): string {
  if (typeof valor === "string" && esDeCalendario(valor)) return enFecha(valor);

  const cuando = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(cuando.getTime())) return "—";

  const ahora = new Date();
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);

  const hora =
    `${String(cuando.getHours()).padStart(2, "0")}:` +
    String(cuando.getMinutes()).padStart(2, "0");

  if (mismoDia(cuando, ahora)) return `hoy ${hora}`;
  if (mismoDia(cuando, ayer)) return `ayer ${hora}`;
  return enFecha(cuando);
}
