/// El host recorta sobre el ALCANCE, no sobre lo concedido.
///
/// Sale de una revision adversarial. El guard comprobaba
/// `convenios` -- las areas alcanzadas en cualquiera de sus
/// gremios -- en vez de `alcance`, que ya viene recortado por
/// la direccion. Quien lleva un area en un gremio y no en el
/// otro entraba por el subdominio equivocado con ambito
/// vacio: no se filtraba dato alguno, pero se llevaba
/// pantallas en blanco en vez de un no que se entienda.
///
/// Los casos van con Carlos, que lleva areas distintas en
/// cada convenio: es la unica forma de que un fallo en el
/// recorte se vea.

import { AdminGuard, type Ambito } from './admin.guard';

const ADE = { id: 'cv-adecopria', slug: 'adecopria' };
const BRI = { id: 'cv-britcham', slug: 'britcham-adee' };

type Caso = {
  host: string;
  concesiones: { convenioId: string; rol: string }[];
  area?: { areas: string[]; nivel: string };
  cabecera?: string;
};

async function correr(caso: Caso): Promise<{ ambito?: Ambito; error?: string }> {
  const prisma = {
    admin: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'a1',
        activo: true,
        rol: 'GESTOR',
        debeCambiarClave: false,
      }),
    },
    adminConvenio: { findMany: jest.fn().mockResolvedValue(caso.concesiones) },
    convenio: { findMany: jest.fn().mockResolvedValue([ADE, BRI]) },
  };
  const jwt = { verify: () => ({ sub: 'a1' }) };
  const reflector = {
    getAllAndOverride: (clave: string) =>
      clave === 'area_requerida' ? caso.area : undefined,
  };
  const guard = new AdminGuard(jwt as never, prisma as never, reflector as never);
  const headers: Record<string, string> = { host: caso.host };
  if (caso.cabecera) headers['x-gremio'] = caso.cabecera;
  const peticion: Record<string, unknown> = {
    cookies: { convoca_sesion: 't' },
    headers,
  };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => peticion }),
    getHandler: () => undefined,
    getClass: () => undefined,
  };
  try {
    await guard.canActivate(ctx as never);
    return { ambito: peticion.ambito as Ambito };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// carlos.mesa de la siembra de pruebas
const CARLOS = [
  { convenioId: ADE.id, rol: 'LIDER_INSCRIPCION' },
  { convenioId: BRI.id, rol: 'GESTOR_ACADEMICO' },
];

describe('host recorta sobre convenios, no sobre concedidos', () => {
  it('1 · carlos por britcham a una ruta de reportes', async () => {
    const r = await correr({
      host: 'britcham-adee.reservasae.com',
      concesiones: CARLOS,
      area: { areas: ['reportes'], nivel: 'VER' },
    });
    console.log('1 reportes/VER por britcham =>', JSON.stringify(r));
  });

  it('2 · el mismo por la puerta general', async () => {
    const r = await correr({
      host: 'reservasae.com',
      concesiones: CARLOS,
      area: { areas: ['reportes'], nivel: 'VER' },
    });
    console.log('2 reportes/VER puerta general =>', JSON.stringify(r));
  });

  it('3 · el mismo pidiendo britcham por CABECERA (no por host)', async () => {
    const r = await correr({
      host: 'reservasae.com',
      concesiones: CARLOS,
      cabecera: BRI.id,
      area: { areas: ['reportes'], nivel: 'VER' },
    });
    console.log('3 reportes/VER cabecera britcham =>', JSON.stringify(r));
  });

  it('4 · escritura de inscripciones por britcham', async () => {
    const r = await correr({
      host: 'britcham-adee.reservasae.com',
      concesiones: CARLOS,
      area: { areas: ['inscripciones'], nivel: 'ESCRIBIR' },
    });
    console.log('4 inscripciones/ESCRIBIR por britcham =>', JSON.stringify(r));
  });

  it('5 · configuracion por el gremio donde no es lider de sistemas', async () => {
    const r = await correr({
      host: 'britcham-adee.reservasae.com',
      concesiones: [
        { convenioId: ADE.id, rol: 'LIDER_SISTEMAS' },
        { convenioId: BRI.id, rol: 'CONSULTA' },
      ],
      area: { areas: ['configuracion'], nivel: 'ESCRIBIR' },
    });
    console.log('5 configuracion/ESCRIBIR por britcham =>', JSON.stringify(r));
  });

  it('6 · lectura sin @Requiere por britcham', async () => {
    const r = await correr({
      host: 'britcham-adee.reservasae.com',
      concesiones: CARLOS,
    });
    console.log('6 sin @Requiere por britcham =>', JSON.stringify(r));
  });
});
