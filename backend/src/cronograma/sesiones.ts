/** Las reglas de las sesiones de un grupo. */

/// Viven aparte del servicio para poder probarlas, y el
/// servicio las LLAMA -- no las reimplementa. Un spec que copia
/// la linea que dice proteger no protege nada, y en este
/// repositorio ya se fallo asi.

export type TipoDeSesion = 'PRESENCIAL' | 'SINCRONICA' | 'PAT';

export type SesionPedida = {
  tipo: TipoDeSesion;
  /// "aaaa-mm-dd" o nada.
  dia?: string | null;
  horaInicio: string;
  horaFin: string;
  /// Donde se hace. Una de las que cubre el grupo.
  ubicacionId?: string | null;
};

const HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/// Solo el dia, sin la hora: lo tecleado es una fecha de
/// calendario y no un instante. Es la distincion que este
/// repositorio ya tuvo que arreglar dos veces.
const soloDia = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Que le falta o le sobra a una sesion. Vacio = esta bien.
 *
 * El grupo entra porque el dia de una sesion no puede salirse
 * de sus fechas, y se juzga contra las que QUEDARAN al guardar,
 * no contra las que habia: mover el rango tambien saca la
 * sesion.
 */
export function loQueEstaMal(
  s: SesionPedida,
  grupo: { inicio: Date | null; fin: Date | null; ubicaciones?: string[] },
): string[] {
  const mal: string[] = [];

  if (!HORA.test(s.horaInicio)) mal.push('La hora de inicio va como HH:MM.');
  if (!HORA.test(s.horaFin)) mal.push('La hora de fin va como HH:MM.');
  if (HORA.test(s.horaInicio) && HORA.test(s.horaFin) && s.horaFin <= s.horaInicio) {
    mal.push('La hora de fin tiene que ser posterior a la de inicio.');
  }

  /// La PAT es la hora de conexion de TODOS los dias del grupo
  /// salvo los que tienen dia propio. Ponerle uno la convierte
  /// en otra cosa y deja sin cubrir el resto.
  if (s.tipo === 'PAT' && s.dia) {
    mal.push('La sesión PAT no lleva día: vale para todos los del grupo.');
  }

  /// La presencial tampoco, y es lo que pidio el cliente: el
  /// grupo ya dice cuando es. Repetirlo es decirlo dos veces.
  if (s.tipo === 'PRESENCIAL' && s.dia && !grupo.inicio) {
    mal.push('Ponga primero las fechas del grupo.');
  }

  if (s.dia) {
    if (!grupo.inicio) {
      mal.push('Ponga primero las fechas del grupo: la sesión va dentro de ellas.');
    } else {
      const d = s.dia.slice(0, 10);
      if (d < soloDia(grupo.inicio) || (grupo.fin && d > soloDia(grupo.fin))) {
        mal.push('El día de la sesión tiene que caer dentro de las fechas del grupo.');
      }
    }
  }

  /// Un foro hibrido se dicta en UNA sede, aunque la accion
  /// alcance seis departamentos. Ofrecer cualquiera dejaria
  /// poner la presencial donde ese grupo no llega.
  if (s.ubicacionId && grupo.ubicaciones && !grupo.ubicaciones.includes(s.ubicacionId)) {
    mal.push('Ese lugar no es de los que cubre el grupo.');
  }

  return mal;
}

/// Como se lee una sesion. Lo usan la tarjeta y el PDF.
export function comoSeLee(s: {
  tipo: TipoDeSesion;
  horaInicio: string;
  horaFin: string;
}): string {
  const nombre =
    s.tipo === 'SINCRONICA'
      ? 'Sesión sincrónica'
      : s.tipo === 'PAT'
        ? 'Conexión PAT'
        : 'Sesión presencial';
  return `${nombre}, de ${s.horaInicio} a ${s.horaFin}`;
}
