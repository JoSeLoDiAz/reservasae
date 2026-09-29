/**
 * LAS METAS DE INSCRIPCIÓN POR ACCIÓN Y POR ASESOR.
 *
 * La cuenta que pidió Josse con su hoja de cálculo (28 sep 2026), y
 * que Catalina quiere ver: **¿cuántas inscripciones tiene que hacer
 * cada asesor de aquí al cierre para llegar a la meta?**
 *
 * Es la fórmula, escrita una vez y a prueba, ANTES de ponerla en una
 * pantalla o en la base: así se valida contra los números que él ya
 * tenía en el Excel (520, 71, 449, 3 asesores, 7 días → 64 y 21).
 *
 * DOS ENTRADAS LAS PONE EL ADMINISTRADOR A MANO --el número de
 * asesores y los días para el cierre-- porque no salen de ningún dato:
 * son una decisión de gestión que cambia día a día. Todo lo demás se
 * deriva de ellas y de lo que el sistema ya sabe.
 *
 * LOS VALORES SE GUARDAN EN COMA FLOTANTE y solo se redondean para
 * PINTARLOS. La meta diaria del Excel es 449/7 = 64,14 y se ve «64»;
 * la meta por asesor es 64,14/3 = 21,38 y se ve «21». Si se redondeara
 * la meta diaria antes de dividirla, la de por asesor saldría de 64 y
 * no de 64,14, y las dos dejarían de cuadrar con su hoja.
 */

/** Redondeo para pintar, no para calcular. `449/5 = 89,8` se ve «90». */
export function paraPintar(n: number): number {
  return Math.round(n);
}

export type MetasDeAccion = {
  /// B · la meta de inscritos del AF.
  metaInscritos: number;
  /// C · los que ya ocupan silla.
  inscritosConfirmados: number;
  /// D · lo que falta, nunca negativo: `max(0, B − C)`. Con la meta ya
  /// cubierta no se debe nada, y un número en rojo ahí sería una
  /// alarma falsa en la fila de quien hizo el trabajo.
  cuposDisponibles: number;
  /// E · a mano.
  numAsesores: number;
  /// F · a mano.
  diasParaCierre: number;
  /// G · `D / F`. En coma flotante. Cero si no quedan días o no falta
  /// nadie: no se divide entre cero ni se inventa una meta negativa.
  metaDiaria: number;
  /// H · `G / E`. En coma flotante. Cero sin asesores.
  metaPorAsesor: number;
};

/**
 * La cuenta de una acción. Todo derivado salvo E y F, que entran.
 */
export function metasDeAccion(e: {
  metaInscritos: number;
  inscritosConfirmados: number;
  numAsesores: number;
  diasParaCierre: number;
}): MetasDeAccion {
  const cuposDisponibles = Math.max(
    0,
    e.metaInscritos - e.inscritosConfirmados,
  );

  /// Sin días o sin cupos que cubrir, no hay meta diaria: es cero, no
  /// una división entre cero ni un negativo.
  const metaDiaria =
    e.diasParaCierre > 0 && cuposDisponibles > 0
      ? cuposDisponibles / e.diasParaCierre
      : 0;

  const metaPorAsesor = e.numAsesores > 0 ? metaDiaria / e.numAsesores : 0;

  return {
    metaInscritos: e.metaInscritos,
    inscritosConfirmados: e.inscritosConfirmados,
    cuposDisponibles,
    numAsesores: e.numAsesores,
    diasParaCierre: e.diasParaCierre,
    metaDiaria,
    metaPorAsesor,
  };
}

/**
 * EL ARRASTRE: lo que un asesor no cumplió ayer se le suma hoy.
 *
 * «Tenía que hacer 21, hizo 15, entonces mañana se le aumentan esos
 * 6, y así progresivamente» (Josse, 28 sep 2026). Es una capa de
 * responsabilidad POR ASESOR encima de la meta diaria: la meta diaria
 * del AF ya baja sola a medida que entran inscritos --se recalcula
 * sobre los cupos que quedan--; esto dice, además, cuánto debe HOY
 * cada persona por lo que dejó pendiente.
 *
 * Solo arrastra el FALTANTE, nunca un sobrante: quien pasó de su meta
 * un día no empieza el siguiente debiendo menos que su base. El
 * exceso ya cuenta --baja los cupos disponibles de todos-- pero no se
 * le abona a su cuenta personal, que sería premiar el adelanto
 * aflojando el día siguiente.
 *
 * La `metaBase` de cada día es la meta por asesor que regía ESE día.
 * Se pasa día a día y no se recalcula desde la de hoy, porque el
 * administrador pudo cambiar el número de asesores o los días por el
 * camino: la historia se cuenta con lo que valía entonces, no con lo
 * de ahora.
 */
export type DiaDelAsesor = {
  /// La meta por asesor que regía ese día (sin el arrastre).
  metaBase: number;
  /// Lo que ese asesor inscribió ese día.
  inscritos: number;
};

export type Arrastre = {
  /// Lo que debe HOY: la base de hoy más lo que arrastra de antes.
  metaHoy: number;
  /// Lo que viene debiendo de los días cerrados anteriores.
  deficitArrastrado: number;
};

/**
 * @param dias  los días de este asesor en orden, del más viejo al de
 *              HOY. El último es el día en curso (aún abierto).
 */
export function arrastreDelAsesor(dias: DiaDelAsesor[]): Arrastre {
  if (dias.length === 0) return { metaHoy: 0, deficitArrastrado: 0 };

  /// El déficit se acumula sobre los días YA CERRADOS: todos menos el
  /// último, que es el de hoy y todavía se está trabajando.
  let deficit = 0;
  for (let i = 0; i < dias.length - 1; i += 1) {
    const metaTotal = dias[i].metaBase + deficit;
    deficit = Math.max(0, metaTotal - dias[i].inscritos);
  }

  const hoy = dias[dias.length - 1];
  return { metaHoy: hoy.metaBase + deficit, deficitArrastrado: deficit };
}

/**
 * EL CUMPLIMIENTO, que es lo que Josse llama «conversión» en ESTA
 * tabla: lo que inscribió el asesor sobre lo que debía inscribir.
 *
 * OJO, no es la conversión de leads→inscritos que ya existe en
 * `proyeccion.ts` --esa mide qué parte de los leads acaba inscrita y
 * alimenta «leads que faltan»--. Aquí es CUMPLIMIENTO DE META: «este
 * asesor hizo su meta o no». Se devuelve como fracción (0,71), y la
 * pantalla la pinta como porcentaje.
 *
 * Sin meta no hay cumplimiento que medir --devuelve null--: un «0 %»
 * ahí se leería como que no hizo nada, cuando lo cierto es que no se
 * le había puesto meta.
 */
export function cumplimiento(inscritos: number, meta: number): number | null {
  if (meta <= 0) return null;
  return inscritos / meta;
}
