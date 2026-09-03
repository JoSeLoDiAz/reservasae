/** Un NIT es UNA organización, y escribir otro nombre lo corrige. */

/**
 * `instituciones` era única por `(nit, razonSocial)`, así que
 * escribir un nombre distinto para el mismo NIT **creaba otra
 * fila**. Así es como el SENA acabó siendo «SENA» y «SENA REGIONAL
 * ANTIOQUIA» a la vez, y el formulario público preguntándole a la
 * gente «ese NIT ampara a 2 organizaciones, elija la suya».
 *
 * Lo que zanja el argumento: `Empresa` —la tabla que de verdad va
 * al F7— YA era única por `nit`. Un NIT ya era una organización
 * donde importa; el directorio era el único sitio que decía otra
 * cosa. Y el F7 va POR ORGANIZACIÓN: dos nombres para el mismo NIT
 * son dos filas que el SENA no puede cuadrar con un registro.
 *
 * El doble de Prisma se comporta como la BASE con la llave nueva:
 * `upsert` por `nit`. Uno que aceptara cualquier `where` probaría
 * el doble, no el candado.
 */

import { DirectorioService } from './directorio.service';

type Fila = { id: string; nit: string; razonSocial: string };

function armar(filas: Fila[] = []) {
  const tabla = [...filas];

  const prisma = {
    institucion: {
      upsert: (a: {
        where: Record<string, unknown>;
        update: { razonSocial?: string };
        create: { nit: string; razonSocial: string };
      }) => {
        /// LA LLAVE NUEVA. Si alguien devuelve la compuesta, esto
        /// revienta y el test lo dice.
        if (typeof a.where.nit !== 'string') {
          throw new Error(
            'El upsert tiene que ir por NIT: la llave compuesta permitía dos filas.',
          );
        }
        const hay = tabla.find((f) => f.nit === a.where.nit);
        if (hay) {
          if (a.update.razonSocial) hay.razonSocial = a.update.razonSocial;
          return Promise.resolve({ ...hay, digitoDeclarado: null, fuente: 'HUMANO' });
        }
        const nueva = { id: `i${tabla.length + 1}`, ...a.create };
        tabla.push(nueva);
        return Promise.resolve({ ...nueva, digitoDeclarado: null, fuente: 'HUMANO' });
      },
      findMany: (a: { where: { nit: string } }) =>
        Promise.resolve(tabla.filter((f) => f.nit === a.where.nit)),
    },
  };

  return { s: new DirectorioService(prisma as never), tabla };
}

const NIT_SENA = '899999034';

describe('escribir otro nombre CORRIGE, no crea una segunda', () => {
  it('el mismo NIT con otro nombre deja UNA sola fila', async () => {
    /// El caso exacto que se vio en pruebas: alguien escribió
    /// «SENA» donde el directorio decía «SENA REGIONAL ANTIOQUIA»,
    /// y quedaron las dos.
    const { s, tabla } = armar([
      { id: 'i1', nit: NIT_SENA, razonSocial: 'SENA REGIONAL ANTIOQUIA' },
    ]);

    await s.agregarManual(NIT_SENA, 'Servicio Nacional de Aprendizaje');

    expect(tabla).toHaveLength(1);
    expect(tabla[0].razonSocial).toBe('Servicio Nacional de Aprendizaje');
  });

  it('un NIT que no estaba sí se crea', async () => {
    const { s, tabla } = armar();
    await s.agregarManual('890905211', 'Alcaldía de Medellín');
    expect(tabla).toHaveLength(1);
  });

  it('y dos NIT distintos siguen siendo dos', async () => {
    /// El aserto que protege del arreglo excesivo: unificar por
    /// NIT no puede unificar organizaciones distintas.
    const { s, tabla } = armar();
    await s.agregarManual(NIT_SENA, 'SENA');
    await s.agregarManual('890905211', 'Alcaldía de Medellín');
    expect(tabla).toHaveLength(2);
  });
});

describe('la búsqueda devuelve una, no una lista para elegir', () => {
  it('con el NIT en el directorio, viene una sola', async () => {
    const { s } = armar([{ id: 'i1', nit: NIT_SENA, razonSocial: 'SENA' }]);
    const r = await s.buscar(NIT_SENA);
    expect(r.instituciones).toHaveLength(1);
    expect(r.agrupaVarias).toBe(false);
  });

  it('sin el NIT, viene vacía', async () => {
    const { s } = armar();
    const r = await s.buscar(NIT_SENA);
    expect(r.instituciones).toEqual([]);
  });
});
