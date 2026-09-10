/** La regla de contacto vive en el SERVIDOR, no en el botón. */

/**
 * Un control que solo está en el navegador no es un control: esta
 * ruta se llama directo. Y lo que se comprueba aquí no es el
 * código de respuesta —eso puede cambiar— sino que **NO SE
 * ESCRIBIÓ NADA**. Es el mismo criterio de `fuera-del-ambito.spec`
 * y de `logos-fuera-del-ambito.spec`: la aserción que no depende
 * de qué conteste cada ruta.
 *
 * El doble de Prisma APLICA EL ÁMBITO DE VERDAD. Uno que
 * devolviera siempre el lead probaría el doble, no el candado — el
 * error que este proyecto ya cometió con el que decidía por el
 * prefijo del id.
 */

import { GestionDelLead } from './gestion-del-lead.service';

const NOTA = {
  texto: 'Se le llamó y quedó de mandar la cédula.',
  canales: ['LLAMADA'],
  resultado: 'CONTACTO',
};

const ADMIN = { id: 'a1', nombre: 'Ana Jaramillo' };

function armar(o: {
  lead?: Record<string, unknown> | null;
  revoco?: boolean;
} = {}) {
  const escrito: string[] = [];

  const tx = {
    notaDeGestion: {
      create: (a: { data: Record<string, unknown> }) => {
        escrito.push('nota.create');
        return Promise.resolve({ id: 'n1', creadoEn: new Date('2026-09-02'), ...a.data });
      },
    },
    leadEntrante: {
      update: () => {
        escrito.push('lead.ultimaGestion');
        return Promise.resolve({});
      },
    },
  };

  const prisma = {
    leadEntrante: {
      findFirst: (a: { where: { convenioId?: { in: string[] } } }) => {
        /// EL ÁMBITO DE VERDAD: fuera de él, la fila no existe.
        if (a.where.convenioId && !a.where.convenioId.in.includes('c1')) {
          return Promise.resolve(null);
        }
        if (o.lead === null) return Promise.resolve(null);
        return Promise.resolve({
          id: 'l1',
          estado: 'PENDIENTE',
          participanteId: null,
          tipoDocumentoSepId: null,
          numeroDocumento: null,
          correo: 'ana@ejemplo.test',
          celular: '3001112222',
          ...(o.lead ?? {}),
        });
      },
      updateMany: () => {
        escrito.push('lead.updateMany');
        return Promise.resolve({ count: 1 });
      },
    },
    adminConvenio: {
      findMany: () => Promise.resolve([{ convenioId: 'c1' }]),
    },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };

  const auditoria = { registrar: () => Promise.resolve() };
  const seParece = { revoco: () => Promise.resolve(o.revoco ?? false) };

  const s = new GestionDelLead(
    prisma as never,
    auditoria as never,
    seParece as never,
  );
  return { s, escrito };
}

async function nota(o: Parameters<typeof armar>[0] = {}, ambito = ['c1']) {
  const { s, escrito } = armar(o);
  try {
    await s.agregarNota('l1', NOTA as never, ADMIN, ambito);
    return { ok: true, escrito, mensaje: '' };
  } catch (e) {
    return { ok: false, escrito, mensaje: (e as Error).message };
  }
}

describe('el camino bueno', () => {
  it('se puede dejar la nota, y se marca la última gestión', async () => {
    /// El aserto que protege del arreglo excesivo: si alguien
    /// «endurece» esto exigiendo autorización para llamar, este
    /// test cae y le obliga a mirar por qué.
    const r = await nota();
    expect(r.ok).toBe(true);
    expect(r.escrito).toContain('nota.create');
    expect(r.escrito).toContain('lead.ultimaGestion');
  });
});

describe('quien revocó: no se escribe NADA', () => {
  it('la nota se rechaza y la base no se toca', async () => {
    const r = await nota({ revoco: true });
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/revocó/i);
    /// Lo que de verdad importa.
    expect(r.escrito).toEqual([]);
  });
});

describe('lo que ya salió de la mesa: no se escribe NADA', () => {
  it('un lead ya convertido no admite notas aquí', async () => {
    const r = await nota({ lead: { participanteId: 'p1' } });
    expect(r.ok).toBe(false);
    expect(r.escrito).toEqual([]);
  });

  it('ni uno descartado', async () => {
    const r = await nota({ lead: { estado: 'DESCARTADO' } });
    expect(r.ok).toBe(false);
    expect(r.escrito).toEqual([]);
  });
});

describe('fuera del ámbito: ni existe ni se escribe', () => {
  it('con el gremio ajeno da 404 y no toca nada', async () => {
    const r = await nota({}, ['c2']);
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/no existe/i);
    expect(r.escrito).toEqual([]);
  });
});

describe('repartir un lead', () => {
  it('no se le asigna a quien no lo podría ver', async () => {
    /// Sin esto, un lead queda con dueño y sin nadie que lo vea, y
    /// la cola lo cuenta como atendido. Mismo defecto que ya se
    /// cerró al repartir fichas.
    const { s, escrito } = armar();
    const prisma = (s as unknown as { prisma: { adminConvenio: { findMany: () => Promise<unknown[]> } } }).prisma;
    prisma.adminConvenio.findMany = () => Promise.resolve([]);

    await expect(s.asignar(['l1'], 'otro', ADMIN, ['c1'])).rejects.toThrow(
      /no tiene permisos/i,
    );
    expect(escrito).toEqual([]);
  });
});
