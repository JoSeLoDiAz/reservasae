import { NextResponse, type NextRequest } from "next/server";

import { etiquetaDelHost } from "@/lib/gremio-del-host";

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
/// Basta con que UNA de las dos lo parezca.
///
/// Antes era `x-forwarded-host ?? host`, y esa cabecera la
/// pone quien quiera: mandandola con un dominio normal, el
/// corte se saltaba y el panel salia por el tunel. Con `some`
/// no se puede esquivar anadiendo una cabecera, solo
/// quitandola, y quitarla deja el `host` de verdad.
function esTunel(peticion: NextRequest): boolean {
  return [
    peticion.headers.get("x-forwarded-host"),
    peticion.headers.get("host"),
  ].some((valor) => {
    const h = (valor ?? "").toLowerCase();
    return h.endsWith(".trycloudflare.com") || h.endsWith(".ngrok-free.app");
  });
}

/// Para el gremio manda `host` y nada mas.
///
/// Es la misma fuente que lee el backend, y tienen que
/// coincidir: con `x-forwarded-host` se podia reescribir a un
/// gremio mientras la paleta salia del otro -- el formulario
/// de uno bajo la marca del otro.
function hostDelGremio(peticion: NextRequest): string {
  return (peticion.headers.get("host") ?? "").toLowerCase();
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
  /// La raíz de un gremio sirve SU formulario corto.
  ///
  /// Va ANTES del corte del túnel o no se ejecutaría nunca en
  /// producción. Y es rewrite, no redirect: la barra tiene que
  /// seguir diciendo la dirección del gremio, y un redirect
  /// además delataría la ruta interna.
  ///
  /// Se comprueba `esTunel` primero porque un host de
  /// trycloudflare tiene tres etiquetas y la suya no está en
  /// RESERVADOS: sin eso, un túnel de pruebas se reescribiría
  /// y se saltaría la puerta que cierra el panel.
  if (!esTunel(peticion) && peticion.nextUrl.pathname === "/") {
    const gremio = etiquetaDelHost(hostDelGremio(peticion));
    if (gremio) {
      return NextResponse.rewrite(
        new URL(`/${gremio}/preinscripcion`, peticion.url),
      );
    }
  }

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
