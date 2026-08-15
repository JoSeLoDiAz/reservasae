/** Ajustes que el sistema operativo no siempre ofrece. */

export type Ajustes = {
  /** Escala del texto, en porcentaje. */
  texto: number;
  /** Quitar transiciones aunque el sistema no lo pida. */
  sinMovimiento: boolean;
  /** Subrayar todos los enlaces, no solo al pasar. */
  enlacesSubrayados: boolean;
};

export const AJUSTES_POR_DEFECTO: Ajustes = {
  texto: 100,
  sinMovimiento: false,
  enlacesSubrayados: false,
};

export const LLAVE_ACCESIBILIDAD = "convoca:accesibilidad";

export function leerAjustes(): Ajustes {
  try {
    const crudo = window.localStorage.getItem(LLAVE_ACCESIBILIDAD);
    if (!crudo) return AJUSTES_POR_DEFECTO;
    return { ...AJUSTES_POR_DEFECTO, ...(JSON.parse(crudo) as Partial<Ajustes>) };
  } catch {
    return AJUSTES_POR_DEFECTO;
  }
}

export function aplicarAjustes(ajustes: Ajustes) {
  const raiz = document.documentElement;
  // el rem manda: escala la interfaz entera
  raiz.style.fontSize = `${ajustes.texto}%`;
  raiz.dataset.sinMovimiento = ajustes.sinMovimiento ? "si" : "";
  raiz.dataset.enlacesSubrayados = ajustes.enlacesSubrayados ? "si" : "";
}

/**
 * Fija los ajustes antes de pintar, como el del tema.
 * Vive aquí y no en el componente porque el layout es un
 * Server Component: desde un módulo "use client" llegaría
 * una referencia, no el texto.
 */
export const SCRIPT_ACCESIBILIDAD = `
(function () {
  try {
    var a = JSON.parse(localStorage.getItem(${JSON.stringify(LLAVE_ACCESIBILIDAD)}) || '{}');
    var r = document.documentElement;
    if (typeof a.texto === 'number' && a.texto >= 80 && a.texto <= 150) {
      r.style.fontSize = a.texto + '%';
    }
    if (a.sinMovimiento) r.dataset.sinMovimiento = 'si';
    if (a.enlacesSubrayados) r.dataset.enlacesSubrayados = 'si';
  } catch (e) {}
})();
`;
