/** El día del calendario de Bogotá, en SQL y en JS. */

/**
 * Las fechas se guardan en UTC y Colombia va cinco horas
 * detrás, así que `date_trunc('day', x)` a secas parte los días
 * a las 19:00 de Bogotá: las cinco horas de tarde-noche —que es
 * cuando la gente diligencia— se cargan al día siguiente. Lo
 * mismo hace `toISOString().slice(0, 10)` en JS, y por eso a
 * partir de las 19:00 «hoy» sale con la fecha de mañana.
 *
 * El arreglo existía en `crm/control.ts` y estaba escrito allí:
 * los cuatro `date_trunc` de los tableros se quedaron fuera, que
 * es la lección de siempre —un arreglo aplicado en un sitio y no
 * a la clase—. Aquí está una sola vez, y `dia-bogota.spec.ts`
 * lo fija.
 *
 * Colombia no tiene horario de verano desde 1993, así que el
 * desplazamiento es −5 fijo; aun así se usa la zona por nombre
 * y no un número, para no tener que acordarse si algún día
 * cambia.
 */

import { Prisma } from '../../generated/prisma';

export const ZONA = 'America/Bogota';

/// Horas de diferencia con UTC. Colombia no tiene horario de
/// verano desde 1993, asi que es fijo.
export const HORAS_BOGOTA = -5;

/**
 * El día de Bogotá de una columna, ya como texto.
 *
 * Devuelve `YYYY-MM-DD` y no un timestamp a propósito: un
 * `date_trunc` en hora de Bogotá vuelve a Node como Date, y ahí
 * se lee otra vez en UTC — el mismo error dos veces, y la
 * segunda invisible. Con texto no hay viaje de vuelta.
 */
/**
 * HOY, en día de Bogotá, para intercalar en SQL.
 *
 * `CURRENT_DATE` es el día del servidor, y el contenedor de
 * Postgres corre en UTC: a partir de las 19:00 de Bogotá ya
 * devuelve mañana. Cuenta en «faltan N días para que arranque el
 * grupo» y en «lleva N días sin entrar al aula», que son cifras
 * que alguien mira de noche.
 */
export const HOY_BOGOTA = Prisma.sql`(NOW() AT TIME ZONE ${ZONA})::date`;

/**
 * Un INSTANTE, como fecha del calendario de Bogota, para restar.
 *
 * `diaBogota` devuelve texto y sirve para agrupar; esto devuelve
 * `date` y sirve para restar dias contra `HOY_BOGOTA`.
 *
 * Hace falta porque `columna::date` a secas da el dia de UTC, y
 * restarlo de `HOY_BOGOTA` mezcla dos calendarios: el arreglo
 * aplicado a un lado de la resta y no al otro. Paso con
 * `ultimoAcceso` justo despues de escribir esta distincion.
 *
 * OJO: solo para instantes. Una fecha de calendario ya guardada
 * a medianoche UTC --`Grupo.fechaInicio`-- se compara con
 * `columna::date` a secas, porque su `::date` YA es el dia que
 * alguien tecleo.
 */
export function fechaBogota(columna: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(${columna} AT TIME ZONE 'UTC' AT TIME ZONE ${ZONA})::date`;
}

export function diaBogota(columna: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`to_char(date_trunc('day', ${columna} AT TIME ZONE 'UTC' AT TIME ZONE ${ZONA}), 'YYYY-MM-DD')`;
}

/** El día de Bogotá de un instante, como `YYYY-MM-DD`. */
export function aDiaBogota(cuando: Date): string {
  /// `en-CA` da `YYYY-MM-DD`, que es el formato que se compara
  /// como texto. Armarlo a mano con las partes es más código y
  /// el mismo resultado.
  return cuando.toLocaleDateString('en-CA', { timeZone: ZONA });
}

/** El día de Bogotá de hace N días. */
export function diaBogotaHace(dias: number, desde: Date): string {
  return aDiaBogota(new Date(desde.getTime() - dias * 24 * 60 * 60 * 1000));
}

/**
 * El día de una FECHA DE CALENDARIO, que no es lo mismo.
 *
 * Hay dos clases de fecha en la base y se leen distinto:
 *
 *  - Un **instante**: cuándo pasó algo. `creadoEn`, `otorgadaEn`,
 *    `ultimoAcceso`. Se guarda en UTC y hay que leerlo en el día
 *    de Bogotá, que es `aDiaBogota`.
 *  - Una **fecha de calendario**: un día que alguien tecleó.
 *    `Grupo.fechaInicio`, `fechaNacimiento`. Llega como
 *    `2026-09-01` y `new Date(...)` la guarda a MEDIANOCHE UTC,
 *    así que el día correcto es el de UTC. Leerla en Bogotá la
 *    retrasa un día entero: el grupo que empieza el 1 de
 *    septiembre sale empezando el 31 de agosto.
 *
 * Son dos funciones y no una con bandera a propósito: la bandera
 * se olvida en la llamada, y este error ya se cometió una vez
 * aplicando `aDiaBogota` a las fechas de los grupos.
 */
export function aDiaDeCalendario(cuando: Date): string {
  return cuando.toISOString().slice(0, 10);
}
