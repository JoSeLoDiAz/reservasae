/** Lo que viene en el CUERPO también se comprueba. */

/**
 * Los cinco guardias de `formularios.service.ts` comprueban el
 * id de la RUTA. Estos tres agujeros venían en el cuerpo de la
 * petición, que no comprobaba nadie:
 *
 *  - `seccionId` de otro formulario.
 *  - `dependeDePreguntaId` de otro formulario, que deja la
 *    pregunta oculta para siempre y su respuesta descartada.
 *  - `formularioSlug` de otro convenio en la reserva pública.
 *
 * Se comprueba lo mismo que en `fuera-del-ambito.spec.ts`: que
 * no responda bien y, sobre todo, que NO SE HAYA ESCRITO NADA.
 */

import { FormulariosService } from './formularios.service';

type Escritura = { tabla: string; metodo: string };

const MIO = 'f-mio';
const AJENO = 'f-ajeno';

/** Un Prisma de mentira que anota lo que se le escribe. */
function prismaFalso() {
  const escrituras: Escritura[] = [];
  const anota =
    (tabla: string, metodo: string, valor: unknown = { id: 'x' }) =>
    () => {
      escrituras.push({ tabla, metodo });
      return Promise.resolve(valor);
    };

  /**
   * Un Prisma que de verdad FILTRA, como filtraría el de verdad.
   *
   * La primera versión decidía por el prefijo del id
   * (`id.startsWith('ajena')`), y eso hacía pasar el test aunque
   * el servicio no comprobara nada: quitándole el
   * `formularioId` al `where`, el doble seguía devolviendo null
   * por el nombre del id. O sea que probaba el doble, no el
   * candado.
   *
   * Ahora hay dos filas de verdad —una de cada formulario— y el
   * doble aplica el `where` que reciba. Si el servicio deja de
   * mandar `formularioId`, la fila ajena se encuentra y el test
   * falla, que es lo que tiene que pasar.
   */
  const FILAS = [
    { id: 's-mia', formularioId: MIO },
    { id: 'p-mia', formularioId: MIO },
    /// La que se edita en las pruebas de `actualizarPregunta`.
    /// Sin ella, `exigirPregunta` no la encuentra y el test
    /// fallaba por el guardia de la RUTA en vez de por el del
    /// cuerpo, que es el que se está probando.
    { id: 'p1', formularioId: MIO },
    { id: 'ajena-s1', formularioId: AJENO },
    { id: 'ajena-p9', formularioId: AJENO },
  ];

  const buscarCon =
    () =>
    ({ where }: { where: { id?: string; formularioId?: string } }) => {
      const fila = FILAS.find(
        (f) =>
          (where.id === undefined || f.id === where.id) &&
          (where.formularioId === undefined || f.formularioId === where.formularioId),
      );
      return Promise.resolve(fila ?? null);
    };

  return {
    escrituras,
    formulario: {
      findFirst: ({ where }: { where: { id?: string } }) =>
        Promise.resolve(where.id === MIO ? { id: MIO } : null),
      findUnique: () => Promise.resolve(null),
    },
    seccion: { findFirst: buscarCon() },
    pregunta: {
      findFirst: buscarCon(),
      findUnique: () =>
        Promise.resolve({
          id: 'p1',
          formularioId: MIO,
          campoNucleo: null,
          tipo: 'TEXTO',
          _count: { respuestas: 0 },
        }),
      aggregate: () => Promise.resolve({ _max: { orden: 3 } }),
      create: anota('pregunta', 'create'),
      update: anota('pregunta', 'update'),
    },
  };
}

function servicio() {
  const prisma = prismaFalso();
  const s = new FormulariosService(prisma as never);
  return { s, prisma };
}

const AMBITO = ['c-mio'];

describe('una pregunta no se cuelga de una sección ajena', () => {
  it('al crearla se rechaza y no se escribe', async () => {
    const { s, prisma } = servicio();

    await expect(
      s.crearPregunta(AMBITO, MIO, {
        etiqueta: '¿Cuál?',
        tipo: 'TEXTO',
        seccionId: 'ajena-s1',
      } as never),
    ).rejects.toThrow(/no es de este formulario/i);
    expect(prisma.escrituras).toEqual([]);
  });

  it('al actualizarla, igual', async () => {
    const { s, prisma } = servicio();

    await expect(
      s.actualizarPregunta(AMBITO, 'p1', { seccionId: 'ajena-s1' } as never),
    ).rejects.toThrow(/no es de este formulario/i);
    expect(prisma.escrituras).toEqual([]);
  });
});

describe('una pregunta no depende de una pregunta ajena', () => {
  it('al crearla se rechaza y no se escribe', async () => {
    const { s, prisma } = servicio();

    await expect(
      s.crearPregunta(AMBITO, MIO, {
        etiqueta: '¿Cuál?',
        tipo: 'TEXTO',
        dependeDePreguntaId: 'ajena-p9',
      } as never),
    ).rejects.toThrow(/no puede depender/i);
    expect(prisma.escrituras).toEqual([]);
  });

  it('al actualizarla, igual', async () => {
    const { s, prisma } = servicio();

    await expect(
      s.actualizarPregunta(AMBITO, 'p1', {
        dependeDePreguntaId: 'ajena-p9',
      } as never),
    ).rejects.toThrow(/no puede depender/i);
    expect(prisma.escrituras).toEqual([]);
  });
});

describe('lo propio sí pasa', () => {
  it('una sección del mismo formulario se acepta', async () => {
    const { s, prisma } = servicio();

    /// `vista()` lee otras tablas que este Prisma no tiene, así
    /// que puede fallar despues; lo que se comprueba es que la
    /// pregunta SI se creo.
    await s
      .crearPregunta(AMBITO, MIO, {
        etiqueta: '¿Cuál?',
        tipo: 'TEXTO',
        seccionId: 's-mia',
      } as never)
      .catch(() => undefined);

    expect(prisma.escrituras.map((e) => e.tabla)).toContain('pregunta');
  });
});

describe('la reserva pública no cuela el formulario del otro convenio', () => {
  /// El agujero era por la puerta PUBLICA: la oferta de un
  /// gremio con el `formularioSlug` del otro. Solo se
  /// comprobaba que estuviera publicado.
  function conFormulario(convenioId: string) {
    const prisma = {
      formulario: {
        findUnique: () =>
          Promise.resolve({
            id: 'f-otro',
            convenioId,
            publicado: true,
            preguntas: [],
          }),
      },
    };
    return new FormulariosService(prisma as never);
  }

  it('el del otro convenio se rechaza', async () => {
    const s = conFormulario('c-otro');

    await expect(
      s.prepararRespuestas('britcham-adee', [], 'c-mio'),
    ).rejects.toThrow(/no está publicado/i);
  });

  it('y el mensaje NO dice que es del otro: sería un oráculo', async () => {
    const s = conFormulario('c-otro');

    await expect(
      s.prepararRespuestas('britcham-adee', [], 'c-mio'),
    ).rejects.not.toThrow(/convenio|gremio|ajeno/i);
  });

  it('el del mismo convenio pasa', async () => {
    const s = conFormulario('c-mio');

    const r = await s.prepararRespuestas('adecopria', [], 'c-mio');
    expect(r.formularioId).toBe('f-otro');
  });
});
