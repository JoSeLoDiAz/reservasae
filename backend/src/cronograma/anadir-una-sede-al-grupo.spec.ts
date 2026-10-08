/** Añadir una sede a un grupo que ya existe. */

/**
 * ES UNA FILA, NO TRES.
 *
 * «Debo poder agregar grupos, departamento, la modalidad y distribuir
 * la meta» (Josse, 7 oct 2026). Medido: lo que describe --«grupo 1
 * Bogotá y grupo 1 Antioquia»-- NO son dos grupos, porque la clave
 * `(accionFormacionId, numero)` lo prohíbe. Es UN grupo con DOS
 * coberturas, y lo único que falta crear es la cobertura.
 *
 * Hasta hoy el único write a `grupos_cobertura` en toda la API era el
 * `update` de los cupos: crear una celda solo entraba por la siembra.
 */

import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { CronogramaService } from './cronograma.service';

const GRUPO = {
  id: 'g1',
  numero: 1,
  accionFormacionId: 'af1',
  accionFormacion: { codigo: 'AF1', convenioId: 'c-adecopria' },
};
const OFERTA = {
  id: 'of-antioquia',
  modalidad: 'VIRTUAL',
  ubicacion: { nombre: 'ANTIOQUIA' },
};

function armar(opciones: {
  grupo?: unknown;
  oferta?: unknown;
  yaEsta?: unknown;
} = {}) {
  const escrito: Record<string, unknown> = {};
  const tx = {
    $queryRaw: (...a: unknown[]) => {
      escrito.candado = String(a[0]);
      return Promise.resolve([]);
    },
    grupoCobertura: {
      create: (a: { data: unknown }) => {
        escrito.creada = a.data;
        return Promise.resolve({ id: 'nueva' });
      },
      aggregate: () => Promise.resolve({ _sum: { cuposMaximos: 98 } }),
    },
    oferta: {
      update: (a: { data: unknown }) => {
        escrito.ofertaActualizada = a.data;
        return Promise.resolve({});
      },
    },
  };
  const prisma = {
    /// `in` Y NO `??`: pasar `grupo: null` a proposito es lo que
    /// prueba el 404, y con el ?? el doble lo convertia en el valor
    /// bueno. Un doble que decide por otra cosa que el caso prueba
    /// el doble ---ya paso aqui con el prefijo de un id---.
    grupo: {
      findFirst: () =>
        Promise.resolve('grupo' in opciones ? opciones.grupo : GRUPO),
    },
        oferta: {
      findUnique: () =>
        Promise.resolve('oferta' in opciones ? opciones.oferta : OFERTA),
    },
    grupoCobertura: {
      findUnique: () => Promise.resolve(opciones.yaEsta ?? null),
    },
    $transaction: (fn: (t: unknown) => Promise<unknown>) => fn(tx),
  };
  const auditoria = {
    registrar: (a: unknown) => {
      escrito.auditoria = a;
      return Promise.resolve();
    },
  };
  return {
    s: new CronogramaService(prisma as never, auditoria as never),
    escrito,
  };
}

const DTO = { ubicacionId: 'u-antioquia', cuposBase: 25, cuposMaximos: 33 };
const ACTOR = { id: 'a1', nombre: 'Ana' };

describe('añadir una sede a un grupo', () => {
  it('crea la cobertura con la modalidad DE LA OFERTA, no de lo que le manden', async () => {
    const { s, escrito } = armar();
    await s.crearCobertura('g1', DTO as never, ['c-adecopria'], ACTOR);
    expect(escrito.creada).toEqual({
      grupoId: 'g1',
      ubicacionId: 'u-antioquia',
      /// DERIVADA: una celda cuya modalidad no case con su oferta se
      /// crea, sale en la tabla y no se puede asignar a nadie.
      modalidad: 'VIRTUAL',
      cuposBase: 25,
      cuposMaximos: 33,
    });
  });

  it('deja la oferta cuadrada con la suma de sus coberturas', async () => {
    const { s, escrito } = armar();
    await s.crearCobertura('g1', DTO as never, ['c-adecopria'], ACTOR);
    expect(escrito.ofertaActualizada).toEqual({ cuposMaximos: 98 });
  });

  /// Lo mismo que hace `actualizarCupos`: dos caminos para dejar
  /// cuadrada la misma fila acabarian discrepando.
  it('toma la fila de la oferta antes de tocar nada', async () => {
    const { s, escrito } = armar();
    await s.crearCobertura('g1', DTO as never, ['c-adecopria'], ACTOR);
    expect(String(escrito.candado)).toContain('ofertas');
  });

  it('sin oferta en esa sede NO crea nada, y lo dice', async () => {
    const { s, escrito } = armar({ oferta: null });
    await expect(
      s.crearCobertura('g1', DTO as never, ['c-adecopria'], ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(escrito.creada).toBeUndefined();
  });

  /// La clave unica, comprobada ANTES para poder decir cual es: un
  /// P2002 crudo solo dice que algo choco.
  it('si esa sede ya está en el grupo, 409 que la nombra', async () => {
    const { s, escrito } = armar({ yaEsta: { id: 'ya' } });
    await expect(
      s.crearCobertura('g1', DTO as never, ['c-adecopria'], ACTOR),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(escrito.creada).toBeUndefined();
  });

  it('el tope no puede nacer por debajo de lo comprometido', async () => {
    const { s, escrito } = armar();
    await expect(
      s.crearCobertura(
        'g1',
        { ...DTO, cuposBase: 50, cuposMaximos: 33 } as never,
        ['c-adecopria'],
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(escrito.creada).toBeUndefined();
  });

  /// EL AMBITO: un grupo del otro gremio no existe para esta cuenta.
  it('un grupo fuera del ámbito es 404 y no escribe', async () => {
    const { s, escrito } = armar({ grupo: null });
    await expect(
      s.crearCobertura('g1', DTO as never, ['c-adecopria'], ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(escrito.creada).toBeUndefined();
  });

  it('deja huella de lo que se añadió', async () => {
    const { s, escrito } = armar();
    await s.crearCobertura('g1', DTO as never, ['c-adecopria'], ACTOR);
    const a = escrito.auditoria as { accion: string; resumen: string };
    expect(a.accion).toBe('COBERTURA_CREADA');
    expect(a.resumen).toContain('ANTIOQUIA');
    expect(a.resumen).toContain('grupo 1');
  });
});

/**
 * EL DESPLEGABLE OFRECE EXACTAMENTE LO QUE EL POST ACEPTA.
 *
 * Es lo que llena «Añadir una sede» en Grupos de AF. Si ofreciera una
 * ubicación sin oferta, elegirla contestaría 400 ---el «botón que da
 * 403» que este proyecto ya tiene documentado---, y si escondiera las
 * que el grupo ya tiene, quien busca Medellín y no la encuentra no
 * sabría si es que no se dicta allí o si es que ya está puesta.
 */
describe('dónde se le puede añadir una sede', () => {
  const OFERTAS = [
    {
      modalidad: 'VIRTUAL',
      ubicacion: { id: 'u-antioquia', nombre: 'ANTIOQUIA', tipo: 'DEPARTAMENTO', departamento: 'ANTIOQUIA' },
    },
    {
      modalidad: 'PRESENCIAL',
      ubicacion: { id: 'u-medellin', nombre: 'MEDELLÍN', tipo: 'CIUDAD', departamento: 'ANTIOQUIA' },
    },
  ];

  function armarSedes(coberturas: Array<{ ubicacionId: string; modalidad: string }>, grupo: unknown = {}) {
    const prisma = {
      grupo: {
        findFirst: () =>
          Promise.resolve(
            grupo === null ? null : { accionFormacionId: 'af1', coberturas },
          ),
      },
      oferta: { findMany: () => Promise.resolve(OFERTAS) },
    };
    return new CronogramaService(prisma as never, { registrar: () => Promise.resolve() } as never);
  }

  it('ofrece las ubicaciones donde la acción SÍ tiene oferta', async () => {
    const sedes = await armarSedes([]).sedesPosibles('g1', ['c-adecopria']);
    expect(sedes.map((s) => s.ubicacionId)).toEqual(['u-antioquia', 'u-medellin']);
  });

  /// La pone la OFERTA y el POST la deriva igual: si el desplegable
  /// dijera otra, la celda nacería con una modalidad que no case con
  /// su oferta y no se podría asignar a nadie.
  it('la modalidad es la de la oferta', async () => {
    const sedes = await armarSedes([]).sedesPosibles('g1', ['c-adecopria']);
    expect(sedes.find((s) => s.ubicacionId === 'u-medellin')?.modalidad).toBe('PRESENCIAL');
  });

  it('marca las que el grupo ya tiene, y NO las esconde', async () => {
    const sedes = await armarSedes([
      { ubicacionId: 'u-medellin', modalidad: 'PRESENCIAL' },
    ]).sedesPosibles('g1', ['c-adecopria']);
    expect(sedes).toHaveLength(2);
    expect(sedes.find((s) => s.ubicacionId === 'u-medellin')?.yaEnElGrupo).toBe(true);
    expect(sedes.find((s) => s.ubicacionId === 'u-antioquia')?.yaEnElGrupo).toBe(false);
  });

  /**
   * LA CLAVE ÚNICA ES (grupo, ubicación, MODALIDAD), así que «ya la
   * tiene» se mide con las DOS. Mirando solo la ubicación, una celda
   * virtual de ANTIOQUIA bloquearía la presencial de ANTIOQUIA, que es
   * una fila legítima y distinta ---es justo lo que pasa en AF7 grupo
   * 1, la única fila del catálogo con dos sedes---.
   */
  it('la misma ubicación con OTRA modalidad sigue disponible', async () => {
    const sedes = await armarSedes([
      { ubicacionId: 'u-antioquia', modalidad: 'PRESENCIAL' },
    ]).sedesPosibles('g1', ['c-adecopria']);
    expect(sedes.find((s) => s.ubicacionId === 'u-antioquia')?.yaEnElGrupo).toBe(false);
  });

  it('un grupo fuera del ámbito es 404', async () => {
    await expect(
      armarSedes([], null).sedesPosibles('ajeno', ['c-adecopria']),
    ).rejects.toThrow(NotFoundException);
  });
});

/**
 * LA QUE YA ESTÁ SE AJUSTA, NO SE RECHAZA (Josse, 8 oct 2026).
 *
 * «En el grupo 1 dice que Antioquia ya está, pero puedo volver a
 * repetir Antioquia, no hay problema [...] lo único que necesitamos
 * ahí es poner que vamos a añadir en el grupo tal, en tal ubicación
 * [...] que yo pueda ajustar los cupos».
 *
 * Dos filas de (grupo, ubicación, modalidad) NO caben ---la llave
 * única lo prohíbe, y hace bien: dos celdas iguales dejarían sin
 * respuesta a cuál pertenece una ficha---. Así que lo que hace el
 * panel con una que ya está es EDITARLA, y para eso necesita su id y
 * sus cupos. El 409 del alta se queda para quien llame a la API
 * directo; lo que cambia es que el panel ya no lo topa.
 */
describe('lo que el grupo ya tiene viaja, para poder ajustarlo', () => {
  const OFERTAS_2 = [
    {
      modalidad: 'VIRTUAL',
      ubicacion: { id: 'u-antioquia', nombre: 'ANTIOQUIA', tipo: 'DEPARTAMENTO', departamento: 'ANTIOQUIA' },
    },
    {
      modalidad: 'VIRTUAL',
      ubicacion: { id: 'u-huila', nombre: 'HUILA', tipo: 'DEPARTAMENTO', departamento: 'HUILA' },
    },
  ];

  function armar(coberturas: unknown[]) {
    const prisma = {
      grupo: {
        findFirst: () => Promise.resolve({ accionFormacionId: 'af2', coberturas }),
      },
      oferta: { findMany: () => Promise.resolve(OFERTAS_2) },
    };
    return new CronogramaService(prisma as never, { registrar: () => Promise.resolve() } as never);
  }

  const PUESTA = {
    id: 'cob-antioquia',
    ubicacionId: 'u-antioquia',
    modalidad: 'VIRTUAL',
    cuposBase: 25,
    cuposMaximos: 33,
  };

  it('trae el id y los cupos de la que ya está', async () => {
    const sedes = await armar([PUESTA]).sedesPosibles('g2', ['c-adecopria']);
    const antioquia = sedes.find((s) => s.ubicacionId === 'u-antioquia');
    expect(antioquia?.puesta).toEqual({
      coberturaId: 'cob-antioquia',
      cuposBase: 25,
      cuposMaximos: 33,
    });
  });

  /// Nulo y no un objeto en cero: cero es un dato y «no la tiene» es
  /// la ausencia de dato. El panel distingue el alta del ajuste por
  /// esto, así que un cero lo haría llamar al PATCH de una cobertura
  /// que no existe.
  it('la que no está viene en nulo, no en cero', async () => {
    const sedes = await armar([PUESTA]).sedesPosibles('g2', ['c-adecopria']);
    expect(sedes.find((s) => s.ubicacionId === 'u-huila')?.puesta).toBeNull();
  });

  /// `yaEnElGrupo` y `puesta` responden lo mismo y por eso no pueden
  /// discrepar: uno es el booleano que la pantalla ya leía y el otro
  /// el dato. Si se separaran, el rótulo diría «ya la tiene» y el
  /// formulario la trataría como alta.
  it('`yaEnElGrupo` y `puesta` no se separan', async () => {
    const sedes = await armar([PUESTA]).sedesPosibles('g2', ['c-adecopria']);
    for (const s of sedes) {
      expect(s.yaEnElGrupo).toBe(s.puesta !== null);
    }
  });

  /**
   * LA MISMA UBICACIÓN CON OTRA MODALIDAD ES OTRA CELDA, y por eso la
   * llave lleva las tres. Es el caso real de AF7 grupo 1, que junta
   * Medellín presencial con la virtual del departamento: medir «ya la
   * tiene» sin la modalidad daría por puesta una celda que no existe
   * y el panel llamaría al PATCH con el id de la otra.
   */
  it('no confunde la misma ubicación con otra modalidad', async () => {
    const sedes = await armar([{ ...PUESTA, modalidad: 'PRESENCIAL' }]).sedesPosibles(
      'g2',
      ['c-adecopria'],
    );
    expect(sedes.find((s) => s.ubicacionId === 'u-antioquia')?.puesta).toBeNull();
  });
});
