/** La organización que nominó una reserva es de todos sus nominados. */

/**
 * `guardarEmpresa` hacía `empresa.update({ data: datos })` sobre
 * la organización atada a la ficha, y una de las dos que pueden
 * estar atadas es LA QUE NOMINÓ POR UNA RESERVA: una sola fila
 * compartida por todos los nominados de ese convenio.
 *
 * Cómo se veía: una persona del Colegio Benedictino abría su
 * enlace, escribía su propio celular en «teléfono» y su propio
 * nombre en «persona de contacto» —que es lo que cualquiera pone
 * si no le dicen otra cosa— y eso quedaba como el teléfono y el
 * contacto del colegio en las 40 fichas. Y el F7 va por
 * organización, así que las 40 filas salían al SENA con el
 * teléfono de una sola persona.
 *
 * Lo que lo tapaba: la pantalla le pedía los datos «de su
 * organización» y ella los daba de buena fe; nada fallaba y el
 * cambio no se veía desde su ficha, solo desde las otras 39.
 *
 * LA SUYA PROPIA SÍ SE ESCRIBE LIBREMENTE. Si la organización es
 * la que ella misma dio —su NIT, o su cédula como RUT— no hay
 * nadie más detrás y corregirla es justo para lo que existe el
 * enlace. La distinción no es «qué campo» sino «de quién es la
 * fila», y eso lo decide la reserva.
 *
 * Es la misma regla que ya aplica el camino de reservas sobre
 * una organización que ya existe: solo se rellenan HUECOS. Que
 * una empresa corrija sus propios datos es trabajo del analista
 * de información, que sabe con quién está hablando; este
 * formulario no lo sabe.
 */

/**
 * Deja solo los campos que en la organización están VACÍOS.
 *
 * Devuelve nada más lo que hay que escribir, no la mezcla
 * entera: así el `update` no reescribe con su propio valor lo
 * que ya estaba bien, y `{}` dice a las claras «aquí no había
 * ningún hueco que rellenar».
 *
 * Vacío es `null`, `undefined` y la cadena en blanco. Lo
 * último importa: una organización creada desde un cargue con
 * `contactoNombre: ''` tiene el hueco igual que si fuera nulo, y
 * tratarla como llena dejaría el dato sin poder completarse
 * nunca. El `0` NO es un hueco: cero trabajadores es un valor
 * que alguien escribió.
 */
export function soloRellenarHuecos<T extends Record<string, unknown>>(
  dice: T,
  guardado: Record<string, unknown>,
): Partial<T> {
  const huecos: Record<string, unknown> = {};

  for (const [campo, valor] of Object.entries(dice)) {
    /// Lo que el formulario no mandó no rellena nada. Sin esto
    /// un paso enviado a medias escribiría `undefined` --que
    /// Prisma ignora-- pero también contaría como «lo intentó»,
    /// y la cuenta de huecos rellenados es lo que se mira en la
    /// prueba.
    if (valor === undefined || valor === null) continue;

    const antes = guardado[campo];
    const vacio =
      antes === null ||
      antes === undefined ||
      (typeof antes === 'string' && antes.trim() === '');

    if (vacio) huecos[campo] = valor;
  }

  return huecos as Partial<T>;
}
