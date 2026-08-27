/// La ficha no puede nombrar el otro convenio.
///
/// `Persona` no tiene convenio a proposito: la misma cedula es
/// UNA persona con varias participaciones, y eso es lo que
/// permite contestar cuanta gente distinta se ha formado. Pero
/// no es permiso para ensenarlas todas.
///
/// Sin el filtro, la ficha abierta en adecopria.reservasae.com
/// decia que esa persona tambien esta en BRITCHAM, en que
/// curso y en que etapa. Que la base sea una sola no significa
/// que se vea todo.
///
/// Se comprueba sobre la CONSULTA y no sobre la respuesta: lo
/// que hay que garantizar es que el ambito viaje al `where`,
/// porque el filtrado lo hace Postgres y un simulacro que lo
/// imite estaria comprobando el simulacro.

import { CrmService } from './crm.service';

const ADE = 'cv-adecopria';
const BRI = 'cv-britcham';

/// Lo que se le pidio a la base en la segunda consulta.
type Consulta = { include?: Record<string, unknown> };

function conAmbito(ambito: string[]) {
  const consultas: Consulta[] = [];
  let llamadas = 0;

  const prisma = {
    participante: {
      findUnique: (args: Consulta) => {
        consultas.push(args);
        llamadas += 1;
        // la primera es el candado del ambito
        if (llamadas === 1) return Promise.resolve({ convenioId: ADE });
        return Promise.resolve(null);
      },
    },
  };

  // cuatro dependencias; solo se usa prisma
  const servicio = new CrmService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { servicio, consultas };
}

/// El `where` que se le puso a las participaciones anidadas.
function dondeDeParticipaciones(consulta: Consulta): Record<string, unknown> {
  const persona = (consulta.include as Record<string, { include?: Record<string, { where?: unknown }> }>)
    ?.persona;
  return (persona?.include?.participaciones?.where ?? {}) as Record<string, unknown>;
}

function dondeDeAutorizaciones(consulta: Consulta): Record<string, unknown> {
  const persona = (consulta.include as Record<string, { include?: Record<string, { where?: unknown }> }>)
    ?.persona;
  return (persona?.include?.autorizaciones?.where ?? {}) as Record<string, unknown>;
}

describe('la ficha no ensena el otro gremio', () => {
  it('los otros cursos de la persona se piden SOLO del ámbito', async () => {
    const { servicio, consultas } = conAmbito([ADE]);

    // devuelve null y revienta despues: da igual, lo que se
    // comprueba es lo que se le pidio a la base
    await servicio.obtener('p-1', [ADE]).catch(() => undefined);

    expect(consultas.length).toBeGreaterThanOrEqual(2);
    const donde = dondeDeParticipaciones(consultas[1]);

    expect(donde).toMatchObject({ convenioId: { in: [ADE] } });
    // y sigue excluyendose a si misma
    expect(donde).toMatchObject({ id: { not: 'p-1' } });
  });

  it('el ámbito del otro convenio no se cuela en la consulta', async () => {
    const { servicio, consultas } = conAmbito([ADE]);
    await servicio.obtener('p-1', [ADE]).catch(() => undefined);

    const donde = dondeDeParticipaciones(consultas[1]);
    const dentro = (donde.convenioId as { in: string[] }).in;
    expect(dentro).not.toContain(BRI);
  });

  it('las autorizaciones tampoco viajan las del otro convenio', async () => {
    const { servicio, consultas } = conAmbito([ADE]);
    await servicio.obtener('p-1', [ADE]).catch(() => undefined);

    const donde = dondeDeAutorizaciones(consultas[1]);
    expect(donde).toMatchObject({ politica: { convenioId: { in: [ADE] } } });
  });

  it('las REVOCADAS de su convenio sí viajan, y hace falta', async () => {
    /// Este `where` llevaba `revocadaEn: null` y se le quitó a
    /// propósito. Con él, tras revocar la ficha decía «todavía
    /// no ha autorizado» y ofrecía registrarla con un clic: la
    /// pantalla borraba de la vista un derecho que la persona
    /// acababa de ejercer.
    ///
    /// Lo que NO se puede quitar es el ámbito, y eso lo fija el
    /// test de arriba.
    const { servicio, consultas } = conAmbito([ADE]);
    await servicio.obtener('p-1', [ADE]).catch(() => undefined);

    const donde = dondeDeAutorizaciones(consultas[1]) as Record<string, unknown>;
    expect(donde.revocadaEn).toBeUndefined();
  });

  it('con los dos convenios sí se piden los dos', async () => {
    const { servicio, consultas } = conAmbito([ADE, BRI]);
    await servicio.obtener('p-1', [ADE, BRI]).catch(() => undefined);

    const donde = dondeDeParticipaciones(consultas[1]);
    expect((donde.convenioId as { in: string[] }).in).toEqual([ADE, BRI]);
  });
});
