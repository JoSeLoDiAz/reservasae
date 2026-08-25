import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // empaqueta solo lo necesario
  output: "standalone",
  // la raiz del monorepo
  outputFileTracingRoot: path.join(__dirname, ".."),

  // en local replica el salto de nginx
  //
  // `PROXY_API=1` lo enciende tambien en un build de
  // produccion. Hace falta para servir la app compilada sin
  // nginx delante -- por ejemplo, detras de un tunel para
  // compartir el formulario. El despliegue real no lo pone y
  // se sigue comportando igual que siempre.
  async rewrites() {
    if (process.env.NODE_ENV === "production" && process.env.PROXY_API !== "1") {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        // 127.0.0.1 y no localhost: solo IPv4
        destination: "http://127.0.0.1:4100/:path*",
      },
    ];
  },
};

export default nextConfig;
