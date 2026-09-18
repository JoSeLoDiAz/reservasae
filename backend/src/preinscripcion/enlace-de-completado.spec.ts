/** Solo el registro marca su enlace. */

import type { PrismaService } from '../prisma/prisma.service';
import { EnlaceDeCompletado } from './enlace-de-completado';

function emisor() {
  const creados: Array<Record<string, unknown>> = [];
  const prisma = {
    enlaceCompletado: {
      findFirst: () => Promise.resolve(null),
      updateMany: () => Promise.resolve({ count: 0 }),
      create: ({ data }: { data: Record<string, unknown> }) => {
        creados.push(data);
        return Promise.resolve({ token: data.token, expiraEn: data.expiraEn });
      },
    },
  } as unknown as PrismaService;
  return { e: new EnlaceDeCompletado(prisma), creados };
}

describe('el enlace del registro', () => {
  it('sale marcado y sin emisor', async () => {
    const { e, creados } = emisor();
    await e.emitirAlRegistrarse('p1');
    expect(creados[0]).toMatchObject({ delRegistro: true, emitidoPorId: null });
  });

  it('el del asesor no se marca', async () => {
    const { e, creados } = emisor();
    await e.emitir('p1', 'a1');
    expect(creados[0]).toMatchObject({ delRegistro: false, emitidoPorId: 'a1' });
  });

  it('el del acuse sin vivo tampoco', async () => {
    const { e, creados } = emisor();
    await e.emitirOReusar('p1', null);
    expect(creados[0]).toMatchObject({ delRegistro: false });
  });
});
