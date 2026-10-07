/** Lo que hay que hacerle a una celda para que Excel no la estropee. */

/**
 * «1,20E+17» EN LA COLUMNA DE CAMPAÑA (cliente, 7 oct 2026).
 *
 * El CSV lleva el número entero ---`120210000000000000`, el id de una
 * campaña de Meta--- y es Excel el que lo convierte al abrir: cualquier
 * celda que parezca un número la lee como número, y uno de dieciocho
 * cifras no cabe en la precisión de un `double`, así que lo enseña en
 * notación científica y PIERDE las cifras de en medio. Entrecomillar no
 * basta: Excel ignora las comillas para decidir el tipo.
 *
 * Y NO ES SOLO LA CAMPAÑA. Lo mismo le pasa a:
 *
 *   - un documento que empiece por cero ---«0123456789» sale
 *     «123456789»---, y ese número viaja al SENA;
 *   - un celular guardado sin el 3 delante;
 *   - cualquier id largo que un proveedor mande como dígitos.
 *
 * Son datos que PARECEN números y no lo son: nadie los suma. Un
 * identificador es una etiqueta.
 *
 * LA MARCA ES `="..."`, que es una fórmula de Excel que devuelve
 * texto. La entienden Excel, Google Sheets y LibreOffice, que son los
 * tres sitios donde se abre esto. Se usa SOLO donde hace falta: si se
 * le pusiera a todo, las columnas de cifras dejarían de sumarse y de
 * ordenarse como números, y esa es la mitad de para lo que se baja el
 * archivo.
 */

/// Desde cuántas cifras Excel empieza a redondear. Un `double` tiene
/// 15 cifras decimales exactas, así que con 16 ya puede mentir. Se
/// usa 12 por margen: los documentos colombianos llegan a 10 y los
/// NIT a 9 más el dígito, así que por debajo de 12 no hay nada que
/// proteger por tamaño.
const DESDE_CUANTAS_CIFRAS = 12;

/** ¿Excel va a estropear este valor si lo deja como está? */
export function excelLoVaAEstropear(valor: string): boolean {
  /// Solo dígitos: si trae letras, guiones o espacios, Excel ya lo
  /// deja en paz. Por eso un NIT «800214750-7» no entra aquí.
  if (!/^\d+$/.test(valor)) return false;
  /// Un cero delante es significativo en un documento y Excel se lo
  /// come, por corto que sea.
  if (valor.length > 1 && valor.startsWith('0')) return true;
  return valor.length >= DESDE_CUANTAS_CIFRAS;
}

/**
 * La celda lista para el CSV, ya escapada.
 *
 * Devuelve el campo ENTERO ---con sus comillas--- porque la marca de
 * texto va por dentro y quien llama no tiene por qué saber eso.
 */
export function celdaParaExcel(valor: string | number | null | undefined): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  /// Las comillas dobles de dentro se duplican, que es como las lee
  /// Excel.
  const escapado = texto.replace(/"/g, '""');
  if (!excelLoVaAEstropear(texto)) return `"${escapado}"`;
  /// `="123"`: la fórmula va dentro del campo entrecomillado, y las
  /// comillas de la fórmula se duplican como cualquier otra.
  return `"=""${escapado}"""`;
}
