/** Los choques con la base no salen como 500. */

/// Antes, un duplicado o una carrera entre dos asesores llegaba
/// a la pantalla como 500 «Internal server error», en inglés. El
/// filtro los traduce; este spec lo ejerce con una aplicación
/// Nest DE VERDAD --Express, body-parser y todo-- y no llamando
/// a `catch` a mano, porque lo que importa es lo que recibe el
/// navegador: el estado, el cuerpo y que no se cuele nada de
/// adentro.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  INestApplication,
  Logger,
  Post,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { Prisma } from '../../generated/prisma';
import {
  ErroresDeBaseFilter,
  traducirErrorDePrisma,
} from './errores-de-base.filter';

const VERSION = '6.19.3';
const CEDULA = '1010316499';

const conocido = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError(
    // así de largo es el mensaje de verdad: trae la consulta
    `Invalid \`prisma.organizacion.create()\` invocation: documento ${CEDULA}`,
    { code, clientVersion: VERSION, meta },
  );

/// Lo que lanza cada ruta. Una por caso, para que la prueba lea
/// como la lista de lo que se promete.
@Controller('prueba')
class PruebaController {
  @Get('p2002')
  duplicado() {
    throw conocido('P2002', { modelName: 'Organizacion', target: ['nit'] });
  }

  /// Con parámetro: el log tiene que decir `:id`, no el valor.
  @Get('p2025/:id')
  noExiste() {
    throw conocido('P2025', {
      modelName: 'Oportunidad',
      cause: 'Record to update not found.',
    });
  }

  @Get('p2003')
  enUso() {
    throw conocido('P2003', {
      modelName: 'Oportunidad',
      field_name: 'Oportunidad_organizacionId_fkey (index)',
    });
  }

  @Get('p2000')
  otroCodigo() {
    throw conocido('P2000', { modelName: 'Organizacion' });
  }

  @Get('validacion')
  validacion() {
    // el de validación trae la consulta con sus valores
    throw new Prisma.PrismaClientValidationError(
      `Invalid \`prisma.lead.create()\` invocation:\n{ data: { documento: "${CEDULA}", correo: "ana@ejemplo.co" } }\nArgument \`celular\` is missing.`,
      { clientVersion: VERSION },
    );
  }

  @Get('sin-conexion')
  sinConexion() {
    throw new Prisma.PrismaClientInitializationError(
      "Can't reach database server at `10.0.0.7:5432`",
      VERSION,
      'P1001',
    );
  }

  @Get('otra-copia')
  otraCopia() {
    // lo que se ve si el error viene de otra copia del runtime
    // de Prisma: mismo nombre y código, otra clase
    throw Object.assign(new Error('Unique constraint failed'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
    });
  }

  @Get('nuestro')
  nuestro() {
    throw new TypeError(
      "Cannot read properties of undefined (reading 'etapa')",
    );
  }

  @Get('no-es-error')
  noEsError() {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw { algo: 'raro' };
  }

  @Get('ya-traducido')
  yaTraducido() {
    throw new ConflictException('Ya existe una cuenta con ese correo.');
  }

  @Get('lista')
  lista() {
    // la forma de la ValidationPipe: `message` es una lista
    throw new BadRequestException([
      'nombre no puede ir vacío',
      'nit debe ser texto',
    ]);
  }

  @Post('eco')
  eco(@Body() cuerpo: unknown) {
    return cuerpo;
  }
}

describe('el filtro de errores de la base', () => {
  let app: INestApplication;
  let errores: jest.SpyInstance;
  let avisos: jest.SpyInstance;

  /// Todo lo que se escribió en el log en la última petición.
  const log = () =>
    [errores, avisos]
      .flatMap((espia) => (espia.mock.calls as unknown[][]).flat())
      .map(String)
      .join('\n');

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [PruebaController],
    }).compile();

    const nest = modulo.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    // pequeño a propósito, para poder pasarse sin mandar 1 MB
    nest.useBodyParser('json', { limit: '200b' });
    // igual que en main.ts
    nest.useGlobalFilters(new ErroresDeBaseFilter(nest.getHttpAdapter()));
    await nest.init();
    app = nest;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    // se espía el prototipo: así se ven el log del filtro y el
    // de Nest, y la salida de la prueba no se llena de rojo
    errores = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    avisos = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const pedir = (ruta: string) => request(app.getHttpServer()).get(ruta);

  /// Lo que lee `pedir.ts` del frontend para mostrar el error.
  const mensaje = (res: { body: unknown }) =>
    (res.body as { message?: unknown }).message;

  describe('los tres que son del usuario', () => {
    it('P2002 (duplicado) es 409 y lo dice en español', async () => {
      const res = await pedir('/prueba/p2002');
      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        statusCode: 409,
        message: 'Ya existe un registro con ese dato.',
        error: 'Conflict',
      });
    });

    it('P2025 (ya no existe) es 404', async () => {
      const res = await pedir('/prueba/p2025/op-123');
      expect(res.status).toBe(404);
      expect(mensaje(res)).toBe('Ese registro ya no existe.');
    });

    it('P2003 (en uso por otro) es 409', async () => {
      const res = await pedir('/prueba/p2003');
      expect(res.status).toBe(409);
      expect(mensaje(res)).toBe(
        'Ese registro está en uso por otro y no se puede cambiar así.',
      );
    });

    it('lo reconoce aunque venga de otra copia del runtime de Prisma', async () => {
      // si algún archivo importa de @prisma/client, el instanceof
      // dice que no; el nombre y el código siguen ahí
      const res = await pedir('/prueba/otra-copia');
      expect(res.status).toBe(409);
      expect(mensaje(res)).toBe('Ya existe un registro con ese dato.');
    });

    it('no se cuela el mensaje de Prisma en la respuesta', async () => {
      const res = await pedir('/prueba/p2002');
      expect(res.text).not.toContain('prisma');
      expect(res.text).not.toContain(CEDULA);
    });
  });

  describe('lo que ya decidió su estado pasa intacto', () => {
    it('una HttpException de un servicio conserva su mensaje', async () => {
      const res = await pedir('/prueba/ya-traducido');
      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        statusCode: 409,
        message: 'Ya existe una cuenta con ese correo.',
        error: 'Conflict',
      });
    });

    it('la lista de la ValidationPipe sigue siendo lista', async () => {
      const res = await pedir('/prueba/lista');
      expect(res.status).toBe(400);
      expect(mensaje(res)).toEqual([
        'nombre no puede ir vacío',
        'nit debe ser texto',
      ]);
    });

    it('el 413 del body-parser sigue siendo 413, no 500', async () => {
      // es el que ve el webhook cuando el lote se pasa del tope
      const res = await request(app.getHttpServer())
        .post('/prueba/eco')
        .send({ relleno: 'x'.repeat(500) });
      expect(res.status).toBe(413);
    });

    it('un JSON roto sigue siendo 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/prueba/eco')
        .set('content-type', 'application/json')
        .send('{"nombre": ');
      expect(res.status).toBe(400);
    });

    it('una ruta que no existe sigue siendo 404', async () => {
      const res = await pedir('/prueba/no-hay-tal');
      expect(res.status).toBe(404);
    });

    it('y lo que sale bien no se toca', async () => {
      const res = await request(app.getHttpServer())
        .post('/prueba/eco')
        .send({ a: 1 });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ a: 1 });
    });
  });

  describe('el resto es 500, en español y sin contar nada de adentro', () => {
    const GENERICO =
      'No se pudo completar la operación por un error interno. Intente de nuevo en un momento.';

    it.each([
      ['otro código de Prisma', '/prueba/p2000'],
      ['un error de validación de Prisma', '/prueba/validacion'],
      ['la base caída', '/prueba/sin-conexion'],
      ['un error nuestro', '/prueba/nuestro'],
      ['algo que ni siquiera es un Error', '/prueba/no-es-error'],
    ])('%s', async (_caso, ruta) => {
      const res = await pedir(ruta);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        statusCode: 500,
        message: GENERICO,
        error: 'Internal Server Error',
      });
    });

    it('la respuesta no trae la consulta, ni la IP de la base, ni la pila', async () => {
      for (const ruta of [
        '/prueba/validacion',
        '/prueba/sin-conexion',
        '/prueba/nuestro',
      ]) {
        const res = await pedir(ruta);
        expect(res.text).not.toMatch(/prisma|10\.0\.0\.7|etapa|at /i);
        expect(res.text).not.toContain(CEDULA);
      }
    });
  });

  describe('el log dice dónde, sin decir de quién', () => {
    it('un 500 queda en el log con la ruta', async () => {
      await pedir('/prueba/nuestro');
      expect(log()).toContain('GET /prueba/nuestro');
      expect(log()).toContain("reading 'etapa'");
    });

    it('de un error de Prisma deja el código y el modelo', async () => {
      await pedir('/prueba/p2002');
      expect(log()).toContain('P2002');
      expect(log()).toContain('modelo Organizacion');
      expect(log()).toContain('campo nit');
    });

    it('la base caída deja su código, que es lo que se busca', async () => {
      await pedir('/prueba/sin-conexion');
      expect(log()).toContain('P1001');
    });

    it('pero nunca el mensaje de Prisma, que trae los valores', async () => {
      // el de validación trae la consulta entera: cédula, correo
      await pedir('/prueba/validacion');
      await pedir('/prueba/p2002');
      expect(log()).not.toContain(CEDULA);
      expect(log()).not.toContain('ana@ejemplo.co');
    });

    it('usa el patrón de la ruta, no el valor que llegó', async () => {
      await pedir(`/prueba/p2025/${CEDULA}`);
      expect(log()).toContain('/prueba/p2025/:id');
      expect(log()).not.toContain(CEDULA);
    });

    it('y la consulta de la URL no llega al log', async () => {
      // las búsquedas viajan en ?buscar=
      await pedir(`/prueba/p2002?buscar=${CEDULA}`);
      expect(log()).not.toContain(CEDULA);
    });
  });
});

describe('traducir un error de Prisma', () => {
  it('lo que no es de Prisma no se traduce', () => {
    expect(traducirErrorDePrisma(new Error('P2002'))).toBeNull();
    expect(traducirErrorDePrisma({ code: 'P2002' })).toBeNull();
    expect(traducirErrorDePrisma(null)).toBeNull();
  });

  it('un código que no es de los tres tampoco', () => {
    expect(traducirErrorDePrisma(conocido('P2034'))).toBeNull();
  });

  it('los tres dan su estado', () => {
    expect(traducirErrorDePrisma(conocido('P2002'))?.getStatus()).toBe(409);
    expect(traducirErrorDePrisma(conocido('P2025'))?.getStatus()).toBe(404);
    expect(traducirErrorDePrisma(conocido('P2003'))?.getStatus()).toBe(409);
  });
});

/// Un filtro que nadie registra no filtra nada, y ningún otro
/// spec arranca `main.ts`: se quitaría sin que nada fallara.
describe('main.ts', () => {
  it('registra el filtro con el adaptador HTTP', () => {
    const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8');
    expect(main).toContain(
      'app.useGlobalFilters(new ErroresDeBaseFilter(app.getHttpAdapter()))',
    );
  });
});
