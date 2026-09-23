/** Lo que sale por la puerta de lectura, y lo que NUNCA sale. */

import { BadRequestException } from '@nestjs/common';

import { IntegracionesService } from './integraciones.service';

const CONVENIO = { id: 'cv1' };

/// Doble que aplica los filtros DE VERDAD sobre listas en
/// memoria. Un doble que decida por el prefijo de un id prueba
/// el doble y no el candado: ya se falló así una vez en este
/// repositorio.
function prismaDoble(datos: {
  participantes?: Array<Record<string, unknown>>;
  leads?: Array<Record<string, unknown>>;
  ficha?: Record<string, unknown> | null;
  lead?: Record<string, unknown> | null;
}) {
  return {
    convenio: { findUnique: jest.fn().mockResolvedValue(CONVENIO) },
    participante: {
      findMany: jest.fn().mockResolvedValue(datos.participantes ?? []),
      findUnique: jest.fn().mockResolvedValue(datos.ficha ?? null),
    },
    leadEntrante: {
      findMany: jest.fn().mockResolvedValue(datos.leads ?? []),
      findUnique: jest.fn().mockResolvedValue(datos.lead ?? null),
    },
  } as never;
}

const PERSONA_COMPLETA = {
  primerNombre: 'Claudia',
  correo: 'c@ejemplo.test',
  celular: '3175559001',
  fechaNacimiento: new Date('1990-05-14'),
  generoSepId: 2,
  estrato: 3,
  departamentoSepId: 68,
  municipioSepId: 68001,
  barrio: 'Sotomayor',
  direccion: 'Calle 45',
  autorizaciones: [{ id: 'a1' }],
};

describe('reconocer a quien escribe', () => {
  it('un número que no es de nadie contesta 200 y «no existe»', async () => {
    const s = new IntegracionesService(prismaDoble({}));
    const r = await s.reconocer('adecopria', '3001112222', undefined);
    expect(r.existe).toBe(false);
    expect(r.estado).toBe('NINGUNO');
    expect(r.primerNombre).toBeNull();
  });

  it('una ficha devuelve nombre, etapa, curso y lo que falta', async () => {
    const s = new IntegracionesService(
      prismaDoble({
        participantes: [{ id: 'p1', personaId: 'per1', creadoEn: new Date('2026-09-01') }],
        ficha: {
          etapa: 'INTERESADO',
          nivelOcupacionalSepId: null,
          accionFormacion: { codigo: 'AF1', nombre: 'GESTIÓN DE LA ATENCIÓN' },
          persona: PERSONA_COMPLETA,
        },
      }),
    );
    const r = await s.reconocer('adecopria', '+57 317 555 9001', undefined);
    expect(r.estado).toBe('FICHA');
    expect(r.primerNombre).toBe('Claudia');
    expect(r.etapa).toBe('INTERESADO');
    expect(r.accion).toEqual({ codigo: 'AF1', nombre: 'GESTIÓN DE LA ATENCIÓN' });
    /// Le falta el nivel ocupacional y nada más.
    expect(r.falta).toEqual(['nivel ocupacional']);
    expect(r.autorizacionVigente).toBe(true);
  });

  /**
   * LA REGLA QUE MÁS IMPORTA DE ESTA RUTA.
   *
   * `falta` existe para que el bot le PIDA esos datos a la
   * persona. A quien revocó no se le piden más: la lista sale
   * vacía y el aviso va en `autorizacionVigente`.
   */
  it('a quien revocó no se le devuelve qué pedirle', async () => {
    const s = new IntegracionesService(
      prismaDoble({
        participantes: [{ id: 'p1', personaId: 'per1', creadoEn: new Date() }],
        ficha: {
          etapa: 'INTERESADO',
          nivelOcupacionalSepId: null,
          accionFormacion: null,
          persona: { ...PERSONA_COMPLETA, autorizaciones: [] },
        },
      }),
    );
    const r = await s.reconocer('adecopria', '3175559001', undefined);
    expect(r.autorizacionVigente).toBe(false);
    expect(r.falta).toEqual([]);
  });

  /**
   * AMBIGUO NO DICE DE QUIÉN ES.
   *
   * Se distingue de «no existe» porque el bot tiene que pasar a
   * una persona, pero no sale ni el nombre ni la etapa: meter el
   * chat de alguien en el expediente de un extraño no se
   * deshace, y saludar al equivocado es la misma familia.
   */
  it('un número en dos personas no devuelve datos de ninguna', async () => {
    const s = new IntegracionesService(
      prismaDoble({
        participantes: [
          { id: 'p1', personaId: 'per1', creadoEn: new Date('2026-09-01') },
          { id: 'p2', personaId: 'per2', creadoEn: new Date('2026-09-02') },
        ],
      }),
    );
    const r = await s.reconocer('adecopria', '3175559001', undefined);
    expect(r.estado).toBe('AMBIGUO');
    expect(r.existe).toBe(true);
    expect(r.primerNombre).toBeNull();
    expect(r.etapa).toBeNull();
    expect(r.falta).toEqual([]);
  });

  it('una ficha Y un lead sueltos también es ambiguo', async () => {
    const s = new IntegracionesService(
      prismaDoble({
        participantes: [{ id: 'p1', personaId: 'per1', creadoEn: new Date() }],
        leads: [{ id: 'l1', recibidoEn: new Date() }],
      }),
    );
    const r = await s.reconocer('adecopria', '3175559001', undefined);
    expect(r.estado).toBe('AMBIGUO');
    expect(r.primerNombre).toBeNull();
  });

  it('un lead dice que todavía no hay ficha', async () => {
    const s = new IntegracionesService(
      prismaDoble({
        leads: [{ id: 'l1', recibidoEn: new Date() }],
        lead: {
          primerNombre: 'Luz',
          nombreCompleto: null,
          accionFormacion: { codigo: 'AF2', nombre: 'DISEÑO' },
        },
      }),
    );
    const r = await s.reconocer('adecopria', '3175559001', undefined);
    expect(r.estado).toBe('LEAD');
    expect(r.primerNombre).toBe('Luz');
    expect(r.etapa).toBeNull();
    expect(r.motivo).toContain('lead');
  });

  it('el teléfono se normaliza: con +57, con 57 y pelado son el mismo', async () => {
    for (const t of ['+573175559001', '57 317 555 9001', '3175559001']) {
      const prisma = prismaDoble({});
      const s = new IntegracionesService(prisma);
      await s.reconocer('adecopria', t, undefined);
      const donde = (prisma as never as { participante: { findMany: jest.Mock } })
        .participante.findMany.mock.calls[0][0];
      expect(JSON.stringify(donde)).toContain('3175559001');
    }
  });

  it('sin convenio y sin nada que buscar, se rechaza', async () => {
    const s = new IntegracionesService(prismaDoble({}));
    await expect(s.reconocer(null, '3001112222', undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(s.reconocer('adecopria', undefined, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  /// El ámbito se aplica en la consulta, no después: un gremio
  /// no puede reconocer al contacto del otro.
  it('busca SOLO dentro del convenio', async () => {
    const prisma = prismaDoble({});
    const s = new IntegracionesService(prisma);
    await s.reconocer('adecopria', '3175559001', undefined);
    const p = (prisma as never as { participante: { findMany: jest.Mock } }).participante
      .findMany.mock.calls[0][0];
    const l = (prisma as never as { leadEntrante: { findMany: jest.Mock } }).leadEntrante
      .findMany.mock.calls[0][0];
    expect(p.where.convenioId).toBe(CONVENIO.id);
    expect(l.where.convenioId).toBe(CONVENIO.id);
  });
});
