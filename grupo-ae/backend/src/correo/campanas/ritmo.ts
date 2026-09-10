/** Cuándo se puede mandar, y cuánto. */

/// Esto es lo que impide que Google cierre la cuenta.
///
/// No hay presupuesto para un proveedor de campañas, así que
/// las campañas salen por la MISMA cuenta de Gmail con la que
/// trabaja la oficina. Eso se puede hacer, pero solo si el
/// envío se parece a lo que Gmail espera de una persona:
/// mensajes de a uno, espaciados, en horario de oficina y sin
/// pasarse del cupo.
///
/// Un golpe de 200 correos en un minuto es exactamente lo que
/// Gmail marca como envío masivo. Y la cuenta que suspende no
/// es «la del sistema»: es proyectosena@grupo-ae.com.co, la
/// que usa la gente todos los días.
///
/// Por eso los topes de aquí son CONSERVADORES a propósito.
/// Google permite ~2.000 destinatarios al día; se usa una
/// fracción. Perder un día de campaña se arregla mañana;
/// perder la cuenta, no.

/// Colombia va cinco horas detrás de UTC, todo el año.
const HORAS_DE_COLOMBIA = -5;

/// La franja en que se le escribe a alguien. Ni antes de las
/// 8 ni después de las 6: un correo de la empresa a las once
/// de la noche es una molestia, y molestar es lo que hace que
/// la gente marque «spam» -- que es justo lo que hunde la
/// reputación de la cuenta.
export const HORA_DESDE = 8;
export const HORA_HASTA = 18;

/// De lunes a viernes. El sábado y el domingo la gente no
/// está esperando nada nuestro.
const DIAS_HABILES = [1, 2, 3, 4, 5];

/**
 * Cuántos al día, en total.
 *
 * Google admite unos 2.000 y aquí se usan 300: hay margen de
 * sobra para el correo normal de la oficina, que sale por la
 * misma cuenta y es el que no se puede sacrificar.
 */
export const TOPE_DIARIO = 300;

/**
 * Y cuántos por hora, como freno de emergencia.
 *
 * NO es para estirar la campaña: una de 200 tiene que salir
 * en minutos, no en días. Esto está por si un fallo pone el
 * bucle a girar sin control -- entonces se para solo antes de
 * gastarse el cupo del día.
 */
export const TOPE_POR_HORA = 250;

/**
 * Cuántos le pueden llegar a UNA persona en un día.
 *
 * Dos, como se pidió. Es el número que separa «me avisaron»
 * de «me están escribiendo todo el día», y quien recibe lo
 * segundo marca spam.
 */
export const TOPE_POR_PERSONA_AL_DIA = 2;

/**
 * Cuánto se espera entre uno y otro: uno a tres segundos.
 *
 * Empecé poniendo 20 a 45 segundos y estaba mal: eso convierte
 * una campaña de 200 en dos días de espera, y ese no es el
 * precio de no llamar la atención.
 *
 * Lo que hace que Google cierre una cuenta no es el ritmo: es
 * pasarse del cupo diario, que le marquen spam y que reboten
 * muchos correos. Un mail-merge normal manda a este ritmo todo
 * el tiempo. Doscientos salen en unos siete minutos.
 *
 * El azar se queda: una cadencia exacta -- uno cada segundo
 * clavado -- sí es de las cosas que delatan a un robot.
 */
export const PAUSA_MINIMA_MS = 1_000;
export const PAUSA_MAXIMA_MS = 3_000;

export type Reloj = { ahora: Date };

/** La hora de Bogotá, sin depender de la del servidor. */
export function enColombia(instante: Date): { dia: number; hora: number } {
  const corrido = new Date(
    instante.getTime() + HORAS_DE_COLOMBIA * 60 * 60 * 1000,
  );
  return { dia: corrido.getUTCDay(), hora: corrido.getUTCHours() };
}

export type Veredicto =
  { puede: true } | { puede: false; motivo: string; reintentar: boolean };

/**
 * ¿Se puede mandar ahora?
 *
 * `reintentar` distingue «todavía no» de «hoy no»: lo primero
 * lo vuelve a intentar el trabajador en un rato, lo segundo
 * espera a mañana. Sin esa diferencia, la cola giraría toda la
 * noche preguntando.
 */
export function sePuedeAhora(
  instante: Date,
  enviadosHoy: number,
  enviadosEstaHora: number,
): Veredicto {
  const { dia, hora } = enColombia(instante);

  if (!DIAS_HABILES.includes(dia)) {
    return {
      puede: false,
      motivo: 'Es fin de semana en Colombia. Sale el lunes.',
      reintentar: true,
    };
  }

  if (hora < HORA_DESDE || hora >= HORA_HASTA) {
    return {
      puede: false,
      motivo: `Fuera del horario de envío (${HORA_DESDE}:00 a ${HORA_HASTA}:00 en Colombia).`,
      reintentar: true,
    };
  }

  if (enviadosHoy >= TOPE_DIARIO) {
    return {
      puede: false,
      motivo:
        `Ya salieron ${enviadosHoy} hoy, que es el tope diario. ` +
        'El resto sale mañana.',
      reintentar: true,
    };
  }

  if (enviadosEstaHora >= TOPE_POR_HORA) {
    return {
      puede: false,
      motivo: `Ya salieron ${enviadosEstaHora} en esta hora. Se espera a la siguiente.`,
      reintentar: true,
    };
  }

  return { puede: true };
}

/// Cuánto esperar antes del siguiente. Con algo de azar: una
/// cadencia exacta -- uno cada 30 segundos clavados -- es de
/// las cosas que delatan a un robot.
export function pausa(azar = Math.random()): number {
  return Math.round(
    PAUSA_MINIMA_MS + azar * (PAUSA_MAXIMA_MS - PAUSA_MINIMA_MS),
  );
}

/// Cuándo empieza el día de Colombia, en UTC. Sirve para
/// contar «lo de hoy» sin equivocarse de día por la tarde.
export function inicioDelDiaColombiano(instante: Date): Date {
  const corrido = new Date(
    instante.getTime() + HORAS_DE_COLOMBIA * 60 * 60 * 1000,
  );
  const medianoche = Date.UTC(
    corrido.getUTCFullYear(),
    corrido.getUTCMonth(),
    corrido.getUTCDate(),
  );
  return new Date(medianoche - HORAS_DE_COLOMBIA * 60 * 60 * 1000);
}
