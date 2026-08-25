/** Qué puede hacer cada rol, escrito una sola vez. */

import type { RolConvenio } from '../../generated/prisma';

/// Las areas del panel, en el orden del proceso.
export type Area =
  | 'reserva'
  | 'inscripciones'
  | 'inscritos'
  | 'reportes'
  | 'academico'
  | 'configuracion';

export type Nivel = 'NADA' | 'VER' | 'ESCRIBIR';

const N: Nivel = 'NADA';
const V: Nivel = 'VER';
const E: Nivel = 'ESCRIBIR';

/**
 * Cuatro reglas y de ahi sale la tabla: cada quien escribe
 * en su area, todos ven la pre-reserva porque es el
 * contexto comun, el lider hace lo del gestor mas sacar
 * los archivos, y los datos personales solo los ve quien
 * los necesita. "reportes" va aparte de "inscritos"
 * porque el archivo del SEP lleva 800 cedulas.
 */
export const PERMISOS: Record<RolConvenio, Record<Area, Nivel>> = {
  GESTOR_INSCRIPCION: {
    reserva: V,
    inscripciones: E,
    inscritos: V,
    // ve el alistamiento, no descarga el archivo
    reportes: V,
    academico: V,
    configuracion: N,
  },
  LIDER_INSCRIPCION: {
    // corrige y aprueba la ficha de una empresa: aprobarla es
    // responder por ella, y eso lo firma un lider
    reserva: E,
    inscripciones: E,
    inscritos: V,
    reportes: E,
    academico: V,
    configuracion: N,
  },
  GESTOR_ACADEMICO: {
    reserva: V,
    inscripciones: V,
    inscritos: V,
    reportes: N,
    academico: E,
    configuracion: N,
  },
  LIDER_ACADEMICO: {
    reserva: V,
    inscripciones: V,
    inscritos: V,
    reportes: N,
    academico: E,
    configuracion: N,
  },
  LIDER_SISTEMAS: {
    reserva: E,
    inscripciones: E,
    inscritos: V,
    reportes: E,
    academico: E,
    configuracion: E,
  },
  CONSULTA: {
    reserva: V,
    inscripciones: V,
    inscritos: V,
    reportes: N,
    academico: V,
    configuracion: N,
  },
};

const ESCALA: Nivel[] = ['NADA', 'VER', 'ESCRIBIR'];

/** Si el nivel que tiene cubre el que se le pide. */
export const alcanza = (tiene: Nivel, pide: Nivel) =>
  ESCALA.indexOf(tiene) >= ESCALA.indexOf(pide);

/// Varias filas en el mismo convenio suman: manda la mayor.
export function nivelDe(roles: RolConvenio[], area: Area): Nivel {
  let mayor: Nivel = 'NADA';
  for (const rol of roles) {
    const nivel = PERMISOS[rol]?.[area] ?? 'NADA';
    if (alcanza(nivel, mayor)) mayor = nivel;
  }
  return mayor;
}

/**
 * Certificar o dar por no aprobado es de lider: es lo que
 * el SENA paga, y no lo firma quien digita.
 */
export const CIERRAN_FORMACION: RolConvenio[] = ['LIDER_ACADEMICO', 'LIDER_SISTEMAS'];

/// Se responde por convenio, no en general: se puede
/// liderar academico en uno y solo digitar en el otro.
export const conveniosQueCierran = (roles: Record<string, RolConvenio[]>) =>
  Object.entries(roles)
    .filter(([, suyos]) => suyos.some((r) => CIERRAN_FORMACION.includes(r)))
    .map(([convenioId]) => convenioId);

export const AREAS: Area[] = [
  'reserva',
  'inscripciones',
  'inscritos',
  'reportes',
  'academico',
  'configuracion',
];

/**
 * El mayor nivel por área entre todos sus convenios, para
 * que el panel dibuje el menú. Es comodidad: quien manda
 * es el guard, y el menú corto no es la cerradura.
 */
export function resumenDePermisos(
  roles: Record<string, RolConvenio[]>,
): Record<Area, Nivel> {
  const salida = {} as Record<Area, Nivel>;
  for (const area of AREAS) {
    let mayor: Nivel = 'NADA';
    for (const suyos of Object.values(roles)) {
      const nivel = nivelDe(suyos, area);
      if (alcanza(nivel, mayor)) mayor = nivel;
    }
    salida[area] = mayor;
  }
  return salida;
}
