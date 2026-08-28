/** Lo que hace el webhook con lo que le llega. */

/**
 * Un webhook tiene tres cosas que no puede fallar: no dejar
 * entrar a quien no tiene llave, no duplicar cuando le
 * reintentan, y no perder lo que le mandan aunque venga a
 * medias. Este spec recorre las tres.
 */

import { BadRequestException } from '@nestjs/common';

import { LeadsService } from './leads.service';

const ADECOPRIA = { id: 'c-ade', slug: 'adecopria' };

function armar(existente: unknown = null) {
  const creados: Array<Record<string, unknown>> = [];

  const prisma = {
    convenio: {
      findFirst: ({ where }: { where: { slug?: string; activo?: boolean } }) =>
        Promise.resolve(where.slug === 'adecopria' ? ADECOPRIA : null),
    },
    leadEntrante: {
      findUnique: () => Promise.resolve(existente),
      create: ({
        data,
        select,
      }: {
        data: Record<string, unknown>;
        select: unknown;
      }) => {
        creados.push(data);
        void select;
        return Promise.resolve({
          id: 'l1',
          estado: 'PENDIENTE',
          participanteId: null,
          motivo: data.motivo ?? null,
        });
      },
    },
  };

  const s = new LeadsService(
    prisma as never,
    {
      encolarSiHaceFalta: () => Promise.resolve(),
    } as never,
  );

  return { s, creados };
}

const BASE = {
  convenio: 'adecopria',
  externoId: 'meta-9911',
  nombreCompleto: 'Ana Jaramillo',
  celular: '3001234567',
};

describe('el gremio va explícito y no se adivina', () => {
  it('un convenio que no existe se rechaza', async () => {
    /// Adivinarlo mal mete a alguien de ADECOPRIA en BRITCHAM,
    /// que es peor que perder el lead.
    const { s, creados } = armar();

    await expect(
      s.entra({ ...BASE, convenio: 'lo-que-sea' }, 'orquestador'),
    ).rejects.toThrow(BadRequestException);
    expect(creados).toEqual([]);
  });

  it('el bueno entra y queda atado a su convenio', async () => {
    const { s, creados } = armar();
    await s.entra(BASE, 'orquestador');
    expect(creados[0].convenioId).toBe('c-ade');
  });
});

describe('un reintento NO duplica', () => {
  it('el mismo externoId devuelve el de antes y no crea otro', async () => {
    /// Los webhooks reintentan y quien los manda ni lo ve. Sin
    /// esto, un parpadeo de red duplica a una persona.
    const { s, creados } = armar({
      id: 'l-viejo',
      estado: 'CONVERTIDO',
      participanteId: 'p1',
      motivo: null,
    });

    const r = await s.entra(BASE, 'orquestador');

    expect(r.repetido).toBe(true);
    expect(r.id).toBe('l-viejo');
    expect(creados).toEqual([]);
  });
});

describe('lo que llega se guarda aunque venga a medias', () => {
  it('sin documento entra, y dice que le falta', async () => {
    /// Contestar 400 porque falta la cédula invita a que quien
    /// lo manda lo reintente en bucle o lo descarte.
    const { s, creados } = armar();
    const r = await s.entra(BASE, 'orquestador');

    expect(creados).toHaveLength(1);
    expect(r.motivo).toMatch(/documento/i);
  });

  it('sin forma de contacto, lo dice', async () => {
    const { s } = armar();
    const r = await s.entra(
      { convenio: 'adecopria', externoId: 'x', nombreCompleto: 'Ana' },
      'orquestador',
    );
    expect(r.motivo).toMatch(/correo o celular/i);
  });

  it('con todo bueno, no falta nada', async () => {
    const { s } = armar();
    const r = await s.entra(
      {
        ...BASE,
        tipoDocumentoSepId: 1,
        numeroDocumento: '1019456782',
        correo: 'ana@ejemplo.test',
      },
      'orquestador',
    );
    expect(r.motivo).toBeNull();
  });

  it('un documento con letras en una cédula se dice como INVÁLIDO', async () => {
    /// Distinto de «falta»: aquí sí mandaron algo, y lo que hay
    /// que hacer es corregir el origen, no volver a pedirlo.
    const { s } = armar();
    const r = await s.entra(
      { ...BASE, tipoDocumentoSepId: 1, numeroDocumento: 'ABCD1234' },
      'orquestador',
    );
    expect(r.motivo).toMatch(/formato válido/i);
  });

  it('un documento demasiado corto también, y no como «falta»', async () => {
    /// `normalizarDocumento` lo anula por corto; sin distinguir,
    /// el asesor leería «falta documento» y volvería a pedir uno
    /// que la persona ya dio.
    const { s } = armar();
    const r = await s.entra(
      { ...BASE, tipoDocumentoSepId: 1, numeroDocumento: 'ABC' },
      'orquestador',
    );
    expect(r.motivo).toMatch(/formato válido/i);
  });
});

describe('se normaliza AL ENTRAR, no después', () => {
  it('el celular pierde el indicativo', async () => {
    /// Si se guarda como viene y se limpia después, la misma
    /// persona escrita de dos formas son dos leads que nadie
    /// relaciona.
    const { s, creados } = armar();
    await s.entra({ ...BASE, celular: '+57 300 123 4567' }, 'orquestador');
    expect(creados[0].celular).toBe('3001234567');
  });

  it('un «no tiene» NO se guarda como celular', async () => {
    const { s, creados } = armar();
    await s.entra({ ...BASE, celular: 'no tiene' }, 'orquestador');
    expect(creados[0].celular).toBeNull();
  });

  it('el correo se guarda en minúsculas', async () => {
    const { s, creados } = armar();
    await s.entra({ ...BASE, correo: '  ANA@Ejemplo.TEST ' }, 'orquestador');
    expect(creados[0].correo).toBe('ana@ejemplo.test');
  });
});

describe('el cuerpo original se guarda entero', () => {
  it('para poder depurar, reprocesar y demostrar qué llegó', async () => {
    const { s, creados } = armar();
    const carga = { campo_raro_de_meta: 42, form_id: 'abc' };
    await s.entra({ ...BASE, carga }, 'orquestador');
    expect(creados[0].carga).toEqual(carga);
  });

  it('si no viene aparte, se guarda lo que llegó', async () => {
    const { s, creados } = armar();
    await s.entra(BASE, 'orquestador');
    expect(creados[0].carga).toMatchObject({ externoId: 'meta-9911' });
  });
});
