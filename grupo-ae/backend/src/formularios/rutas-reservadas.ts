/** Rutas del sitio que un slug no puede ocupar. */

/**
 * El slug del formulario ES la ruta publica, asi que un
 * formulario llamado "admin" nace inaccesible: la pagina
 * de administracion gana. El frontend tiene su propia
 * copia porque la necesita en un script en linea; esta
 * es la que manda.
 */
export const RUTAS_RESERVADAS = new Set([
  'admin',
  'api',
  'consulta',
  'health',
  'marca',
  'preinscripcion',
  'completar',
]);

export const esRutaReservada = (slug: string) =>
  RUTAS_RESERVADAS.has(slug.trim().toLowerCase());
