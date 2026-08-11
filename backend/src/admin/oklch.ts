/**
 * Conversion sRGB <-> OKLCH, sin dependencias.
 *
 * En OKLCH y no en HSL porque en HSL «L 50 %» en amarillo y en azul se ven muy
 * distintos de claros, asi que fijar L no garantiza contraste. En OKLCH la L es
 * luminosidad percibida y sirve como perilla fiable.
 */

import { aRgb } from './contraste';

export type Oklch = { l: number; c: number; h: number };

function aLineal(v: number): number {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function aSrgb(v: number): number {
  const x = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, x)) * 255);
}

export function hexAOklch(hex: string): Oklch | null {
  const rgb = aRgb(hex);
  if (!rgb) return null;

  const r = aLineal(rgb[0]);
  const g = aLineal(rgb[1]);
  const b = aLineal(rgb[2]);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const lab = {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };

  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: lab.l, c, h };
}

// null si el color se sale del gamut sRGB
function intentarHex({ l, c, h }: Oklch): string | null {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const l_ = Math.pow(l + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m_ = Math.pow(l - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s_ = Math.pow(l - 0.0894841775 * a - 1.291485548 * b, 3);

  const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;

  const margen = 0.0005;
  if (Math.min(r, g, bl) < -margen || Math.max(r, g, bl) > 1 + margen) return null;

  return (
    '#' +
    [aSrgb(r), aSrgb(g), aSrgb(bl)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
  );
}

/** OKLCH a hex, bajando croma hasta que entre en sRGB. */
export function oklchAHex(color: Oklch): string {
  const l = Math.min(1, Math.max(0, color.l));
  let c = Math.max(0, color.c);

  for (let i = 0; i < 64; i++) {
    const hex = intentarHex({ l, c, h: color.h });
    if (hex) return hex;
    c *= 0.92;
  }
  // gris del mismo L: siempre existe
  return intentarHex({ l, c: 0, h: 0 }) ?? '#000000';
}

/** Mismo tono y croma, otra luminosidad. */
export function conLuminosidad(base: Oklch, l: number, croma?: number): string {
  return oklchAHex({ l, c: croma ?? base.c, h: base.h });
}
