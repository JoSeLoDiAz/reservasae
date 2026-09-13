/** Las fechas de un grupo y su sesion sincronica. */

/**
 * Llama a `actualizarGrupo`, no a un predicado suyo, y esa es toda la
 * razon de que exista. CLAUDE.md ya cuenta como se fallo en esto: los
 * specs probaban las funciones PURAS de la escalera de etapas y las
 * tres salian bien, porque el defecto nunca estuvo en los predicados
 * sino en COMO `cambiarEtapa` los usaba. Ningun spec la llamaba.
 *
 * Aqui las reglas nuevas --las dos horas y el dia de la sesion-- viven
 * dentro del metodo, asi que el metodo es lo que hay que ejercer.
 */

import { BadRequestException } from '@nestjs/common';

import { CronogramaService } from './cronograma.service';

const AMBITO = ['convenio-1'];

const DIA = (t: string) => new Date(`${t}T00:00:00.000Z`);

/// Un grupo del 1 al 30 de sept, de 08:00 a 12:00, sin sesion.
function armar(sobre: Record<string, unknown> = {}) {
  const grupo = {
    id: 'gru-1',
    fechaInicio: DIA('2026-09-01'),
    fechaFin: DIA('2026-09-30'),
    horaInicio: '08:00',
    horaFin: '12:00',
    sesionDia: null,
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

describe('las horas del grupo', () => {
  it('una hora de fin sin inicio no llega a la base', async () => {
    const { servicio, escrito } = armar({ horaInicio: null, horaFin: null });

    await expect(
      servicio.actualizarGrupo('gru-1', { horaFin: '20:00' }, AMBITO),
    ).rejects.toThrow(BadRequestException);
    expect(escrito.data).toBeUndefined();
  });

  it('el fin no puede caer antes que el inicio', async () => {
    const { servicio, escrito } = armar();

    await expect(
      servicio.actualizarGrupo('gru-1', { horaInicio: '18:00', horaFin: '09:00' }, AMBITO),
    ).rejects.toThrow(/posterior a la de inicio/);
    expect(escrito.data).toBeUndefined();
  });

  /// Ni iguales: una sesion de cero minutos no es una sesion.
  it('tampoco valen dos horas iguales', async () => {
    const { servicio } = armar();

    await expect(
      servicio.actualizarGrupo('gru-1', { horaInicio: '18:00', horaFin: '18:00' }, AMBITO),
    ).rejects.toThrow(/posterior a la de inicio/);
  });

  /// El fin se juzga contra el inicio QUE QUEDARA, no el guardado.
  it('mover solo el inicio por delante del fin guardado se detiene', async () => {
    const { servicio } = armar();

    await expect(
      servicio.actualizarGrupo('gru-1', { horaInicio: '13:00' }, AMBITO),
    ).rejects.toThrow(/posterior a la de inicio/);
  });

  it('borrar la hora de inicio borrando tambien el fin si pasa', async () => {
    const { servicio, escrito } = armar();

    await servicio.actualizarGrupo('gru-1', { horaInicio: null, horaFin: null }, AMBITO);

    expect(escrito.data).toMatchObject({ horaInicio: null, horaFin: null });
  });
});

describe('el dia de la sesion sincronica', () => {
  it('cae dentro de las fechas del grupo', async () => {
    const { servicio, escrito } = armar();

    await servicio.actualizarGrupo('gru-1', { sesionDia: '2026-09-15' }, AMBITO);

    expect(escrito.data).toMatchObject({ sesionDia: new Date('2026-09-15') });
  });

  it('antes de que empiece el grupo se rechaza', async () => {
    const { servicio, escrito } = armar();

    await expect(
      servicio.actualizarGrupo('gru-1', { sesionDia: '2026-08-31' }, AMBITO),
    ).rejects.toThrow(/dentro de las fechas del grupo/);
    expect(escrito.data).toBeUndefined();
  });

  it('despues de que termine tambien', async () => {
    const { servicio } = armar();

    await expect(
      servicio.actualizarGrupo('gru-1', { sesionDia: '2026-10-01' }, AMBITO),
    ).rejects.toThrow(/dentro de las fechas del grupo/);
  });

  it('sin fechas de grupo no hay donde ponerla', async () => {
    const { servicio } = armar({ fechaInicio: null, fechaFin: null });

    await expect(
      servicio.actualizarGrupo('gru-1', { sesionDia: '2026-09-15' }, AMBITO),
    ).rejects.toThrow(/Ponga primero las fechas del grupo/);
  });

  /// EL CASO QUE NADIE MIRA: la sesion estaba bien y el grupo se
  /// mueve por debajo. Se juzga contra las fechas que QUEDARAN.
  it('mover el grupo dejando fuera una sesion guardada se detiene', async () => {
    const { servicio, escrito } = armar({ sesionDia: DIA('2026-09-05') });

    await expect(
      servicio.actualizarGrupo('gru-1', { fechaInicio: '2026-09-10' }, AMBITO),
    ).rejects.toThrow(/dentro de las fechas del grupo/);
    expect(escrito.data).toBeUndefined();
  });

  it('quitar la sesion siempre se puede', async () => {
    const { servicio, escrito } = armar({ sesionDia: DIA('2026-09-05') });

    await servicio.actualizarGrupo('gru-1', { sesionDia: null }, AMBITO);

    expect(escrito.data).toMatchObject({ sesionDia: null });
  });
});
