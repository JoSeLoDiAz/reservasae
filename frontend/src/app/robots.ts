import type { MetadataRoute } from "next";

/**
 * Nada de esto se rastrea.
 *
 * Va en la misma dirección que el 404 de la raíz: los enlaces de cada convenio
 * se envían directamente a sus organizaciones. Si un buscador indexara
 * /britcham-adee, el sitio tendría de facto la puerta de entrada pública que
 * se decidió no tener, solo que a través de Google.
 *
 * OJO: esto por sí solo NO basta. Cloudflare inyecta su propio robots.txt
 * gestionado por delante, con `User-agent: * / Allow: /`; al fusionarse los
 * dos grupos el Allow gana y este Disallow queda anulado. Lo que de verdad
 * frena la indexación es el `noindex` del layout, que viaja en la cabecera de
 * cada página y Cloudflare no toca.
 *
 * Se deja igualmente porque los rastreadores que sí respetan el último grupo
 * lo leen, y porque si algún día se apaga el robots.txt gestionado de
 * Cloudflare, este empieza a funcionar solo.
 *
 * Se quita borrando este archivo si algún día se quiere presencia pública.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
