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
export function variantesParaElFondo<T extends { esquema: string }>(
  logos: T[],
  fondoOscuro: boolean,
): T[] {
  const cual = fondoOscuro ? "OSCURO" : "CLARO";
  return logos.filter((l) => l.esquema === "AMBOS" || l.esquema === cual);
}
