/** Los candados del aviso: a quién va, y que no se repita. */

import { NotificacionesService } from './notificaciones.service';

type Fila = {
  id: string;
  destinatarioId: string;
  participanteId: string;
  convenioId: string;
  tipo: string;
  titulo: string;
  detalle: string | null;
  claveEvento: string;
  creadoEn: Date;
  leidaEn: Date | null;
};

type Llave = { destinatarioId: string; tipo: string; claveEvento: string };

/**
 * EL DOBLE APLICA LOS FILTROS DE VERDAD.
 *
 * Con uno que devuelva lo primero que encuentre, los tests
 * probarían el doble: ya se falló así en esta casa con el que
 * decidía por el prefijo del id.
 */
function prismaFalso(
  fichas: Record<string, { asesorId: string | null; convenioId: string }>,
) {
  const filas: Fila[] = [];
  let n = 0;
  const casa = (f: Fila, w: Record<string, unknown>): boolean =>
    Object.entries(w).every(
      ([k, v]) => (f as unknown as Record<string, unknown>)[k] === v,
    );

  return {
    filas,
    prisma: {
      participante: {
        findUnique: ({ where }: { where: { id: string } }) =>
          Promise.resolve(fichas[where.id] ?? null),
      },
      notificacion: {
        /**
         * APLICA LA RAMA `update`, Y NO ES UN DETALLE.
         *
         * La primera versión devolvía la fila encontrada tal
         * cual, sin tocarla. Con eso el test de «no reabre lo
         * leído» pasaba IGUAL con el candado quitado: probaba el
         * doble. Se vio mutando el código --`update: { leidaEn:
         * null }`-- y viendo que no caía ninguno.
         */
        upsert: (args: {
          where: { destinatarioId_tipo_claveEvento: Llave };
          create: Omit<Fila, 'id' | 'creadoEn' | 'leidaEn'>;
          update: Partial<Fila>;
        }) => {
          const llave = args.where.destinatarioId_tipo_claveEvento;
          const ya = filas.find(
            (f) =>
              f.destinatarioId === llave.destinatarioId &&
              f.tipo === llave.tipo &&
              f.claveEvento === llave.claveEvento,
          );
          if (ya) {
            Object.assign(ya, args.update);
            return Promise.resolve(ya);
          }
          const fila: Fila = {
            ...args.create,
            id: `n${++n}`,
            creadoEn: new Date(2026, 8, 25, 10, n),
            leidaEn: null,
          };
          filas.push(fila);
          return Promise.resolve(fila);
        },
        count: ({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(filas.filter((f) => casa(f, where)).length),
        updateMany: (args: {
          where: Record<string, unknown>;
          data: { leidaEn: Date };
        }) => {
          const tocan = filas.filter((f) => casa(f, args.where));
          tocan.forEach((f) => {
            f.leidaEn = args.data.leidaEn;
          });
          return Promise.resolve({ count: tocan.length });
        },
      },
    },
  };
}

const CON_ASESOR = { asesorId: 'ana', convenioId: 'adecopria' };
const SIN_ASESOR = { asesorId: null, convenioId: 'adecopria' };

describe('a quién se avisa', () => {
  it('le llega al asesor que lleva la ficha', async () => {
    const d = prismaFalso({ p1: CON_ASESOR });
    const s = new NotificacionesService(d.prisma as never);

    await s.avisar({
      participanteId: 'p1',
      tipo: 'DATOS_COMPLETADOS',
      claveEvento: 'enlace-1',
    });

    expect(d.filas).toHaveLength(1);
    expect(d.filas[0].destinatarioId).toBe('ana');
    expect(d.filas[0].titulo).toBe('Completó sus datos');
    expect(d.filas[0].convenioId).toBe('adecopria');
  });

  /**
   * UNA FICHA DEL MONTÓN COMÚN NO ES DE NADIE.
   *
   * Y eso NO es un fallo que haya que tapar inventando un
   * destinatario: avisar «a alguien» es meter el trabajo de una
   * ficha en la bandeja de quien no la lleva.
   */
  it('sin asesor no se avisa a nadie', async () => {
    const d = prismaFalso({ p1: SIN_ASESOR });
    const s = new NotificacionesService(d.prisma as never);

    await s.avisar({
      participanteId: 'p1',
      tipo: 'DATOS_COMPLETADOS',
      claveEvento: 'enlace-1',
    });

    expect(d.filas).toHaveLength(0);
  });

  it('el destinatario explícito gana al asesor de la ficha', async () => {
    const d = prismaFalso({ p1: CON_ASESOR });
    const s = new NotificacionesService(d.prisma as never);

    await s.avisar({
      participanteId: 'p1',
      tipo: 'FICHA_ASIGNADA',
      claveEvento: 'p1:julieth',
      destinatarioId: 'julieth',
    });

    expect(d.filas[0].destinatarioId).toBe('julieth');
  });

  it('una ficha que no existe no rompe nada', async () => {
    const d = prismaFalso({});
    const s = new NotificacionesService(d.prisma as never);

    await expect(
      s.avisar({
        participanteId: 'fantasma',
        tipo: 'DATOS_COMPLETADOS',
        claveEvento: 'x',
      }),
    ).resolves.toBeUndefined();
    expect(d.filas).toHaveLength(0);
  });

  /**
   * NUNCA LANZA, Y ESTE ES EL TEST QUE LO SUJETA.
   *
   * `avisar` se llama desde la puerta PÚBLICA, justo después de
   * que la persona guarde sus datos. Un fallo aquí no puede
   * devolverle un 500 a quien acaba de completar su ficha: es la
   * misma regla que ya llevan el bloque de leads y
   * `registrarToqueDeOrigen`.
   */
  it('si la base falla, se traga el error', async () => {
    const roto = {
      participante: {
        findUnique: () => Promise.reject(new Error('sin conexión')),
      },
    };
    const s = new NotificacionesService(roto as never);

    await expect(
      s.avisar({
        participanteId: 'p1',
        tipo: 'DATOS_COMPLETADOS',
        claveEvento: 'x',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('el mismo suceso no avisa dos veces', () => {
  const aviso = {
    participanteId: 'p1',
    tipo: 'DATOS_COMPLETADOS' as const,
    claveEvento: 'enlace-1',
  };

  it('reintentar el guardado deja UNA sola fila', async () => {
    const d = prismaFalso({ p1: CON_ASESOR });
    const s = new NotificacionesService(d.prisma as never);

    await s.avisar(aviso);
    await s.avisar(aviso);
    await s.avisar(aviso);

    expect(d.filas).toHaveLength(1);
  });

  /// Un enlace nuevo SÍ es un suceso nuevo: la asesora lo volvió
  /// a mandar y la persona lo volvió a llenar.
  it('un enlace distinto vuelve a avisar', async () => {
    const d = prismaFalso({ p1: CON_ASESOR });
    const s = new NotificacionesService(d.prisma as never);

    await s.avisar(aviso);
    await s.avisar({ ...aviso, claveEvento: 'enlace-2' });

    expect(d.filas).toHaveLength(2);
  });

  /**
   * Y NO REABRE LO QUE YA SE LEYÓ.
   *
   * Sin este aserto, alguien «arregla» la idempotencia poniendo
   * `update: { leidaEn: null }` y el panel vuelve a marcarle en
   * rojo a la asesora algo que ya atendió, cada vez que entre un
   * reintento.
   */
  it('un reintento no devuelve a «sin leer» lo ya leído', async () => {
    const d = prismaFalso({ p1: CON_ASESOR });
    const s = new NotificacionesService(d.prisma as never);

    await s.avisar(aviso);
    await s.marcarTodasLeidas('ana');
    expect(await s.sinLeer('ana')).toBe(0);

    await s.avisar(aviso);

    expect(await s.sinLeer('ana')).toBe(0);
  });
});

describe('leer es solo lo propio', () => {
  it('no se puede marcar la de otro', async () => {
    const d = prismaFalso({ p1: CON_ASESOR });
    const s = new NotificacionesService(d.prisma as never);
    await s.avisar({
      participanteId: 'p1',
      tipo: 'DATOS_COMPLETADOS',
      claveEvento: 'e1',
    });

    const cambiadas = await s.marcarLeida('otro', d.filas[0].id);

    expect(cambiadas).toBe(0);
    expect(d.filas[0].leidaEn).toBeNull();
    expect(await s.sinLeer('ana')).toBe(1);
  });

  it('la suya sí, y una sola vez', async () => {
    const d = prismaFalso({ p1: CON_ASESOR });
    const s = new NotificacionesService(d.prisma as never);
    await s.avisar({
      participanteId: 'p1',
      tipo: 'DATOS_COMPLETADOS',
      claveEvento: 'e1',
    });

    expect(await s.marcarLeida('ana', d.filas[0].id)).toBe(1);
    expect(await s.marcarLeida('ana', d.filas[0].id)).toBe(0);
    expect(await s.sinLeer('ana')).toBe(0);
  });
});
