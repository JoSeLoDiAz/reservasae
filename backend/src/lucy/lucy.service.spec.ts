/** La puerta de Lucy, llamada de verdad. */

/// Llama a `entra()`, no a `aQuienSePega`. La regla del cruce ya
/// tiene su spec; lo que aqui se prueba es COMO el metodo la usa
/// -- que es donde este repositorio ya se llevo el susto con
/// `cambiarEtapa`: los predicados salian bien y el defecto vivia
/// en quien los llamaba.

import { BadRequestException } from '@nestjs/common';

import { LucyService } from './lucy.service';

const CONVENIO = { id: 'cv-1' };

function armar(mundo: {
  fichas?: Array<{ id: string; personaId: string; creadoEn: Date }>;
  leads?: Array<{ id: string; recibidoEn: Date }>;
  yaEstaba?: { id: string; estado: string; notaId: string | null } | null;
} = {}) {
  const escrito: Record<string, unknown> = {};
  const prisma = {
    convenio: { findUnique: () => Promise.resolve(CONVENIO) },
    conversacionEntrante: {
      findUnique: () => Promise.resolve(mundo.yaEstaba ?? null),
      create: ({ data }: { data: Record<string, unknown> }) => {
        escrito.conversacion = data;
        return Promise.resolve({ id: 'conv-1' });
      },
      update: ({ data }: { data: Record<string, unknown> }) => {
        escrito.conversacionActualizada = data;
        return Promise.resolve({});
      },
    },
    notaDeGestion: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        escrito.nota = data;
        return Promise.resolve({ id: 'nota-1' });
      },
    },
    leadEntrante: {
      findMany: () => Promise.resolve(mundo.leads ?? []),
      update: ({ data }: { data: Record<string, unknown> }) => {
        escrito.lead = data;
        return Promise.resolve({});
      },
    },
    participante: { findMany: () => Promise.resolve(mundo.fichas ?? []) },
  };
  return { servicio: new LucyService(prisma as never), escrito };
}

const CUERPO = {
  externoId: 'conv-9f31',
  telefono: '+57 300 412 8876',
  resumen: 'Preguntó por el curso. Sigue interesada.',
};

describe('entra una conversación de Lucy', () => {
  it('la cuelga de la ficha y con canal WhatsApp', async () => {
    const { servicio, escrito } = armar({
      fichas: [{ id: 'f1', personaId: 'p1', creadoEn: new Date(2026, 8, 1) }],
    });

    const r = await servicio.entra(CUERPO as never, 'lucy', 'adecopria');

    expect(r.estado).toBe('PEGADA');
    expect(escrito.nota).toMatchObject({
      participanteId: 'f1',
      leadId: null,
      canales: ['WHATSAPP'],
      autorNombre: 'Lucy (WhatsApp)',
      autorId: null,
    });
  });

  /// Si esto se rompe, la lista de «a quien insistirle hoy» se
  /// vacia sola en cuanto Lucy toque a alguien.
  it('la nota NO lleva resultado: no es un intento de contacto', async () => {
    const { servicio, escrito } = armar({
      fichas: [{ id: 'f1', personaId: 'p1', creadoEn: new Date(2026, 8, 1) }],
    });

    await servicio.entra(CUERPO as never, 'lucy', 'adecopria');

    expect((escrito.nota as { resultado: unknown }).resultado).toBeNull();
  });

  it('el número se guarda normalizado, sin el +57', async () => {
    const { servicio, escrito } = armar();

    await servicio.entra(CUERPO as never, 'lucy', 'adecopria');

    expect((escrito.conversacion as { celular: string }).celular).toBe('3004128876');
  });

  /// No se crea lead y no se descarta: queda la fila.
  it('un número de nadie queda guardado, sin nota', async () => {
    const { servicio, escrito } = armar();

    const r = await servicio.entra(CUERPO as never, 'lucy', 'adecopria');

    expect(r.estado).toBe('SIN_DUENO');
    expect(r.notaId).toBeNull();
    expect(escrito.nota).toBeUndefined();
    expect(escrito.conversacion).toBeDefined();
  });

  it('con dos personas detrás no se escribe ninguna nota', async () => {
    const { servicio, escrito } = armar({
      fichas: [
        { id: 'f1', personaId: 'p1', creadoEn: new Date(2026, 8, 1) },
        { id: 'f2', personaId: 'p2', creadoEn: new Date(2026, 8, 2) },
      ],
    });

    const r = await servicio.entra(CUERPO as never, 'lucy', 'adecopria');

    expect(r.estado).toBe('AMBIGUA');
    expect(escrito.nota).toBeUndefined();
  });

  /// A 200 por minuto los reintentos son certeza.
  it('el mismo externoId otra vez no deja una segunda nota', async () => {
    const { servicio, escrito } = armar({
      yaEstaba: { id: 'conv-1', estado: 'PEGADA', notaId: 'nota-1' },
      fichas: [{ id: 'f1', personaId: 'p1', creadoEn: new Date(2026, 8, 1) }],
    });

    const r = await servicio.entra(CUERPO as never, 'lucy', 'adecopria');

    expect(r.repetido).toBe(true);
    expect(r.notaId).toBe('nota-1');
    expect(escrito.nota).toBeUndefined();
    expect(escrito.conversacion).toBeUndefined();
  });

  /// Mezclar gremios es mezclar dos tratamientos de datos.
  it('si la dirección y el cuerpo dicen gremios distintos, se rechaza', async () => {
    const { servicio } = armar();

    await expect(
      servicio.entra({ ...CUERPO, convenio: 'britcham-adee' } as never, 'lucy', 'adecopria'),
    ).rejects.toThrow(BadRequestException);
  });

  it('sin gremio por ningún lado, se rechaza', async () => {
    const { servicio } = armar();

    await expect(servicio.entra(CUERPO as never, 'lucy', null)).rejects.toThrow(
      /Falta el convenio/,
    );
  });

  it('sobre un lead, mueve su última gestión', async () => {
    const { servicio, escrito } = armar({
      leads: [{ id: 'l1', recibidoEn: new Date(2026, 8, 1) }],
    });

    const r = await servicio.entra(CUERPO as never, 'lucy', 'adecopria');

    expect(r.estado).toBe('PEGADA');
    expect(escrito.nota).toMatchObject({ leadId: 'l1', participanteId: null });
    expect(escrito.lead).toHaveProperty('ultimaGestionEn');
  });
});
