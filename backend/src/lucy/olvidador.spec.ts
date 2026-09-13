import { OlvidadorDeConversaciones } from './olvidador';

/// El doble APLICA el filtro de verdad sobre una lista en
/// memoria. Un doble que devuelva un numero sin mirar el `where`
/// prueba el doble, no el candado -- ya se fallo asi en este
/// repositorio con el que decidia por el prefijo del id.
function armar(filas: Array<{ estado: string; recibidoEn: Date }>) {
  const prisma = {
    conversacionEntrante: {
      deleteMany: ({ where }: { where: Record<string, never> }) => {
        const w = where as unknown as {
          estado: string;
          recibidoEn: { lt: Date };
        };
        const quedan = filas.filter(
          (f) => !(f.estado === w.estado && f.recibidoEn < w.recibidoEn.lt),
        );
        const borradas = filas.length - quedan.length;
        filas.length = 0;
        filas.push(...quedan);
        return Promise.resolve({ count: borradas });
      },
    },
  };
  return { olvidador: new OlvidadorDeConversaciones(prisma as never), filas };
}

const HOY = new Date('2026-09-13T12:00:00.000Z');
const haceDias = (n: number) => new Date(HOY.getTime() - n * 86_400_000);

describe('el olvidador', () => {
  it('borra las de nadie que pasaron de 60 días', async () => {
    const { olvidador, filas } = armar([
      { estado: 'SIN_DUENO', recibidoEn: haceDias(90) },
      { estado: 'SIN_DUENO', recibidoEn: haceDias(61) },
    ]);

    expect(await olvidador.olvidar(HOY)).toBe(2);
    expect(filas).toHaveLength(0);
  });

  it('no toca las de nadie que aún no cumplen', async () => {
    const { olvidador, filas } = armar([
      { estado: 'SIN_DUENO', recibidoEn: haceDias(59) },
      { estado: 'SIN_DUENO', recibidoEn: haceDias(1) },
    ]);

    expect(await olvidador.olvidar(HOY)).toBe(0);
    expect(filas).toHaveLength(2);
  });

  /// Borrarla haria que un reintento tardio dejara una segunda
  /// nota, que es lo que la fila existe para impedir.
  it('NUNCA borra una pegada, por vieja que sea', async () => {
    const { olvidador, filas } = armar([
      { estado: 'PEGADA', recibidoEn: haceDias(900) },
    ]);

    expect(await olvidador.olvidar(HOY)).toBe(0);
    expect(filas).toHaveLength(1);
  });

  /// Una ambigua SI es de alguien -- de varios, por eso no se
  /// eligio --. Caducarla tira la conversacion de una persona
  /// que esta en el CRM.
  it('NUNCA borra una ambigua, por vieja que sea', async () => {
    const { olvidador, filas } = armar([
      { estado: 'AMBIGUA', recibidoEn: haceDias(900) },
    ]);

    expect(await olvidador.olvidar(HOY)).toBe(0);
    expect(filas).toHaveLength(1);
  });

  it('con las tres mezcladas solo cae la que toca', async () => {
    const { olvidador, filas } = armar([
      { estado: 'SIN_DUENO', recibidoEn: haceDias(100) },
      { estado: 'PEGADA', recibidoEn: haceDias(100) },
      { estado: 'AMBIGUA', recibidoEn: haceDias(100) },
    ]);

    expect(await olvidador.olvidar(HOY)).toBe(1);
    expect(filas.map((f) => f.estado).sort()).toEqual(['AMBIGUA', 'PEGADA']);
  });
});
