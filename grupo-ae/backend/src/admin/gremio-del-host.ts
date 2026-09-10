/** Qué gremio nombra la dirección por la que entraron. */

/// Nunca son un gremio, pase lo que pase. Es la misma idea
/// de `formularios/rutas-reservadas.ts`: un nombre que el
/// sitio ya usa no puede convertirse en la puerta de un
/// convenio, ni aunque alguien bautice así uno.
const RESERVADOS = new Set(['www', 'prueba', 'api', 'localhost', '127']);

/// El prefijo que llevan los subdominios de PRUEBAS.
///
/// `pre-adecopria.reservasae.com` sirve el entorno de pruebas
/// del mismo gremio que `adecopria.reservasae.com`. Va delante
/// y no detras por el comodin de Cloudflare, que cubre un solo
/// nivel: `adecopria.prueba.reservasae.com` daria error de TLS.
///
/// Aqui se quita antes de buscar el convenio. Sin esto la
/// etiqueta seria `pre-adecopria`, que no es el slug de ningun
/// convenio, y el gremio se quedaria sin resolver EN SILENCIO:
/// el panel perderia la marca y dejaria de fijar el gremio, y
/// los dos webhooks —el del orquestador y el de Meta—
/// rechazarian todo lo que les llegara por esa direccion.
///
/// Ojo si alguna vez se crea un convenio cuyo slug empiece por
/// `pre-`: esto se lo comeria. Hoy son `adecopria` y
/// `britcham-adee`, y quien cree el tercero tiene que saberlo.
const PREFIJO_DE_PRUEBAS = 'pre-';

/// Lo que puede ser un slug, y nada mas.
///
/// El Host lo escribe el cliente y no tiene por que ser un
/// dominio: `//malo.reservasae.com` daria la etiqueta
/// `//malo`, y metida en una URL saca la peticion del origen.
const PATRON = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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

  /// Se quita DESPUES de validar el patron, nunca antes.
  ///
  /// Asi `//malo` se rechaza por no ser un dominio y no por
  /// parecerse a un prefijo, y `pre-` a secas —que quedaria en
  /// cadena vacia— tampoco llega a colarse como etiqueta.
  const sinPrefijo = primera.startsWith(PREFIJO_DE_PRUEBAS)
    ? primera.slice(PREFIJO_DE_PRUEBAS.length)
    : primera;

  /// Y lo RESERVADO se comprueba otra vez, ya sin prefijo.
  ///
  /// Sin esta segunda vuelta, `pre-prueba` se convierte en
  /// `prueba` y se cuela justo por el nombre que la primera
  /// comprobacion aparta. Su spec lo fija.
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
