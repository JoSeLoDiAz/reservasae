/** Con qué se le va a responder a quien acaba de escribir. */

/**
 * LA DECISIÓN: sin correo y sin celular no se capta, y se dice en
 * la misma pantalla.
 *
 * Una oportunidad sin forma de contacto no es una oportunidad
 * incompleta: es una fila que ocupa una columna del tablero, suma
 * en el recuento y no se puede trabajar. Y hace un daño que no se
 * ve — el reloj de primera respuesta empieza a correr contra el
 * equipo por algo que nadie podía contestar, así que la mediana
 * con la que se juzga al equipo se ensucia con leads mudos.
 *
 * Se rechaza EN LA PUERTA, por dos razones:
 *
 *  - La persona está delante del formulario, con los datos en la
 *    mano: es el único momento en que arreglarlo cuesta un campo.
 *    El asesor que lo descubre tres días después no tiene a quién
 *    llamar para pedirle el teléfono.
 *  - Rechazar DESPUÉS de guardar dejaría los datos dentro de todas
 *    formas, que es el daño entero. Es la misma lección que la
 *    preinscripción aprendió con la política de datos.
 *
 * Lo que NO se hace es exigir los dos. Con uno sobra, y cada campo
 * obligatorio de un formulario público se paga en gente que no lo
 * termina.
 *
 * Módulo puro y aparte, como `escalera.ts`: esta misma regla la
 * necesita la pantalla para pintar el aviso antes de enviar, y dos
 * copias serían dos reglas.
 */

import { celularUtil, normalizarCelular } from '../comun/celular';

/// Lo poco que hace falta para decidir.
export type LoQueTrajo = {
  correo?: string | null;
  celular?: string | null;
};

export type ComoResponder = {
  puede: boolean;
  /// Ya limpios y listos para guardar. Null cuando no sirven.
  correo: string | null;
  celular: string | null;
  /// Qué falta, en la frase que va a leer quien llenó el
  /// formulario. Null si pasa.
  porque: string | null;
};

/**
 * El mismo patrón que usa `formularios.service` para las preguntas
 * de tipo CORREO, y a propósito: si la pregunta suelta de un
 * formulario y el correo del núcleo se validaran con reglas
 * distintas, el mismo texto pasaría por una puerta y no por la
 * otra.
 */
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function hayComoResponder(trajo: LoQueTrajo): ComoResponder {
  const correoEscrito = (trajo.correo ?? '').trim().toLowerCase();
  const celularEscrito = (trajo.celular ?? '').trim();

  const correo = CORREO.test(correoEscrito) ? correoEscrito : null;
  /// Se guarda NORMALIZADO —diez dígitos, sin el indicativo—
  /// porque es como lo busca el resto del sistema: `+57 300 111
  /// 2222` y `3001112222` son el mismo número, y guardados
  /// distinto no se cruzan nunca.
  const celular = celularUtil(celularEscrito)
    ? normalizarCelular(celularEscrito)
    : null;

  if (correo || celular) {
    return { puede: true, correo, celular, porque: null };
  }

  /**
   * Dos negativas distintas, y la diferencia importa.
   *
   * «No dejó nada» se arregla escribiendo algo. «Lo que escribió no
   * sirve» se arregla mirando lo que ya escribió, y decirle
   * «déjenos un correo» a quien acaba de dejar uno mal tecleado es
   * la clase de mensaje que hace que la gente cierre la página.
   */
  const escribioAlgo = correoEscrito !== '' || celularEscrito !== '';
  if (!escribioAlgo) {
    return {
      puede: false,
      correo: null,
      celular: null,
      porque:
        'Déjenos un correo o un celular: sin una forma de contactarlo no ' +
        'podemos responderle.',
    };
  }

  const problemas: string[] = [];
  if (correoEscrito) problemas.push(`«${correoEscrito}» no es un correo`);
  if (celularEscrito) {
    /// Se nombra el fijo porque es el error real: la gente escribe
    /// el teléfono de la oficina y no entiende por qué se lo
    /// rechazan.
    problemas.push(
      `«${celularEscrito}» no es un celular de diez dígitos que empiece ` +
        'por 3 (un fijo no recibe mensajes)',
    );
  }

  return {
    puede: false,
    correo: null,
    celular: null,
    porque: `Revise sus datos de contacto: ${problemas.join(' y ')}.`,
  };
}
