/** Revocar la autorización tiene efecto, no solo pantalla. */

/**
 * `revocadaEn` se leía en siete consultas y no se escribía en
 * ninguna: la columna existía, el índice existía, todo lo de
 * abajo la honraba, y no había puerta. El sistema decía poder
 * demostrar la autorización y era incapaz de honrar su
 * revocación, que es el otro lado del mismo artículo.
 *
 * Se comprueba lo que de verdad importa: que se marquen TODAS
 * las vivas del convenio, que no se borre ninguna fila y que
 * quede el movimiento con quién lo hizo.
 */

import { BadRequestException } from '@nestjs/common';

import { CrmService } from './crm.service';

type Llamada = { que: string; datos?: unknown };

function prismaFalso(vivas: string[]) {
  const hecho: Llamada[] = [];

  return {
    hecho,
    participante: {
      findFirst: () => Promise.resolve({ id: 'p1' }),
      findUnique: () =>
        Promise.resolve({
          id: 'p1',
          personaId: 'per1',
          convenioId: 'c1',
          etapa: 'CONTACTADO',
        }),
    },
    autorizacionDatos: {
      findMany: () => Promise.resolve(vivas.map((id) => ({ id }))),
      updateMany: (args: unknown) => {
        hecho.push({ que: 'autorizacion.updateMany', datos: args });
        return Promise.resolve({ count: vivas.length });
      },
      deleteMany: () => {
        hecho.push({ que: 'autorizacion.deleteMany' });
        return Promise.resolve({ count: 0 });
      },
    },
    movimientoParticipante: {
      create: (args: unknown) => {
        hecho.push({ que: 'movimiento.create', datos: args });
        return Promise.resolve({ id: 'm1' });
      },
    },
    $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
  };
}

function servicio(vivas: string[]) {
  const prisma = prismaFalso(vivas);
  const auditoria = { registrar: () => Promise.resolve() };
  const s = new CrmService(
    prisma as never,
    auditoria as never,
    { encolarSiHaceFalta: () => Promise.resolve() } as never,
    {} as never,
    { alInscribir: () => Promise.resolve() } as never,
  );
  /// `obtener` lee media base; no es lo que se prueba.
  jest.spyOn(s, 'obtener').mockResolvedValue({ id: 'p1' } as never);
  return { s, prisma };
}

const ADMIN = { id: 'a1', nombre: 'Ana Jaramillo' };
const DTO = { motivo: 'Lo pidió por teléfono', canal: 'VERBAL_ASESOR' };

describe('revocar la autorización', () => {
  it('marca TODAS las vivas del convenio, no una', async () => {
    /// Dejar una viva deja a la persona dentro del reporte al
    /// SEP, que es exactamente lo que pidió que no pasara.
    const { s, prisma } = servicio(['au1', 'au2']);

    await s.revocarAutorizacion('p1', DTO as never, ADMIN as never, ['c1']);

    const marca = prisma.hecho.find((h) => h.que === 'autorizacion.updateMany');
    expect(marca).toBeDefined();
    const args = marca!.datos as { where: { id: { in: string[] } }; data: { revocadaEn: Date } };
    expect(args.where.id.in).toEqual(['au1', 'au2']);
    expect(args.data.revocadaEn).toBeInstanceOf(Date);
  });

  it('NO borra la fila: una revocación es un hecho nuevo', async () => {
    /// Hay que poder decir que hubo autorización desde tal día
    /// hasta tal otro. Borrarla borra la mitad de la frase.
    const { s, prisma } = servicio(['au1']);

    await s.revocarAutorizacion('p1', DTO as never, ADMIN as never, ['c1']);

    expect(prisma.hecho.map((h) => h.que)).not.toContain('autorizacion.deleteMany');
  });

  it('deja movimiento con quién lo hizo y por dónde', async () => {
    const { s, prisma } = servicio(['au1']);

    await s.revocarAutorizacion('p1', DTO as never, ADMIN as never, ['c1'], '1.2.3.4');

    const mov = prisma.hecho.find((h) => h.que === 'movimiento.create');
    const datos = (mov!.datos as { data: Record<string, unknown> }).data;
    expect(datos.adminId).toBe('a1');
    expect(datos.ip).toBe('1.2.3.4');
    expect(String(datos.nota)).toContain('VERBAL_ASESOR');
    expect(String(datos.nota)).toContain('Lo pidió por teléfono');
  });

  it('la etapa NO cambia: revocar no es retirarse', async () => {
    /// Decidir por la persona que se retira sería poner en su
    /// boca algo que no dijo.
    const { s, prisma } = servicio(['au1']);

    await s.revocarAutorizacion('p1', DTO as never, ADMIN as never, ['c1']);

    const mov = prisma.hecho.find((h) => h.que === 'movimiento.create');
    const datos = (mov!.datos as { data: Record<string, unknown> }).data;
    expect(datos.etapaAntes).toBe('CONTACTADO');
    expect(datos.etapaDespues).toBe('CONTACTADO');
  });

  it('sin autorización vigente se niega, y no escribe nada', async () => {
    const { s, prisma } = servicio([]);

    await expect(
      s.revocarAutorizacion('p1', DTO as never, ADMIN as never, ['c1']),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.hecho).toEqual([]);
  });
});
