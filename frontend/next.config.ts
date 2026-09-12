import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // empaqueta solo lo necesario
  output: "standalone",

  /// Los dominios desde los que `next dev` se deja usar.
  ///
  /// Next 16 bloquea las peticiones de desarrollo que llegan con
  /// un Host que no es `localhost`, y lo hace en silencio: la
  /// página se sirve, pero el navegador no recibe el bundle del
  /// cliente. Lo que se ve entonces es el HTML del servidor
  /// —«Cargando la convocatoria…», con la paleta por defecto— y
  /// nada más: no hidrata, no pide el catálogo y no responde a
  /// nada. Pasa media hora antes de sospechar del túnel.
  ///
  /// Solo afecta a `next dev`; en producción esta lista no se
  /// mira. Ver `scripts/tunel-convoca.ps1`.
  /// La red local va en la lista TAMBIEN, y por la misma razon:
  /// entrar por `http://192.168.0.5:3100` desde el telefono o
  /// desde otro equipo es un Host que no es `localhost`, asi que
  /// sin esto la pagina se sirve y NO hidrata. El sintoma es el
  /// descrito arriba y cuesta media hora de sospechar del cable.
  ///
  /// Van los tres rangos privados y no solo el 192.168 de hoy: la
  /// IP la reparte el router por DHCP y cambia de red en red.
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
  ],
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
