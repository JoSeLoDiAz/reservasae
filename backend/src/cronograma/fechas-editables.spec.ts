/** Las fechas de un grupo y sus sesiones. */

/**
 * Llama a `actualizarGrupo`, no a `loQueEstaMal`. Las reglas
 * puras ya tienen su spec; aqui se prueba COMO el metodo las
 * usa -- que es donde este repositorio se llevo el susto con
 * `cambiarEtapa`: los predicados salian bien y el defecto vivia
 * en quien los llamaba.
 */

import { BadRequestException } from '@nestjs/common';

import { CronogramaService } from './cronograma.service';

const AMBITO = ['convenio-1'];
const DIA = (t: string) => new Date(`${t}T00:00:00.000Z`);

/// Un grupo del 1 al 30 de septiembre.
function armar(sobre: Record<string, unknown> = {}) {
  const grupo = {
    id: 'gru-1',
    fechaInicio: DIA('2026-09-01'),
    fechaFin: DIA('2026-09-30'),
    coberturas: [{ ubicacionId: 'ubi-medellin' }, { ubicacionId: 'ubi-huila' }],
    ...sobre,
  };

  const escrito: Record<string, unknown> = {};
  const prisma = {
    grupo: {
      findFirst: () => Promise.resolve(grupo),
      update: ({ data }: { data: Record<string, unknown> }) => {
        escrito.data = data;
        return Promise.resolve(data);
      },
    },
  };

  return { servicio: new CronogramaService(prisma as never), escrito };
}

const PRESENCIAL = { tipo: 'PRESENCIAL' as const, horaInicio: '08:00', horaFin: '17:00' };

describe('las fechas del grupo', () => {
  it('el fin no puede caer antes que el inicio', async () => {
    const { servicio, escrito } = armar();

    await expect(
      servicio.actualizarGrupo(
        'gru-1',
        { fechaInicio: '2026-09-10', fechaFin: '2026-09-01' },
        AMBITO,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(escrito.data).toBeUndefined();
  });
});

describe('las sesiones del grupo', () => {
  /// LO QUE PIDIO EL CLIENTE: la presencial no lleva dia, porque
  /// el grupo ya dice cuando es.
  it('una presencial sin dia se guarda', async () => {
    const { servicio, escrito } = armar();

    await servicio.actualizarGrupo('gru-1', { sesiones: [PRESENCIAL] }, AMBITO);

    expect(escrito.data).toMatchObject({
      sesiones: {
        deleteMany: {},
        create: [{ orden: 1, tipo: 'PRESENCIAL', dia: null, horaInicio: '08:00' }],
      },
    });
  });

  /// EL BOOTCAMP (AF6): dos sesiones, cada una con su dia.
  it('dos sesiones se guardan en orden', async () => {
    const { servicio, escrito } = armar();

    await servicio.actualizarGrupo(
      'gru-1',
      {
        sesiones: [
          { tipo: 'PRESENCIAL', dia: '2026-09-10', horaInicio: '08:00', horaFin: '12:00' },
          { tipo: 'PRESENCIAL', dia: '2026-09-11', horaInicio: '14:00', horaFin: '18:00' },
        ],
      },
      AMBITO,
    );

    const create = (escrito.data as { sesiones: { create: Array<{ orden: number }> } })
      .sesiones.create;
    expect(create.map((c) => c.orden)).toEqual([1, 2]);
  });

  /// LA HIBRIDA (AF7): una presencial con dia, y la PAT sin el.
  it('la PAT convive con la presencial', async () => {
    const { servicio, escrito } = armar();

    await servicio.actualizarGrupo(
      'gru-1',
      {
        sesiones: [
          { tipo: 'PRESENCIAL', dia: '2026-09-10', horaInicio: '08:00', horaFin: '17:00' },
          { tipo: 'PAT', horaInicio: '18:00', horaFin: '20:00' },
        ],
      },
      AMBITO,
    );

    expect(escrito.data).toBeDefined();
  });

  /// EL FORO HIBRIDO: un solo dia, unos en la sede y otros
  /// conectados desde su departamento. Se prohibia el dia a la
  /// PAT pensando solo en el curso largo, y con eso AF7 no se
  /// podia describir.
  it('una PAT CON día se guarda: es un foro, no un curso', async () => {
    const { servicio, escrito } = armar();

    await servicio.actualizarGrupo(
      'gru-1',
      {
        sesiones: [
          { tipo: 'PRESENCIAL', dia: '2026-09-10', horaInicio: '10:00', horaFin: '12:00', ubicacionId: 'ubi-medellin' },
          { tipo: 'PAT', dia: '2026-09-10', horaInicio: '10:00', horaFin: '12:00', ubicacionId: 'ubi-huila' },
        ],
      },
      AMBITO,
    );

    const create = (escrito.data as { sesiones: { create: Array<{ dia: Date | null }> } })
      .sesiones.create;
    expect(create).toHaveLength(2);
    expect(create.map((c) => c.dia)).not.toContain(null);
  });

  it('y una PAT sin día sigue valiendo: es el curso largo', async () => {
    const { servicio, escrito } = armar();

    await servicio.actualizarGrupo(
      'gru-1',
      { sesiones: [{ tipo: 'PAT', horaInicio: '18:00', horaFin: '20:00' }] },
      AMBITO,
    );

    expect(escrito.data).toMatchObject({ sesiones: { create: [{ dia: null }] } });
  });

  it('un dia fuera de las fechas del grupo se rechaza, y dice cual', async () => {
    const { servicio, escrito } = armar();

    await expect(
      servicio.actualizarGrupo(
        'gru-1',
        {
          sesiones: [
            PRESENCIAL,
            { tipo: 'SINCRONICA', dia: '2026-10-05', horaInicio: '18:00', horaFin: '20:00' },
          ],
        },
        AMBITO,
      ),
    ).rejects.toThrow(/Sesión 2/);
    expect(escrito.data).toBeUndefined();
  });

  it('el fin antes que el inicio se rechaza', async () => {
    const { servicio } = armar();

    await expect(
      servicio.actualizarGrupo(
        'gru-1',
        { sesiones: [{ tipo: 'PRESENCIAL', horaInicio: '18:00', horaFin: '09:00' }] },
        AMBITO,
      ),
    ).rejects.toThrow(/posterior a la de inicio/);
  });

  /// EL CASO QUE NADIE MIRA: la sesion estaba bien y el grupo se
  /// mueve por debajo.
  it('mover el grupo dejando fuera una sesion que se manda se detiene', async () => {
    const { servicio, escrito } = armar();

    await expect(
      servicio.actualizarGrupo(
        'gru-1',
        {
          fechaInicio: '2026-09-20',
          sesiones: [{ tipo: 'SINCRONICA', dia: '2026-09-05', horaInicio: '08:00', horaFin: '12:00' }],
        },
        AMBITO,
      ),
    ).rejects.toThrow(/dentro de las fechas del grupo/);
    expect(escrito.data).toBeUndefined();
  });

  /// `undefined` es «no las toques»; la lista vacia SI las borra.
  it('no mandarlas no las toca', async () => {
    const { servicio, escrito } = armar();

    await servicio.actualizarGrupo('gru-1', { dias: 'lunes a viernes' }, AMBITO);

    expect(escrito.data).not.toHaveProperty('sesiones');
  });

  /// UN FORO HIBRIDO se dicta en UNA sede, aunque la accion
  /// alcance seis departamentos.
  it('el lugar tiene que ser de los que cubre el grupo', async () => {
    const { servicio, escrito } = armar();

    await expect(
      servicio.actualizarGrupo(
        'gru-1',
        { sesiones: [{ ...PRESENCIAL, ubicacionId: 'ubi-de-otro-grupo' }] },
        AMBITO,
      ),
    ).rejects.toThrow(/no es de los que cubre el grupo/);
    expect(escrito.data).toBeUndefined();
  });

  it('y uno de los suyos se guarda', async () => {
    const { servicio, escrito } = armar();

    await servicio.actualizarGrupo(
      'gru-1',
      { sesiones: [{ ...PRESENCIAL, ubicacionId: 'ubi-medellin' }] },
      AMBITO,
    );

    expect(escrito.data).toMatchObject({
      sesiones: { create: [{ ubicacionId: 'ubi-medellin' }] },
    });
  });

  /// EL BOOTCAMP otra vez: dos presenciales sin fecha se leen
  /// identicas. Ahora la presencial SI puede llevar dia.
  it('dos presenciales con su dia cada una', async () => {
    const { servicio, escrito } = armar();

    await servicio.actualizarGrupo(
      'gru-1',
      {
        sesiones: [
          { tipo: 'PRESENCIAL', dia: '2026-09-09', horaInicio: '08:00', horaFin: '17:00' },
          { tipo: 'PRESENCIAL', dia: '2026-09-10', horaInicio: '08:00', horaFin: '17:00' },
        ],
      },
      AMBITO,
    );

    const create = (escrito.data as { sesiones: { create: Array<{ dia: Date | null }> } })
      .sesiones.create;
    expect(create.map((c) => c.dia)).not.toContain(null);
  });

  it('una lista vacía las borra todas', async () => {
    const { servicio, escrito } = armar();

    await servicio.actualizarGrupo('gru-1', { sesiones: [] }, AMBITO);

    expect(escrito.data).toMatchObject({ sesiones: { deleteMany: {}, create: [] } });
  });
});
