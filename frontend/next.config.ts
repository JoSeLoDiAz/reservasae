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
  //
  // En local usamos 3100/4100 y no los 3000/4000 de siempre porque el otro
  // proyecto del equipo (SEP_APP) ya ocupa esos puertos: apuntando al 4000
  // este frontend hacia proxy contra el backend equivocado y todo /api/
  // respondia 404. En produccion no aplica, ahi manda nginx.
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    return [
      {
        source: "/api/:path*",
        // 127.0.0.1 y no localhost: Node resuelve localhost a ::1 primero y el
        // backend escucha en 0.0.0.0, que en Windows es solo IPv4. Con
        // localhost el proxy falla con ECONNREFUSED sin explicacion.
        destination: "http://127.0.0.1:4100/:path*",
      },
    ];
  },
};

export default nextConfig;
