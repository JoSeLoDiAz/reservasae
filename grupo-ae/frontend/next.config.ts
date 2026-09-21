import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // empaqueta solo lo necesario
  output: "standalone",
  // Sin el botón «N» del indicador de desarrollo. Vive fijo en
  // la esquina inferior y, en el panel, tapaba la última fila de
  // las tablas y parte de la píldora de tema y accesibilidad. Solo
  // existe en `next dev`, así que apagarlo no cambia nada en el
  // build que se despliega; los errores siguen saliendo en la
  // consola y en la superposición de errores de Next.
  devIndicators: false,
  // la raiz del monorepo. Dos niveles: esta copia vive en
  // `grupo-ae/frontend`, no en `frontend`, y ahi arriba estan el
  // pnpm-workspace.yaml y el node_modules de verdad.
  outputFileTracingRoot: path.join(__dirname, "../.."),

  // Turbopack deduce la raiz solo, y con la copia anidada la deduce
  // mal: busca `next` desde `src/app`, no lo encuentra, y el dev
  // server arranca y se cae al primer render.
  turbopack: { root: path.join(__dirname, "../..") },

  // Detras del tunel la app se sirve desde un dominio
  // *.trycloudflare.com, y el dev server de Next rechaza las
  // peticiones internas que vengan de un origen que no reconoce:
  // el HTML carga y el CSS y el JS no.
  allowedDevOrigins: ["*.trycloudflare.com"],

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
        destination: "http://127.0.0.1:4200/:path*",
      },
    ];
  },
};

export default nextConfig;
