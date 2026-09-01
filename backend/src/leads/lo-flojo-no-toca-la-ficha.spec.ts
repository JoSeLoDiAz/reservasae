/** Una coincidencia floja no escribe NADA en la ficha ajena. */

/**
 * `solo-lo-firme-ata.spec.ts` ya vigila que el lead no quede
 * atado. Este vigila lo otro, que corría con cualquier
 * coincidencia y nadie miraba: los tres escritos que caen sobre
 * la ficha de la otra persona.
 *
 * El daño es el que describe el fichero del cruce: una empresa
 * pone el correo de la secretaria en veinte formularios. Los
 * veinte cruzaban por correo, y a ella se le estampaban veinte
 * toques de pauta, se le fijaba el origen y se le creaba una
 * propuesta de datos con la información de otro. La métrica de
 * coste por inscrito acababa atribuyendo a una sola persona lo
 * que trajeron veinte.
 */

import { Test } from '@nestjs/testing';

import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma/prisma.service';
import { ColaRui } from '../crm/rui/cola-rui';

/// La ficha que YA existe, sobre la que no hay que escribir.
const AJENA = 'participante-de-otra-persona';

function armar(firme: boolean) {
  const escrito: string[] = [];

  const tx = {
    leadEntrante: {
      update: () => {
        escrito.push('lead.update');
        return Promise.resolve({});
      },
    },
    toqueDeOrigen: {
      upsert: () => {
        escrito.push('toqueDeOrigen');
        return Promise.resolve({});
      },
    },
    participante: {
      updateMany: () => {
        escrito.push('participante.origenLead');
        return Promise.resolve({ count: 1 });
      },
    },
    propuestaDeDatos: {
      deleteMany: () => {
        escrito.push('propuesta.deleteMany');
        return Promise.resolve({ count: 0 });
      },
      create: () => {
        escrito.push('propuesta.create');
        return Promise.resolve({});
      },
    },
  };

  const prisma = {
    $transaction: (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    persona: {
      /// La persona de la ficha ajena, con datos DISTINTOS de los
      /// del lead: así `distintos` no sale vacío y el camino de
      /// la propuesta se ejercita de verdad.
      findUnique: () =>
        Promise.resolve({
          id: 'persona-ajena',
          correo: 'secretaria@empresa.com',
          celular: '3000000000',
          primerNombre: 'ANA',
          segundoNombre: null,
          primerApellido: 'GOMEZ',
          segundoApellido: null,
        }),
    },
  };

  return { prisma, escrito, firme };
}

describe('cruce flojo contra una ficha que ya existe', () => {
  it('con coincidencia FLOJA no escribe nada sobre la ficha ajena', async () => {
    const { prisma, escrito } = armar(false);
    const s = new LeadsService(prisma as never, { encolar: () => {} } as never);

    await (s as never as {
      avisarQueYaEstaba: (
        id: string,
        c: unknown,
        d: unknown,
        p: boolean,
      ) => Promise<void>;
    }).avisarQueYaEstaba(
      'lead-1',
      {
        participanteId: AJENA,
        personaId: 'persona-ajena',
        por: 'CORREO',
        firme: false,
      },
      { correo: 'secretaria@empresa.com', primerNombre: 'LUIS' },
      true,
    );

    /// El lead SÍ se marca —queda PENDIENTE con su motivo—, pero
    /// la ficha de Ana no se toca por ningún lado.
    expect(escrito).toEqual(['lead.update']);
    expect(escrito).not.toContain('toqueDeOrigen');
    expect(escrito).not.toContain('participante.origenLead');
    expect(escrito).not.toContain('propuesta.create');
  });

  it('con coincidencia FIRME sí deja el toque, el origen y la propuesta', async () => {
    const { prisma, escrito } = armar(true);
    const s = new LeadsService(prisma as never, { encolar: () => {} } as never);

    await (s as never as {
      avisarQueYaEstaba: (
        id: string,
        c: unknown,
        d: unknown,
        p: boolean,
      ) => Promise<void>;
    }).avisarQueYaEstaba(
      'lead-1',
      {
        participanteId: AJENA,
        personaId: 'persona-ajena',
        por: 'DOCUMENTO',
        firme: true,
      },
      { correo: 'otro@correo.com', primerNombre: 'LUIS' },
      true,
    );

    /// Aquí sí: es la misma persona, y que volviera por una pauta
    /// es justo la métrica que se pidió.
    expect(escrito).toContain('lead.update');
    expect(escrito).toContain('toqueDeOrigen');
    expect(escrito).toContain('participante.origenLead');
    expect(escrito).toContain('propuesta.create');
  });
});
