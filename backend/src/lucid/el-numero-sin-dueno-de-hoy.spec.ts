/** La conversación cuyo dueño apareció después recibe su nota. */

/**
 * «EL NUMERO SIN DUENO DE HOY ES EL DUENO DE MANANA» estaba escrito en
 * `olvido.ts` como intencion y NO se cumplia: una conversacion de
 * alguien que todavia no estaba en el CRM nacia `SIN_DUENO` y el unico
 * proceso que volvia a mirarla era el olvidador, que a los 60 dias la
 * BORRA.
 *
 * Lo pidio Josse el 8 oct 2026 con el orden invertido ---«los que no
 * estan registrados se ingresen de manera masiva y POSTERIORMENTE
 * guarde la gestion»--- y en ese orden se perdia todo.
 */

import { EstadoConversacion } from '../../generated/prisma';
import { LucidService } from './lucid.service';
import { DIAS_QUE_SE_GUARDAN } from './olvido';

const HOY = new Date('2026-10-08T12:00:00.000Z');
const haceDias = (d: number) => new Date(HOY.getTime() - d * 24 * 60 * 60 * 1000);

const HUERFANA = {
  id: 'conv1',
  convenioId: 'c1',
  celular: '3001234567',
  resumen: 'Preguntó por el curso de IA',
  origenSistema: 'lucid',
};

function armar(opciones: {
  huerfanas?: unknown[];
  fichas?: unknown[];
  leads?: unknown[];
} = {}) {
  const escrito: Record<string, unknown> = {};
  const pedido: Record<string, unknown> = {};
  const prisma = {
    conversacionEntrante: {
      findMany: (a: unknown) => {
        pedido.huerfanas = a;
        return Promise.resolve(opciones.huerfanas ?? [HUERFANA]);
      },
      update: (a: unknown) => {
        escrito.conversacion = a;
        return Promise.resolve({});
      },
    },
    participante: { findMany: () => Promise.resolve(opciones.fichas ?? []) },
    leadEntrante: {
      findMany: () => Promise.resolve(opciones.leads ?? []),
      update: (a: unknown) => {
        escrito.lead = a;
        return Promise.resolve({});
      },
    },
    notaDeGestion: {
      create: (a: unknown) => {
        escrito.nota = a;
        return Promise.resolve({ id: 'nota1' });
      },
    },
  };
  return { s: new LucidService(prisma as never), escrito, pedido };
}

const FICHA = { id: 'p1', personaId: 'per1', creadoEn: haceDias(1) };

describe('el número sin dueño de hoy', () => {
  it('si ya es ficha, le cuelga su nota', async () => {
    const { s, escrito } = armar({ fichas: [FICHA] });
    const r = await s.repescar(HOY);
    expect(r).toEqual({ miradas: 1, pegadas: 1 });
    expect((escrito.nota as { data: { participanteId: string } }).data.participanteId).toBe('p1');
  });

  /**
   * Y LA DEJA `PEGADA`, que es la mitad que importa: sin eso la fila
   * sigue en `SIN_DUENO` con su nota ya colgada, y el olvidador la
   * borra a los 60 dias ---dejando la nota huerfana y perdiendo la
   * idempotencia, asi que un reintento colgaria una segunda---.
   */
  it('deja la conversación PEGADA, no SIN_DUENO', async () => {
    const { s, escrito } = armar({ fichas: [FICHA] });
    await s.repescar(HOY);
    expect((escrito.conversacion as { data: Record<string, unknown> }).data).toEqual({
      notaId: 'nota1',
      estado: EstadoConversacion.PEGADA,
    });
  });

  it('si sigue sin ser de nadie, no escribe nada', async () => {
    const { s, escrito } = armar();
    const r = await s.repescar(HOY);
    expect(r).toEqual({ miradas: 1, pegadas: 0 });
    expect(escrito.nota).toBeUndefined();
    expect(escrito.conversacion).toBeUndefined();
  });

  /**
   * SOLO `SIN_DUENO`, igual que el olvidador. Una `PEGADA` ya tiene su
   * nota y volver a colgarsela seria dos; una `AMBIGUA` SI es de
   * alguien ---de varios--- y que aparezca uno mas no lo resuelve.
   */
  it('solo mira las SIN_DUENO', async () => {
    const { s, pedido } = armar();
    await s.repescar(HOY);
    const w = (pedido.huerfanas as { where: Record<string, unknown> }).where;
    expect(w.estado).toBe(EstadoConversacion.SIN_DUENO);
  });

  /**
   * LA VENTANA ES LA DEL OLVIDADOR, y no es un numero suelto: mas alla
   * la fila ya no existe. Una ventana mas corta dejaria conversaciones
   * vivas que nadie vuelve a mirar y que despues se borran.
   */
  it('la ventana es la misma que la del olvidador', async () => {
    const { s, pedido } = armar();
    await s.repescar(HOY);
    const w = (pedido.huerfanas as { where: { recibidoEn: { gte: Date } } }).where;
    expect(w.recibidoEn.gte.getTime()).toBe(haceDias(DIAS_QUE_SE_GUARDAN).getTime());
  });

  /// De las mas viejas primero: son las que menos les queda antes de
  /// que el olvidador se las lleve.
  it('empieza por las más viejas', async () => {
    const { s, pedido } = armar();
    await s.repescar(HOY);
    expect((pedido.huerfanas as { orderBy: unknown }).orderBy).toEqual({ recibidoEn: 'asc' });
  });

  /// Cada fila pregunta por su celular, asi que sin tope un barrido
  /// sobre miles seria una tormenta de consultas cada media hora.
  it('tiene tope por pasada', async () => {
    const { s, pedido } = armar();
    await s.repescar(HOY);
    expect((pedido.huerfanas as { take: number }).take).toBeGreaterThan(0);
  });

  /// Si el dueño es un LEAD se le mueve la última gestión: es verdad
  /// que se le tocó, y la cola del asesor se ordena por eso.
  it('si el dueño es un lead, le mueve la última gestión', async () => {
    const { s, escrito } = armar({ leads: [{ id: 'l1', recibidoEn: haceDias(1) }] });
    await s.repescar(HOY);
    expect((escrito.lead as { where: { id: string } }).where.id).toBe('l1');
  });

  /**
   * LA NOTA VA SIN RESULTADO, tambien aqui. `gestionDe()` cuenta los
   * intentos con `resultado: { not: null }`: poner CONTACTO vaciaria
   * sola la lista de a quien hay que insistirle, que es el producto.
   */
  it('la nota repescada no cuenta como gestión', async () => {
    const { s, escrito } = armar({ fichas: [FICHA] });
    await s.repescar(HOY);
    expect((escrito.nota as { data: { resultado: unknown } }).data.resultado).toBeNull();
  });
});
