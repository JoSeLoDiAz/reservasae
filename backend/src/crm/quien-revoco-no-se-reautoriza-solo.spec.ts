/** Quien revocó el tratamiento de sus datos no vuelve solo. */

/**
 * LA PUERTA PÚBLICA RESUCITABA UN DERECHO YA EJERCIDO.
 *
 * `dejarConstancia` miraba únicamente las autorizaciones VIVAS para no
 * duplicarlas. Ante una REVOCADA caía derecho al `create` y escribía
 * una nueva, así que la persona volvía a contar como autorizada para
 * matricular y para reportar al SENA.
 *
 * La conversión de un lead ya lo comprobaba por su cuenta
 * ---`revocoDespuesDe`, con un comentario que dice literalmente
 * «escribirla ahora resucitaría en silencio un derecho que ya
 * ejerció»--- y la preinscripción pública no. Y es la peor de las dos
 * para saltárselo: es una ruta ANÓNIMA Y SIN SESIÓN donde basta
 * teclear una cédula. Un tercero podía reactivar el tratamiento de
 * datos de alguien que había pedido expresamente que pararan.
 *
 * Es el mismo patrón que este repositorio ya ha visto cuatro veces:
 * un arreglo que cierra el camino principal y deja abierta la pública,
 * que es la que más gente usa y la que menos se mira.
 *
 * Por eso la comprobación vive en `dejarConstancia` y no en cada
 * llamador: es el único sitio del sistema que escribe esa fila.
 */

import { dejarConstancia } from './constancia-de-autorizacion';

const POLITICA = { id: 'pol-1', version: 2 };

/// Un prisma de mentira que responde lo justo.
function prismaCon({ revocada, viva }: { revocada: boolean; viva: boolean }) {
  const creadas: unknown[] = [];
  return {
    creadas,
    prisma: {
      politicaDatos: { findFirst: () => Promise.resolve(POLITICA) },
      autorizacionDatos: {
        findFirst: ({ where }: { where: Record<string, unknown> }) => {
          /// La consulta de la revocada pide `revocadaEn: { not: null }`;
          /// la de la viva, `revocadaEn: null`. Se distinguen por ahí.
          const pideRevocada =
            typeof where.revocadaEn === 'object' && where.revocadaEn !== null;
          if (pideRevocada)
            return Promise.resolve(revocada ? { id: 'a-1' } : null);
          return Promise.resolve(viva ? { id: 'a-2' } : null);
        },
        create: (args: unknown) => {
          creadas.push(args);
          return Promise.resolve({ id: 'nueva' });
        },
      },
    },
  };
}

const CONSTANCIA = {
  personaId: 'per-1',
  convenioId: 'conv-1',
  canal: 'FORMULARIO_WEB' as const,
  evidencia: 'Formulario de preinscripción',
};

describe('cuándo se escribe la constancia', () => {
  it('sin autorización previa, se escribe', async () => {
    const { prisma, creadas } = prismaCon({ revocada: false, viva: false });
    await expect(dejarConstancia(prisma as never, CONSTANCIA)).resolves.toBe(
      'REGISTRADA',
    );
    expect(creadas).toHaveLength(1);
  });

  it('si ya la tenía viva, no se duplica', async () => {
    const { prisma, creadas } = prismaCon({ revocada: false, viva: true });
    await expect(dejarConstancia(prisma as never, CONSTANCIA)).resolves.toBe(
      'YA_TENIA',
    );
    expect(creadas).toEqual([]);
  });

  /**
   * EL CASO QUE SE COLABA. Y lo que importa no es el valor que
   * devuelve, sino que NO SE ESCRIBA NADA: una fila nueva aquí es una
   * autorización que la persona no dio.
   */
  it('si revocó, NO se escribe ninguna', async () => {
    const { prisma, creadas } = prismaCon({ revocada: true, viva: false });
    await expect(dejarConstancia(prisma as never, CONSTANCIA)).resolves.toBe(
      'REVOCADA',
    );
    expect(creadas).toEqual([]);
  });

  /**
   * LA REVOCACIÓN MANDA SOBRE LA VIVA, y conviene que esté fijado: una
   * persona puede tener una autorización viva contra una versión del
   * texto y haber revocado otra. Ante la duda, no se escribe.
   */
  it('con una revocada y una viva, sigue sin escribirse', async () => {
    const { prisma, creadas } = prismaCon({ revocada: true, viva: true });
    await expect(dejarConstancia(prisma as never, CONSTANCIA)).resolves.toBe(
      'REVOCADA',
    );
    expect(creadas).toEqual([]);
  });

  it('sin política publicada no se escribe nada, como antes', async () => {
    const { creadas } = prismaCon({ revocada: false, viva: false });
    const prisma = {
      politicaDatos: { findFirst: () => Promise.resolve(null) },
      autorizacionDatos: {
        findFirst: () => Promise.resolve(null),
        create: () => {},
      },
    };
    await expect(dejarConstancia(prisma as never, CONSTANCIA)).resolves.toBe(
      'SIN_POLITICA',
    );
    expect(creadas).toEqual([]);
  });
});

describe('la revocación se busca por CONVENIO, no por versión del texto', () => {
  /**
   * Y no es un detalle: las políticas se versionan, así que atar la
   * búsqueda a `politicaDatosId` dejaría pasar a quien revocó la
   * versión 1 en cuanto se publicara la 2. El derecho se ejerce sobre
   * el tratamiento de sus datos en ese convenio, no sobre un PDF.
   */
  it('la consulta filtra por el convenio entero', () => {
    const t = require('fs').readFileSync(
      require('path').join(__dirname, 'constancia-de-autorizacion.ts'),
      'utf8',
    ) as string;
    const i = t.indexOf('revocadaEn: { not: null }');
    expect(i).toBeGreaterThan(-1);
    /// El `where` que la contiene pide el convenio, no la política.
    const desde = t.lastIndexOf('where:', i);
    expect(t.slice(desde, i)).toContain(
      'politica: { convenioId: c.convenioId }',
    );
  });
});
