import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // empaqueta solo lo necesario
  output: "standalone",
  // la raiz del monorepo
  outputFileTracingRoot: path.join(__dirname, ".."),

  // en local replica el salto de nginx
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
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
