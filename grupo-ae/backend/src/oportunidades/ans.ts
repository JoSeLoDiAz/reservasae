/** El compromiso de primera respuesta, y si se cumplió. */

/**
 * EL ACUERDO DE NIVEL DE SERVICIO, que la dirección pidió
 * «estructurar» (notas del 15 sep 2026).
 *
 * La mitad difícil ya estaba hecha y llevaba semanas funcionando
 * sin que nadie la llamara así: `Oportunidad.primeraRespuestaEn`
 * se escribe UNA vez y no se puede reescribir —su propio
 * comentario en el esquema dice que «una medición que se puede
 * reescribir no mide»— y `minutosPrimeraRespuesta` queda guardado
 * para poder promediar sin recorrer la tabla.
 *
 * O sea: el sistema YA MEDÍA. Lo que le faltaba para ser un ANS
 * era el COMPROMISO —contra qué se juzga esa medición— y eso es
 * esto.
 *
 * VIVE EN EL BACKEND Y NO EN EL PANEL, y ese es el arreglo de
 * fondo. El número existía, pero solo en
 * `frontend/.../datos-del-negocio.tsx`, donde servía para pintar
 * el reloj de color. Un umbral que solo conoce la pantalla puede
 * colorear, pero no puede contar: nadie sabía cuántas se
 * incumplieron esta semana, que es la única pregunta que un ANS
 * viene a contestar.
 *
 * Y NO ES EL MISMO EN LOS DOS EMBUDOS, ni puede serlo. Quien
 * pregunta por WhatsApp por un curso de 780 mil y no tiene
 * respuesta en cinco minutos ya se matriculó en otro instituto;
 * una propuesta de 46 millones aguanta el día. Es la misma razón
 * que ya estaba escrita en el panel, traída al sitio donde
 * además sirve para medir.
 *
 * EL FALLO QUE ESTO ARREGLA, que no era pequeño: la portada
 * contaba `minutosEsperando >= 5` para LOS DOS embudos. Un
 * negocio de empresa aparecía como incumplido a los seis minutos,
 * cuando su compromiso son veinticuatro horas. La cifra de
 * «pasados» del tablero venía inflada por un factor de casi
 * trescientos en todo lo que fuera de empresas, y es justo la
 * cifra con la que se juzga al equipo.
 */

import { TipoEmbudo } from '../../generated/prisma';

/**
 * Cuánto se compromete uno a tardar en contestar por primera vez.
 *
 * Sale del panel, donde estaba desde antes y ya estaba acordado.
 * El día que la dirección quiera otro número, se cambia aquí y lo
 * siguen la portada, el reloj y cualquier informe que venga.
 *
 * NO es configurable desde Apariencia a propósito, y conviene
 * dejarlo dicho porque es la petición que va a llegar: un
 * compromiso que cada quien se ajusta deja de ser un compromiso.
 * Si mañana se quiere por gremio, va en el modelo con su fecha de
 * vigencia —como las políticas—, no en un campo que se pisa y
 * borra el de antes.
 */
export const COMPROMISO_EN_MINUTOS: Record<TipoEmbudo, number> = {
  [TipoEmbudo.PERSONA]: 5,
  [TipoEmbudo.EMPRESA]: 24 * 60,
};

/**
 * ¿Esa espera ya incumplió?
 *
 * Con `>` y no `>=`: cumplir el compromiso es contestar EN cinco
 * minutos, y el que contesta en el minuto cinco lo cumplió. Con
 * `>=` el equipo pierde un caso por cada respuesta que llega justo
 * a tiempo, que es la clase de detalle que desacredita un
 * indicador entero cuando alguien lo revisa a mano.
 */
export function incumple(
  minutos: number,
  embudo: TipoEmbudo,
  /// Los de Configuración cuando los hay. Sin argumento, los de
  /// aquí: así esto se sigue probando sin base y una instalación
  /// sin parametrizar se comporta igual que antes.
  compromiso: Record<TipoEmbudo, number> = COMPROMISO_EN_MINUTOS,
): boolean {
  return minutos > compromiso[embudo];
}

/// Cómo se dice el compromiso en una frase. La portada lo
/// escribía a mano —«pasan de cinco minutos»— y por eso seguía
/// diciendo cinco cuando la cifra ya mezclaba los dos embudos.
export function compromisoEnPalabras(
  embudo: TipoEmbudo,
  compromiso: Record<TipoEmbudo, number> = COMPROMISO_EN_MINUTOS,
): string {
  const m = compromiso[embudo];
  if (m < 60) return `${m} minutos`;
  const horas = m / 60;
  return horas === 24 ? 'un día' : `${horas} horas`;
}
