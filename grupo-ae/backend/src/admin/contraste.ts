/** Contraste WCAG 2.1. */

function canal(valor: number): number {
  const v = valor / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function aRgb(hex: string): [number, number, number] | null {
  const limpio = hex.replace('#', '');
  const completo =
    limpio.length === 3
      ? limpio
          .split('')
          .map((c) => c + c)
          .join('')
      : limpio;
  if (!/^[0-9a-fA-F]{6}$/.test(completo)) return null;
  return [
    parseInt(completo.slice(0, 2), 16),
    parseInt(completo.slice(2, 4), 16),
    parseInt(completo.slice(4, 6), 16),
  ];
}

export function luminancia(hex: string): number | null {
  const rgb = aRgb(hex);
  if (!rgb) return null;
  return 0.2126 * canal(rgb[0]) + 0.7152 * canal(rgb[1]) + 0.0722 * canal(rgb[2]);
}

/** De 1 (idénticos) a 21 (negro sobre blanco). */
export function contraste(colorA: string, colorB: string): number | null {
  const a = luminancia(colorA);
  const b = luminancia(colorB);
  if (a === null || b === null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function minimoExigido(grande = false): number {
  return grande ? 3 : 4.5;
}
