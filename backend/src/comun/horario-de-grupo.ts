/** Los dias y las horas de un grupo, en una sola frase. */

/// La frase NO se guarda, se arma. Hasta el 13 sep 2026
/// `Grupo.horario` era texto libre y ahi dentro vivian los dias
/// Y las horas: «Lunes a viernes, 2:00 p. m. a 5:00 p. m.». Con
/// las horas en sus propias columnas, dejar ademas la frase
/// guardada serian dos verdades sobre el mismo hecho, que es el
/// defecto que este repositorio lleva cinco rondas documentando.
///
/// Asi que la columna se quedo con los DIAS --lo unico que de
/// verdad es libre-- y la frase se compone aqui, una sola vez,
/// para las cuatro pantallas que hoy la pintan: el cronograma
/// (tarjeta y tabla), el seguimiento academico y la asignacion
/// por lote. Ninguna de ellas cambia: reciben la misma clave
/// `horario` con el mismo texto de siempre.

export type HorarioDeGrupo = {
  dias: string | null;
  horaInicio: string | null;
  horaFin: string | null;
};

/** "lunes a sabado, de 18:00 a 20:00", o lo que haya. */
export function fraseDeHorario(g: HorarioDeGrupo): string | null {
  const dias = g.dias?.trim() || null;
  const horas = tramo(g.horaInicio, g.horaFin);
  if (dias && horas) return `${dias}, ${horas}`;
  return dias ?? horas;
}

/// «desde las» sin fin es legitimo; al reves lo prohibe la base.
function tramo(inicio: string | null, fin: string | null): string | null {
  if (inicio && fin) return `de ${inicio} a ${fin}`;
  if (inicio) return `desde las ${inicio}`;
  return null;
}
