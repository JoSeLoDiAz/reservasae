/** Los ajustes de pantalla de UNA persona, guardados en su cuenta. */

/// Por qué existe.
///
/// La escala de texto y las dos ayudas de Accesibilidad vivían en el
/// `localStorage` del navegador, así que se quedaban en el equipo: quien
/// las subía al 110 % en el monitor grande volvía al 100 % al entrar
/// desde el portátil, y creía que la interfaz había cambiado de tamaño.
/// «Hoy esa escala se guarda por navegador [...] que viaje con su
/// cuenta, como ya viajan sus colores propios» (23 sep 2026).
///
/// Van al lado de `temaPropio`, en la misma fila y por las mismas
/// razones: son de la persona, no del gremio, y nadie más los ve.
/// El navegador sigue guardando su copia --es lo que pinta el tamaño
/// antes de que React monte, sin destello-- y esto es la fuente que
/// manda cuando las dos discrepan.

export type AjustesDePantalla = {
  /** Escala del texto, en porcentaje. */
  texto: number;
  /** Quitar transiciones aunque el sistema no lo pida. */
  sinMovimiento: boolean;
  /** Subrayar todos los enlaces, no solo al pasar. */
  enlacesSubrayados: boolean;
};

export const AJUSTES_POR_DEFECTO: AjustesDePantalla = {
  texto: 100,
  sinMovimiento: false,
  enlacesSubrayados: false,
};

/// El mismo recorrido que ofrece el panel de Accesibilidad. Por
/// debajo de 90 la interfaz deja de leerse y por encima de 140 las
/// tablas no caben en ninguna pantalla.
export const TEXTO_MINIMO = 90;
export const TEXTO_MAXIMO = 140;

/// De cinco en cinco, como el control: un 103 % no lo puede pedir la
/// interfaz y solo serviría para que dos equipos de la misma persona
/// se vieran distintos sin que ella sepa por qué.
export const PASO_DE_TEXTO = 5;

export function escalaValida(texto: number): boolean {
  return (
    Number.isFinite(texto) &&
    texto >= TEXTO_MINIMO &&
    texto <= TEXTO_MAXIMO &&
    (texto - TEXTO_MINIMO) % PASO_DE_TEXTO === 0
  );
}

/**
 * Lo que hay guardado, ya limpio.
 *
 * Es `Json?` en la base, o sea que ahí puede haber cualquier cosa:
 * lo de una versión anterior del panel, o lo que alguien escribiera a
 * mano. Cada campo que no cuadra se cae al de siempre en vez de
 * viajar hasta el navegador y romper el tamaño de la interfaz.
 */
export function leerAjustesDePantalla(valor: unknown): AjustesDePantalla {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    return AJUSTES_POR_DEFECTO;
  }
  const crudo = valor as Record<string, unknown>;
  const texto = typeof crudo.texto === 'number' ? Math.round(crudo.texto) : NaN;
  return {
    texto: escalaValida(texto) ? texto : AJUSTES_POR_DEFECTO.texto,
    sinMovimiento:
      typeof crudo.sinMovimiento === 'boolean'
        ? crudo.sinMovimiento
        : AJUSTES_POR_DEFECTO.sinMovimiento,
    enlacesSubrayados:
      typeof crudo.enlacesSubrayados === 'boolean'
        ? crudo.enlacesSubrayados
        : AJUSTES_POR_DEFECTO.enlacesSubrayados,
  };
}

/**
 * Los ajustes nuevos, SUMADOS a los que ya tenía.
 *
 * Suma y no reemplaza, igual que los colores propios: el panel puede
 * mandar solo el campo que se tocó, y reemplazar apagaría de paso las
 * dos ayudas que esa persona tuviera encendidas.
 */
export function conAjustes(
  actual: AjustesDePantalla,
  cambios: Partial<AjustesDePantalla>,
): AjustesDePantalla {
  return leerAjustesDePantalla({ ...actual, ...cambios });
}
