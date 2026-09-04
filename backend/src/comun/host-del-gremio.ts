/** La dirección de un gremio, sacada de otra del sitio. */

/// El dominio, sin la etiqueta del gremio ni la del entorno.
///
/// `pre-adecopria.reservasae.com` -> `reservasae.com`
/// `prueba.reservasae.com`        -> `reservasae.com`
const SOLO_EL_DOMINIO = /^(?:pre-)?[a-z0-9-]+\.(?=[a-z0-9-]+\.[a-z]{2,})/;

/**
 * De cualquier host del sitio al de ese gremio.
 *
 * En pruebas lleva `pre-` delante, que va DELANTE y no detrás
 * por el comodín de Cloudflare: cubre un solo nivel.
 *
 * Estaba escrita dentro de `meta-pruebas.controller.ts` y el
 * correo de bienvenida iba a ser la segunda. Dos reglas para
 * la misma dirección acaban discrepando, y aquí el síntoma
 * sería un enlace que no lleva a ninguna parte.
 */
export function hostDelGremio(
  host: string | null | undefined,
  slug: string,
): string {
  const limpio = (host ?? '').toLowerCase().trim();
  if (
    !limpio ||
    limpio.startsWith('localhost') ||
    limpio.startsWith('127.0.0.1')
  ) {
    return limpio || 'localhost';
  }
  const dominio = limpio.replace(SOLO_EL_DOMINIO, '');
  const prefijo = process.env.ENTORNO === 'prueba' ? 'pre-' : '';
  return `${prefijo}${slug}.${dominio}`;
}
