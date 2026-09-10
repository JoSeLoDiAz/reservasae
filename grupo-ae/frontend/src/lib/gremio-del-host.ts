/** La etiqueta de gremio que trae la dirección. */

// la que manda esta en el backend
//
// Copia consciente de `backend/src/admin/gremio-del-host.ts`,
// igual que `marca.ts` repite las rutas reservadas: el
// middleware corre en el runtime edge y no puede consultar la
// base ni importar nada del servidor.

/// Nunca son un gremio, pase lo que pase.
const RESERVADOS = new Set(["www", "prueba", "api", "localhost", "127"]);

/// Lo que puede ser un slug, y nada mas.
///
/// El Host lo escribe el cliente y no tiene por que ser un
/// dominio: `//malo.reservasae.com` daria la etiqueta
/// `//malo`, y metida en una URL saca la peticion del origen.
const PATRON = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/// El prefijo del entorno de pruebas, que NO es del gremio.
///
/// `pre-adecopria` y `adecopria` son el MISMO gremio en dos
/// entornos: los separa el tunel al que apunta el DNS, no la
/// etiqueta. Aqui hace falta porque el middleware reescribe la
/// raiz a `/<slug>/preinscripcion`, y `/pre-adecopria/...` no
/// es ninguna ruta.
///
/// Se quita IGUAL que en el backend y a proposito: dos fuentes
/// para la misma decision acaban discrepando, y este proyecto
/// ya tuvo el formulario de un gremio bajo la marca del otro
/// por exactamente eso.
const PREFIJO_DE_PRUEBAS = "pre-";

/** La primera etiqueta del dominio, limpia y sin `pre-`. */
export function etiquetaDelHost(host?: string | null): string | null {
  if (!host) return null;

  const limpio = host.trim().toLowerCase().split(":")[0];
  if (!limpio) return null;

  const partes = limpio.split(".");
  // sin subdominio no hay gremio
  if (partes.length < 3) return null;

  const primera = partes[0];
  if (!primera || RESERVADOS.has(primera)) return null;
  if (!PATRON.test(primera)) return null;

  // se quita DESPUES de validar, igual que en el backend
  const sinPrefijo = primera.startsWith(PREFIJO_DE_PRUEBAS)
    ? primera.slice(PREFIJO_DE_PRUEBAS.length)
    : primera;

  if (!sinPrefijo || RESERVADOS.has(sinPrefijo)) return null;
  return sinPrefijo;
}
