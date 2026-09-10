import type { MetadataRoute } from "next";

/** Nada de esto se rastrea. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
