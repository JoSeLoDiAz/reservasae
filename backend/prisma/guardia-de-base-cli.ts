/** El guardia, para anteponerlo a un comando de Prisma. */

/**
 * `prisma migrate deploy` no pasa por ningún guión nuestro, así
 * que no hay dónde meterle el candado: se le antepone este.
 *
 * Existe como fichero aparte y no como una bandera de
 * `guardia-de-base.ts` porque ese módulo lo importan diez
 * guiones, y un módulo que además se ejecuta solo es un módulo
 * que alguien importa sin querer y le corta el proceso.
 */

import { exigirBaseSegura } from './guardia-de-base';

exigirBaseSegura('El comando que sigue');
