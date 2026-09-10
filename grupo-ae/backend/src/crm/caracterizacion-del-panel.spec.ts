/** La caracterización, desde el panel, con sus candados. */

/**
 * Son datos SENSIBLES del art. 5 de la Ley 1581 —etnia,
 * discapacidad, condición de víctima, diversidad sexual— y lo que
 * este spec protege no es que se guarden: es CÓMO.
 *
 * Los tres candados, y los tres se probaron por mutación:
 *
 *   1. Sin autorización viva no se guarda ninguna, y se DICE.
 *   2. La autorización es la del convenio de esa ficha, no una
 *      cualquiera de esa persona.
 *   3. Se reescriben en bloque: quitar una marca es tan
 *      significativo como ponerla.
 *
 * El doble de Prisma aplica los filtros de verdad. Uno que
 * devolviera siempre una autorización probaría el doble.
 */

import { CrmService } from './crm.service';

type Autorizacion = { id: string; convenioId: string; revocada: boolean };

function armar(autorizaciones: Autorizacion[]) {
  const borrados: string[] = [];
  const creados: Array<{ personaId: string; caracterizacionSepId: number; autorizacionId: string }> = [];
  const auditadas: string[] = [];

  const tx = {
    caracterizacionPersona: {
      deleteMany: (a: { where: { personaId: string } }) => {
        borrados.push(a.where.personaId);
        return Promise.resolve({ count: 0 });
      },
      createMany: (a: { data: typeof creados }) => {
        creados.push(...a.data);
        return Promise.resolve({ count: a.data.length });
      },
    },
    persona: { update: () => Promise.resolve({}) },
  };

  const prisma = {
    participante: {
      findUnique: () =>
        Promise.resolve({ personaId: 'per-1', convenioId: 'c-adecopria' }),
    },
    autorizacionDatos: {
      /// FILTRA de verdad: por revocada y por convenio.
      findFirst: (a: {
        where: { revocadaEn: null; politica?: { convenioId?: string } };
      }) => {
        const conv = a.where.politica?.convenioId;
        const hay = autorizaciones.filter(
          (x) => !x.revocada && (conv === undefined || x.convenioId === conv),
        );
        return Promise.resolve(hay[0] ? { id: hay[0].id } : null);
      },
    },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };

  const auditoria = {
    registrar: (a: { camposTocados?: string[]; resumen?: string }) => {
      auditadas.push((a.camposTocados ?? []).join(',') + '|' + (a.resumen ?? ''));
      return Promise.resolve();
    },
  };

  const s = new CrmService(
    prisma as never,
    auditoria as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const guardar = (dto: Record<string, unknown>) =>
    (
      s as unknown as {
        guardarCaracterizacion: (
          id: string,
          dto: unknown,
          admin: unknown,
          ip?: string,
        ) => Promise<void>;
      }
    ).guardarCaracterizacion('p-1', dto, { id: 'a-1', nombre: 'Ana' });

  return { guardar, borrados, creados, auditadas };
}

const VIVA_SUYA: Autorizacion[] = [
  { id: 'aut-adecopria', convenioId: 'c-adecopria', revocada: false },
];

describe('sin autorización viva no se guarda, y se dice', () => {
  it('sin ninguna autorización, se rechaza con el motivo', async () => {
    /// El enlace público lo dejaba en un warn del log y seguía:
    /// la persona contestaba y la respuesta se perdía. Aquí hay
    /// un asesor delante que puede registrarla y reintentar.
    const { guardar, creados } = armar([]);

    await expect(guardar({ caracterizaciones: [7] })).rejects.toThrow(
      /autorización de datos/i,
    );
    expect(creados).toEqual([]);
  });

  it('con la autorización REVOCADA, tampoco', async () => {
    const { guardar, creados } = armar([
      { id: 'aut-vieja', convenioId: 'c-adecopria', revocada: true },
    ]);

    await expect(guardar({ caracterizaciones: [7] })).rejects.toThrow();
    expect(creados).toEqual([]);
  });

  it('pero RECHAZAR sí se puede guardar sin autorización', async () => {
    /// «Prefiero no responder» no es un dato sensible: es la
    /// ausencia de uno. Exigir autorización para registrarlo
    /// impediría dejar constancia de que se le preguntó.
    const { guardar, borrados } = armar([]);

    await guardar({ caracterizacionRechazada: true });
    expect(borrados).toEqual(['per-1']);
  });
});

describe('cuelga de la autorización de SU convenio', () => {
  it('no coge la del otro gremio', async () => {
    /// La constancia señalaría un texto que esa persona no leyó
    /// para esto. Y al revocar en su gremio, la marca ni se
    /// enteraría.
    const { guardar, creados } = armar([
      { id: 'aut-britcham', convenioId: 'c-britcham', revocada: false },
    ]);

    await expect(guardar({ caracterizaciones: [7] })).rejects.toThrow();
    expect(creados).toEqual([]);
  });

  it('con la suya viva, cuelga de esa', async () => {
    const { guardar, creados } = armar([
      { id: 'aut-britcham', convenioId: 'c-britcham', revocada: false },
      ...VIVA_SUYA,
    ]);

    await guardar({ caracterizaciones: [7, 12] });
    expect(creados.map((c) => c.autorizacionId)).toEqual([
      'aut-adecopria',
      'aut-adecopria',
    ]);
  });
});

describe('se reescriben en bloque', () => {
  it('quitar una marca la quita de verdad', async () => {
    /// Quitar es tan significativo como poner. Un upsert por id
    /// dejaría las viejas ahí para siempre.
    const { guardar, borrados, creados } = armar(VIVA_SUYA);

    await guardar({ caracterizaciones: [7] });

    expect(borrados).toEqual(['per-1']);
    expect(creados.map((c) => c.caracterizacionSepId)).toEqual([7]);
  });

  it('los ids fuera del catálogo se descartan', async () => {
    const { guardar, creados } = armar(VIVA_SUYA);
    await guardar({ caracterizaciones: [7, 999999] });
    expect(creados.map((c) => c.caracterizacionSepId)).toEqual([7]);
  });

  it('los repetidos no se guardan dos veces', async () => {
    const { guardar, creados } = armar(VIVA_SUYA);
    await guardar({ caracterizaciones: [7, 7, 7] });
    expect(creados).toHaveLength(1);
  });
});

describe('queda en la auditoría, con el campo y no con el valor', () => {
  it('se registra que cambió, sin decir QUÉ marcó', async () => {
    /// `clase-de-dato.ts` los marca SENSIBLE justamente para que
    /// el historial diga que cambiaron sin repetir qué son. Un
    /// historial que copia el dato sensible lo duplica.
    const { guardar, auditadas } = armar(VIVA_SUYA);

    await guardar({ caracterizaciones: [7, 12] });

    expect(auditadas).toHaveLength(1);
    expect(auditadas[0]).toContain('caracterizaciones');
    /// El resumen dice CUÁNTAS, no cuáles.
    expect(auditadas[0]).toMatch(/2 marca/);
    expect(auditadas[0]).not.toContain('7');
  });

  it('y rechazar también deja huella', async () => {
    const { guardar, auditadas } = armar([]);
    await guardar({ caracterizacionRechazada: true });
    expect(auditadas[0]).toMatch(/no responder/i);
  });
});

describe('si no se pregunta, no se toca', () => {
  it('un PATCH que no menciona la caracterización no la borra', async () => {
    /// Es el candado que impide que editar el correo de alguien
    /// le borre sus marcas sensibles.
    const { guardar, borrados, auditadas } = armar(VIVA_SUYA);

    await guardar({ correo: 'nuevo@ejemplo.test' });

    expect(borrados).toEqual([]);
    expect(auditadas).toEqual([]);
  });
});
