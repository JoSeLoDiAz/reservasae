/** El lead completo pasa solo; el que no, se queda. */

import { ConversionAutomatica } from './conversion-automatica';

type Lead = Record<string, unknown>;

/// Un lead que SÍ está listo, para variarlo campo a campo.
function listo(cambios: Lead = {}): Lead {
  return {
    id: 'l1',
    convenioId: 'c1',
    estado: 'PENDIENTE',
    origen: 'FACEBOOK',
    aceptaHabeasData: true,
    participanteId: null,
    tipoDocumentoSepId: 1,
    numeroDocumento: '1005991001',
    nombreCompleto: null,
    primerNombre: 'Marta',
    primerApellido: 'Vargas',
    accionFormacionId: 'af1',
    ...cambios,
  };
}

function montar(leads: Lead[], fallan: string[] = []) {
  const convertidos: Array<{
    leadId: string;
    asesorId: string | null;
    admin: unknown;
    ambito: string[];
  }> = [];

  const prisma = {
    leadEntrante: {
      findMany: (a: { where: Record<string, unknown> }) => {
        // el doble aplica el filtro de verdad
        const w = a.where;
        return Promise.resolve(
          leads.filter(
            (l) => l.estado === w.estado && l.participanteId === w.participanteId,
          ),
        );
      },
    },
  };

  const conversion = {
    convertirDeLote: (
      leadId: string,
      asesorId: string | null,
      admin: unknown,
      ambito: string[],
    ) => {
      if (fallan.includes(leadId)) {
        return Promise.reject(new Error('ese documento es de otra persona'));
      }
      convertidos.push({ leadId, asesorId, admin, ambito });
      return Promise.resolve({ participanteId: 'p1', conAutorizacion: true });
    },
  };

  const obrero = new ConversionAutomatica(
    prisma as never,
    conversion as never,
  );
  return { obrero, convertidos };
}

describe('pasa el que está completo', () => {
  it('un lead con documento, nombre y curso se convierte', async () => {
    const { obrero, convertidos } = montar([listo()]);
    expect(await obrero.pasar()).toBe(1);
    expect(convertidos.map((c) => c.leadId)).toEqual(['l1']);
  });

  it('y la ficha nace SIN asesor', async () => {
    /// Lo pidió el cliente: caen en el montón común y desde
    /// ahí se reparten. Con dueño no habría a quién repartir.
    const { obrero, convertidos } = montar([listo()]);
    await obrero.pasar();
    expect(convertidos[0].asesorId).toBeNull();
  });

  it('y sin persona que la firme: la hace el sistema', async () => {
    const { obrero, convertidos } = montar([listo()]);
    await obrero.pasar();
    expect(convertidos[0].admin).toBeNull();
  });

  it('el ámbito es el convenio del lead, no todos', async () => {
    /// Sin esto un lead de un gremio se convertiría con el
    /// ámbito del otro, que es la fuga que este repositorio
    /// lleva cuatro rondas cerrando.
    const { obrero, convertidos } = montar([listo({ convenioId: 'britcham' })]);
    await obrero.pasar();
    expect(convertidos[0].ambito).toEqual(['britcham']);
  });
});

describe('se queda el que no está listo', () => {
  it('sin documento no pasa', async () => {
    const { obrero, convertidos } = montar([
      listo({ numeroDocumento: null, tipoDocumentoSepId: null }),
    ]);
    expect(await obrero.pasar()).toBe(0);
    expect(convertidos).toEqual([]);
  });

  it('sin curso tampoco', async () => {
    /// Es lo que hace morder al unique (acción, persona): sin
    /// curso, dos leads de la misma persona darían dos fichas.
    const { obrero, convertidos } = montar([listo({ accionFormacionId: null })]);
    expect(await obrero.pasar()).toBe(0);
    expect(convertidos).toEqual([]);
  });

  it('sin apellido tampoco', async () => {
    const { obrero } = montar([listo({ primerApellido: null })]);
    expect(await obrero.pasar()).toBe(0);
  });

  it('con el documento mal escrito tampoco', async () => {
    const { obrero } = montar([listo({ numeroDocumento: 'CC 1.234' })]);
    expect(await obrero.pasar()).toBe(0);
  });
});

describe('la autorización manda, y es lo que separa esto de un invento', () => {
  it('quien dijo que NO no se convierte solo', async () => {
    /// Un `false` explícito es una negativa. Crearle la ficha
    /// sola es seguir tratando sus datos después de que pidió
    /// que no. Se queda en la mesa para que lo mire alguien.
    const { obrero, convertidos } = montar([listo({ aceptaHabeasData: false })]);
    expect(await obrero.pasar()).toBe(0);
    expect(convertidos).toEqual([]);
  });

  it('quien no llegó por un formulario tampoco', async () => {
    /// A quien escribió por WhatsApp nadie le enseñó un texto.
    /// La constancia saldría de la nada.
    const { obrero } = montar([listo({ origen: 'WHATSAPP' })]);
    expect(await obrero.pasar()).toBe(0);
  });

  it('pero el de pauta con la casilla marcada sí', async () => {
    const { obrero } = montar([listo({ origen: 'INSTAGRAM' })]);
    expect(await obrero.pasar()).toBe(1);
  });

  it('y el de pauta sin decir nada también', async () => {
    /// `null` es «el emisor no manda ese campo». Vale el
    /// argumento: el formulario no se puede enviar sin aceptar.
    const { obrero } = montar([listo({ aceptaHabeasData: null })]);
    expect(await obrero.pasar()).toBe(1);
  });
});

describe('lo que no puede pasar', () => {
  it('que uno que falla pare la vuelta', async () => {
    /// El cruce de documento lanza si esa cédula es de otra
    /// persona. Ese lead se queda, los demás siguen.
    const leads = [listo({ id: 'a' }), listo({ id: 'b' }), listo({ id: 'c' })];
    const { obrero, convertidos } = montar(leads, ['b']);
    expect(await obrero.pasar()).toBe(2);
    expect(convertidos.map((c) => c.leadId)).toEqual(['a', 'c']);
  });

  it('que dos vueltas corran a la vez', async () => {
    /// Dos crearían la misma persona y la segunda moriría
    /// contra el unique del documento.
    const { obrero } = montar([listo()]);
    const [uno, dos] = await Promise.all([obrero.pasar(), obrero.pasar()]);
    expect([uno, dos].filter((n) => n === 0)).toHaveLength(1);
  });

  it('que toque un lead ya atendido', async () => {
    const { obrero, convertidos } = montar([
      listo({ estado: 'CONVERTIDO', participanteId: 'p9' }),
    ]);
    expect(await obrero.pasar()).toBe(0);
    expect(convertidos).toEqual([]);
  });
});
