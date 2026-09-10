/** Un dato personal, reconocible en un log pero sin serlo. */

/// Un log con cédulas es una filtración: el stdout del
/// contenedor lo lee cualquiera con acceso al servidor, se
/// copia a un agregador de logs, y ahí se queda sin las
/// protecciones que sí tiene la base de datos. Al procesar la
/// cola entera, el log terminaba con la cédula de cada persona
/// registrada, una por línea.
///
/// Pero un log que no dice a quién se refiere no sirve para
/// depurar. Se tapa el medio y se dejan las puntas: quien esté
/// mirando una ficha concreta reconoce la suya, y quien lea el
/// log a secas no se lleva ninguna.

export function taparDocumento(documento: string | null | undefined): string {
  const d = (documento ?? '').trim();
  if (!d) return '(sin documento)';
  /// Menos de siete: se tapa entero. Con un documento corto,
  /// dejar cuatro dígitos es dejarlo casi completo.
  if (d.length < 7) return '*'.repeat(d.length);
  return `${d.slice(0, 2)}${'*'.repeat(d.length - 4)}${d.slice(-2)}`;
}
