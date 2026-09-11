/** El único sitio donde el dinero deja de ser Decimal y pasa a número. */

import type { Prisma } from '../../generated/prisma';

/// Como sale de la base (Decimal) o como llega del panel (número).
export type Dinero = Prisma.Decimal | number;

/**
 * Un Decimal de la base, en pesos enteros.
 *
 * Se redondea AQUÍ, fila por fila, y no al final de la suma. La
 * alternativa —sumar los Decimal y redondear el total— es más
 * exacta y peor: el total dejaría de cuadrar con la suma de las
 * filas que el panel enseña, y esa diferencia de tres pesos es la
 * que hace que nadie vuelva a creerle al tablero.
 *
 * Al peso y no al centavo porque en Colombia no se cotiza en
 * centavos: la columna es `Decimal(14,2)` por prudencia, pero todo
 * lo que entra por el panel son enteros. Sumar enteros en `number`
 * es exacto hasta los nueve mil billones, así que de aquí en
 * adelante ya no hay decimales que arrastrar.
 */
export function aPesos(valor: Dinero): number {
  return Math.round(Number(valor));
}

/**
 * Un billón de pesos.
 *
 * No es un límite del negocio, es una red contra el teclado: la
 * meta se escribe a mano y sobra un cero con facilidad. Una meta
 * con un cero de más no da error en ningún sitio, solo deja al
 * equipo en 3 % todo el mes.
 */
export const TOPE_DE_META = 1_000_000_000_000;

/** Qué le pasa a ese valor. Null si no le pasa nada. */
export function revisarValor(valor: number): string | null {
  if (!Number.isFinite(valor)) {
    return 'El valor de la meta tiene que ser un número en pesos.';
  }
  if (!Number.isInteger(valor)) {
    return 'La meta va en pesos enteros, sin centavos.';
  }
  /**
   * Cero SÍ se admite, y es distinto de no tener meta.
   *
   * «Este mes no tiene que vender» —está de vacaciones, entra la
   * semana que viene— es una decisión que alguien toma, y borrar la
   * fila para decirla la confundiría con «todavía no le hemos
   * puesto meta». El avance las distingue: una es CUMPLIDA, la otra
   * es SIN_META.
   */
  if (valor < 0) {
    return 'La meta no puede ser negativa. Si este mes no tiene que vender, póngale cero.';
  }
  if (valor > TOPE_DE_META) {
    return `Esa meta pasa del billón de pesos. Revise si sobra un cero: llegó ${valor.toLocaleString('es-CO')}.`;
  }
  return null;
}
