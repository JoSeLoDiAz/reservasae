/** La bandeja: ver lo que no se pegó solo, y pegarlo sin mezclar gremios. */

/**
 * «NO ESTÁ LLEGANDO LAS CONVERSACIONES DE LUCID; DICE QUE LLEGA 200
 * PERO NO QUEDA» (cliente, 5 oct 2026).
 *
 * Llegaban y se guardaban. Lo que pasaba es que cuando el número no
 * casa con nadie del gremio ---o casa con más de uno--- la
 * conversación queda `SIN_DUENO` o `AMBIGUA`, y ninguna pantalla leía
 * esa tabla. Guardado donde nadie lo ve es indistinguible de perdido,
 * y el olvidador las borra a los 60 días, así que acababa siéndolo.
 *
 * Lo que se prueba aquí no es que la lista salga ---eso se vio contra
 * el backend corriendo--- sino las reglas que no se pueden mirar a
 * ojo: que no se mezclen gremios, que no se pegue dos veces, y que la
 * nota se escriba IGUAL que en el camino automático.
 *
 * EL DOBLE RESPONDE LO QUE RESPONDERÍA PRISMA, incluido el filtro por
 * convenio. Un doble que contesta a `findFirst` sin mirar el `where`
 * daría por buena una consulta que no filtra, que es justo el fallo
 * que se quiere impedir.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';

import { BandejaDeConversaciones } from './bandeja.service';
import type { PrismaService } from '../prisma/prisma.service';

const ADECOPRIA = 'conv-ade';
const BRITCHAM = 'conv-brit';

type Mundo = {
  conversacion: {
    id: string;
    convenioId: string;
    estado: 'SIN_DUENO' | 'AMBIGUA' | 'PEGADA';
    resumen: string;
    origenSistema: string;
    notaId: string | null;
  };
  /// Fichas y leads con el convenio al que pertenecen, para que el
  /// doble pueda contestar al filtro igual que la base.
  fichas: Array<{ id: string; convenioId: string }>;
  leads: Array<{ id: string; convenioId: string }>;
};

/// Lo que se escribió, para poder mirarlo después.
type Escrito = {
  notas: Array<Record<string, unknown>>;
  conversaciones: Array<Record<string, unknown>>;
  leads: Array<Record<string, unknown>>;
};

function bandeja(mundo: Mundo) {
  const escrito: Escrito = { notas: [], conversaciones: [], leads: [] };

  /// Igual que el `where` de verdad: id Y convenio dentro del ámbito.
  const casa = (
    donde: Record<string, unknown>,
    fila: { id: string; convenioId: string },
  ) => {
    if (donde.id !== undefined && donde.id !== fila.id) return false;
    const conv = donde.convenioId as
      | string
      | { in?: string[] }
      | { not?: string }
      | undefined;
    if (conv === undefined) return true;
    if (typeof conv === 'string') return conv === fila.convenioId;
    if (Array.isArray((conv as { in?: string[] }).in)) {
      return (conv as { in: string[] }).in.includes(fila.convenioId);
    }
    return true;
  };

  const prisma = {
    conversacionEntrante: {
      findFirst: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          casa(where, {
            id: mundo.conversacion.id,
            convenioId: mundo.conversacion.convenioId,
          })
            ? mundo.conversacion
            : null,
        ),
      update: ({ data }: { data: Record<string, unknown> }) => {
        escrito.conversaciones.push(data);
        return Promise.resolve({});
      },
    },
    participante: {
      findFirst: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(mundo.fichas.find((f) => casa(where, f)) ?? null),
    },
    leadEntrante: {
      findFirst: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(mundo.leads.find((l) => casa(where, l)) ?? null),
      update: ({ data }: { data: Record<string, unknown> }) => {
        escrito.leads.push(data);
        return Promise.resolve({});
      },
    },
    notaDeGestion: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        escrito.notas.push(data);
        return Promise.resolve({ id: 'nota-1' });
      },
    },
  } as unknown as PrismaService;

  return { servicio: new BandejaDeConversaciones(prisma), escrito };
}

const mundo = (p: Partial<Mundo['conversacion']> = {}): Mundo => ({
  conversacion: {
    id: 'c1',
    convenioId: ADECOPRIA,
    estado: 'SIN_DUENO',
    resumen: 'Preguntó por el horario del sábado.',
    origenSistema: 'lucid',
    notaId: null,
    ...p,
  },
  fichas: [
    { id: 'ficha-ade', convenioId: ADECOPRIA },
    { id: 'ficha-brit', convenioId: BRITCHAM },
  ],
  leads: [{ id: 'lead-ade', convenioId: ADECOPRIA }],
});

describe('pegarla a mano', () => {
  it('deja la nota en la ficha y la saca de la cola', async () => {
    const { servicio, escrito } = bandeja(mundo());
    const r = await servicio.pegar('c1', [ADECOPRIA], {
      participanteId: 'ficha-ade',
    });

    expect(r).toEqual({ pegada: true, notaId: 'nota-1' });
    expect(escrito.notas).toHaveLength(1);
    expect(escrito.notas[0].participanteId).toBe('ficha-ade');
    /// Y la conversación deja de estar en espera.
    expect(escrito.conversaciones[0]).toMatchObject({
      estado: 'PEGADA',
      notaId: 'nota-1',
    });
  });

  /**
   * LA NOTA SE ESCRIBE IGUAL QUE EN EL CAMINO AUTOMÁTICO, y es la
   * mitad del asunto: si aquí se escribiera distinto, el historial de
   * la persona diría de dónde vino el trabajo en vez de qué pasó con
   * ella.
   *
   * `autorId` nulo porque el texto es de Lucid, no de quien la pega; y
   * `resultado` nulo porque las notas del sistema no son intentos de
   * contacto ---marcarlas así vaciaría sola la lista de a quién hay
   * que insistirle---. De paso, con autor nulo tampoco cuenta como
   * gestión de nadie en el tablero de asesores.
   */
  it('la nota es de Lucid: sin autor y sin resultado', async () => {
    const { servicio, escrito } = bandeja(mundo());
    await servicio.pegar('c1', [ADECOPRIA], { participanteId: 'ficha-ade' });
    expect(escrito.notas[0]).toMatchObject({
      autorId: null,
      resultado: null,
      texto: 'Preguntó por el horario del sábado.',
      canales: ['WHATSAPP'],
    });
    /// La firma sale del proveedor, no escrita a fuego: con otro
    /// chatbot, la nota iría firmada por Lucid.
    expect(escrito.notas[0].autorNombre).toBeTruthy();
  });

  it('si es de un lead, le mueve la última gestión', async () => {
    const { servicio, escrito } = bandeja(mundo());
    await servicio.pegar('c1', [ADECOPRIA], { leadId: 'lead-ade' });
    expect(escrito.notas[0].leadId).toBe('lead-ade');
    expect(escrito.leads[0].ultimaGestionEn).toBeInstanceOf(Date);
  });
});

describe('lo que NO se puede hacer', () => {
  /**
   * LOS GREMIOS NO SE MEZCLAN. No es una formalidad: pegar una
   * conversación de ADECOPRIA en una ficha de BRITCHAM mete lo que una
   * persona escribió por WhatsApp en el tratamiento de datos del otro
   * convenio.
   */
  it('no se pega en una ficha de otro gremio', async () => {
    const { servicio, escrito } = bandeja(mundo());
    await expect(
      servicio.pegar('c1', [ADECOPRIA, BRITCHAM], {
        participanteId: 'ficha-brit',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    /// Y no escribe nada: un rechazo que ya dejó la nota no es un
    /// rechazo.
    expect(escrito.notas).toHaveLength(0);
  });

  it('ni en un lead de otro gremio', async () => {
    const m = mundo();
    m.leads.push({ id: 'lead-brit', convenioId: BRITCHAM });
    const { servicio, escrito } = bandeja(m);
    await expect(
      servicio.pegar('c1', [ADECOPRIA, BRITCHAM], { leadId: 'lead-brit' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(escrito.notas).toHaveLength(0);
  });

  /// Dos notas con el mismo texto en dos fichas parecen dos
  /// conversaciones distintas de la misma persona.
  it('una conversación ya pegada no se vuelve a pegar', async () => {
    const { servicio, escrito } = bandeja(
      mundo({ estado: 'PEGADA', notaId: 'nota-vieja' }),
    );
    await expect(
      servicio.pegar('c1', [ADECOPRIA], { participanteId: 'ficha-ade' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(escrito.notas).toHaveLength(0);
  });

  it('hay que decir a quién: sin destino no se adivina', async () => {
    const { servicio } = bandeja(mundo());
    await expect(servicio.pegar('c1', [ADECOPRIA], {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('ni a una ficha Y a un lead a la vez: pasó con una persona', async () => {
    const { servicio } = bandeja(mundo());
    await expect(
      servicio.pegar('c1', [ADECOPRIA], {
        participanteId: 'ficha-ade',
        leadId: 'lead-ade',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  /**
   * Y UNA CONVERSACIÓN DE OTRO GREMIO NO SE TOCA SIQUIERA. Pasar su
   * id a mano por la URL no vale: el ámbito se comprueba en la
   * consulta, no después.
   */
  it('una conversación fuera del ámbito no existe para esa cuenta', async () => {
    const { servicio } = bandeja(mundo({ convenioId: BRITCHAM }));
    await expect(
      servicio.pegar('c1', [ADECOPRIA], { participanteId: 'ficha-ade' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('la cola', () => {
  it('sin convenios no se pregunta nada', async () => {
    const { servicio } = bandeja(mundo());
    await expect(servicio.enEspera([])).resolves.toEqual([]);
  });
});
