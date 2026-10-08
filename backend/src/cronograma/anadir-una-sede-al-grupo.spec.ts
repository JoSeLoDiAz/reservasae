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
