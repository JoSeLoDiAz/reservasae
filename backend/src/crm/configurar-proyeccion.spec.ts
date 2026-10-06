/** Configurar la proyección de metas de una acción, con sus candados. */

/**
 * Lo que este spec protege: que solo se toque una acción DEL ÁMBITO,
 * que el # de asesores sea razonable, y que quede el REGISTRO DE
 * CAMBIOS que pidió Catalina --con el antes y el después--.
 *
 * El doble de Prisma aplica el filtro de ámbito de verdad: uno que
 * devolviera siempre la acción dejaría fijar la meta de otro gremio.
 */

import { CrmService } from './crm.service';

type AccionFalsa = {
  id: string;
  convenioId: string;
  proyeccionAsesores: number | null;
  proyeccionDias: number | null;
  proyeccionCierre: Date | null;
};

function armar(acciones: AccionFalsa[]) {
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const auditadas: Array<{
    accion: string;
    resumen?: string;
    camposTocados?: string[];
    entidad?: string;
  }> = [];

  const prisma = {
    accionFormacion: {
      findFirst: (a: {
        where: { id: string; convenioId: { in: string[] } };
      }) => {
        const hit = acciones.find(
          (x) =>
            x.id === a.where.id && a.where.convenioId.in.includes(x.convenioId),
        );
        return Promise.resolve(hit ?? null);
      },
      update: (a: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: a.where.id, data: a.data });
        return Promise.resolve({});
      },
    },
  };

  const auditoria = {
    registrar: (a: {
      accion: string;
      resumen?: string;
      camposTocados?: string[];
      entidad?: string;
    }) => {
      auditadas.push(a);
      return Promise.resolve();
    },
  };

  const s = new CrmService(
    prisma as never,
    auditoria as never,
    {} as never,
    {} as never,
    {} as never,
    { avisar: () => Promise.resolve() } as never,
    /// El catálogo de notas. Devuelve «sin clasificar», que es lo
    /// que anota una pantalla que todavía no ofrece los
    /// desplegables: ninguno de estos tests clasifica nada.
    {
      exigirClasificacion: () =>
        Promise.resolve({ categoriaId: null, subcategoriaId: null }),
    } as never,
  );

  const configurar = (
    id: string,
    cambios: {
      asesores?: number | null;
      dias?: number | null;
      cierre?: string | null;
    },
    convenios: string[],
  ) =>
    (
      s as unknown as {
        configurarProyeccion: (
          id: string,
          cambios: unknown,
          ambito: unknown,
          actor: unknown,
          ip?: string,
        ) => Promise<unknown>;
      }
    ).configurarProyeccion(
      id,
      cambios,
      { convenios } as never,
      { id: 'a-1', nombre: 'Catalina' },
      '1.2.3.4',
    );

  return { configurar, updates, auditadas };
}

const AF: AccionFalsa = {
  id: 'af-adecopria',
  convenioId: 'c-adecopria',
  proyeccionAsesores: 2,
  proyeccionDias: null,
  proyeccionCierre: null,
};

describe('solo se toca una acción del ámbito', () => {
  it('una acción de OTRO gremio no existe: 404 y no escribe', async () => {
    const { configurar, updates } = armar([AF]);
    await expect(
      configurar('af-adecopria', { asesores: 3 }, ['c-britcham']),
    ).rejects.toThrow(/no existe/i);
    expect(updates).toHaveLength(0);
  });
});

describe('el # de asesores tiene que ser real', () => {
  it('cero o menos se rechaza y no escribe', async () => {
    const { configurar, updates } = armar([AF]);
    await expect(
      configurar('af-adecopria', { asesores: 0 }, ['c-adecopria']),
    ).rejects.toThrow(/entero de 1/i);
    expect(updates).toHaveLength(0);
  });

  it('un número disparatado se rechaza', async () => {
    const { configurar } = armar([AF]);
    await expect(
      configurar('af-adecopria', { asesores: 5000 }, ['c-adecopria']),
    ).rejects.toThrow(/no es real/i);
  });
});

describe('el cambio se guarda y queda registrado', () => {
  it('cambiar el # de asesores escribe y audita el antes→después', async () => {
    const { configurar, updates, auditadas } = armar([AF]);
    await configurar('af-adecopria', { asesores: 3 }, ['c-adecopria']);

    expect(updates).toHaveLength(1);
    expect(updates[0].data.proyeccionAsesores).toBe(3);

    const huella = auditadas.find((a) => a.accion === 'PROYECCION_EDITADA');
    expect(huella).toBeDefined();
    expect(huella?.entidad).toBe('accion');
    expect(huella?.camposTocados).toEqual(['asesores']);
    /// Venía de 2, va a 3.
    expect(huella?.resumen).toContain('asesores 2');
    expect(huella?.resumen).toContain('asesores 3');
  });

  it('vaciar el # de asesores (null) lo borra', async () => {
    const { configurar, updates } = armar([AF]);
    await configurar('af-adecopria', { asesores: null }, ['c-adecopria']);
    expect(updates[0].data.proyeccionAsesores).toBeNull();
  });

  it('cambiar solo los días no toca los asesores', async () => {
    const { configurar, updates, auditadas } = armar([AF]);
    await configurar('af-adecopria', { dias: 6 }, ['c-adecopria']);
    expect(updates[0].data).not.toHaveProperty('proyeccionAsesores');
    expect(updates[0].data.proyeccionDias).toBe(6);
    const huella = auditadas.find((a) => a.accion === 'PROYECCION_EDITADA');
    expect(huella?.camposTocados).toEqual(['dias']);
  });

  it('sin ningún cambio, se rechaza', async () => {
    const { configurar, updates } = armar([AF]);
    await expect(
      configurar('af-adecopria', {}, ['c-adecopria']),
    ).rejects.toThrow(/ningún cambio/i);
    expect(updates).toHaveLength(0);
  });
});
