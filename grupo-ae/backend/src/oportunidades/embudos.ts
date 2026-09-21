/** Qué etapas tiene cada embudo, y cuánto vale estar en cada una. */

/**
 * Un solo catálogo de etapas, dos embudos que eligen las suyas.
 *
 * La alternativa —una tabla por embudo, o un embudo configurable
 * desde el panel— se descartó a propósito. Dos tablas obligan a
 * traducir en cada informe que quiera sumar los dos, y un embudo
 * configurable convierte cada consulta en «depende de lo que
 * alguien haya escrito», que es como los CRMs del mercado acaban
 * con cuarenta etapas y ningún pronóstico.
 *
 * Aquí las etapas son un enum de la base y esto declara cuáles usa
 * cada quien. Añadir un tercer embudo es añadir una fila a estas
 * dos tablas.
 */

import {
  EtapaOportunidad,
  TipoEmbudo,
  type MotivoCierre,
} from '../../generated/prisma';

/**
 * Las etapas de cada embudo, EN ORDEN.
 *
 * El orden importa y se usa: es el de las columnas del tablero y el
 * que decide si un cambio de etapa avanza o retrocede. Cambiarlo
 * cambia el tablero.
 *
 * El de personas es más corto a propósito. En venta a persona el
 * ciclo se mide en días y el volumen es alto: cada etapa de más es
 * una casilla que nadie llena, y un embudo con casillas sin llenar
 * no es un embudo con detalle, es un embudo que miente.
 */
export const ETAPAS_ABIERTAS: Record<TipoEmbudo, EtapaOportunidad[]> = {
  [TipoEmbudo.EMPRESA]: [
    EtapaOportunidad.CAPTADO,
    EtapaOportunidad.CONTACTADO,
    EtapaOportunidad.CALIFICADO,
    EtapaOportunidad.PROPUESTA_ENVIADA,
    EtapaOportunidad.EN_NEGOCIACION,
  ],
  [TipoEmbudo.PERSONA]: [
    EtapaOportunidad.CAPTADO,
    EtapaOportunidad.CONTACTADO,
    EtapaOportunidad.CALIFICADO,
  ],
};

/// Las dos formas de terminar. Iguales en los dos embudos.
export const ETAPAS_CERRADAS: EtapaOportunidad[] = [
  EtapaOportunidad.GANADO,
  EtapaOportunidad.PERDIDO,
];

/** Todo lo que ese embudo admite, abierto y cerrado. */
export function etapasDe(embudo: TipoEmbudo): EtapaOportunidad[] {
  return [...ETAPAS_ABIERTAS[embudo], ...ETAPAS_CERRADAS];
}

/** Si esa etapa pertenece a ese embudo. */
export function esDelEmbudo(
  embudo: TipoEmbudo,
  etapa: EtapaOportunidad,
): boolean {
  return etapasDe(embudo).includes(etapa);
}

/** Sigue viva: ni ganada ni perdida. */
export function estaAbierta(etapa: EtapaOportunidad): boolean {
  return !ETAPAS_CERRADAS.includes(etapa);
}

/**
 * La probabilidad de cada etapa, por embudo.
 *
 * SON UN SUPUESTO, y hay que decirlo cada vez que se lean.
 *
 * Los CRMs del mercado traen 10 / 20 / 40 / 60 / 80 por defecto y
 * casi nadie los cambia, así que el pronóstico de casi todo el
 * mundo está calculado con las probabilidades de nadie. Estas de
 * aquí salen de la forma del embudo, no de nuestro histórico —
 * porque todavía no hay histórico.
 *
 * Se recalculan con datos propios en cuanto haya cierres
 * suficientes, y por embudo separado: mezclar empresa y persona en
 * un solo promedio empeora los dos. Hasta entonces, el panel las
 * enseña marcadas como estimadas.
 */
export const PROBABILIDAD: Record<
  TipoEmbudo,
  Record<EtapaOportunidad, number>
> = {
  [TipoEmbudo.EMPRESA]: {
    [EtapaOportunidad.CAPTADO]: 5,
    [EtapaOportunidad.CONTACTADO]: 15,
    [EtapaOportunidad.CALIFICADO]: 30,
    [EtapaOportunidad.PROPUESTA_ENVIADA]: 50,
    [EtapaOportunidad.EN_NEGOCIACION]: 70,
    [EtapaOportunidad.GANADO]: 100,
    [EtapaOportunidad.PERDIDO]: 0,
  },
  [TipoEmbudo.PERSONA]: {
    [EtapaOportunidad.CAPTADO]: 10,
    [EtapaOportunidad.CONTACTADO]: 30,
    [EtapaOportunidad.CALIFICADO]: 55,
    /// No son suyas: se declaran en cero para que la tabla esté
    /// completa y `probabilidadDe` no devuelva undefined si
    /// alguien la llama con una etapa que no toca.
    [EtapaOportunidad.PROPUESTA_ENVIADA]: 0,
    [EtapaOportunidad.EN_NEGOCIACION]: 0,
    [EtapaOportunidad.GANADO]: 100,
    [EtapaOportunidad.PERDIDO]: 0,
  },
};

/** Cuánto vale estar ahí, de 0 a 100. */
export function probabilidadDe(
  embudo: TipoEmbudo,
  etapa: EtapaOportunidad,
  /// La tabla de Configuración cuando la hay. Sin argumento, la
  /// estimada de aquí.
  tabla: Record<TipoEmbudo, Record<EtapaOportunidad, number>> = PROBABILIDAD,
): number {
  return tabla[embudo][etapa];
}

/**
 * Cuánto pesa una oportunidad en el pronóstico.
 *
 * En centavos redondeados al peso: `valor` viene como Decimal y el
 * llamador lo pasa en número, así que aquí se redondea una sola vez
 * y en un solo sitio. Sumar cien pronósticos con decimales sueltos
 * descuadra el total contra la suma de las partes, y esa diferencia
 * de tres pesos es la que hace que nadie vuelva a creerle al
 * tablero.
 */
export function valorPonderado(valor: number, probabilidad: number): number {
  return Math.round(valor * (probabilidad / 100));
}

/// Los motivos que solo valen para ganar.
export const MOTIVOS_DE_GANAR: MotivoCierre[] = [
  'PRECIO_ACEPTADO',
  'UNICA_OPCION',
  'RECOMENDACION',
];

/**
 * Si ese motivo puede acompañar a ese cierre.
 *
 * Existe porque el desplegable del panel no basta: la misma
 * petición la puede mandar un script, y «ganada porque nunca
 * respondió» es una fila que envenena el informe del que se supone
 * que aprendemos.
 */
export function motivoValeParaCerrar(
  etapa: EtapaOportunidad,
  motivo: MotivoCierre,
): boolean {
  const esDeGanar = MOTIVOS_DE_GANAR.includes(motivo);
  if (etapa === EtapaOportunidad.GANADO) return esDeGanar;
  /// `OTRO` cae aquí por no estar en los de ganar, que es lo que se
  /// quiere: perder por algo que no habíamos previsto es normal;
  /// ganar por algo que no habíamos previsto hay que escribirlo.
  if (etapa === EtapaOportunidad.PERDIDO) return !esDeGanar;
  return false;
}
