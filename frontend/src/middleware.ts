import { NextResponse, type NextRequest } from "next/server";

/**
 * El panel no sale por el túnel.
 *
 * Un túnel a este puerto publica la aplicación entera, y el
 * panel lleva nombres, documentos, correos y celulares. Quien
 * entre por un dominio de túnel solo alcanza el trámite
 * público; todo lo demás le contesta 404.
 *
 * Se mira el dominio y no una variable de entorno para no
 * tener que levantar dos servidores: por `localhost` el panel
 * sigue abierto como siempre, en el mismo proceso.
 *
 * Solo reconoce dominios de túnel de pruebas. Un despliegue
 * de verdad lleva su propio dominio y esto no lo toca.
 */
function esTunel(peticion: NextRequest): boolean {
  const host = (
    peticion.headers.get("x-forwarded-host") ??
    peticion.headers.get("host") ??
    ""
  ).toLowerCase();

  return host.endsWith(".trycloudflare.com") || host.endsWith(".ngrok-free.app");
}

/// Lo que el trámite necesita para funcionar. Todo lo que no
/// esté aquí no sale al público.
const RUTAS_PUBLICAS = [
  "/completar",
  "/api/preinscripcion",
  "/api/completar",
  "/api/directorio",
  "/api/marca",
];

/// Las de Next y los archivos sueltos. Sin esto no carga ni
/// el CSS ni el logo.
const INFRAESTRUCTURA = ["/_next", "/favicon.ico", "/logo-convoca.png"];

export function middleware(peticion: NextRequest) {
  if (!esTunel(peticion)) return NextResponse.next();

  const ruta = peticion.nextUrl.pathname;

  if (INFRAESTRUCTURA.some((p) => ruta.startsWith(p))) return NextResponse.next();
  if (RUTAS_PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // `/<convenio>/preinscripcion`, que es el formulario corto
  if (/^\/[a-z0-9]+(-[a-z0-9]+)*\/preinscripcion\/?$/.test(ruta)) {
    return NextResponse.next();
  }

  // 404 y no 403: un 403 confirma que el panel existe
  return new NextResponse("No encontrado", { status: 404 });
}

export const config = {
  matcher: "/((?!_next/static|_next/image).*)",
};
