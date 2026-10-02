/** Dos reintentos a la vez no crean dos leads. */

/**
 * A-08, Y ES LO QUE HACEN LOS REINTENTOS DE META.
 *
 * `recibir` comprueba primero si el lead ya está ---`findUnique` por
 * `origenSistema_externoId`--- y si no, lo crea. Esa comprobación NO
 * BASTA, y no por estar mal escrita: entre el SELECT y el INSERT caben
 * los dos. Dos reintentos del mismo webhook llegan a la vez, los dos
 * leen que no existe, y los dos crean.
 *
 * La base lo paraba ---hay `@@unique([origenSistema, externoId])`---
 * pero paraba MAL: el segundo reventaba con un 500. Y quien manda el
 * webhook lee un 500 como «no llegó» y REINTENTA. La misma persona
 * entrando dos veces y dos asesoras llamándola.
 *
 * Ahora el que pierde la carrera relee lo que escribió el que ganó y
 * contesta lo mismo que cuando el lead ya estaba: `repetido: true`.
 */

import { Prisma } from '../../generated/prisma';

/**
 * LA RAMA DE RECUPERACIÓN, SOLA.
 *
 * Copia literal de la que quedó en `leads.service.ts`. `recibir` pide
 * media docena de tablas para llegar hasta el `create`, y lo que puede
 * equivocarse aquí es QUÉ SE HACE CON EL ERROR, no el camino para
 * llegar. El último caso lee el servicio para que esta copia no mienta.
 */
async function conLaCarrera(
  crear: () => Promise<{ id: string }>,
  releer: () => Promise<{ id: string } | null>,
): Promise<{ id: string; repetido: boolean }> {
  try {
    const lead = await crear();
    return { ...lead, repetido: false };
  } catch (e) {
    if (
      !(e instanceof Prisma.PrismaClientKnownRequestError) ||
      e.code !== 'P2002'
    ) {
      throw e;
    }
    const gano = await releer();
    if (!gano) throw e;
    return { ...gano, repetido: true };
  }
}

const choque = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'x',
  });

describe('dos reintentos del mismo webhook', () => {
  it('el que gana crea, y dice que es nuevo', async () => {
    const r = await conLaCarrera(
      () => Promise.resolve({ id: 'l1' }),
      () => Promise.resolve(null),
    );
    expect(r).toEqual({ id: 'l1', repetido: false });
  });

  it('el que pierde NO revienta: relee y dice que ya estaba', async () => {
    const r = await conLaCarrera(
      () => Promise.reject(choque()),
      () => Promise.resolve({ id: 'l1' }),
    );
    /// El MISMO id que creó el otro. Si devolviera uno nuevo, quien
    /// manda el webhook ataría su registro a una ficha que no existe.
    expect(r).toEqual({ id: 'l1', repetido: true });
  });

  /**
   * LO QUE NO SE PUEDE TRAGAR, y es la mitad del arreglo.
   *
   * Capturar todo convertiría un fallo de base ---conexión caída, una
   * columna que no admite nulos--- en un lead silenciosamente perdido:
   * el webhook recibiría un 200 y nadie volvería a mandarlo.
   */
  it('cualquier otro error de base sube tal cual', async () => {
    const otro = new Prisma.PrismaClientKnownRequestError('se cayó', {
      code: 'P1001',
      clientVersion: 'x',
    });
    await expect(
      conLaCarrera(
        () => Promise.reject(otro),
        () => Promise.resolve({ id: 'l1' }),
      ),
    ).rejects.toThrow(/se cayó/);
  });

  it('y un error que no es de prisma, tampoco se traga', async () => {
    await expect(
      conLaCarrera(
        () => Promise.reject(new Error('cualquier cosa')),
        () => Promise.resolve({ id: 'l1' }),
      ),
    ).rejects.toThrow(/cualquier cosa/);
  });

  /**
   * EL P2002 QUE NO ERA DE ESTA CARRERA.
   *
   * Un único distinto puede saltar con el mismo código. Si se relee y
   * no hay nada, devolver «repetido» sería mentir sobre un lead que no
   * entró: quien lo mandó dejaría de reintentar y ese lead se pierde.
   */
  it('si al releer no hay nada, el error sube', async () => {
    await expect(
      conLaCarrera(
        () => Promise.reject(choque()),
        () => Promise.resolve(null),
      ),
    ).rejects.toThrow(/Unique constraint/);
  });
});

describe('la rama de arriba es la que está en el servicio', () => {
  const fuente = () =>
    require('fs').readFileSync(
      require('path').join(__dirname, 'leads.service.ts'),
      'utf8',
    ) as string;

  it('el create va dentro de un try que mira P2002', () => {
    const t = fuente();
    expect(t).toContain('lead = await this.prisma.leadEntrante.create({');
    expect(t).toContain("e.code !== 'P2002'");
    expect(t).toContain('if (!gano) throw e;');
    expect(t).toContain('return { ...this.vista(gano), repetido: true };');
  });

  /**
   * Y QUE EL ÚNICO SIGA AHÍ, porque todo esto descansa en él: sin
   * `@@unique([origenSistema, externoId])` no hay P2002 que capturar y
   * los dos reintentos crean dos filas sin que nada falle.
   */
  it('y el único sobre el que descansa sigue en el schema', () => {
    const schema = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'prisma', 'schema.prisma'),
      'utf8',
    ) as string;
    const modelo = schema.slice(
      schema.indexOf('model LeadEntrante'),
      schema.indexOf('\n}', schema.indexOf('model LeadEntrante')),
    );
    expect(modelo).toContain('@@unique([origenSistema, externoId])');
  });
});
