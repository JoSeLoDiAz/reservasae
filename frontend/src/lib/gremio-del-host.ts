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

/** La primera etiqueta del dominio, limpia. */
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
  return primera;
}
