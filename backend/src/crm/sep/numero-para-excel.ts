/** Un identificador que va a Excel sin perder lo que lo identifica. */

/**
 * EXCEL SE COME LOS CEROS DE LA IZQUIERDA.
 *
 * Un documento o un NIT son CADENAS que parecen números. Mandados como
 * número, `0900421154` llega al SENA como `900421154`: otra
 * organización, o ninguna. Y no sale un error, sale un cargue contra el
 * identificador equivocado, que es peor.
 *
 * La regla ya existía para el documento de la persona, dentro del
 * formato del cargue. El NIT iba con un `Number()` a secas en los TRES
 * formatos ---cargue, uso directo y F7--- y `normalizarNit` admite
 * perfectamente un NIT que empiece por cero. Lo encontró una auditoría
 * del 2 oct 2026.
 *
 * Se mudó aquí para que los cuatro sitios llamen al mismo: la primera
 * copia fue la que dejó al NIT fuera.
 */

/**
 * Como número cuando se puede, y como texto cuando el cero importa.
 *
 * NÚMERO SIEMPRE QUE SE PUEDA porque el SENA cruza estas columnas
 * contra su maestro y una celda de texto donde espera número también
 * rebota. Texto solo en los dos casos en que el número mentiría: si
 * empieza por cero, o si trae letras ---los pasaportes---.
 *
 * Hasta 15 dígitos, que es lo que cabe exacto en un `number`: por
 * encima, el último dígito empieza a redondearse en silencio.
 */
export function identificadorParaExcel(valor: string): string | number {
  return /^\d{1,15}$/.test(valor) && !valor.startsWith('0')
    ? Number(valor)
    : valor;
}
