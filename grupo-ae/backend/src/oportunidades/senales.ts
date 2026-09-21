/** Las dos señales de que un negocio se está pudriendo. */

/**
 * «MUERTOS VIVIENTES» y «BANANEOS», que la dirección pidió por su
 * nombre (notas del 15 sep 2026).
 *
 * NO SON ETAPAS, Y ESA ES LA DECISIÓN QUE HAY QUE DEFENDER AQUÍ.
 * Se pidieron en la misma lista que «solicitud de negocio» y
 * «cotización», así que lo natural habría sido añadirlas al enum.
 * Sería un error, por tres motivos que solo se ven después:
 *
 *  1. **El negocio pierde su etapa real.** ¿Se murió en cotización
 *     o en negociación? Esa es justo la pregunta que sirve para
 *     arreglar el proceso, y una etapa «muertos vivientes» la
 *     borra.
 *  2. **Rompe el pronóstico.** Cada etapa lleva su probabilidad.
 *     Un muerto viviente no tiene una probabilidad propia: tiene
 *     la de su etapa, y lo que pasa es que ya no se la cree nadie.
 *  3. **No se puede volver.** Si revive, ¿a qué etapa? El
 *     historial de `movimientos_oportunidad` ya no lo sabría.
 *
 * Así que son MARCAS que cruzan el embudo, se calculan y no se
 * declaran. Nadie las pone a mano a propósito: una marca que hay
 * que acordarse de poner no la pone nadie, y la que sí se pondría
 * —«este está muerto»— ya existe y es `probabilidadPropia`.
 *
 * LA DIFERENCIA ENTRE LAS DOS ES DE QUIÉN ES LA CULPA, y por eso
 * son dos y no una:
 *
 *   MUERTO VIVIENTE  la fecha que el negocio prometió ya pasó y
 *                    sigue abierto.            → fallo NUESTRO
 *   BANANEO          lo trabajamos una y otra vez y no se mueve
 *                    de etapa.                 → fallo DE ELLOS,
 *                                                o lo calificamos
 *                                                mal
 *
 * Y NO DUPLICAN lo que ya hay. El panel ya tiene dos avisos con
 * los que estas se confunden fácil:
 *
 *   - **Frías** (`frialdadDe`): lleva días sin que nadie la toque.
 *     Es un aviso temprano y se apaga sola en cuanto alguien hace
 *     algo. Un muerto viviente puede estar caliente —alguien la
 *     toca todas las semanas— y seguir muerto: lo que lo define no
 *     es el abandono, es la promesa incumplida.
 *   - **Sin próximo paso** (`esProximoPaso`): nadie se comprometió
 *     a nada. Mide el plan, no el resultado.
 */

import { EtapaOportunidad, TipoEmbudo } from '../../generated/prisma';

export type Senal = 'MUERTO_VIVIENTE' | 'BANANEO';

/**
 * Cuántas gestiones HECHAS en la misma etapa son un bananeo.
 *
 * Tres, en los dos embudos. No es un número medido —no hay
 * histórico propio todavía— y por eso vive aquí con su nombre, en
 * un solo sitio: el día que haya datos se cambia con un número, no
 * buscando `3` por el código.
 *
 * Es un CONTEO y no un plazo, a propósito. Un plazo obligaría a un
 * umbral distinto por embudo —en empresas el ciclo es de semanas o
 * meses y en personas de días, y así lo dice el propio tablero— y
 * dos umbrales que hay que mantener en sintonía se desincronizan.
 * Tres gestiones hechas son tres gestiones hechas en los dos
 * mundos: si usted llamó, escribió y visitó, y el negocio sigue
 * donde estaba, lo están bananeando.
 */
export const GESTIONES_PARA_BANANEO: Record<TipoEmbudo, number> = {
  [TipoEmbudo.EMPRESA]: 3,
  [TipoEmbudo.PERSONA]: 3,
};

/// Lo mínimo que hace falta saber de un negocio para juzgarlo. Se
/// declara así, y no con el tipo de Prisma, para que este módulo
/// se pueda probar sin base y sin el cliente generado — igual que
/// `agenda.ts`.
export type NegocioAJuzgar = {
  embudo: TipoEmbudo;
  etapa: EtapaOportunidad;
  cierreEsperado: Date | null;
  /// Cuándo entró a la etapa en la que está. Es la fecha del
  /// último movimiento; si nunca se movió, su creación.
  enLaEtapaDesde: Date;
  /// Cuántas gestiones se HICIERON desde entonces. Las pendientes
  /// no cuentan: agendar una llamada no es haberla hecho, y si
  /// contaran, bananeo se encendería con solo poner tareas.
  gestionesHechasEnLaEtapa: number;
};

/// Las dos formas de terminar. Un negocio cerrado no se pudre:
/// ya pasó lo que tenía que pasar.
const CERRADAS: EtapaOportunidad[] = [
  EtapaOportunidad.GANADO,
  EtapaOportunidad.PERDIDO,
];

/**
 * ¿La fecha que prometió ya pasó y sigue abierto?
 *
 * SIN UMBRAL INVENTADO, y eso es lo bueno de esta definición: no
 * dice «treinta días», dice «la fecha que usted mismo puso». El
 * número sale del negocio, no de mí.
 *
 * Un negocio SIN `cierreEsperado` no es un muerto viviente por no
 * tenerlo. Es otro problema —un negocio sin fecha no se puede
 * pronosticar— y mezclarlo aquí haría que la marca dijera dos
 * cosas a la vez. Ese hueco lo tapa quien exija la fecha, no esto.
 */
function esMuertoViviente(n: NegocioAJuzgar, ahora: Date): boolean {
  if (CERRADAS.includes(n.etapa)) return false;
  if (n.cierreEsperado === null) return false;
  return n.cierreEsperado.getTime() < ahora.getTime();
}

/** ¿Se trabaja y no se mueve? */
function esBananeo(n: NegocioAJuzgar, umbral: Record<TipoEmbudo, number>): boolean {
  if (CERRADAS.includes(n.etapa)) return false;
  return n.gestionesHechasEnLaEtapa >= umbral[n.embudo];
}

/**
 * Las señales de ese negocio. Puede llevar las dos.
 *
 * Y llevar las dos NO es una inconsistencia que haya que resolver
 * eligiendo una: un negocio al que se le pasó la fecha Y al que le
 * hemos hecho cuatro gestiones sin moverlo es exactamente el peor
 * caso, y esconder una de las dos marcas lo haría parecer menos
 * grave de lo que es.
 */
export function senalesDe(
  n: NegocioAJuzgar,
  ahora: Date,
  /// El umbral de Configuración cuando lo hay; si no, el de aquí.
  umbral: Record<TipoEmbudo, number> = GESTIONES_PARA_BANANEO,
): Senal[] {
  const senales: Senal[] = [];
  if (esMuertoViviente(n, ahora)) senales.push('MUERTO_VIVIENTE');
  if (esBananeo(n, umbral)) senales.push('BANANEO');
  return senales;
}

/// Cómo se lee cada señal. Aquí y no en el panel porque el panel
/// no es el único que las va a nombrar: en cuanto haya un informe
/// de «qué se nos está pudriendo», lo dirá con estas palabras.
const ROTULOS: Record<Senal, string> = {
  MUERTO_VIVIENTE: 'Muerto viviente',
  BANANEO: 'Bananeo',
};

/// Y por qué está marcada. El rótulo solo no basta: «bananeo» en
/// una tarjeta, sin decir por qué, es una etiqueta de la que nadie
/// se fía y que todo el mundo acaba ignorando.
const PORQUES: Record<Senal, string> = {
  MUERTO_VIVIENTE:
    'La fecha de cierre que tiene puesta ya pasó y sigue abierta. Cámbiele la fecha o ciérrela.',
  BANANEO:
    'Ya se le hicieron varias gestiones y no se ha movido de etapa. O no es quien decide, o no hay presupuesto.',
};

export function rotuloDeSenal(s: Senal): string {
  return ROTULOS[s];
}

export function porqueDeSenal(s: Senal): string {
  return PORQUES[s];
}
