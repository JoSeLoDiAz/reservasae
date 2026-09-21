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
      // alto fijo: la cabecera se pega justo debajo y con
      // dos lineas la taparia. Ver --franja-alto
      // 28px, que es lo que dice `--franja-alto` en
      // `globals.css`. El elemento medía 36 más 2 de borde: la
      // franja tapaba dos píxeles de lo que se le pegaba
      // debajo, porque el token y la caja decían cosas
      // distintas. Y sin el borde de 2px: 2px significa «aquí
      // empieza algo» y esto no empieza nada del producto.
      className="franja-entorno no-imprimir sticky top-0 z-50 flex h-7 items-center justify-center gap-x-3 overflow-hidden bg-[#9a3412] px-4 text-center whitespace-nowrap text-white"
    >
      <span className="rotulo-bloque">Entorno de pruebas</span>
      <span className="micro hidden sm:inline">
        Los datos son inventados. Nada de lo que haga aquí llega a producción.
      </span>
      {/* Llevaba a reservasae.com/consulta, que es la consulta de
          Convoca, no el CRM de Grupo AE. Ahora sale de SITIO_REAL_URL;
          sin ella no se pinta, en vez de mandar a otro producto. */}
      {process.env.SITIO_REAL_URL && (
        <a
          href={process.env.SITIO_REAL_URL}
          className="micro underline underline-offset-2 hover:no-underline"
        >
          Ir al sitio real
        </a>
      )}
    </div>
  );
}
