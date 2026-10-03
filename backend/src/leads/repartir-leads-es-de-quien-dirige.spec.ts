/** Repartir leads entre asesores lo hace quien dirige, no cualquiera. */

/**
 * EL MISMO AGUJERO QUE YA SE CERRÓ EN FICHAS, ABIERTO EN LA MESA.
 *
 * `POST /admin/leads/asignar-lote` solo exigía `inscripciones ·
 * ESCRIBIR`, que tiene cualquier gestor de inscripciones, y el
 * servicio nunca miraba en qué convenios puede repartir quien llama.
 *
 * Un gestor ES un asesor: los leads suyos los trabaja, no los reparte.
 * Sin este candado podía pasarle sus leads a otra persona o ---con
 * `asesorId: null`--- quitárselos a una compañera entera de un golpe.
 *
 * Lo que lo hace de libro: en ESTE MISMO CONTROLADOR,
 * `POST convertir-lote` ya pasaba `conveniosQueReparten(ambito.roles)`,
 * y el gemelo de fichas `PATCH lote/asesor` también. Dos rutas con el
 * candado y la tercera sin él, haciendo lo mismo.
 *
 * Lo tapaba el panel: `puede.repartirFichas` llega en `false` y la
 * tarjeta de «Asesor» no se pinta. El candado vivía en la pantalla, que
 * es justo lo que `permisos.ts` dice haber dejado de hacer.
 */

import { ForbiddenException } from '@nestjs/common';

import { GestionDelLead } from './gestion-del-lead.service';

const ADMIN = { id: 'adm-1', nombre: 'Quien llama' } as never;

/// Dos leads de ADECOPRIA, que es donde esta cuenta NO reparte.
function armar() {
  const actualizados: unknown[] = [];
  const prisma = {
    leadEntrante: {
      findMany: () =>
        Promise.resolve([
          { convenioId: 'conv-adecopria' },
          { convenioId: 'conv-adecopria' },
        ]),
      updateMany: (args: unknown) => {
        actualizados.push(args);
        return Promise.resolve({ count: 2 });
      },
    },
    adminConvenio: {
      findMany: () => Promise.resolve([{ convenioId: 'conv-adecopria' }]),
    },
  };
  const servicio = new GestionDelLead(
    prisma as never,
    { registrar: () => Promise.resolve() } as never,
    {} as never,
    {} as never,
  );
  return { servicio, actualizados };
}

describe('quién puede repartir', () => {
  /**
   * EL CASO QUE SE COLABA: un gestor repartiendo el trabajo del
   * equipo. No reparte en ningún convenio, así que la lista va vacía.
   */
  it('un gestor que no reparte en ese gremio no puede', async () => {
    const { servicio, actualizados } = armar();
    await expect(
      servicio.asignar(
        ['l-1', 'l-2'],
        'otro-asesor',
        ADMIN,
        ['conv-adecopria'],
        undefined,
        [],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    /// Y no escribe nada: el candado va ANTES del `updateMany`.
    expect(actualizados).toEqual([]);
  });

  /**
   * NI SIQUIERA PARA DEJARLOS SIN DUEÑO, que es la forma de hacer
   * daño que no parece daño: `asesorId: null` sobre el lote de otra
   * persona le vacía la cola entera.
   */
  it('tampoco para quitarles el dueño', async () => {
    const { servicio, actualizados } = armar();
    await expect(
      servicio.asignar(
        ['l-1', 'l-2'],
        null,
        ADMIN,
        ['conv-adecopria'],
        undefined,
        [],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(actualizados).toEqual([]);
  });

  it('quien sí reparte en ese gremio, puede', async () => {
    const { servicio, actualizados } = armar();
    await servicio.asignar(
      ['l-1', 'l-2'],
      'otro-asesor',
      ADMIN,
      ['conv-adecopria'],
      undefined,
      ['conv-adecopria'],
    );
    expect(actualizados).toHaveLength(1);
  });

  /**
   * Y BASTA CON QUE UNO DEL LOTE SEA AJENO. Un lote puede mezclar los
   * dos gremios; si se comprobara «alguno vale», repartir uno propio
   * serviría de llave para los ajenos que fueran dentro.
   */
  it('si el lote mezcla gremios, manda el que no reparte', async () => {
    const actualizados: unknown[] = [];
    const prisma = {
      leadEntrante: {
        findMany: () =>
          Promise.resolve([
            { convenioId: 'conv-adecopria' },
            { convenioId: 'conv-britcham' },
          ]),
        updateMany: (a: unknown) => {
          actualizados.push(a);
          return Promise.resolve({ count: 2 });
        },
      },
      adminConvenio: {
        findMany: () => Promise.resolve([{ convenioId: 'conv-adecopria' }]),
      },
    };
    const servicio = new GestionDelLead(
      prisma as never,
      { registrar: () => Promise.resolve() } as never,
      {} as never,
      {} as never,
    );
    await expect(
      servicio.asignar(
        ['l-1', 'l-2'],
        'otro',
        ADMIN,
        ['conv-adecopria', 'conv-britcham'],
        undefined,
        ['conv-adecopria'],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(actualizados).toEqual([]);
  });
});

/**
 * Y LA RUTA LO PASA, que es la mitad que falta: el servicio puede
 * tener el mejor candado del mundo y quedarse sin llave si el
 * controlador no se la da. Es exactamente como quedó esta ruta
 * mientras sus dos hermanas sí la pasaban.
 */
describe('el controlador le da la llave al servicio', () => {
  it('asignar-lote pasa los convenios donde reparte', () => {
    const t = require('fs').readFileSync(
      require('path').join(__dirname, 'mesa-de-entrada.controller.ts'),
      'utf8',
    ) as string;
    const i = t.indexOf('asignarLote(');
    expect(i).toBeGreaterThan(-1);
    const cuerpo = t.slice(i, t.indexOf('\n  }', i));
    expect(cuerpo).toContain('conveniosQueReparten(ambito.roles)');
  });
});
