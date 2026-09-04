/** Qué roles pueden quedarse con una ficha o con un lead. */

/**
 * Los tres que tienen `inscripciones · ESCRIBIR` en la matriz de
 * `admin/permisos.ts`. NO es una lista aparte: es esa misma
 * decisión leída al revés —del área al rol en vez del rol al
 * área— porque un desplegable necesita la lista y la matriz
 * responde de uno en uno.
 *
 * Estaba escrita dos veces, en `crm.service` y en la mesa de
 * entrada, y la siembra de interesados iba a ser la tercera. Dos
 * listas de quién puede ser asesor acaban discrepando, y el
 * síntoma es un desplegable que ofrece a alguien que después
 * recibe 403 — o peor, una ficha asignada a quien no la puede
 * ver, que la brecha de nombres cuenta como atendida.
 *
 * Los ACADÉMICOS no están, y es deliberado: llevan el aula, no la
 * captación. Y `CONSULTA` tampoco, obviamente.
 */

import { RolConvenio } from '../../generated/prisma';

export const PUEDEN_LLEVAR_FICHAS: RolConvenio[] = [
  RolConvenio.GESTOR_INSCRIPCION,
  RolConvenio.LIDER_INSCRIPCION,
  RolConvenio.LIDER_SISTEMAS,
];

/**
 * El `where` de «quién puede llevar fichas aquí».
 *
 * Va aquí y no repetido en cada consulta porque son dos cosas y
 * las dos importan: el rol Y que la cuenta siga **activa**.
 * Desactivar a alguien corta su sesión al instante, así que
 * ofrecerlo en el desplegable sería ofrecer a quien ya no entra.
 *
 * Admite un convenio o un ámbito entero: la ficha pregunta por
 * uno y la mesa de entrada por todos los que el asesor alcanza.
 */
export function llevanFichasEn(convenio: string | string[]) {
  return {
    activo: true,
    convenios: {
      some: {
        convenioId: Array.isArray(convenio) ? { in: convenio } : convenio,
        rol: { in: PUEDEN_LLEVAR_FICHAS },
      },
    },
  };
}
