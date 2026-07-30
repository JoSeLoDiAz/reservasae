import type { MetadataRoute } from "next";

/**
 * Nada de esto se indexa.
 *
 * Va en la misma dirección que el 404 de la raíz: los enlaces de cada convenio
 * se envían directamente a sus organizaciones. Si un buscador indexara
 * /britcham-adee, el sitio tendría de facto la puerta de entrada pública que
 * se decidió no tener, solo que a través de Google.
 *
 * Se quita borrando este archivo si algún día se quiere presencia pública.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
