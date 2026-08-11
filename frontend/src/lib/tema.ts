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
