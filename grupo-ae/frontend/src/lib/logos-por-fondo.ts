/** Qué variante de logo se ve sobre qué fondo. */

/// Por debajo de esto se lee mejor en blanco.
const UMBRAL_OSCURO = 0.35;

/** ¿Sobre este color toca la variante de fondo oscuro? */
export function esFondoOscuro(hex: string): boolean {
  const n = hex.trim().replace("#", "");
  if (n.length < 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lineal = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b) < UMBRAL_OSCURO;
}

/** Los logos que salen sobre un fondo así. */
///
/// `esquema` es OPCIONAL aquí y obligatorio en Convoca, y es la
/// única diferencia entre las dos copias de este fichero.
///
/// El backend de Grupo AE no manda todavía la variante por tema
/// —su `Logo` no tiene la columna—, así que sin esto la cabecera
/// no compila. Un logo sin variante declarada se trata como
/// `AMBOS`, que es lo que de hecho es: el único archivo que hay,
/// y sale sobre los dos fondos igual que salía antes.
///
/// El día que el backend traiga la columna, esto empieza a
/// filtrar solo, sin tocar la cabecera.
///
/// El `id` está en la restricción por obligación del compilador,
/// no por capricho: un tipo con TODAS sus propiedades opcionales
/// es un «weak type», y TypeScript rechaza pasarle un `Logo` que
/// no comparte ni una con él. Pidiendo `id` —que todo logo
/// tiene— la comprobación vuelve a ser la normal.
export function variantesParaElFondo<T extends { id: string; esquema?: string }>(
  logos: T[],
  fondoOscuro: boolean,
): T[] {
  const cual = fondoOscuro ? "OSCURO" : "CLARO";
  return logos.filter(
    (l) => !l.esquema || l.esquema === "AMBOS" || l.esquema === cual,
  );
}
