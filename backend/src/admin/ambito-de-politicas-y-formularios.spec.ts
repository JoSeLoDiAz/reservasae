/// El ambito por convenio en politicas y formularios.
///
/// Nacio de una revision adversarial: desde el subdominio de
/// un gremio se podia PUBLICAR la politica de datos del otro
/// -- el texto legal que su gente acepta -- y listar sus
/// formularios. Ninguno de los dos controladores leia el
/// ambito, y `CLAUDE.md` afirmaba lo contrario.
///
/// Queda como prueba de regresion: si alguien quita el
/// ambito de ahi, falla el build.

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AdminGuard, COOKIE_SESION } from './admin.guard';
import { FormulariosAdminController } from '../formularios/formularios.controller';
import { FormulariosService } from '../formularios/formularios.service';
import { PoliticasAdminController } from '../politicas/politicas.controller';
import { PoliticasService } from '../politicas/politicas.service';
import { PrismaService } from '../prisma/prisma.service';

const SECRETO = 'un-secreto-larguisimo-de-mas-de-32-caracteres';
const ADECOPRIA = 'cnv-adecopria';
const BRITCHAM = 'cnv-britcham';

type Concesion = { convenioId: string; rol: string };

// lo que la cuenta tiene concedido en cada prueba
let concesiones: Concesion[] = [];

const creadas: any[] = [];
const cerradas: any[] = [];

const CONVENIOS = [
  { id: ADECOPRIA, slug: 'adecopria', nombre: 'ADECOPRIA', sigla: 'ADECOPRIA', orden: 1 },
  { id: BRITCHAM, slug: 'britcham-adee', nombre: 'BRITCHAM ADEE', sigla: 'BRITCHAM', orden: 2 },
];

// la política de BRITCHAM que ya firmó gente
const POLITICA_BRITCHAM = {
  id: 'pol-britcham-v1',
  convenioId: BRITCHAM,
  destinatario: 'RESERVA',
  version: 1,
  titulo: 'Política de tratamiento de datos BRITCHAM',
  contenido: 'texto vigente',
  vigenteHasta: null,
  vigenteDesde: new Date('2026-01-01'),
  convenio: CONVENIOS[1],
  _count: { reservas: 120, autorizaciones: 40 },
};

const FORMULARIOS = [
  {
    id: 'form-adecopria',
    convenioId: ADECOPRIA,
    slug: 'adecopria',
    titulo: 'ADECOPRIA',
    descripcion: '',
    publicado: true,
    convenio: { slug: 'adecopria', sigla: 'ADECOPRIA', orden: 1 },
    _count: { preguntas: 20, secciones: 4 },
    actualizadoEn: new Date(),
  },
  {
    id: 'form-britcham',
    convenioId: BRITCHAM,
    slug: 'britcham-adee',
    titulo: 'BRITCHAM ADEE',
    descripcion: '',
    publicado: true,
    convenio: { slug: 'britcham-adee', sigla: 'BRITCHAM', orden: 2 },
    _count: { preguntas: 22, secciones: 5 },
    actualizadoEn: new Date(),
  },
];

/// Respeta `{ in: [...] }`. Sin esto el simulacro devolveria
/// todo y la prueba no comprobaria nada.
function cuadra(campo: any, valor: string): boolean {
  if (campo === undefined || campo === null) return true;
  if (typeof campo === 'string') return campo === valor;
  if (Array.isArray(campo?.in)) return campo.in.includes(valor);
  return true;
}

const prismaFalso: any = {
  admin: {
    findUnique: async () => ({
      id: 'adm-1',
      correo: 'lider.adecopria@ejemplo.test',
      nombre: 'Líder de sistemas de ADECOPRIA',
      rol: 'GESTOR',
      activo: true,
      debeCambiarClave: false,
    }),
  },
  adminConvenio: {
    findMany: async () => concesiones,
  },
  convenio: {
    findMany: async () => CONVENIOS,
    findUnique: async ({ where }: any) =>
      CONVENIOS.find((c) => c.id === where.id) ?? null,
  },
  politicaDatos: {
    findMany: async ({ where }: any) =>
      [POLITICA_BRITCHAM].filter((p) => cuadra(where?.convenioId, p.convenioId)),
    findFirst: async ({ where }: any) =>
      where.convenioId === BRITCHAM ? POLITICA_BRITCHAM : null,
    update: async (args: any) => {
      cerradas.push(args);
      return { ...POLITICA_BRITCHAM, vigenteHasta: new Date() };
    },
    create: async (args: any) => {
      creadas.push(args);
      return { id: 'pol-nueva', ...args.data };
    },
  },
  formulario: {
    findMany: async ({ where }: any) =>
      FORMULARIOS.filter((f) => cuadra(where?.convenioId, f.convenioId)),
  },
  $transaction: async (fn: any) => fn(prismaFalso),
};

describe('el ámbito en políticas y formularios', () => {
  let app: INestApplication;
  let cookie: string;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: SECRETO })],
      controllers: [PoliticasAdminController, FormulariosAdminController],
      providers: [
        PoliticasService,
        FormulariosService,
        AdminGuard,
        { provide: PrismaService, useValue: prismaFalso },
      ],
    }).compile();

    app = modulo.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    const jwt = app.get(JwtService);
    cookie = `${COOKIE_SESION}=${jwt.sign({ sub: 'adm-1' })}`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    creadas.length = 0;
    cerradas.length = 0;
  });

  it('A · desde adecopria.reservasae.com publica la política de BRITCHAM', async () => {
    concesiones = [{ convenioId: ADECOPRIA, rol: 'LIDER_SISTEMAS' }];

    const res = await request(app.getHttpServer())
      .post('/admin/politicas')
      .set('Host', 'adecopria.reservasae.com')
      .set('Cookie', cookie)
      .send({
        convenioId: BRITCHAM,
        destinatario: 'RESERVA',
        titulo: 'Nueva política de BRITCHAM escrita desde ADECOPRIA',
        contenido:
          'Texto legal suplantado con longitud suficiente para pasar la validación del DTO.',
      });

    // 404 y no 403: decir que existe es un oraculo
    expect(res.status).toBe(404);
    // y sobre todo: no se creo ni se cerro nada
    expect(creadas).toHaveLength(0);
    expect(cerradas).toHaveLength(0);
  });

  it('A2 · lista las políticas del otro convenio', async () => {
    concesiones = [{ convenioId: ADECOPRIA, rol: 'LIDER_SISTEMAS' }];

    const res = await request(app.getHttpServer())
      .get(`/admin/politicas?convenioId=${BRITCHAM}`)
      .set('Host', 'adecopria.reservasae.com')
      .set('Cookie', cookie);

    // una lista se ACOTA, no se prohibe
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('B · en el host del gremio donde NO tiene configuración, igual escribe', async () => {
    concesiones = [
      { convenioId: ADECOPRIA, rol: 'LIDER_SISTEMAS' },
      { convenioId: BRITCHAM, rol: 'GESTOR_INSCRIPCION' },
    ];

    const res = await request(app.getHttpServer())
      .post('/admin/politicas')
      .set('Host', 'britcham-adee.reservasae.com')
      .set('Cookie', cookie)
      .send({
        convenioId: BRITCHAM,
        destinatario: 'RESERVA',
        titulo: 'Política publicada por un gestor de inscripción',
        contenido:
          'Texto legal suplantado con longitud suficiente para pasar la validación del DTO.',
      });

    // el area configuracion no la lleva un gestor
    expect(res.status).toBe(403);
    expect(creadas).toHaveLength(0);
  });

  it('B2 · sin el área en ese gremio, la lista se niega y no se acota', async () => {
    concesiones = [
      { convenioId: ADECOPRIA, rol: 'LIDER_SISTEMAS' },
      { convenioId: BRITCHAM, rol: 'GESTOR_INSCRIPCION' },
    ];

    const res = await request(app.getHttpServer())
      .get('/admin/formularios')
      .set('Host', 'britcham-adee.reservasae.com')
      .set('Cookie', cookie);

    /// 403 y no una lista vacia: lleva el area en ADECOPRIA
    /// y no en BRITCHAM, asi que por esta puerta no le
    /// corresponde nada. Antes devolvia los formularios de
    /// LOS DOS gremios.
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('britcham-adee');
  });

  it('B3 · con el área en los dos, la lista trae SOLO el del host', async () => {
    concesiones = [
      { convenioId: ADECOPRIA, rol: 'LIDER_SISTEMAS' },
      { convenioId: BRITCHAM, rol: 'LIDER_SISTEMAS' },
    ];

    const res = await request(app.getHttpServer())
      .get('/admin/formularios')
      .set('Host', 'britcham-adee.reservasae.com')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect((res.body as Array<{ convenio: string }>).map((f) => f.convenio)).toEqual([
      'britcham-adee',
    ]);
  });

  it('C · una cuenta solo de ADECOPRIA no entra por el host de BRITCHAM', async () => {
    concesiones = [{ convenioId: ADECOPRIA, rol: 'LIDER_SISTEMAS' }];

    const res = await request(app.getHttpServer())
      .get('/admin/formularios')
      .set('Host', 'britcham-adee.reservasae.com')
      .set('Cookie', cookie);

    console.log('C · status:', res.status, '·', JSON.stringify(res.body));
    expect(res.status).toBe(403);
  });
});
