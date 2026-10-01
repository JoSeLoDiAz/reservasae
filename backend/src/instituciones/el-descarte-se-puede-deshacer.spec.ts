/** Un descarte de la bandeja tiene que poder deshacerse. */

/**
 * POR QUÉ ESTE FICHERO (repaso de QA, 30 sep 2026).
 *
 * `la-bandeja-por-revisar-se-vacia.spec.ts` vigila que lo descartado
 * NO vuelva a proponerse, que es el arreglo de fondo de la bandeja.
 * Este vigila la otra mitad, que faltaba: que ese olvido se pueda
 * DESHACER. Sin él, descartar por error el teléfono bueno de una
 * organización lo dejaba fuera para siempre y nadie podía
 * recuperarlo, que choca con la regla de la casa ---nada se pierde
 * sin vuelta atrás---.
 *
 * Las tres cosas que se comprueban son las tres que tienen que ser
 * verdad para que el deshacer sirva de algo:
 *
 *  1. Que los descartes de una organización SE VEAN en su ficha.
 *  2. Que deshacer uno quite ESE y no los demás, y deje escrito
 *     quién lo hizo.
 *  3. Que después de deshacerlo el campo VUELVA a proponerse, que es
 *     lo único que de verdad le importa a quien lo deshace.
 */

import { NotFoundException } from '@nestjs/common';

import { AuditoriaService } from '../comun/auditoria.service';
import { InstitucionesService } from './instituciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { cargarDescartes } from './web/descartes';
import { fichaAPropuesta } from './web/ficha-a-propuesta';
import { leerFichaWeb } from './web/leer-ficha-web';

const FICHA = 'institucion-abc';
const ANA = { id: 'admin-ana', nombre: 'Ana Jaramillo' };

type FilaDescarte = {
  id: string;
  institucionId: string;
  campo: string;
  valor: string;
  valorMostrado: string;
  fuente: string;
  creadoEn: Date;
  descartadoPor: { nombre: string } | null;
};

/// Tres descartes, dos de esta organización y uno de la de al lado.
/// Tres y no uno porque lo que hay que comprobar es que deshacer uno
/// NO se lleva los otros: con una sola fila, un borrado sin `where`
/// pasaría la prueba.
function filas(): FilaDescarte[] {
  return [
    {
      id: 'd1',
      institucionId: FICHA,
      campo: 'telefono',
      valor: '(601) 518-6600',
      valorMostrado: '(601) 518-6600',
      fuente: 'WEB',
      creadoEn: new Date('2026-09-20T10:00:00Z'),
      descartadoPor: { nombre: 'Lucía Parra' },
    },
    {
      id: 'd2',
      institucionId: FICHA,
      campo: 'direccion',
      valor: 'calle 24 # 27a-56',
      valorMostrado: 'Calle 24 # 27A-56',
      fuente: 'WEB',
      creadoEn: new Date('2026-09-21T10:00:00Z'),
      /// Sin autor a propósito: la cuenta que lo descartó se pudo dar
      /// de baja y la fila se queda. La pantalla tiene que poder
      /// pintar esta fila igual.
      descartadoPor: null,
    },
    {
      id: 'd3',
      institucionId: 'otra-institucion',
      campo: 'telefono',
      valor: '(601) 518-6600',
      valorMostrado: '(601) 518-6600',
      fuente: 'RUES',
      creadoEn: new Date('2026-09-22T10:00:00Z'),
      descartadoPor: { nombre: 'Ana Jaramillo' },
    },
  ];
}

/// El Prisma de mentira. Guarda los descartes en una lista y apunta
/// lo que se audita, que son las dos cosas que hay que mirar.
function armar(descartes = filas()) {
  const auditado: Array<Record<string, unknown>> = [];

  const prisma = {
    institucion: {
      findUnique: () =>
        Promise.resolve({
          id: FICHA,
          nit: '900123456',
          razonSocial: 'ABC LABORATORIOS S.A.S',
          fuentePorCampo: {},
          verificadaPor: null,
          empresas: [],
          propuestas: [],
          consultas: [],
          /// El servidor ya los devuelve ordenados y con el autor
          /// dentro: la pantalla no vuelve a pedirlos.
          descartes: descartes
            .filter((d) => d.institucionId === FICHA)
            .map((d) => ({
              id: d.id,
              campo: d.campo,
              valorMostrado: d.valorMostrado,
              fuente: d.fuente,
              creadoEn: d.creadoEn,
              descartadoPor: d.descartadoPor,
            })),
        }),
    },
    descarteDeCampo: {
      findUnique: ({ where }: { where: { id: string } }) => {
        const d = descartes.find((x) => x.id === where.id);
        return Promise.resolve(
          d
            ? {
                id: d.id,
                campo: d.campo,
                valorMostrado: d.valorMostrado,
                institucion: { id: d.institucionId, nit: '900123456' },
              }
            : null,
        );
      },
      delete: ({ where }: { where: { id: string } }) => {
        const i = descartes.findIndex((x) => x.id === where.id);
        if (i < 0) return Promise.reject(new Error('esa fila ya no está'));
        const [fuera] = descartes.splice(i, 1);
        return Promise.resolve(fuera);
      },
      findMany: ({ where }: { where: { institucionId: string } }) =>
        Promise.resolve(
          descartes
            .filter((d) => d.institucionId === where.institucionId)
            .map((d) => ({ campo: d.campo, valor: d.valor })),
        ),
    },
  } as unknown as PrismaService;

  const auditoria = {
    registrar: (e: Record<string, unknown>) => {
      auditado.push(e);
      return Promise.resolve();
    },
    historial: () => Promise.resolve([]),
  } as unknown as AuditoriaService;

  return {
    servicio: new InstitucionesService(prisma, auditoria),
    prisma,
    descartes,
    auditado,
  };
}

describe('1 · los descartes de una organización se ven en su ficha', () => {
  it('la ficha los trae con campo, valor, autor y fecha', async () => {
    const { servicio } = armar();

    const ficha = await servicio.ver(FICHA);

    expect(ficha.descartes).toHaveLength(2);
    expect(ficha.descartes[0]).toMatchObject({
      id: 'd1',
      campo: 'telefono',
      /// El valor TAL COMO LLEGÓ: es el que se reconoce. El
      /// normalizado es para comparar y no sale a la pantalla.
      valorMostrado: '(601) 518-6600',
      fuente: 'WEB',
      descartadoPor: { nombre: 'Lucía Parra' },
    });
    expect(ficha.descartes[0].creadoEn).toBeInstanceOf(Date);
  });

  it('solo los de ESA organización, no los de la de al lado', async () => {
    const { servicio } = armar();

    const ficha = await servicio.ver(FICHA);

    /// `d3` es el MISMO campo y el MISMO valor, descartado en otra
    /// organización: si saliera aquí, alguien «desharía» el descarte
    /// de una ficha que no está mirando.
    expect(ficha.descartes.map((d) => d.id)).toEqual(['d1', 'd2']);
  });
});

describe('2 · deshacer uno quita ese y nada más', () => {
  it('se va la fila pedida y las otras dos se quedan', async () => {
    const { servicio, descartes } = armar();

    const r = await servicio.permitirDeNuevo('d1', ANA);

    expect(r).toEqual({
      id: 'd1',
      campo: 'telefono',
      valorMostrado: '(601) 518-6600',
    });
    expect(descartes.map((d) => d.id)).toEqual(['d2', 'd3']);
  });

  it('queda escrito quién lo deshizo, con el campo y el valor', async () => {
    const { servicio, auditado } = armar();

    await servicio.permitirDeNuevo('d1', ANA);

    expect(auditado).toHaveLength(1);
    expect(auditado[0]).toMatchObject({
      actor: ANA,
      accion: 'DESCARTE_REVOCADO',
      entidad: 'institucion',
      entidadId: FICHA,
      camposTocados: ['telefono'],
    });
    /// Con el valor dentro: «se volvió a permitir un teléfono» deja
    /// sin responder la pregunta que se hace, que es CUÁL.
    expect(auditado[0].resumen).toContain('(601) 518-6600');
  });

  it('el que ya no está se dice en español y no se toca nada más', async () => {
    const { servicio, descartes, auditado } = armar();

    /// Dos personas pueden estar mirando la misma ficha: que alguien
    /// se adelante no es un error del servidor.
    await expect(
      servicio.permitirDeNuevo('d-que-no-existe', ANA),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(descartes).toHaveLength(3);
    expect(auditado).toEqual([]);
  });
});

describe('3 · después de deshacerlo, el campo VUELVE a proponerse', () => {
  it('el buscador vuelve a traer el teléfono que se había descartado', async () => {
    const { servicio, prisma } = armar();

    /// La ficha del buscador trae el teléfono y la organización lo
    /// tiene vacío: justo la situación en que se propondría.
    const encontrada = leerFichaWeb(
      'Razón social: ABC LABORATORIOS S.A.S.Teléfono: (601) 518-6600' +
        'Dirección: Calle 24 # 27A-56',
    );

    /// ANTES: el descarte está puesto y el teléfono no se propone.
    const antes = await cargarDescartes(prisma, FICHA);
    expect(
      fichaAPropuesta(encontrada, { telefono: null }, antes).telefono,
    ).toBeUndefined();

    await servicio.permitirDeNuevo('d1', ANA);

    /// DESPUÉS: la misma consulta, con la memoria releída, vuelve a
    /// proponerlo. Es lo único que de verdad le importa a quien pulsa
    /// «Volver a permitirlo».
    const despues = await cargarDescartes(prisma, FICHA);
    expect(
      fichaAPropuesta(encontrada, { telefono: null }, despues).telefono,
    ).toBe('(601) 518-6600');
  });

  it('deshacer el teléfono no revive la dirección, que sigue descartada', async () => {
    const { servicio, prisma } = armar();

    await servicio.permitirDeNuevo('d1', ANA);

    const encontrada = leerFichaWeb(
      'Teléfono: (601) 518-6600Dirección: Calle 24 # 27A-56',
    );
    const memoria = await cargarDescartes(prisma, FICHA);
    const propuesta = fichaAPropuesta(
      encontrada,
      { telefono: null, direccion: null },
      memoria,
    );

    expect(propuesta.telefono).toBe('(601) 518-6600');
    expect(propuesta.direccion).toBeUndefined();
  });
});
