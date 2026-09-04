/** Cómo se llama cada rol cuando lo lee una persona. */

/// Estaban solo en el frontend, para el desplegable de
/// usuarios. El correo de bienvenida también los necesita, y
/// el backend no puede leer de allá. Lo que sujeta las dos
/// copias es `el-espejo-no-se-separa.spec.ts`.

import { RolConvenio } from '../../generated/prisma';

export const ROL_EN_PALABRAS: Record<RolConvenio, string> = {
  LIDER_SISTEMAS: 'Líder de sistemas de información',
  LIDER_INSCRIPCION: 'Líder de inscripciones',
  GESTOR_INSCRIPCION: 'Gestor(a) de inscripciones',
  LIDER_ACADEMICO: 'Líder de seguimiento académico',
  GESTOR_ACADEMICO: 'Gestor(a) de seguimiento académico',
  COORDINACION_ADMINISTRATIVA: 'Coordinadora Administrativa',
  CONSULTA: 'Consulta',
};

/** Sus roles en palabras, sin repetir, en una frase. */
export function papelDe(roles: RolConvenio[]): string {
  const suyos = [...new Set(roles.map((r) => ROL_EN_PALABRAS[r]))];
  if (suyos.length === 0) return 'Sin rol asignado';
  if (suyos.length === 1) return suyos[0];
  return `${suyos.slice(0, -1).join(', ')} y ${suyos[suyos.length - 1]}`;
}
