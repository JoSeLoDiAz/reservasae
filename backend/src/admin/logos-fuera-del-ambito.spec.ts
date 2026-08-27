/// Los logos de un gremio no se tocan desde el otro.
///
/// Salio de una revision adversarial. Ninguna de las cuatro
/// rutas de /admin/logos miraba el ambito: el unico candado
/// contaba si el formulario EXISTE, no de quien es. Y el GET
/// no tenia ni @Requiere ni @Roles, asi que lo veia cualquier
/// sesion de admin -- y es el que entrega los ids que
/// necesitan el PATCH y el DELETE.
///
/// El peor era el DELETE: borra un logo del banner PUBLICO
/// del otro gremio y su URL /marca/logos/:id deja de existir.
///
/// Los logos GENERALES (formularioId = null) no pertenecen a
/// ningun convenio, asi que `{ in: ambito }` no los cubre: el
/// candado tiene que mirar la PUERTA. Se editan desde la
/// general y desde ninguna otra, o se salta pasando el campo
/// vacio -- que es justo lo que hacia la pantalla.

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AdminController, MarcaPublicaController } from './admin.controller';
import { AdminGuard, COOKIE_SESION } from './admin.guard';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

const SECRETO = 'un-secreto-larguisimo-de-mas-de-32-caracteres';
const ADE = { id: 'cv-ade', slug: 'adecopria' };
const BRI = { id: 'cv-bri', slug: 'britcham-adee' };

const FORM_BRI = 'form-bri';
const LOGO_BRI = 'logo-bri';

/// Cada escritura que llegue a la base queda aqui.
let escrituras: string[] = [];

function alcanzaBritcham(campo: unknown): boolean {
  const dentro = (campo as { in?: string[] } | undefined)?.in;
  return Array.isArray(dentro) ? dentro.includes(BRI.id) : true;
}

function escribe(nombre: string) {
  return async () => {
    escrituras.push(nombre);
    return { id: 'x', formularioId: FORM_BRI };
  };
}

const prismaFalso: Record<string, unknown> = {
  admin: {
    findUnique: async () => ({
      id: 'adm-1',
      correo: 'ana@ejemplo.test',
      nombre: 'Ana, superadmin de ADECOPRIA',
      rol: 'SUPERADMIN',
      activo: true,
      debeCambiarClave: false,
    }),
  },
  adminConvenio: {
    findMany: async () => [{ convenioId: ADE.id, rol: 'LIDER_SISTEMAS' }],
  },
  convenio: {
    findMany: async () => [ADE, BRI],
    findFirst: async () => null,
    findUnique: async () => BRI,
    count: async () => 2,
  },
  formulario: {
    // solo lo devuelve si el ambito alcanza a BRITCHAM
    findFirst: async ({ where }: { where?: { convenioId?: unknown } }) =>
      alcanzaBritcham(where?.convenioId) ? { id: FORM_BRI } : null,
    findUnique: async () => ({ id: FORM_BRI, convenioId: BRI.id }),
    count: async () => 1,
  },
  logo: {
    findUnique: async () => ({ id: LOGO_BRI, formularioId: FORM_BRI, orden: 0 }),
    findMany: async () => [],
    count: async () => 0,
    create: escribe('logo.create'),
    update: escribe('logo.update'),
    delete: escribe('logo.delete'),
  },
  marca: { upsert: async () => ({ nombreApp: 'Convoca' }) },
  tema: { findMany: async () => [] },
};

prismaFalso.$transaction = async (fn: unknown) =>
  typeof fn === 'function'
    ? (fn as (tx: unknown) => unknown)(prismaFalso)
    : Promise.all(fn as unknown[]);

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('logos: nada del convenio ajeno', () => {
  let app: INestApplication;
  let cookie: string;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: SECRETO })],
      controllers: [AdminController, MarcaPublicaController],
      providers: [
        AdminService,
        AdminGuard,
        { provide: PrismaService, useValue: prismaFalso },
      ],
    }).compile();

    app = modulo.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    cookie = `${COOKIE_SESION}=${app.get(JwtService).sign({ sub: 'adm-1' })}`;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    escrituras = [];
  });

  /// Entrando por la puerta de ADECOPRIA.
  function desdeAdecopria(metodo: string, ruta: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agente = request(app.getHttpServer()) as any;
    return agente[metodo](ruta)
      .set('Host', 'adecopria.reservasae.com')
      .set('Cookie', cookie);
  }

  it('no lista los logos del formulario de BRITCHAM', async () => {
    const res = await desdeAdecopria('get', `/admin/logos?formularioId=${FORM_BRI}`);
    expect(res.status).not.toBe(200);
  });

  it('no lista los GENERALES desde la puerta de un gremio', async () => {
    // formularioId = null no lo cubre ningun `{ in: ambito }`
    const res = await desdeAdecopria('get', '/admin/logos');
    expect(res.status).not.toBe(200);
  });

  it('no sube un logo al formulario de BRITCHAM', async () => {
    const res = await desdeAdecopria('post', '/admin/logos')
      .field('formularioId', FORM_BRI)
      .attach('logo', PNG, { filename: 'colado.png', contentType: 'image/png' });

    expect(escrituras).toEqual([]);
    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(201);
  });

  it('no sube un logo GENERAL desde la puerta de un gremio', async () => {
    const res = await desdeAdecopria('post', '/admin/logos').attach(
      'logo',
      PNG,
      { filename: 'colado.png', contentType: 'image/png' },
    );

    expect(escrituras).toEqual([]);
    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(201);
  });

  it('no renombra ni mueve un logo de BRITCHAM', async () => {
    const res = await desdeAdecopria('patch', `/admin/logos/${LOGO_BRI}`).send({
      etiqueta: 'Pisada desde el otro gremio',
    });

    expect(escrituras).toEqual([]);
    expect(res.status).not.toBe(200);
  });

  it('no borra un logo del banner público de BRITCHAM', async () => {
    const res = await desdeAdecopria('delete', `/admin/logos/${LOGO_BRI}`);

    // la peor de las cuatro: su URL dejaria de existir
    expect(escrituras).toEqual([]);
    expect(res.status).not.toBe(200);
  });

  it('no entrega la paleta ni los logos de un formulario ajeno por su slug', async () => {
    const res = await desdeAdecopria(
      'get',
      `/admin/marca/formulario/${BRI.slug}`,
    );
    expect(res.status).not.toBe(200);
  });
});
