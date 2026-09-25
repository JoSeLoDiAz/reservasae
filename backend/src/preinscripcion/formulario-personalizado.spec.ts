/** Una acción oculta solo se abre por SU formulario. */

/**
 * El encargo (Mauricio, 23 sep 2026) es que la AF6 de ADECOPRIA
 * --el taller-bootcamp, que no se oferta al público-- se pueda
 * llenar por un enlace propio, `?TallerBootcamp`, sin publicarla.
 *
 * Lo que se prueba aquí es el CANDADO, no la pantalla: que la
 * palabra abre esa acción y NINGUNA otra, que sin palabra todo
 * sigue como estaba, y que una palabra inventada --o la buena en
 * el gremio equivocado-- no abre nada.
 *
 * Se mira el `where` que sale hacia Prisma y no el resultado: es
 * el sitio exacto donde una acción oculta deja de estarlo, y un
 * doble que devuelva filas ya da por bueno justo lo que se
 * pregunta.
 */

import { PreinscripcionService } from './preinscripcion.service';
import { dobleDeEnlace } from './doble-enlace';
import { dobleDeColaDeCorreo } from '../correo/automaticos/doble';
import { dobleDeEmbudo } from '../embudo/doble';
import { todosLosFormularios } from './formularios-personalizados';
/// Compilado desde el frontend, igual que `enlace-corto.spec.ts`:
/// la regla del enlace corto vive allí y aquí solo se comprueba
/// que estas palabras no se le meten dentro.
import { leerEnlaceCorto } from '../../../frontend/src/lib/enlace-corto';

/** Un Prisma de mentira que anota los `where` que recibe. */
function prismaFalso() {
  const donde: { acciones?: unknown; oferta?: unknown } = {};

  return {
    donde,
    convenio: {
      findFirst: ({ where }: { where: { slug: string } }) =>
        Promise.resolve({
          id: 'c1',
          slug: where.slug,
          nombre: 'ADECOPRIA',
          sigla: 'ADECOPRIA',
        }),
    },
    accionFormacion: {
      findMany: ({ where }: { where: unknown }) => {
        donde.acciones = where;
        return Promise.resolve([]);
      },
    },
    politicaDatos: { findFirst: () => Promise.resolve(null) },
    oferta: {
      findFirst: ({ where }: { where: unknown }) => {
        donde.oferta = where;
        /// Null: al registro le basta con que la oferta no
        /// aparezca. Lo que importa es con qué la buscó.
        return Promise.resolve(null);
      },
    },
  };
}

function servicio() {
  const prisma = prismaFalso();
  const s = new PreinscripcionService(
    prisma as never,
    { encolarSiHaceFalta: () => Promise.resolve() } as never,
    { registrar: () => Promise.resolve() } as never,
    { enviar: () => Promise.resolve({ estado: 'APAGADO' }) } as never,
    { agregarManual: () => Promise.resolve(null) } as never,
    dobleDeEmbudo(),
    dobleDeColaDeCorreo(),
    dobleDeEnlace('NO-SALE'),
  
    { avisar: () => Promise.resolve() } as never,
  );
  return { s, prisma };
}

/// El `where` de las acciones, ya en forma de objeto plano.
function condicion(valor: unknown): Record<string, unknown> {
  return (valor ?? {}) as Record<string, unknown>;
}

describe('el catálogo del formulario personalizado', () => {
  it('sin palabra solo sirve lo publicado, como siempre', async () => {
    const { s, prisma } = servicio();

    await s.catalogo('adecopria');

    expect(condicion(prisma.donde.acciones)).toMatchObject({ visible: true });
  });

  it('con la palabra trae SU acción, publicada o no', async () => {
    const { s, prisma } = servicio();

    await s.catalogo('adecopria', 'TallerBootcamp');

    const donde = condicion(prisma.donde.acciones);
    expect(donde).toMatchObject({ codigo: 'AF6' });
    /// Y sin `visible`: si siguiera ahí, el formulario no
    /// enseñaría nada y todo esto no serviría de nada.
    expect(donde).not.toHaveProperty('visible');
  });

  it('da igual cómo se escriban las mayúsculas', async () => {
    const { s, prisma } = servicio();

    await s.catalogo('adecopria', 'tallerbootcamp');

    expect(condicion(prisma.donde.acciones)).toMatchObject({ codigo: 'AF6' });
  });

  it('una palabra inventada no abre nada', async () => {
    const { s, prisma } = servicio();

    await s.catalogo('adecopria', 'AbreteSesamo');

    expect(condicion(prisma.donde.acciones)).toMatchObject({ visible: true });
  });

  it('la palabra buena en el otro gremio tampoco', async () => {
    /// Son dos convenios distintos y cada formulario es de uno.
    /// Sin esto, el enlace de ADECOPRIA abriría en BRITCHAM una
    /// acción que allí se llama igual.
    const { s, prisma } = servicio();

    await s.catalogo('britcham-adee', 'TallerBootcamp');

    expect(condicion(prisma.donde.acciones)).toMatchObject({ visible: true });
  });
});

describe('el registro, que es el candado de verdad', () => {
  const BASE = {
    ofertaId: 'o1',
    tipoDocumentoSepId: 1,
    numeroDocumento: '1019456782',
    primerNombre: 'Ana',
    primerApellido: 'Jaramillo',
    aceptaPolitica: true,
  };

  /// La oferta no aparece --el doble devuelve null-- y el
  /// servicio corta con un 400. Lo que se mira es el `where`.
  async function intentar(dto: Record<string, unknown>) {
    const { s, prisma } = servicio();
    await expect(s.registrar('adecopria', dto as never)).rejects.toThrow();
    const donde = condicion(prisma.donde.oferta);
    return condicion(donde.accionFormacion);
  }

  it('un POST sin palabra sigue exigiendo que esté publicada', async () => {
    expect(await intentar(BASE)).toMatchObject({ visible: true });
  });

  it('con la palabra, solo por el código que ella nombra', async () => {
    /// Contra el CÓDIGO y no contra «trae formulario»: si fuera
    /// lo segundo, esta misma palabra con el id de una oferta de
    /// cualquier otra acción oculta la abriría también.
    const donde = await intentar({ ...BASE, formulario: 'TallerBootcamp' });
    expect(donde).toMatchObject({ codigo: 'AF6' });
    expect(donde).not.toHaveProperty('visible');
  });

  it('con una palabra inventada, no', async () => {
    expect(
      await intentar({ ...BASE, formulario: 'AbreteSesamo' }),
    ).toMatchObject({ visible: true });
  });
});

describe('las palabras no se pisan con el enlace corto', () => {
  it('ninguna se lee como campaña', () => {
    /// La misma palabra haciendo dos cosas es de las que no se
    /// ven hasta que la pauta sale mal contada: `procedenciaDe`
    /// clasifica el canal por el prefijo del enlace corto.
    for (const f of todosLosFormularios()) {
      expect(leerEnlaceCorto(`?${f.palabra}`)).toBeNull();
    }
  });
});
