/** Un «false» escrito con comillas es un NO, no un SÍ. */

/**
 * `main.ts` monta el `ValidationPipe` con
 * `enableImplicitConversion: true`, y para un campo declarado
 * `boolean` eso convierte con la regla de JavaScript: cualquier
 * cadena no vacía es `true`. Así que `"false"` llega como **true**.
 *
 * Comprobado en vivo contra el webhook: `aceptaHabeasData:
 * "false"` se guardaba como `t`.
 *
 * Y no es un redondeo: ese campo es la constancia de que la
 * persona marcó la casilla de tratamiento de datos. Guardarlo al
 * revés le estampa una autorización que NO dio, y una prueba falsa
 * es peor que ninguna — la que falta bloquea el reporte al SENA;
 * la falsa lo abre.
 *
 * Es el mismo defecto que ya tuvo este proyecto con los números:
 * la cadena vacía llegaba al `@Transform` ya convertida a `0` y se
 * guardaba como un id que no existe. La lección es la misma: hay
 * que leer el valor CRUDO, antes de que el pipe lo toque.
 *
 * Se aceptan las formas que manda un integrador de verdad — Meta,
 * un CRM ajeno, una hoja de cálculo — y NADA MÁS. Lo que no se
 * reconoce devuelve `undefined`, que es «no lo dijo»: inventar un
 * `true` por no saber leerlo es exactamente lo que esto evita.
 */

const SI = new Set(['true', '1', 'si', 'sí', 'yes', 'y', 'on', 't']);
const NO = new Set(['false', '0', 'no', 'n', 'off', 'f', '']);

export function booleanoDeVerdad(valor: unknown): boolean | undefined {
  if (typeof valor === 'boolean') return valor;
  if (valor === null || valor === undefined) return undefined;
  if (typeof valor === 'number') return valor !== 0;
  if (typeof valor !== 'string') return undefined;

  const t = valor.trim().toLowerCase();
  if (SI.has(t)) return true;
  if (NO.has(t)) return false;
  return undefined;
}
