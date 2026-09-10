/** Cuándo va a salir de verdad, dicho en palabras. */

/// La pregunta que la pantalla no contestaba.
///
/// Alguien lanzaba una campaña a las siete de la noche, no
/// veía salir nada, y creía que estaba rota. Le llamaba a uno
/// a preguntar. La respuesta —«sale mañana a las ocho»— la
/// sabía el servidor y no la decía nadie.
///
/// Vive en el backend a propósito: las reglas de horario están
/// en `ritmo.ts` y si la pantalla las copiara, el día que
/// alguien cambie el horario habría dos verdades y una de las
/// dos estaría mintiendo.

import {
  enColombia,
  HORA_DESDE,
  HORA_HASTA,
  PAUSA_MAXIMA_MS,
  TOPE_DIARIO,
} from './ritmo';

const DIAS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

export type CuandoSale = {
  /// ¿Saldría algo AHORA MISMO?
  ahora: boolean;
  /// En palabras, para pintarlo tal cual.
  cuando: string;
  /// Cuánto tarda una tanda de este tamaño, en palabras.
  cuantoTarda: (cuantos: number) => string;
  horario: { desde: number; hasta: number; topeDiario: number };
};

/// Cuándo arranca, si no es ahora.
function proximaVentana(dia: number, hora: number): string {
  /// Antes de las ocho de un día hábil: hoy mismo.
  if (dia >= 1 && dia <= 5 && hora < HORA_DESDE) {
    return `Empieza hoy a las ${HORA_DESDE}:00 de la mañana.`;
  }

  /// Después de las seis, o fin de semana: el próximo hábil.
  const siguiente = dia === 5 || dia === 6 ? 1 : dia === 0 ? 1 : dia + 1;
  const nombre = dia === 0 || dia === 6 ? 'el lunes' : `el ${DIAS[siguiente]}`;
  return `Empieza ${nombre} a las ${HORA_DESDE}:00 de la mañana.`;
}

export function cuandoSale(instante = new Date()): CuandoSale {
  const { dia, hora } = enColombia(instante);
  const habil = dia >= 1 && dia <= 5;
  const enHorario = habil && hora >= HORA_DESDE && hora < HORA_HASTA;

  return {
    ahora: enHorario,
    cuando: enHorario
      ? 'Empieza a salir ahora mismo, de a uno.'
      : proximaVentana(dia, hora),
    cuantoTarda: (cuantos: number) => enPalabras(cuantos),
    horario: { desde: HORA_DESDE, hasta: HORA_HASTA, topeDiario: TOPE_DIARIO },
  };
}

/**
 * Cuánto tarda una tanda, por lo alto.
 *
 * Por lo ALTO y no en promedio: si uno dice «dos minutos» y
 * tarda cuatro, la siguiente vez nadie le cree. Mejor que
 * sobre.
 */
export function enPalabras(cuantos: number): string {
  if (cuantos <= 0) return 'No hay a quién mandarle.';

  /// Lo que no cabe hoy espera a mañana: el tope diario se
  /// comparte con el correo normal de la oficina.
  const dias = Math.ceil(cuantos / TOPE_DIARIO);
  const deHoy = Math.min(cuantos, TOPE_DIARIO);
  const minutos = Math.ceil((deHoy * PAUSA_MAXIMA_MS) / 60_000);

  const tanda =
    minutos <= 1
      ? 'menos de un minuto'
      : minutos < 60
        ? `unos ${minutos} minutos`
        : `algo más de ${Math.round(minutos / 60)} hora${minutos >= 120 ? 's' : ''}`;

  if (dias <= 1) return `Los ${cuantos} salen en ${tanda}.`;

  return (
    `Hoy salen ${TOPE_DIARIO} en ${tanda}; el resto, los días siguientes. ` +
    `En total, unos ${dias} días hábiles.`
  );
}
