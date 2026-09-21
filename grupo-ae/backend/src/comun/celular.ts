/** Si un celular colombiano es un celular de verdad. */

/**
 * No se validaba en ningún sitio, y hay dos consecuencias:
 * viaja al reporte del SEP como número de contacto, y la
 * compuerta de matrícula lo acepta como «alguna forma de
 * contactarla». Con `celular: "no tiene"` alguien queda
 * matriculado y nadie puede llamarlo, que es exactamente lo que
 * esa compuerta existe para evitar.
 *
 * Diez dígitos empezando por 3 es el móvil colombiano. Se
 * admite el indicativo `+57` o `57` delante, porque es como
 * viene pegado desde una hoja de cálculo, y se ignoran espacios,
 * guiones y paréntesis.
 *
 * NO se admite un fijo: la columna del SEP es de celular, y un
 * fijo de siete dígitos no recibe mensajes, que es para lo que
 * se pide.
 */

const MOVIL = /^3\d{9}$/;

/** Solo los dígitos, sin indicativo. */
export function normalizarCelular(valor: string): string {
  const digitos = (valor ?? '').replace(/\D/g, '');
  // el indicativo llega de las hojas de calculo
  if (digitos.length === 12 && digitos.startsWith('57')) return digitos.slice(2);
  return digitos;
}

/** Vacío es válido: el celular es opcional. */
export function celularValido(valor: string | null | undefined): boolean {
  if (!valor) return true;
  return MOVIL.test(normalizarCelular(valor));
}

/** Si sirve para llamar o escribir a esta persona. */
export function celularUtil(valor: string | null | undefined): boolean {
  return !!valor && MOVIL.test(normalizarCelular(valor));
}

/// Para los DTO: deja el número en los diez dígitos SI de
/// verdad es un móvil, y si no devuelve lo que vino.
///
/// Existe porque `Persona.celular` se guardaba CRUDO por casi
/// todas sus puertas de escritura —la ficha del panel, el
/// pegado desde Excel, la preinscripción pública y el arreglo
/// de un lead en la mesa—, así que en la misma columna
/// convivían `+57 300 111 2222`, `+573001112222` y
/// `3001112222`. Los tres son la misma persona y ninguno se
/// encuentra buscando por otro: `cruzar-con-el-crm` busca la
/// ficha por celular con igualdad exacta, y con tres grafías
/// conviviendo el cruce falla en silencio con media base.
///
/// Es el mismo arreglo que José hizo en el CRM de la raíz
/// (commit 1dae76f), con la misma función y el mismo nombre a
/// propósito: si los dos CRM guardan el celular con reglas
/// distintas, el día que se crucen datos entre ellos vuelve a
/// pasar lo mismo.
///
/// No se toca lo que NO es un móvil: un «no tiene» tecleado se
/// queda como está. Perderlo sería decidir por el asesor que
/// ahí no había nada, y la regla de la casa es que el celular
/// avisa y no bloquea —ya lo marcan como inútil `celularUtil`
/// y las tres reglas de `completitud.ts`—.
///
/// Lo que no es texto (`undefined`, `null`) pasa sin tocar:
/// en los DTO de edición `null` BORRA y ausente NO TOCA, y
/// confundirlos pisaría un celular bueno con nada.
export function aCelularGuardable(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor;
  const limpio = normalizarCelular(valor);
  return celularUtil(limpio) ? limpio : valor.trim();
}
