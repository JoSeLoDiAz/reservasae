/** Qué gremio nombra la dirección por la que entraron. */

/// Nunca son un gremio, pase lo que pase. Es la misma idea
/// de `formularios/rutas-reservadas.ts`: un nombre que el
/// sitio ya usa no puede convertirse en la puerta de un
/// convenio, ni aunque alguien bautice así uno.
const RESERVADOS = new Set(['www', 'prueba', 'api', 'localhost', '127']);

/// Lo que puede ser un slug, y nada mas.
///
/// El Host lo escribe el cliente y no tiene por que ser un
/// dominio: `//malo.reservasae.com` daria la etiqueta
/// `//malo`, y metida en una URL saca la peticion del origen.
const PATRON = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/// El prefijo del entorno de pruebas, que NO es del gremio.
///
/// `pre-adecopria.reservasae.com` y `adecopria.reservasae.com`
/// nombran el MISMO gremio en dos entornos distintos: lo que
/// los separa es el tunel al que apunta el DNS, no la etiqueta.
/// El prefijo existe porque el comodin de Cloudflare cubre un
/// solo nivel y `adecopria.prueba.` daria error de TLS.
///
/// Sin quitarlo, `pre-adecopria` no casa con ningun convenio y
/// la direccion cae a la PUERTA GENERAL: el panel de pruebas
/// enseñaba los dos gremios en una direccion que dice ser de
/// uno. Un slug de convenio no puede empezar por `pre-`.
const PREFIJO_DE_PRUEBAS = 'pre-';

export type ConvenioConSlug = { id: string; slug: string };

/** La primera etiqueta del dominio, limpia y sin `pre-`. */
export function etiquetaDelHost(host?: string | null): string | null {
  if (!host) return null;

  // el puerto sobra, y el host llega como lo escribió quien
  // sea: puede venir con mayúsculas o con espacios
  const limpio = host.trim().toLowerCase().split(':')[0];
  if (!limpio) return null;

  const partes = limpio.split('.');
  // sin subdominio no hay gremio: reservasae.com, localhost
  if (partes.length < 3) return null;

  const primera = partes[0];
  if (!primera || RESERVADOS.has(primera)) return null;
  if (!PATRON.test(primera)) return null;

  // se quita DESPUES de validar: asi `//malo` se rechaza
  // antes, y no por parecerse a un prefijo
  const sinPrefijo = primera.startsWith(PREFIJO_DE_PRUEBAS)
    ? primera.slice(PREFIJO_DE_PRUEBAS.length)
    : primera;

  // `pre-` a secas no nombra a nadie
  if (!sinPrefijo || RESERVADOS.has(sinPrefijo)) return null;
  return sinPrefijo;
}

/**
 * El convenio que nombra la dirección, si nombra alguno.
 *
 * Devuelve null para la puerta general. Un subdominio que no
 * corresponde a ningún convenio activo también es null: se
 * trata como la puerta general, no como un gremio inexistente,
 * y allí el panel ya exige superadmin.
 */
export function gremioDelHost(
  host: string | null | undefined,
  convenios: ConvenioConSlug[],
): ConvenioConSlug | null {
  const etiqueta = etiquetaDelHost(host);
  if (!etiqueta) return null;
  return convenios.find((c) => c.slug === etiqueta) ?? null;
}
