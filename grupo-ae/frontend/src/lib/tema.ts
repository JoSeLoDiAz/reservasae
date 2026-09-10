/** Modo claro / oscuro y contraste. */

export type ModoElegido = "sistema" | "claro" | "oscuro";
export type Esquema = "CLARO" | "OSCURO";

export const LLAVE_MODO = "convoca:modo";

/** Colores de un esquema por token. */
export type ColoresTema = Record<string, string>;

export type GrupoToken = {
  clave: string;
  etiqueta: string;
  descripcion: string;
};

export type DefinicionToken = {
  clave: string;
  variableCss: string;
  grupo: string;
  etiqueta: string;
  ayuda?: string;
};

export type ComprobacionContraste = {
  frente: string;
  fondo: string;
  descripcion: string;
  grande?: boolean;
  /// Dos colores que tienen que distinguirse entre sí, no
  /// texto sobre un fondo. Lleva su propio umbral.
  entreEstados?: boolean;
};

export type CatalogoColores = {
  grupos: GrupoToken[];
  tokens: DefinicionToken[];
  comprobacionesContraste: ComprobacionContraste[];
};

export function esquemaDelSistema(): Esquema {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "OSCURO" : "CLARO";
}

export function resolverEsquema(modo: ModoElegido): Esquema {
  if (modo === "claro") return "CLARO";
  if (modo === "oscuro") return "OSCURO";
  return esquemaDelSistema();
}

export function aplicarEsquema(esquema: Esquema) {
  document.documentElement.dataset.tema = esquema === "OSCURO" ? "oscuro" : "claro";
}

/** Fija el esquema antes de pintar. */
export const SCRIPT_SIN_PARPADEO = `
(function () {
  try {
    var m = localStorage.getItem(${JSON.stringify(LLAVE_MODO)});
    var oscuro =
      m === 'oscuro' ||
      ((!m || m === 'sistema') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro';
  } catch (e) {}
})();
`;

// contraste (wcag 2.1)

function canal(valor: number): number {
  const v = valor / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminancia(hex: string): number | null {
  const limpio = hex.replace("#", "");
  const completo =
    limpio.length === 3
      ? limpio
          .split("")
          .map((c) => c + c)
          .join("")
      : limpio;
  if (!/^[0-9a-fA-F]{6}$/.test(completo)) return null;

  const r = parseInt(completo.slice(0, 2), 16);
  const g = parseInt(completo.slice(2, 4), 16);
  const b = parseInt(completo.slice(4, 6), 16);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Razón de contraste, de 1 a 21. */
export function contraste(colorA: string, colorB: string): number | null {
  const a = luminancia(colorA);
  const b = luminancia(colorB);
  if (a === null || b === null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export type NivelContraste = "AAA" | "AA" | "AA-GRANDE" | "INSUFICIENTE";

/** Nivel WCAG de una razón de contraste. */
export function nivelContraste(razon: number, grande = false): NivelContraste {
  if (razon >= 7) return "AAA";
  if (razon >= 4.5) return "AA";
  if (grande && razon >= 3) return "AA-GRANDE";
  return "INSUFICIENTE";
}

// distinguir dos colores de estado

/// ¿Se distinguen estos dos colores?
///
/// NO se mide con la razón de contraste de la WCAG. Esa mide
/// luminosidad, que es lo que hace falta para saber si un texto
/// se LEE sobre un fondo, y es otra pregunta. Dos colores
/// pueden diferir mucho de tono y poco de luminosidad —el rojo
/// y el verde de la paleta por defecto están en 1,15— y aun así
/// distinguirse perfectamente.
///
/// Se comprobó: con la razón de la WCAG y un umbral razonable,
/// la paleta por defecto —que está elegida a propósito para
/// verse bien— fallaba las seis comprobaciones. Un aviso que
/// salta siempre no lo lee nadie.
///
/// Lo que sí mide la diferencia que ve el ojo es la distancia
/// en el espacio Lab. Ahí la paleta por defecto va de 53 a 109,
/// y tres verdes parecidos se quedan entre 3 y 9.

function aLineal(canal: number): number {
  return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
}

function aSrgb(lineal: number): number {
  const x = Math.max(0, Math.min(1, lineal));
  return x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
}

function canales(hex: string): [number, number, number] | null {
  const limpio = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return null;
  return [0, 2, 4].map((i) => parseInt(limpio.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

/** Coordenadas CIE Lab de un color, para poder restarlas. */
function lab(hex: string): [number, number, number] | null {
  const c = canales(hex);
  if (!c) return null;
  const [r, g, b] = c.map(aLineal);

  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * El mismo color, visto por quien tiene deuteranopia.
 *
 * Es el daltonismo más común —alrededor del 6 % de los
 * hombres— y es justo el que confunde el rojo con el verde,
 * que son dos de los tres estados. Sin esta comprobación, un
 * «disponible» y un «completo» pueden pasar la primera medida
 * y ser el mismo color para uno de cada dieciséis usuarios.
 */
function comoLoVeDeuteranopia(hex: string): string | null {
  const c = canales(hex);
  if (!c) return null;
  const [r, g, b] = c.map(aLineal);
  const proyectado = [
    0.625 * r + 0.375 * g,
    0.7 * r + 0.3 * g,
    0.3 * g + 0.7 * b,
  ];
  return (
    "#" +
    proyectado
      .map((x) =>
        Math.round(aSrgb(x) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function distancia(colorA: string, colorB: string): number | null {
  const a = lab(colorA);
  const b = lab(colorB);
  if (!a || !b) return null;
  return Math.sqrt(a.reduce((suma, x, i) => suma + (x - b[i]) ** 2, 0));
}

/// Los dos umbrales salen de medir la paleta por defecto contra
/// una mala a propósito, no de una norma:
///
///                        normal      con deuteranopia
///   la de fábrica        53 a 109        10 a 92
///   tres verdes iguales    3 a 9          3 a 7
const DISTANCIA_MINIMA = 25;
const DISTANCIA_MINIMA_DEUTERANOPIA = 8;

export type Distincion = {
  distancia: number;
  distanciaDeuteranopia: number;
  bastante: boolean;
};

/** Si dos colores de estado se pueden distinguir. */
export function seDistinguen(colorA: string, colorB: string): Distincion | null {
  const normal = distancia(colorA, colorB);
  const da = comoLoVeDeuteranopia(colorA);
  const db = comoLoVeDeuteranopia(colorB);
  if (normal === null || !da || !db) return null;

  const daltonica = distancia(da, db);
  if (daltonica === null) return null;

  return {
    distancia: normal,
    distanciaDeuteranopia: daltonica,
    bastante:
      normal >= DISTANCIA_MINIMA &&
      daltonica >= DISTANCIA_MINIMA_DEUTERANOPIA,
  };
}
