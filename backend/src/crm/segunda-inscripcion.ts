/** Cuando la misma persona puede estar en DOS formaciones. */

/**
 * La regla, de Josse (24 sep 2026):
 *
 *   «las personas solo se pueden repetir para el conteo de
 *    inscritos y se cuenta como 2 inscripciones de la misma
 *    persona, no es que esté duplicada sino que participa en las
 *    dos formaciones. Y solo se puede repetir si la persona está
 *    en AF1 o AF2 y participa también en AF7. Los otros no se
 *    pueden repetir».
 *
 * HASTA HOY NO HABÍA NINGÚN CANDADO. El `upsert` de `Persona` por
 * documento reúsa a la persona y la segunda ficha se creaba sin
 * que nada se quejara: se podía estar en AF1, AF3 y AF5 a la vez.
 * Esto no relaja nada, lo cierra.
 *
 * VA POR ID Y NO POR CÓDIGO, y esa es la trampa de este cambio:
 * «AF7» existe en los DOS gremios y no es la misma cosa --en
 * ADECOPRIA es el foro «Salto adelante», híbrido, y en BRITCHAM es
 * «Expansión global», presencial--. Una regla escrita sobre el
 * código dejaría repetir en BRITCHAM, que nadie pidió. Por eso la
 * pareja vive en el DATO, en `AccionFormacion.combinaConAccionId`,
 * y añadir otra es un UPDATE, no un despliegue.
 *
 * ES SIMÉTRICA (decisión de Josse): da igual el orden. Quien entró
 * por el foro puede sumar su curso después, y al revés. Tener que
 * explicarle a un asesor por qué le deja en un orden y no en el
 * otro sería una regla que se recuerda mal.
 *
 * DE MOMENTO SOLO EN EL PANEL, también por decisión suya. La
 * puerta pública sigue como estaba: alguien que ya tiene ficha se
 * puede preinscribir a otra acción. Cerrarla allí es un cambio
 * para el ciudadano y se decide aparte.
 */

/// Lo que hace falta saber de una acción para juzgar la pareja.
export type AccionParaCombinar = {
  id: string;
  codigo: string;
  nombre: string;
  combinaConAccionId: string | null;
};

/**
 * Si estas dos se pueden cursar a la vez.
 *
 * Basta con que UNA de las dos nombre a la otra: es lo que la
 * vuelve simétrica sin tener que escribir la pareja dos veces en
 * la base.
 */
export function seCursanJuntas(
  a: AccionParaCombinar,
  b: AccionParaCombinar,
): boolean {
  if (a.id === b.id) return false;
  return a.combinaConAccionId === b.id || b.combinaConAccionId === a.id;
}

/**
 * Por qué NO se puede crear esta segunda ficha, o null si sí.
 *
 * Devuelve la frase entera porque la lee un asesor con la persona
 * al teléfono: decirle «no se puede» sin decirle con cuál sí es
 * mandarlo a probar una por una.
 */
export function motivoDeSegundaImposible(
  nueva: AccionParaCombinar,
  yaTiene: AccionParaCombinar[],
): string | null {
  if (yaTiene.length === 0) return null;

  /// Ya está en ESTA misma. No es un problema de parejas.
  const repetida = yaTiene.find((a) => a.id === nueva.id);
  if (repetida) {
    return `Esta persona ya está inscrita en «${repetida.codigo} · ${repetida.nombre}».`;
  }

  /// DOS ES EL TECHO. La regla habla de una pareja, no de una
  /// lista: con tres fichas ya no se sabe cuál de las parejas
  /// vale, y el conteo de inscritos deja de poder explicarse.
  if (yaTiene.length >= 2) {
    return (
      'Esta persona ya está en dos formaciones, que es el máximo. ' +
      `Hoy está en ${yaTiene.map((a) => a.codigo).join(' y ')}.`
    );
  }

  const suya = yaTiene[0];
  if (seCursanJuntas(nueva, suya)) return null;

  /// Con cuál SÍ podría, para que el asesor no tenga que adivinar.
  const conCual = suya.combinaConAccionId;
  const sugerencia = conCual
    ? ' Con la que sí puede sumar es la que se cursa junto a esa.'
    : '';

  return (
    `Esta persona ya está en «${suya.codigo} · ${suya.nombre}», y esa no se ` +
    `cursa a la vez que «${nueva.codigo} · ${nueva.nombre}».${sugerencia}`
  );
}
