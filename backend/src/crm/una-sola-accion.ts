/** Una sola accion de formacion por persona. El foro no cuenta. */

/**
 * Decision del cliente, confirmada por Catalina el 14 sep 2026:
 * «solamente se puede inscribir a una... si es de las virtuales
 * se puede inscribir al foro, que puede escoger las dos, pero
 * para las demas solamente que escoja una».
 *
 * El porque es de gestion, no de sistema: con la gente repartida
 * en varias acciones las estadisticas quedan «un revuelto» --sus
 * palabras-- y no se sabe cuanta gente distinta se esta formando
 * en cada cosa.
 *
 * EL FORO ES LA EXCEPCION y se sostiene sola: son DOS HORAS
 * contra las cuarenta de un curso. No compite con nada, asi que
 * bloquearlo le quitaria asistentes sin ganar ninguna
 * estadistica.
 *
 * LA PANTALLA YA LO PROMETIA Y NADIE LO CUMPLIA. El formulario
 * publico dice «solo puede preinscribirse en una» desde siempre,
 * y la unica comprobacion que habia era por persona Y ACCION: al
 * elegir otra accion se creaba una participacion nueva sin
 * avisar. Un control en pie y vacio de efecto.
 */

/// `evento` es texto libre --CURSO, TALLER, TALLER-BOOTCAMP,
/// FORO--, asi que se compara por igualdad y no por «contiene»:
/// un futuro «FORO-TALLER» de cuarenta horas no puede colarse
/// por la excepcion de los de dos.
export function esForo(evento: string | null | undefined): boolean {
  return (evento ?? '').trim().toUpperCase() === 'FORO';
}

export type YaInscritaEn = {
  accionFormacionId: string;
  codigo: string;
  nombre: string;
  evento: string | null;
};

/**
 * Por que NO puede inscribirse, o null si puede.
 *
 * Volver a la MISMA accion no es motivo: eso no es una segunda
 * inscripcion, es la misma, y quien llama ya la resuelve
 * devolviendole su enlace en vez de decirle que no.
 */
export function motivoParaNoInscribir(
  pedida: { id: string; evento: string | null },
  yaTiene: YaInscritaEn[],
): string | null {
  if (esForo(pedida.evento)) return null;

  const otra = yaTiene.find(
    (y) => y.accionFormacionId !== pedida.id && !esForo(y.evento),
  );
  if (!otra) return null;

  return `Ya está inscrita en «${otra.nombre}» (${otra.codigo}), y solo se puede tomar una acción de formación. Si prefiere otra, escríbanos y se la cambiamos.`;
}
