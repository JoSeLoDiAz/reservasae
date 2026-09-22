/** Lo que dicen las cifras del tráfico, una sola vez. */

/**
 * Sale de `panel-trafico.tsx` porque ahora hay DOS pantallas que
 * lo dicen: el informe de Tráfico y el módulo 4 del Resumen.
 *
 * No es orden: es la única forma de que las dos no discrepen. Este
 * repositorio lleva media docena de veces documentando el mismo
 * fallo —«dos verdades sobre la misma decisión»— y el diccionario
 * de procedencias ya lo vivió: «hubo una copia en el servidor que
 * nadie importaba, que es exactamente el defecto que este cambio
 * vino a evitar».
 */

/// Por debajo de esto no se imprime porcentaje: una tasa con dos
/// visitas se lee igual que una con tres mil.
export const MINIMO_PARA_TASA = 30;

/**
 * El redondeo del embudo, y de nadie más.
 *
 * Un porcentaje que sale en dos sitios con dos redondeos distintos
 * se lee como dos cifras.
 */
export function porcentaje(parte: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((parte / total) * 100)} %`;
}

/// Los peldaños de la escalera, como se leen. El orden ES el
/// embudo: `hitos` acredita a cada visita todos los de debajo de
/// su máximo, así que la lista nunca sube.
export const PELDANOS_DEL_TRAFICO = [
  { paso: "LLEGO", etiqueta: "Abrieron el enlace" },
  { paso: "CATALOGO_LISTO", etiqueta: "Vieron el formulario" },
  { paso: "ELIGIO_UBICACION", etiqueta: "Eligieron su ciudad" },
  { paso: "VIO_ACCIONES", etiqueta: "Vieron los cursos" },
  { paso: "ELIGIO_ACCION", etiqueta: "Eligieron un curso" },
  { paso: "AUTORIZO", etiqueta: "Autorizaron sus datos" },
  { paso: "DATOS_COMPLETOS", etiqueta: "Llenaron todo" },
  { paso: "ENVIO", etiqueta: "Pulsaron confirmar" },
  { paso: "REGISTRADO", etiqueta: "Se preinscribieron" },
] as const;

/** Cuántas visitas llegaron a un peldaño. */
export function visitasDe(
  hitos: Array<{ paso: string; visitas: number }>,
  paso: string,
): number {
  return hitos.find((h) => h.paso === paso)?.visitas ?? 0;
}
