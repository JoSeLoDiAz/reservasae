/** Una fecha TECLEADA, leída por sus tres números. */

/// `new Date("2026-10-13")` es medianoche UTC, y en Bogotá eso
/// es el 12 a las 19:00: la pantalla muestra el día anterior al
/// que alguien escribió. Le pasó a quien carga el cronograma.
///
/// Es la misma distinción que el backend ya hace con
/// `aDiaBogota` para instantes y `aDiaDeCalendario` para fechas
/// tecleadas. Aquí vive una vez para que no se vuelva a arreglar
/// en un sitio y a olvidar en el de al lado: estaba resuelto en
/// `comoDia` de la vista del cronograma y la línea de debajo
/// seguía con `new Date`.
///
/// Los INSTANTES —creadoEn, ultimoAcceso— no pasan por aquí: esos
/// sí se leen en la hora de quien mira.

export function comoDia(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
}

const LARGA: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

export function fechaDeCalendario(
  iso: string | null | undefined,
  opciones: Intl.DateTimeFormatOptions = LARGA,
): string {
  if (!iso) return "—";
  return comoDia(iso).toLocaleDateString("es-CO", opciones);
}
