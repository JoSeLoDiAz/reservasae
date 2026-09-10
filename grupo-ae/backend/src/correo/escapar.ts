/** Texto de una persona, metido en HTML sin que sea HTML. */

/// Vive aparte porque el módulo tenía TRES escapados y no
/// coincidían: el del correo individual escapaba las comillas,
/// el de campañas no, y el aviso del entorno de pruebas no
/// escapaba nada. Tres copias de la misma regla son tres
/// oportunidades de que una se quede corta, y la que se quedó
/// corta fue justo la que interpola direcciones de correo.
///
/// Por qué importa lo de las direcciones: la validación que
/// hay es `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`, que solo prohíbe la
/// arroba y los espacios. `<` y `>` PASAN. Así que
/// `a<img/src=x>@b.co` es una dirección válida para ese
/// filtro y llegaba entera al HTML.

/// El orden manda: `&` PRIMERO.
///
/// Al revés, un `<` se vuelve `&lt;` y después ese `&` se
/// vuelve `&amp;lt;`, y el destinatario lee «&lt;» en vez de
/// «<». Es el error clásico del doble escapado.
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/// Para meter texto dentro de un atributo HTML.
///
/// Es el mismo escapado: se separa por nombre para que en el
/// sitio de uso se lea qué se está protegiendo. Un valor de
/// atributo sin comillas escapadas se sale del atributo y lo
/// que siga se lee como marcado.
export const escaparAtributo = escaparHtml;
