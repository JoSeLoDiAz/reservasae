/** Repartir cupos entre sedes, sin descuadrar la oferta. */

/**
 * Hasta ahora los cupos de un grupo solo entraban por la semilla: si el
 * proyecto sumaba plazas en un departamento y las quitaba en otro,
 * tocaba el Excel y volver a sembrar, o entrar a la base a mano.
 *
 * Al abrirlo hay que sostener el invariante que nadie sostenía:
 * `Oferta.cuposMaximos` es la SUMA de los topes de sus coberturas. Eran
 * dos números que podían separarse para siempre sin que nadie avisara.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';

import { CronogramaService } from './cronograma.service';

const AMBITO = ['convenio-1'];

/// Una cobertura de Bogotá con 30 de tope, 25 comprometidos y 10
/// personas dentro. La acción tiene otra sede con 40 de tope.
function armar(sobre: Record<string, unknown> = {}, dentro = 10) {
  const cobertura = {
    id: 'cob-1',
    cuposBase: 25,
    cuposMaximos: 30,
    ubicacionId: 'ubi-bogota',
    ubicacion: { nombre: 'Bogotá D.C.' },
    grupo: { numero: 1, accionFormacionId: 'af-1' },
    _count: { participantes: dentro },
    ...sobre,
  };

  const escrito: Record<string, unknown> = {};
  const prisma = {
    grupoCobertura: {
      findFirst: () => Promise.resolve(cobertura),
      update: ({ data }: { data: Record<string, unknown> }) => {
        escrito.cobertura = data;
        return Promise.resolve(data);
      },
      /// Bogotá con lo que se acabe de escribir, más otra sede de 40.
      aggregate: () =>
        Promise.resolve({
          _sum: {
            cuposMaximos:
              ((escrito.cobertura as { cuposMaximos?: number })?.cuposMaximos ?? 0) + 40,
          },
        }),
    },
    oferta: {
      findUnique: () => Promise.resolve({ id: 'of-1' }),
      update: ({ data }: { data: Record<string, unknown> }) => {
        escrito.oferta = data;
        return Promise.resolve(data);
      },
    },
    $queryRaw: () => Promise.resolve([]),
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };

  return { servicio: new CronogramaService(prisma as never), escrito };
}

describe('editar los cupos de un grupo en una sede', () => {
  it('sube el tope y el de la oferta pasa a ser la suma de sus sedes', async () => {
    const { servicio, escrito } = armar();

    const r = await servicio.actualizarCupos('cob-1', { cuposMaximos: 50 }, AMBITO);

    expect(escrito.cobertura).toEqual({ cuposBase: 25, cuposMaximos: 50 });
    /// 50 de Bogotá + 40 de la otra sede.
    expect(escrito.oferta).toEqual({ cuposMaximos: 90 });
    expect(r.topeDeLaOferta).toBe(90);
  });

  it('bajarlo también recalcula: es el caso de quitarle a un departamento', async () => {
    const { servicio, escrito } = armar();

    await servicio.actualizarCupos('cob-1', { cuposMaximos: 15, cuposBase: 15 }, AMBITO);

    expect(escrito.oferta).toEqual({ cuposMaximos: 55 });
  });

  /// El sobrecupo suma sobre lo comprometido; nunca resta.
  it('el tope no puede quedar por debajo de lo comprometido', async () => {
    const { servicio } = armar();

    await expect(
      servicio.actualizarCupos('cob-1', { cuposMaximos: 20, cuposBase: 25 }, AMBITO),
    ).rejects.toThrow(/sobrecupo suma, no resta/);
  });

  /// Lo que impide dejar a alguien fuera de un sitio que ya ocupa.
  it('no se puede bajar el tope por debajo de la gente que ya está dentro', async () => {
    const { servicio } = armar({}, 22);

    await expect(
      servicio.actualizarCupos('cob-1', { cuposMaximos: 20, cuposBase: 20 }, AMBITO),
    ).rejects.toThrow(/ya tiene 22 personas dentro/);
  });

  it('una cobertura de otro convenio no existe para quien mira', async () => {
    const prisma = {
      grupoCobertura: { findFirst: () => Promise.resolve(null) },
    };
    const servicio = new CronogramaService(prisma as never);

    await expect(
      servicio.actualizarCupos('cob-ajena', { cuposMaximos: 50 }, AMBITO),
    ).rejects.toThrow(NotFoundException);
  });

  it('sin oferta en esa sede no hay donde sumar', async () => {
    const { servicio } = armar();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (servicio as any).prisma.oferta.findUnique = () => Promise.resolve(null);

    await expect(
      servicio.actualizarCupos('cob-1', { cuposMaximos: 50 }, AMBITO),
    ).rejects.toThrow(BadRequestException);
  });

  /// Sin tocar nada, no se rompe: los valores de hoy son válidos.
  it('un PATCH vacío deja los cupos como estaban', async () => {
    const { servicio, escrito } = armar();

    await servicio.actualizarCupos('cob-1', {}, AMBITO);

    expect(escrito.cobertura).toEqual({ cuposBase: 25, cuposMaximos: 30 });
  });
});
