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
];

/**
 * EL LÍDER DE SISTEMAS SALIÓ DE LA LISTA (cliente, 2 oct 2026:
 * «solo debe salir Gestor de Inscripciones y Líder de Inscripciones»).
 *
 * Tenía `inscripciones · ESCRIBIR` en la matriz y por eso estaba, pero
 * una cosa es PODER escribir en las fichas y otra que la gente le
 * reparta leads: ese rol administra el sistema, no atiende la
 * captación. En un desplegable de «¿a quién se la paso?», cada nombre
 * que no va a trabajar ese lead es una forma de perderlo.
 *
 * NO ROMPE LO YA ASIGNADO. Esta lista decide a quién se OFRECE, no
 * quién puede tener: `exigirAsesorDelConvenio` sigue aceptando a
 * cualquiera con concesión en el convenio, así que las fichas que ya
 * lleva un líder de sistemas se quedan donde están y se le pueden
 * quitar. Lo que no se puede es darle más desde el desplegable.
 *
 * Y VA EN ESTA LISTA Y NO EN CADA PANTALLA, que es el motivo de que
 * este fichero exista: dos listas de quién puede ser asesor acaban
 * discrepando.
 */

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

/**
 * En qué convenios esta cuenta puede QUEDARSE con una ficha.
 *
 * Gemela de `conveniosQueReparten`, y hace falta aparte porque son
 * dos preguntas distintas: un gestor LLEVA fichas y no las REPARTE,
 * y un líder académico las reparte y no le toca ninguna. Desde el
 * 2 oct 2026 la usa `coger-un-lead.ts`, para que quien coge uno
 * libre sea alguien que de verdad lo va a trabajar.
 */
export const conveniosQueLlevanFichas = (
  roles: Record<string, RolConvenio[]>,
) =>
  Object.entries(roles)
    .filter(([, suyos]) => suyos.some((r) => PUEDEN_LLEVAR_FICHAS.includes(r)))
    .map(([convenioId]) => convenioId);
