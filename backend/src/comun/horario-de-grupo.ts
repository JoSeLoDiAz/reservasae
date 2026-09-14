/** Los dias y las horas de un grupo, en una sola frase. */

/// La frase NO se guarda, se arma. `Grupo.horario` era texto
/// libre y ahi dentro vivian los dias Y las horas: «Lunes a
/// viernes, 2:00 p. m. a 5:00 p. m.». Con las horas en sus
/// propias filas, dejar ademas la frase guardada serian dos
/// verdades sobre el mismo hecho.
///
/// Las horas ya no son del grupo sino de sus SESIONES (13 sep
/// 2026): un bootcamp tiene dos y una hibrida tiene una
/// presencial mas la hora de conexion. Esta frase es la de las
/// cuatro pantallas que solo la PINTAN --el academico, la
/// asignacion por lote y el cronograma--, y ahi lo que se
/// necesita es el tramo, no el detalle.

export type SesionParaLaFrase = {
  horaInicio: string;
  horaFin: string;
};

export type HorarioDeGrupo = {
  dias: string | null;
  sesiones: SesionParaLaFrase[];
};

/** "lunes a sabado, de 18:00 a 20:00", o lo que haya. */
export function fraseDeHorario(g: HorarioDeGrupo): string | null {
  const dias = g.dias?.trim() || null;
  const horas = tramos(g.sesiones);
  if (dias && horas) return `${dias}, ${horas}`;
  return dias ?? horas;
}

/// Con varias sesiones se enumeran: dos tramos distintos no se
/// pueden resumir en uno sin mentir sobre alguno.
function tramos(sesiones: SesionParaLaFrase[]): string | null {
  const buenas = sesiones.filter((s) => s.horaInicio && s.horaFin);
  if (!buenas.length) return null;
  const partes = buenas.map((s) => `de ${s.horaInicio} a ${s.horaFin}`);
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
}
