/** Qué acción de formación nombra lo que dijo el lead. */

/**
 * El emisor manda algo como `AF1 - Los nuevos retos` y de ahí
 * hay que sacar el curso. Antes esto se guardaba como texto y no
 * lo miraba nadie: el lead llegaba diciendo qué quería y, al
 * convertirlo, la ficha nacía sin acción — alguien tenía que
 * volver a elegirla a mano leyendo esa misma frase.
 *
 * **El código solo basta porque el gremio lo dice la URL.** `AF1`
 * en ADECOPRIA es neuroeducación y en BRITCHAM es agentes
 * autónomos: son cursos distintos con el mismo código. Buscar
 * `AF1` sin el convenio devolvería dos, y elegir uno sería
 * inventarse en cuál se inscribe la persona.
 *
 * Se resuelve AL ENTRAR y no al convertir, como el celular: si se
 * guarda el texto crudo y se interpreta después, dos leads que
 * dicen lo mismo escrito distinto son dos cosas que nadie
 * relaciona.
 */

/// `AF1`, `af 1`, `AF1 - Los nuevos retos`, `Curso AF07`.
///
/// Se busca el código EN CUALQUIER PARTE del texto y no solo al
/// principio: quien manda el formulario de Meta rara vez controla
/// cómo se rotula la opción.
const CODIGO = /\bAF\s*0*(\d{1,2})\b/i;

/** El código normalizado —`AF1`— o null si no nombra ninguno. */
export function codigoQuePidio(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const m = CODIGO.exec(texto);
  if (!m) return null;

  /// Sin ceros a la izquierda: en la base son `AF1`, no `AF01`.
  const numero = Number(m[1]);
  if (!Number.isInteger(numero) || numero < 1) return null;
  return `AF${numero}`;
}

export type AccionDelCatalogo = { id: string; codigo: string; visible: boolean };

/**
 * La acción de ESE convenio que nombra el texto, o null.
 *
 * Devuelve null —y no la primera que se parezca— cuando el
 * código no existe en ese gremio. Un lead con un curso que no
 * tenemos no es un lead de otro curso: es un lead al que hay que
 * preguntarle, y adivinarlo lo mete en una formación que no pidió.
 *
 * Una acción NO VISIBLE tampoco vale: si no está publicada, no se
 * está ofreciendo, y apuntarle a alguien ahí desde fuera se salta
 * la decisión de no ofrecerla.
 */
export function accionQuePidio(
  texto: string | null | undefined,
  delConvenio: AccionDelCatalogo[],
): AccionDelCatalogo | null {
  const codigo = codigoQuePidio(texto);
  if (!codigo) return null;
  return delConvenio.find((a) => a.codigo === codigo && a.visible) ?? null;
}
