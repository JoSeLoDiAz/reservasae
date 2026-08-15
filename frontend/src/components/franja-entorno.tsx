/** Aviso fijo de que esto no es produccion. */

export function FranjaEntorno() {
  // se hornea en la imagen y ademas llega por entorno
  if (process.env.ENTORNO !== "prueba") return null;

  return (
    <div
      role="region"
      aria-label="Aviso de entorno"
      // color fijo: la paleta la edita el admin y esto
      // no puede volverse invisible. Ver CLAUDE.md.
      className="no-imprimir sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b-2 border-[#7c2d12] bg-[#9a3412] px-4 py-1.5 text-center text-sm text-white"
    >
      <span className="font-semibold tracking-wide uppercase">Entorno de pruebas</span>
      <span className="text-white/85">
        Los datos son inventados. Nada de lo que haga aquí llega a producción.
      </span>
      <a
        // a /consulta y no a la raiz: alli el 404 es adrede
        href="https://reservasae.com/consulta"
        className="underline underline-offset-2 hover:no-underline"
      >
        Ir al sitio real
      </a>
    </div>
  );
}
