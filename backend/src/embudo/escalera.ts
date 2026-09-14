/** Los peldaños de una visita al formulario público. */

/// Sube cuando cambia el ORDEN de la escalera.
///
/// Sin esto, un informe que junte dos versiones del formulario
/// mezcla peldaños que no significan lo mismo.
export const VERSION_EMBUDO = 1;

/**
 * En ORDEN, y ese orden es el informe.
 *
 * Refleja el formulario de hoy: primero la oferta, después los
 * datos con el permiso al pie, y al final la revisión. Si el
 * formulario se reordena, se sube `VERSION_EMBUDO`.
 *
 * `AUTORIZO` va antes que `DATOS_COMPLETOS` y no al revés: desde
 * el 14 sep 2026 la autorización es uno de los requisitos que
 * `faltaEnDatos` exige, así que no se puede estar completo sin
 * haberla marcado. El embudo sale monótono por construcción.
 */
export const ESCALERA = [
  'LLEGO',
  'CATALOGO_LISTO',
  'ELIGIO_UBICACION',
  'VIO_ACCIONES',
  'ELIGIO_ACCION',
  'AUTORIZO',
  'DATOS_COMPLETOS',
  'LLEGO_A_REVISION',
  'ENVIO',
  'REGISTRADO',
] as const;

/// Fuera de la escalera: dicen por qué se paró, no hasta dónde
/// llegó. Meterlas en el orden haría un embudo que sube.
export const MARCAS = ['CATALOGO_FALLO', 'SIN_COBERTURA', 'ENVIO_FALLO'] as const;

export type Peldano = (typeof ESCALERA)[number];
export type Marca = (typeof MARCAS)[number];
export type Paso = Peldano | Marca;

export const PASOS: readonly string[] = [...ESCALERA, ...MARCAS];

/// Lo escribe el SERVIDOR, no el navegador.
///
/// Es el único que no se puede permitir perder: beaconeado se cae
/// justo cuando la pestaña muere entre el envío y la respuesta,
/// que es un caso real en el que la ficha SÍ se creó.
export const DEL_SERVIDOR: readonly string[] = ['REGISTRADO'];

/// Los que acepta la puerta pública.
export const DEL_NAVEGADOR: readonly string[] = PASOS.filter(
  (p) => !DEL_SERVIDOR.includes(p),
);

/** En qué peldaño va, o -1 si es una marca. */
export function altura(paso: string): number {
  return (ESCALERA as readonly string[]).indexOf(paso);
}
