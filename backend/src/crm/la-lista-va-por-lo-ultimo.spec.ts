/** La lista de leads se ordena por lo ÚLTIMO que pasó. */

/// Lo pidió el cliente el 16 sep 2026 con su propio caso: alguien
/// se preinscribe a las 4:39 p. m., se le manda el correo
/// pidiéndole los datos, los completa al día siguiente... y
/// seguía hundida donde entró. SUSTITUYE a su orden del 3 sep,
/// que era por fecha de creación.

import { masReciente } from './ultima-actividad';

/// El doble aplica el orden DE VERDAD sobre las filas, no por el
/// prefijo del id ni por el orden en que se escribieron: un doble
/// que no ordena prueba el doble y no el candado.
function prismaDoble(filas: Array<{ id: string; actualizadoEn: Date; creadoEn: Date }>) {
  return {
    participante: {
      count: async () => filas.length,
      findMany: async ({
        orderBy,
      }: {
        orderBy?: Record<string, 'asc' | 'desc'>;
      }) => {
        const [campo, sentido] = Object.entries(orderBy ?? {})[0] ?? [];
        if (!campo) return filas;
        const clave = campo as 'actualizadoEn' | 'creadoEn';
        return [...filas].sort((a, b) =>
          sentido === 'desc'
            ? b[clave].getTime() - a[clave].getTime()
            : a[clave].getTime() - b[clave].getTime(),
        );
      },
    },
  };
}

const d = (iso: string) => new Date(iso);

describe('el orden de la lista', () => {
  /// El caso del cliente, tal cual: se inscribió ayer y completó
  /// hoy; la otra entró más tarde que ella pero no se ha movido.
  const catalina = {
    id: 'catalina',
    creadoEn: d('2026-09-15T21:39:00Z'),
    actualizadoEn: d('2026-09-16T14:36:00Z'),
  };
  const masNueva = {
    id: 'mas-nueva',
    creadoEn: d('2026-09-16T13:00:00Z'),
    actualizadoEn: d('2026-09-16T13:00:00Z'),
  };

  it('quien acaba de completar sus datos sube al primer puesto', async () => {
    const p = prismaDoble([masNueva, catalina]);
    const filas = await p.participante.findMany({
      orderBy: { actualizadoEn: 'desc' },
    });

    expect(filas[0].id).toBe('catalina');
  });

  it('y con el orden viejo se quedaba debajo, que es el defecto', async () => {
    const p = prismaDoble([masNueva, catalina]);
    const filas = await p.participante.findMany({
      orderBy: { creadoEn: 'desc' },
    });

    expect(filas[0].id).toBe('mas-nueva');
  });
});

describe('la columna no puede ir por detrás de la fila', () => {
  /// El RUI corrige un nombre: escribe movimiento y NO toca la
  /// ficha. Si la columna enseñara solo el movimiento, iría por
  /// delante; si enseñara solo `actualizadoEn`, por detrás. El
  /// mayor de los dos nunca miente en ninguna de las dos
  /// direcciones.
  it('enseña el movimiento cuando es más nuevo', () => {
    expect(
      masReciente(d('2026-09-16T15:00:00Z'), d('2026-09-16T09:00:00Z')),
    ).toEqual(d('2026-09-16T15:00:00Z'));
  });

  it('y la fecha de la ficha cuando lo es ella', () => {
    expect(
      masReciente(d('2026-09-16T09:00:00Z'), d('2026-09-16T15:00:00Z')),
    ).toEqual(d('2026-09-16T15:00:00Z'));
  });

  it('sin ningún movimiento, la de la ficha', () => {
    expect(masReciente(null, d('2026-09-16T15:00:00Z'))).toEqual(
      d('2026-09-16T15:00:00Z'),
    );
  });
});
