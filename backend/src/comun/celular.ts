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

/// Para los DTO: deja el numero en los diez digitos SI de
/// verdad es un movil, y si no devuelve lo que vino.
///
/// Existe porque `Persona.celular` se guardaba CRUDA por sus
/// seis puertas de escritura, asi que en la misma columna
/// convivian `+57 300 111 2222`, `+573001112222` y
/// `3001112222`. Los tres son la misma persona y ninguno se
/// encuentra buscando por otro -- y buscar por numero es
/// justo lo que hace falta para cruzar un chat de WhatsApp
/// contra su ficha.
///
/// No se toca lo que NO es un movil: un «no tiene» tecleado
/// se queda como esta. Perderlo seria decidir por el asesor
/// que ahi no habia nada, y la regla de la casa es que el
/// celular avisa y no bloquea.
export function aCelularGuardable(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor;
  const limpio = normalizarCelular(valor);
  return celularUtil(limpio) ? limpio : valor.trim();
}
