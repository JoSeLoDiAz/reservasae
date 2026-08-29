/** Qué hacer con un campo que llegó vacío. */

/**
 * Por qué esto no puede leer `value`, que es la trampa entera.
 *
 * `main.ts` monta el `ValidationPipe` con
 * `enableImplicitConversion: true`, y eso convierte el valor
 * SEGÚN EL TIPO DECLARADO antes de que corra un `@Transform`
 * propio. En un campo `number?`, la cadena vacía llega al
 * transform ya convertida a **`0`** — así que la comprobación
 * `value === ''` no se cumple nunca y el «vacío» se guarda como
 * un cero.
 *
 * Y un cero no es un dato ausente: es un id que no existe en
 * ningún catálogo del SEP. Con `municipioSepId: ''` el
 * formulario público de completar datos mandaba `0`, y
 * `municipioCuadra` lo rechazaba con «Ese municipio no pertenece
 * a ese departamento» — sobre un municipio que la persona ni
 * veía ni había tocado, en una pantalla que no lo pregunta. La
 * ficha quedaba imposible de completar.
 *
 * Por eso se lee `obj[key]`, que es el objeto plano tal como
 * llegó, sin convertir.
 */

type Entrada = { value: unknown; key: string; obj: Record<string, unknown> };

/** Si el cliente no mandó nada en ese campo. */
function llegoVacio({ key, obj }: Entrada): boolean {
  const crudo = obj?.[key];
  if (crudo === '' || crudo === null || crudo === undefined) return true;
  // "  " de un campo de texto tampoco es un dato
  return typeof crudo === 'string' && crudo.trim() === '';
}

/**
 * Vacío = «no lo mandé». Para crear y para completar.
 *
 * `undefined` deja el campo fuera del `data` de Prisma, así que
 * no pisa lo que ya hubiera.
 */
export const aNumeroOAusente = (e: Entrada): number | undefined =>
  llegoVacio(e) ? undefined : Number(e.value);

/**
 * Vacío = «quítalo». Para editar desde el panel.
 *
 * Un desplegable que se vacía a mano SÍ quiere borrar el dato, y
 * eso es `null` y no `undefined`: son cosas distintas y el
 * sistema ya depende de la diferencia en `motivoDeIdInvalido`.
 */
export const aNumeroONulo = (e: Entrada): number | null =>
  llegoVacio(e) ? null : Number(e.value);
