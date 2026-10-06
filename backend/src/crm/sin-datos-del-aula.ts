/** De qué acciones no ha dicho nada el aula todavía. */

/**
 * «EL 13 DE OCTUBRE ARRANCAN LOS CUATRO PRIMEROS GRUPOS DE AF1: 116
 * PERSONAS PASAN SOLAS A EN FORMACIÓN Y, CON CERO ACTIVIDADES
 * CARGADAS, EL TABLERO LAS VA A DAR TODAS POR "NUNCA ENTRÓ AL AULA",
 * DE FORMA PERMANENTE» (Josse, 6 oct 2026).
 *
 * El tablero decía «no entró» y «no se sabe» con la misma palabra, y
 * la pintaba del rojo de PERDIDO. El día que un grupo empieza, sus
 * inscritos salían señalados por algo que no habían hecho.
 *
 * EL AULA ALIMENTA LAS DOS COSAS que esa pantalla mide: las
 * actividades y los accesos. Si de una acción no hay NI UNA actividad
 * publicada NI UN acceso de nadie, lo que falta son los datos, no la
 * gente.
 *
 * SE APAGA SOLO. En cuanto llegue lo primero ---una actividad
 * publicada o un solo acceso--- esta acción deja de estar en la lista
 * y vuelve a mandar la regla de siempre. Nadie tiene que acordarse de
 * quitarlo, que es lo que hace que un apaño así no se pudra.
 *
 * VIVE AQUÍ Y NO DENTRO DEL SERVICIO, y es una lección de hoy: Josse
 * tuvo que sacar el conteo de lo gestionado a su propio fichero
 * porque su prueba leía el TEXTO del servicio y no podía ver la única
 * decisión que importaba ---de hecho no vio el defecto---. Esta regla
 * es igual de pequeña y de fácil de equivocar.
 */

/** Una actividad publicada de una acción. */
export type ActividadPublicada = { accionFormacionId: string };

/** Lo que hace falta de cada ficha para decidir. */
export type FichaDelAula = {
  accionFormacionId: string | null;
  ultimoAcceso: Date | null;
};

/**
 * Las acciones de las que el aula no ha reportado nada.
 *
 * Solo mira las acciones que aparecen en `fichas`: una acción sin
 * gente no se juzga ---no hay a quién marcar--- y meterla en el
 * conjunto solo serviría para que alguien la contara.
 */
export function accionesSinDatosDelAula(
  actividades: ActividadPublicada[],
  fichas: FichaDelAula[],
): Set<string> {
  const conActividades = new Set(actividades.map((a) => a.accionFormacionId));
  const conAlgunAcceso = new Set(
    fichas
      .filter((f) => f.ultimoAcceso !== null)
      .map((f) => f.accionFormacionId ?? ''),
  );

  const sin = new Set<string>();
  for (const f of fichas) {
    const id = f.accionFormacionId;
    /// Sin acción no hay aula de la que hablar, y el '' que usaba la
    /// versión anterior metía a toda esa gente en el mismo saco.
    if (!id) continue;
    if (conActividades.has(id)) continue;
    if (conAlgunAcceso.has(id)) continue;
    sin.add(id);
  }
  return sin;
}
