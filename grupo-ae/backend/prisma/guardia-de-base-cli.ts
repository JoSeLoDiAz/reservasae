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

/// Carga el .env a mano, y hace falta.
///
/// Los diez guiones que llaman al guardia importan antes el
/// cliente de Prisma, y ESE import carga el .env de lado. Aqui
/// no hay Prisma, asi que sin esta linea `DATABASE_URL` llega
/// vacia y el guardia se planta SIEMPRE -- falla cerrado, que
/// es el lado bueno, pero deja `prisma:deploy` inservible.
import 'dotenv/config';

import { exigirBaseSegura } from './guardia-de-base';

exigirBaseSegura('El comando que sigue');
