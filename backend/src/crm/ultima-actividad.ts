/** La más reciente de dos fechas, con una que puede faltar. */

/// La lista de leads se ordena por `actualizadoEn` y la columna
/// enseña «última actividad». Si la columna mostrara solo el
/// último movimiento, una ficha podría verse con una fecha más
/// vieja que la de la fila de debajo y la tabla parecería mal
/// ordenada. Enseñando el mayor de los dos eso no puede pasar.
export function masReciente(a: Date | null, b: Date): Date {
  return a && a.getTime() > b.getTime() ? a : b;
}
