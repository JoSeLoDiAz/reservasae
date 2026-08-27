/// Ninguna ruta de formularios toca el convenio ajeno.
///
/// Recorre las VEINTIUNA rutas del controlador de admin con
/// ids de BRITCHAM y una cuenta que solo lleva ADECOPRIA, y
/// exige dos cosas: que no responda 200 y, sobre todo, que
/// NO se haya escrito nada.
///
/// La segunda es la que importa. Una revision adversarial
/// encontro que GET :id devolvia 404 mientras PATCH :id
/// escribia con 200: la lectura cerrada y la escritura
/// abierta, que es la peor combinacion. Un arreglo ruta por
/// ruta se olvida de alguna; esto no se olvida de ninguna, y
/// si manana se anade una sin ambito, falla el build.

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AdminGuard, COOKIE_SESION } from '../admin/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { FormulariosAdminController } from './formularios.controller';
import { FormulariosService } from './formularios.service';

const SECRETO = 'un-secreto-larguisimo-de-mas-de-32-caracteres';
const ADE = { id: 'cv-ade', slug: 'adecopria' };
const BRI = { id: 'cv-bri', slug: 'britcham-adee' };

/// Todo lo de BRITCHAM: lo que la cuenta NO debe alcanzar.
const AJENO = {
  formulario: 'form-bri',
  seccion: 'sec-bri',
  pregunta: 'preg-bri',
  opcion: 'opc-bri',
  accion: 'acc-bri',
};

/// Cada escritura que llegue a la base queda aqui.
let escrituras: string[] = [];

/// El ambito viaja como un `{ in: [...] }`.
function alcanza(campo: unknown): boolean {
  const dentro = (campo as { in?: string[] } | undefined)?.in;
  return Array.isArray(dentro) ? dentro.includes(BRI.id) : true;
}

function escribe(nombre: string) {
  return async (...args: unknown[]) => {
    escrituras.push(nombre);
    return {
      id: 'x',
      formularioId: AJENO.formulario,
      preguntaId: AJENO.pregunta,
      ...(args[0] as object),
    };
  };
}

const prismaFalso: Record<string, unknown> = {
  admin: {
    findUnique: async () => ({
      id: 'adm-1',
      correo: 'lider@ejemplo.test',
      nombre: 'Lider de ADECOPRIA',
      rol: 'GESTOR',
      activo: true,
      debeCambiarClave: false,
    }),
  },
  adminConvenio: {
    findMany: async () => [{ convenioId: ADE.id, rol: 'LIDER_SISTEMAS' }],
  },
  convenio: {
    findMany: async () => [ADE, BRI],
    findFirst: async ({ where }: { where?: { convenioId?: unknown } }) =>
      alcanza(where?.convenioId) ? BRI : null,
    findUnique: async () => BRI,
    count: async () => 2,
  },
  formulario: {
    findFirst: async ({ where }: { where?: { convenioId?: unknown } }) =>
      alcanza(where?.convenioId) ? { id: AJENO.formulario } : null,
    findUnique: async () => ({
      id: AJENO.formulario,
      convenioId: BRI.id,
      preguntas: [],
      secciones: [],
    }),
    findMany: async () => [],
    create: escribe('formulario.create'),
    update: escribe('formulario.update'),
    delete: escribe('formulario.delete'),
  },
  seccion: {
    findFirst: async ({ where }: { where?: { formulario?: { convenioId?: unknown } } }) =>
      alcanza(where?.formulario?.convenioId) ? { id: AJENO.seccion } : null,
    findUnique: async () => ({ id: AJENO.seccion, formularioId: AJENO.formulario }),
    findMany: async () => [],
    create: escribe('seccion.create'),
    update: escribe('seccion.update'),
    delete: escribe('seccion.delete'),
    updateMany: escribe('seccion.updateMany'),
  },
  pregunta: {
    findFirst: async ({ where }: { where?: { formulario?: { convenioId?: unknown } } }) =>
      alcanza(where?.formulario?.convenioId) ? { id: AJENO.pregunta } : null,
    findUnique: async () => ({
      id: AJENO.pregunta,
      formularioId: AJENO.formulario,
      tipo: 'TEXTO_CORTO',
    }),
    findMany: async () => [],
    count: async () => 0,
    create: escribe('pregunta.create'),
    update: escribe('pregunta.update'),
    delete: escribe('pregunta.delete'),
    updateMany: escribe('pregunta.updateMany'),
  },
  opcion: {
    findFirst: async ({
      where,
    }: {
      where?: { pregunta?: { formulario?: { convenioId?: unknown } } };
    }) => (alcanza(where?.pregunta?.formulario?.convenioId) ? { id: AJENO.opcion } : null),
    findUnique: async () => ({ id: AJENO.opcion, preguntaId: AJENO.pregunta }),
    findMany: async () => [],
    count: async () => 0,
    create: escribe('opcion.create'),
    update: escribe('opcion.update'),
    delete: escribe('opcion.delete'),
    updateMany: escribe('opcion.updateMany'),
  },
  accionFormacion: {
    findFirst: async ({ where }: { where?: { convenioId?: unknown } }) =>
      alcanza(where?.convenioId) ? { id: AJENO.accion } : null,
    findMany: async () => [],
    update: escribe('accion.update'),
    updateMany: escribe('accion.updateMany'),
  },
  respuesta: {
    count: async () => 0,
    findMany: async () => [],
    deleteMany: escribe('respuesta.deleteMany'),
  },
};

prismaFalso.$transaction = async (fn: unknown) =>
  typeof fn === 'function'
    ? (fn as (tx: unknown) => unknown)(prismaFalso)
    : Promise.all(fn as unknown[]);

/// Las 21 rutas. Los cuerpos son minimos pero validos, para
/// que la peticion llegue al servicio y no muera en el DTO.
const RUTAS: Array<{ m: string; r: string; b?: object }> = [
  { m: 'get', r: '/admin/formularios' },
  { m: 'get', r: `/admin/formularios/${AJENO.formulario}` },
  { m: 'get', r: '/admin/formularios/campos-nucleo' },
  { m: 'get', r: '/admin/formularios/resumenes' },
  { m: 'patch', r: `/admin/formularios/resumenes/${AJENO.accion}`, b: { resumen: 'Texto de resumen publico con longitud suficiente.' } },
  { m: 'post', r: '/admin/formularios', b: { convenioId: BRI.id, slug: 'colado', titulo: 'Colado' } },
  { m: 'post', r: `/admin/formularios/${AJENO.formulario}/duplicar`, b: { slug: 'copia-colada', titulo: 'Copia colada' } },
  { m: 'patch', r: `/admin/formularios/${AJENO.formulario}`, b: { titulo: 'Pisado desde el otro gremio' } },
  { m: 'delete', r: `/admin/formularios/${AJENO.formulario}` },
  { m: 'patch', r: `/admin/formularios/${AJENO.formulario}/apariencia`, b: { coloresClaro: { marca: '#ff0000' } } },
  { m: 'post', r: `/admin/formularios/${AJENO.formulario}/secciones`, b: { titulo: 'Seccion colada' } },
  { m: 'patch', r: `/admin/formularios/secciones/${AJENO.seccion}`, b: { titulo: 'Pisada' } },
  { m: 'delete', r: `/admin/formularios/secciones/${AJENO.seccion}` },
  { m: 'patch', r: `/admin/formularios/${AJENO.formulario}/secciones/orden`, b: { ids: [AJENO.seccion] } },
  { m: 'post', r: `/admin/formularios/${AJENO.formulario}/preguntas`, b: { etiqueta: 'Colada', tipo: 'TEXTO_CORTO' } },
  { m: 'patch', r: `/admin/formularios/preguntas/${AJENO.pregunta}`, b: { etiqueta: 'Pisada' } },
  { m: 'patch', r: `/admin/formularios/${AJENO.formulario}/preguntas/orden`, b: { ids: [AJENO.pregunta] } },
  { m: 'post', r: `/admin/formularios/preguntas/${AJENO.pregunta}/opciones`, b: { etiqueta: 'Colada', valor: 'colada' } },
  { m: 'patch', r: `/admin/formularios/opciones/${AJENO.opcion}`, b: { etiqueta: 'Pisada' } },
  { m: 'delete', r: `/admin/formularios/opciones/${AJENO.opcion}` },
  { m: 'patch', r: `/admin/formularios/preguntas/${AJENO.pregunta}/opciones/orden`, b: { ids: [AJENO.opcion] } },
];

/// Las que devuelven una lista o un catalogo si responden
/// 200: lo que se les exige es venir vacias.
const LISTAS = new Set([
  '/admin/formularios',
  '/admin/formularios/resumenes',
  '/admin/formularios/campos-nucleo',
]);

describe('formularios: nada del convenio ajeno', () => {
  let app: INestApplication;
  let cookie: string;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: SECRETO })],
      controllers: [FormulariosAdminController],
      providers: [
        FormulariosService,
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

  it.each(RUTAS)('$m $r no escribe nada de BRITCHAM', async ({ m: metodo, r: ruta, b: cuerpo }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agente = request(app.getHttpServer()) as any;
    const peticion = agente[metodo](ruta)
      .set('Host', 'adecopria.reservasae.com')
      .set('Cookie', cookie);

    const res = await (cuerpo ? peticion.send(cuerpo) : peticion);

    // lo que de verdad importa: la base no se movio
    expect(escrituras).toEqual([]);

    // y lo que apunta a una fila ajena tampoco responde bien
    if (!LISTAS.has(ruta)) {
      expect(res.status).not.toBe(200);
      expect(res.status).not.toBe(201);
    }
  });

  it('las listas responden 200 pero vacias', async () => {
    for (const ruta of ['/admin/formularios', '/admin/formularios/resumenes']) {
      const res = await request(app.getHttpServer())
        .get(ruta)
        .set('Host', 'adecopria.reservasae.com')
        .set('Cookie', cookie);

      expect([ruta, res.status]).toEqual([ruta, 200]);
      const filas = Array.isArray(res.body) ? res.body : res.body.acciones;
      expect(filas).toEqual([]);
    }
  });
});
