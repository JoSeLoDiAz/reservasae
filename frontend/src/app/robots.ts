import type { MetadataRoute } from "next";

/**
 * Nada de esto se rastrea.
 *
 * No basta: Cloudflare inyecta su propio robots.txt por delante y su Allow
 * gana. Lo que frena la indexación es el `noindex` del layout.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
