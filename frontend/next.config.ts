import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Empaqueta server.js + solo las dependencias necesarias: la imagen de
  // produccion queda pequena en vez de arrastrar todo node_modules.
  output: "standalone",
  // El build corre desde la raiz del monorepo; sin esto Next se confunde
  // con el pnpm-lock del workspace al calcular que archivos incluir.
  outputFileTracingRoot: path.join(__dirname, ".."),

  // En el servidor nginx enruta /api/ hacia el backend. En local no hay
  // nginx, asi que replicamos el mismo salto (incluido el quitar el prefijo
  // /api) para que el codigo del frontend sea identico en ambos lados.
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/:path*",
      },
    ];
  },
};

export default nextConfig;
