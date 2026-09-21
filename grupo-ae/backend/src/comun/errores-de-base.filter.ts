import {
  ArgumentsHost,
  Catch,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { inspect } from 'node:util';

import { Prisma } from '../../generated/prisma';

/** Lo que la base rechaza, dicho como lo entiende quien lo pidió. */

/// Antes de este filtro, todo error de Prisma que un servicio
/// no atrapara a mano salía como 500 «Internal server error»,
/// en inglés. Y los que más salían no eran fallas del servidor:
/// eran carreras. Dos asesores guardan la misma organización al
/// mismo tiempo y el segundo choca con el índice único (P2002);
/// uno mueve una oportunidad que otro acaba de cerrar y el
/// `update` ya no encuentra la fila (P2025). Eso no es un 500:
/// es un 409 o un 404, y con eso la persona SÍ puede hacer algo
/// --recargar, cambiar el dato-- en vez de concluir que el
/// sistema se cayó y llamar a soporte.
///
/// Los servicios que ya traducen su P2002 con un mensaje propio
/// («Ya existe una cuenta con ese correo.») lo siguen haciendo:
/// eso llega aquí como HttpException y pasa intacto. Este filtro
/// es la red de abajo, no el reemplazo del mensaje preciso. Si
/// una pantalla necesita decir CUÁL dato está repetido, el
/// servicio lo atrapa y lo dice; aquí solo se evita el 500.

/// Los textos que ve el usuario. Se exportan para que nadie
/// los copie a mano en otro lado y se desalineen.
export const MENSAJES_DE_BASE = {
  duplicado: 'Ya existe un registro con ese dato.',
  noExiste: 'Ese registro ya no existe.',
  enUso: 'Ese registro está en uso por otro y no se puede cambiar así.',
  /// Genérico a propósito. El mensaje de un error interno puede
  /// traer la consulta entera, el nombre de una tabla o la ruta
  /// de un archivo del servidor: nada de eso le sirve a quien
  /// está en la pantalla, y todo le sirve a quien la está
  /// tanteando. El detalle queda en el log, no en la respuesta.
  generico:
    'No se pudo completar la operación por un error interno. Intente de nuevo en un momento.',
} as const;

type ErrorConocidoDePrisma = Error & {
  code: string;
  meta?: Record<string, unknown>;
};

/// Reconoce el error de Prisma por la clase Y por el nombre.
///
/// El cliente se genera en `generated/prisma` con su propia
/// copia del runtime, y `instanceof` solo reconoce la clase de
/// ESA copia. Basta con que un archivo importe algún día de
/// `@prisma/client` --o que un `prisma generate` deje dos
/// versiones cargadas-- para que el `instanceof` diga que no en
/// silencio y todo vuelva a salir como 500 sin que nada falle.
/// El nombre lo pone Prisma en todas sus copias, así que es la
/// red de esa red.
function esConocidoDePrisma(error: unknown): error is ErrorConocidoDePrisma {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return true;
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

/// Cualquier error de Prisma, del tipo que sea: los de
/// validación, los de conexión, los que el motor no clasifica.
function esDePrisma(error: unknown): error is Error {
  return error instanceof Error && error.name.startsWith('PrismaClient');
}

/// Traduce los tres códigos que son del usuario y no del
/// servidor. Cualquier otro devuelve `null` y termina en 500.
///
/// P2003 va a 409 y no a 400: la petición está bien formada, lo
/// que choca es el ESTADO de la base. Aquí nada se borra --se
/// oculta, se cancela o se cierra--, así que cuando aparece casi
/// siempre es una carrera: se enlaza con algo que otro acaba de
/// cambiar, o se intenta soltar algo de lo que todavía cuelga
/// otro registro. Es el mismo caso que el duplicado: el dato
/// está en conflicto con lo que ya hay.
export function traducirErrorDePrisma(error: unknown): HttpException | null {
  if (!esConocidoDePrisma(error)) return null;
  switch (error.code) {
    case 'P2002':
      return new ConflictException(MENSAJES_DE_BASE.duplicado);
    case 'P2025':
      return new NotFoundException(MENSAJES_DE_BASE.noExiste);
    case 'P2003':
      return new ConflictException(MENSAJES_DE_BASE.enUso);
    default:
      return null;
  }
}

/// Los errores de `http-errors` que ya dicen su estado de
/// cliente: el 413 del body-parser cuando el lote de leads se
/// pasa de 1 MB, por ejemplo. Nest los contestaba con su estado
/// y su texto, y así se quedan -- volverlos 500 sería decirle a
/// quien mandó un cuerpo enorme que el problema es nuestro.
///
/// `expose` es la marca que pone esa librería cuando el mensaje
/// se puede mostrar. Se exige y no basta con `statusCode`:
/// cualquier cliente HTTP de salida trae un `statusCode` en sus
/// errores, y su mensaje suele llevar la URL interna que se
/// llamó.
function esErrorDeClienteHttp(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { statusCode, expose } = error as {
    statusCode?: unknown;
    expose?: unknown;
  };
  return (
    expose === true &&
    typeof statusCode === 'number' &&
    statusCode >= 400 &&
    statusCode < 500
  );
}

/// De qué ruta vino, para el log.
///
/// Se prefiere el PATRÓN de la ruta (`/crm/nit/:nit`) a la URL
/// que llegó (`/crm/nit/1010316499`), y si no hay patrón se
/// corta la consulta: un NIT de persona natural es su cédula, y
/// las búsquedas viajan en `?buscar=`. Un log con cédulas es una
/// filtración (ver `tapar.ts`), y el patrón además agrupa: diez
/// choques en la misma ruta se leen como uno solo repetido.
function rutaDeLaPeticion(host: ArgumentsHost): string {
  const peticion = host.switchToHttp().getRequest<
    | {
        method?: string;
        originalUrl?: string;
        url?: string;
        route?: { path?: unknown };
      }
    | undefined
  >();
  const patron = peticion?.route?.path;
  const url =
    typeof patron === 'string'
      ? patron
      : (peticion?.originalUrl ?? peticion?.url ?? '').split('?')[0];
  return `${peticion?.method ?? '?'} ${url || '?'}`;
}

/// Lo que se puede decir de un error de Prisma sin decir el
/// dato: la clase, el código, el modelo y el campo.
///
/// El MENSAJE no se toca nunca. En uno de validación viene la
/// consulta entera con sus valores --nombre, correo, cédula--; en
/// uno desconocido viene el error crudo de Postgres, que para un
/// CHECK trae «Failing row contains (...)» con la fila completa.
/// El esquema no es un dato personal; los valores sí.
function resumenDePrisma(error: Error): string {
  const { code, errorCode, meta } = error as {
    code?: unknown;
    errorCode?: unknown;
    meta?: Record<string, unknown>;
  };
  const partes = [error.name];
  const codigo = code ?? errorCode;
  if (typeof codigo === 'string') partes.push(codigo);
  if (typeof meta?.modelName === 'string')
    partes.push(`modelo ${meta.modelName}`);
  const campo = meta?.target ?? meta?.field_name;
  if (typeof campo === 'string') partes.push(`campo ${campo}`);
  if (Array.isArray(campo) && campo.every((c) => typeof c === 'string')) {
    partes.push(`campo ${campo.join(', ')}`);
  }
  return partes.join(' · ');
}

/// Solo los marcos «at ...» de la pila, sin la primera línea.
///
/// La pila de un Error empieza repitiendo el mensaje, así que
/// pasarla entera al log es pasar el mensaje por la puerta de
/// atrás. Los marcos dicen DÓNDE se lanzó, que es lo que hace
/// falta para ir a buscarlo.
function soloLosMarcos(pila: string | undefined): string | undefined {
  const marcos = (pila ?? '')
    .split('\n')
    .filter((linea) => /^\s+at /.test(linea));
  return marcos.length ? marcos.join('\n') : undefined;
}

/// El filtro global: la última puerta antes de contestar.
///
/// Extiende `BaseExceptionFilter` y no contesta a mano para que
/// la forma de la respuesta sea EXACTAMENTE la de siempre
/// (`{ statusCode, message, error }`): `pedir.ts` del frontend
/// lee `message`, y un 409 de aquí se tiene que ver igual que
/// uno lanzado por un servicio. También hereda el cuidado con
/// una respuesta que ya empezó a salir (una descarga a medio
/// camino): esa no se contesta, se cierra.
@Catch()
export class ErroresDeBaseFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('ErroresDeBase');

  catch(exception: unknown, host: ArgumentsHost): void {
    // lo que ya decidió su estado pasa tal cual
    if (exception instanceof HttpException || esErrorDeClienteHttp(exception)) {
      return super.catch(exception, host);
    }

    const ruta = rutaDeLaPeticion(host);

    /// Un 409 o un 404 de aquí no es una falla del servidor,
    /// pero se deja una línea de aviso: si la misma ruta choca
    /// todos los días con el mismo índice, eso no es una carrera
    /// sino un servicio que debería preguntar antes de escribir.
    const traducida = traducirErrorDePrisma(exception);
    if (traducida) {
      this.logger.warn(
        `${resumenDePrisma(exception as Error)} -> ${traducida.getStatus()} en ${ruta}`,
      );
      return super.catch(traducida, host);
    }

    this.registrarFalla(exception, ruta);
    return super.catch(
      new InternalServerErrorException(MENSAJES_DE_BASE.generico),
      host,
    );
  }

  /// Todo lo que se oculta en la respuesta tiene que quedar en
  /// el log, o el 500 genérico deja a quien depura a ciegas.
  private registrarFalla(exception: unknown, ruta: string): void {
    if (esDePrisma(exception)) {
      this.logger.error(
        `${resumenDePrisma(exception)} en ${ruta}`,
        soloLosMarcos(exception.stack),
      );
      return;
    }
    // un error nuestro: su mensaje lo escribimos nosotros
    if (exception instanceof Error) {
      this.logger.error(
        `${exception.name}: ${exception.message} en ${ruta}`,
        exception.stack,
      );
      return;
    }
    this.logger.error(
      `Se lanzó algo que no es un Error en ${ruta}: ${inspect(exception, { depth: 2 })}`,
    );
  }
}
