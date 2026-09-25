/** Quién lleva un grupo: asignarlo, soltarlo y a quién se puede. */

/**
 * La columna `asesorAcademicoId` existía en la base y la leía
 * «Seguimiento de asesores», pero NADA la escribía: ni el backend ni
 * el panel. Lo vio José al integrar (25 sep 2026) --«cero escritores»--
 * y en producción eran 120 grupos y 0 asignados, así que esa pestaña
 * llevaba meses enseñando una sola fila, «Sin asesor asignado», con
 * todo el mundo dentro.
 *
 * Aquí se prueba la puerta que faltaba, y sobre todo lo que la hace
 * segura: que el asesor se comprueba contra EL GREMIO DEL GRUPO y no
 * contra el ámbito de quien edita. Son dos cosas distintas y confundirlas
 * deja a alguien de BRITCHAM llevando un grupo de ADECOPRIA al que no
 * puede ni entrar.
 */

import { BadRequestException } from '@nestjs/common';

import { CronogramaService } from './cronograma.service';

const AMBITO = ['convenio-1', 'convenio-2'];

/**
 * @param puede  lo que contesta `adminConvenio.findFirst`: la cuenta
 *               cuando sí puede llevar el grupo, `null` cuando no.
 */
function armar(puede: { adminId: string } | null) {
  const escrito: Record<string, unknown> = {};
  const preguntado: Record<string, unknown>[] = [];

  const prisma = {
    grupo: {
      findFirst: () =>
        Promise.resolve({
          id: 'gru-1',
          fechaInicio: new Date('2026-09-01T00:00:00.000Z'),
          fechaFin: new Date('2026-09-30T00:00:00.000Z'),
          accionFormacion: { convenioId: 'convenio-1' },
          coberturas: [{ ubicacionId: 'ubi-medellin' }],
        }),
      update: ({ data }: { data: Record<string, unknown> }) => {
        escrito.data = data;
        return Promise.resolve(data);
      },
    },
    adminConvenio: {
      findFirst: ({ where }: { where: Record<string, unknown> }) => {
        preguntado.push(where);
        return Promise.resolve(puede);
      },
    },
  };

  return {
    servicio: new CronogramaService(prisma as never),
    escrito,
    preguntado,
  };
}

describe('el asesor académico de un grupo', () => {
  it('se asigna cuando la cuenta puede llevarlo', async () => {
    const { servicio, escrito } = armar({ adminId: 'marta' });

    await servicio.actualizarGrupo(
      'gru-1',
      { asesorAcademicoId: 'marta' },
      AMBITO,
    );

    expect(escrito.data).toMatchObject({ asesorAcademicoId: 'marta' });
  });

  /// LO IMPORTANTE: contra el gremio DEL GRUPO.
  it('se comprueba contra el gremio del grupo, no contra el de quien edita', async () => {
    const { servicio, preguntado } = armar({ adminId: 'marta' });

    await servicio.actualizarGrupo(
      'gru-1',
      { asesorAcademicoId: 'marta' },
      AMBITO,
    );

    expect(preguntado[0]).toMatchObject({
      adminId: 'marta',
      convenioId: 'convenio-1',
      admin: { activo: true },
    });
  });

  /// COUNTRY_MANAGER ve lo académico pero no escribe en ello: dirige,
  /// no lleva grupos. Si alguien lo añade a la lista sin pensarlo, esta
  /// prueba lo dice.
  it('solo ofrece los roles que escriben en académico', async () => {
    const { servicio, preguntado } = armar({ adminId: 'marta' });

    await servicio.actualizarGrupo(
      'gru-1',
      { asesorAcademicoId: 'marta' },
      AMBITO,
    );

    expect(preguntado[0].rol).toEqual({
      in: ['GESTOR_ACADEMICO', 'LIDER_ACADEMICO', 'LIDER_SISTEMAS'],
    });
  });

  it('no deja asignar a quien no es de ese gremio ni tiene el permiso', async () => {
    const { servicio, escrito } = armar(null);

    await expect(
      servicio.actualizarGrupo('gru-1', { asesorAcademicoId: 'ajeno' }, AMBITO),
    ).rejects.toThrow(BadRequestException);
    /// Y no se guarda NADA: ni las fechas que vinieran en el mismo envío.
    expect(escrito.data).toBeUndefined();
  });

  /// Soltar el grupo no es asignar: no hay a quién comprobar.
  it('un nulo lo suelta sin preguntar por nadie', async () => {
    const { servicio, escrito, preguntado } = armar(null);

    await servicio.actualizarGrupo(
      'gru-1',
      { asesorAcademicoId: null },
      AMBITO,
    );

    expect(escrito.data).toMatchObject({ asesorAcademicoId: null });
    expect(preguntado).toHaveLength(0);
  });

  /// La ficha de fechas y la de cupos mandan lo suyo y nada más:
  /// si esto no fuera `undefined`, editar una fecha borraría al asesor.
  it('no mandarlo deja al que ya lo llevaba', async () => {
    const { servicio, escrito } = armar(null);

    await servicio.actualizarGrupo(
      'gru-1',
      { fechaInicio: '2026-09-02' },
      AMBITO,
    );

    expect(
      (escrito.data as Record<string, unknown>).asesorAcademicoId,
    ).toBeUndefined();
  });
});

describe('a quién se le puede asignar', () => {
  /// La tabla trae una fila por rol Y por gremio, así que la misma
  /// persona llega tres veces. En un desplegable eso son tres opciones
  /// iguales que no se distinguen.
  it('funde a la misma persona en una fila con sus gremios', async () => {
    const prisma = {
      adminConvenio: {
        findMany: () =>
          Promise.resolve([
            {
              convenioId: 'convenio-1',
              admin: { id: 'marta', nombre: 'Marta Oquendo' },
            },
            {
              convenioId: 'convenio-2',
              admin: { id: 'marta', nombre: 'Marta Oquendo' },
            },
            {
              convenioId: 'convenio-1',
              admin: { id: 'hector', nombre: 'Héctor Ramos' },
            },
          ]),
      },
    };
    const servicio = new CronogramaService(prisma as never);

    await expect(servicio.asesoresPosibles(AMBITO)).resolves.toEqual([
      {
        id: 'marta',
        nombre: 'Marta Oquendo',
        convenios: ['convenio-1', 'convenio-2'],
      },
      { id: 'hector', nombre: 'Héctor Ramos', convenios: ['convenio-1'] },
    ]);
  });

  it('sin ámbito no ofrece a nadie', async () => {
    const prisma = { adminConvenio: { findMany: () => Promise.resolve([]) } };
    const servicio = new CronogramaService(prisma as never);

    await expect(servicio.asesoresPosibles([])).resolves.toEqual([]);
  });
});
