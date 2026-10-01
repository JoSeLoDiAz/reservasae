/** Los candados del catálogo de notas. */

/**
 * Cuatro, y cada uno protege algo que ya se rompió en esta casa de
 * otra forma:
 *
 *  1. No se repite el nombre de una categoría. Dos «No contactado»
 *     parten en dos el informe que cuelga de esa categoría.
 *  2. Ocultar NO borra. Es la regla de la casa, y aquí es
 *     obligatoria: hay notas que nombran la fila.
 *  3. Una subcategoría es de SU categoría. Cruzarlas vuelve el
 *     informe mentira sin que nada falle.
 *  4. Una nota con una subcategoría de otra categoría se rechaza, y
 *     se rechaza en el SERVIDOR: la ruta se llama directo.
 *
 * EL DOBLE APLICA LOS FILTROS DE VERDAD, como el de
 * `notificaciones.spec.ts` y por el mismo motivo: ya se falló en
 * este proyecto con un doble que devolvía lo primero que encontraba,
 * y los tests pasaban probando el doble.
 */

import type { ResultadoGestion } from '../../generated/prisma';
import { ConfiguracionDeNotasService } from './configuracion-de-notas.service';

type FilaCategoria = {
  id: string;
  nombre: string;
  orden: number;
  ocultaEn: Date | null;
  /// Qué significa la categoría. Desde el 30 sep 2026 de aquí sale
  /// el `resultado` de la nota, así que el doble tiene que tenerlo:
  /// sin la columna, el test de la derivación probaría el doble.
  resultado: ResultadoGestion | null;
};

type FilaSub = {
  id: string;
  categoriaId: string;
  nombre: string;
  orden: number;
  ocultaEn: Date | null;
};

type Donde = Record<string, unknown>;

/// El `mode: 'insensitive'` de Prisma, de verdad: sin esto el test
/// de «no se repite el nombre» pasaría con el candado quitado,
/// porque el doble compararía exacto igual que la base.
function casaNombre(valor: string, pedido: unknown): boolean {
  if (typeof pedido === 'string') return valor === pedido;
  const o = pedido as { equals?: string; mode?: string };
  if (o?.equals === undefined) return true;
  return o.mode === 'insensitive'
    ? valor.toLocaleLowerCase() === o.equals.toLocaleLowerCase()
    : valor === o.equals;
}

function casa(
  fila: Record<string, unknown>,
  donde: Donde | undefined,
): boolean {
  if (!donde) return true;
  return Object.entries(donde).every(([k, v]) => {
    if (k === 'nombre') return casaNombre(fila.nombre as string, v);
    if (k === 'ocultaEn') return v === null ? fila.ocultaEn === null : true;
    if (v !== null && typeof v === 'object' && 'not' in v) {
      return fila[k] !== v.not;
    }
    return fila[k] === v;
  });
}

function armar(
  categorias: FilaCategoria[] = [],
  subs: FilaSub[] = [],
  /// Las notas que ya nombran una fila. Sin esto, «ocultar no
  /// borra» se probaría sobre un catálogo que nadie usa, que es el
  /// caso en el que borrar no dolería.
  notas: Array<{
    id: string;
    categoriaId: string | null;
    subcategoriaId: string | null;
  }> = [],
) {
  const borrados: string[] = [];

  const prisma = {
    categoriaDeNota: {
      /// APLICA TAMBIÉN EL `where` ANIDADO de las subcategorías. Sin
      /// eso, «la oculta no se ofrece al anotar» pasaba aunque el
      /// servicio no filtrara las subcategorías: probaba el doble.
      findMany: ({
        where,
        include,
      }: {
        where?: Donde;
        include?: { subcategorias?: { where?: Donde } };
      } = {}) =>
        Promise.resolve(
          categorias
            .filter((c) => casa(c, where))
            .sort(
              (a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre),
            )
            .map((c) => ({
              ...c,
              subcategorias: subs
                .filter(
                  (s) =>
                    s.categoriaId === c.id &&
                    casa(s, include?.subcategorias?.where),
                )
                .sort((a, b) => a.orden - b.orden),
              _count: {
                notas: notas.filter((n) => n.categoriaId === c.id).length,
              },
            })),
        ),
      findFirst: ({ where }: { where?: Donde } = {}) =>
        Promise.resolve(categorias.find((c) => casa(c, where)) ?? null),
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(categorias.find((c) => c.id === where.id) ?? null),
      create: ({
        data,
      }: {
        data: {
          nombre: string;
          orden: number;
          resultado?: ResultadoGestion | null;
        };
      }) => {
        const fila: FilaCategoria = {
          id: `cat${categorias.length + 1}`,
          nombre: data.nombre,
          orden: data.orden,
          ocultaEn: null,
          resultado: data.resultado ?? null,
        };
        categorias.push(fila);
        return Promise.resolve(fila);
      },
      update: ({ where, data }: { where: { id: string }; data: Donde }) => {
        const fila = categorias.find((c) => c.id === where.id);
        if (!fila) throw new Error('el doble no tiene esa categoría');
        for (const [k, v] of Object.entries(data)) {
          if (v !== undefined) (fila as unknown as Donde)[k] = v;
        }
        return Promise.resolve(fila);
      },
      /// EL DOBLE SABE BORRAR. Y es a propósito: si el servicio
      /// algún día llama a `delete`, el test de «ocultar no borra»
      /// tiene que caerse. Con un doble sin `delete` reventaría por
      /// el motivo equivocado --«no es una función»-- y eso no
      /// prueba la regla, prueba el doble.
      delete: ({ where }: { where: { id: string } }) => {
        borrados.push(where.id);
        const i = categorias.findIndex((c) => c.id === where.id);
        if (i >= 0) categorias.splice(i, 1);
        return Promise.resolve({ id: where.id });
      },
    },
    subcategoriaDeNota: {
      findFirst: ({ where }: { where?: Donde } = {}) =>
        Promise.resolve(subs.find((s) => casa(s, where)) ?? null),
      findUnique: ({ where }: { where: { id: string } }) => {
        const s = subs.find((x) => x.id === where.id);
        if (!s) return Promise.resolve(null);
        const cat = categorias.find((c) => c.id === s.categoriaId);
        return Promise.resolve({
          ...s,
          categoria: { nombre: cat?.nombre ?? '?' },
        });
      },
      create: ({
        data,
      }: {
        data: { categoriaId: string; nombre: string; orden: number };
      }) => {
        const fila: FilaSub = {
          id: `sub${subs.length + 1}`,
          categoriaId: data.categoriaId,
          nombre: data.nombre,
          orden: data.orden,
          ocultaEn: null,
        };
        subs.push(fila);
        return Promise.resolve(fila);
      },
      update: ({ where, data }: { where: { id: string }; data: Donde }) => {
        const fila = subs.find((s) => s.id === where.id);
        if (!fila) throw new Error('el doble no tiene esa subcategoría');
        for (const [k, v] of Object.entries(data)) {
          if (v !== undefined) (fila as unknown as Donde)[k] = v;
        }
        return Promise.resolve(fila);
      },
      delete: ({ where }: { where: { id: string } }) => {
        borrados.push(where.id);
        const i = subs.findIndex((s) => s.id === where.id);
        if (i >= 0) subs.splice(i, 1);
        return Promise.resolve({ id: where.id });
      },
    },
    notaDeGestion: {
      groupBy: () =>
        Promise.resolve(
          [...new Set(notas.map((n) => n.subcategoriaId).filter(Boolean))].map(
            (id) => ({
              subcategoriaId: id,
              _count: {
                _all: notas.filter((n) => n.subcategoriaId === id).length,
              },
            }),
          ),
        ),
    },
  };

  const servicio = new ConfiguracionDeNotasService(
    prisma as never,
    {
      registrar: () => Promise.resolve(),
    } as never,
  );

  return { servicio, categorias, subs, borrados };
}

const QUIEN = { id: 'a1', nombre: 'Ana Jaramillo' };

function categoria(
  id: string,
  nombre: string,
  orden = 10,
  ocultaEn: Date | null = null,
  /// Lo que la categoría significa. Por omisión, nada: así los tests
  /// que ya existían siguen describiendo el caso que describían, y
  /// el de la derivación lo pone a propósito.
  resultado: ResultadoGestion | null = null,
): FilaCategoria {
  return { id, nombre, orden, ocultaEn, resultado };
}

function sub(
  id: string,
  categoriaId: string,
  nombre: string,
  ocultaEn: Date | null = null,
): FilaSub {
  return { id, categoriaId, nombre, orden: 10, ocultaEn };
}

describe('el nombre de una categoría no se repite', () => {
  it('rechaza el mismo nombre', async () => {
    const { servicio, categorias } = armar([categoria('c1', 'No contactado')]);

    await expect(
      servicio.crearCategoria({ nombre: 'No contactado' }, QUIEN),
    ).rejects.toThrow(/ya existe/i);

    expect(categorias).toHaveLength(1);
  });

  /// Y SIN DISTINGUIR MAYÚSCULAS, que es lo que el `@unique` de la
  /// base NO cubre: «no contactado» pasaría el índice y quedarían
  /// dos filas que en el desplegable se leen igual.
  it('rechaza el mismo nombre con otras mayúsculas', async () => {
    const { servicio, categorias } = armar([categoria('c1', 'No contactado')]);

    await expect(
      servicio.crearCategoria({ nombre: 'NO CONTACTADO' }, QUIEN),
    ).rejects.toThrow(/ya existe/i);

    expect(categorias).toHaveLength(1);
  });

  /// Si la que choca está OCULTA, el mensaje tiene que decirlo: si
  /// no, quien configura ve «ya existe» y no la encuentra en la
  /// pantalla, porque está entre las ocultas.
  it('dice que la repetida está oculta, para poder desocultarla', async () => {
    const { servicio } = armar([
      categoria('c1', 'No contactado', 10, new Date('2026-09-30')),
    ]);

    await expect(
      servicio.crearCategoria({ nombre: 'No contactado' }, QUIEN),
    ).rejects.toThrow(/oculta/i);
  });

  it('deja crear una con nombre distinto, al final del orden', async () => {
    const { servicio, categorias } = armar([
      categoria('c1', 'No contactado', 10),
    ]);

    await servicio.crearCategoria({ nombre: 'Contactado' }, QUIEN);

    expect(categorias.map((c) => [c.nombre, c.orden])).toEqual([
      ['No contactado', 10],
      ['Contactado', 20],
    ]);
  });

  /// El mismo nombre SÍ se repite entre categorías distintas: «Sin
  /// respuesta» puede tener sentido en dos sitios, y prohibirlo
  /// obligaría a inventar sinónimos.
  it('la subcategoría sí repite nombre en otra categoría', async () => {
    const { servicio, subs } = armar(
      [categoria('c1', 'No contactado'), categoria('c2', 'Contactado')],
      [sub('s1', 'c1', 'Sin respuesta')],
    );

    await servicio.crearSubcategoria('c2', { nombre: 'Sin respuesta' }, QUIEN);

    expect(subs).toHaveLength(2);
  });

  it('pero no dentro de la misma', async () => {
    const { servicio, subs } = armar(
      [categoria('c1', 'No contactado')],
      [sub('s1', 'c1', 'Sin respuesta')],
    );

    await expect(
      servicio.crearSubcategoria('c1', { nombre: 'sin respuesta' }, QUIEN),
    ).rejects.toThrow(/ya está/i);

    expect(subs).toHaveLength(1);
  });
});

describe('ocultar no borra', () => {
  it('la categoría se queda, con la fecha de cuándo dejó de ofrecerse', async () => {
    const { servicio, categorias, borrados } = armar(
      [categoria('c1', 'No contactado')],
      [sub('s1', 'c1', 'Sin respuesta')],
      [{ id: 'n1', categoriaId: 'c1', subcategoriaId: 's1' }],
    );

    await servicio.actualizarCategoria('c1', { oculta: true }, QUIEN);

    expect(borrados).toEqual([]);
    expect(categorias).toHaveLength(1);
    expect(categorias[0].ocultaEn).toBeInstanceOf(Date);
  });

  it('la subcategoría también', async () => {
    const { servicio, subs, borrados } = armar(
      [categoria('c1', 'No contactado')],
      [sub('s1', 'c1', 'Sin respuesta')],
    );

    await servicio.actualizarSubcategoria('s1', { oculta: true }, QUIEN);

    expect(borrados).toEqual([]);
    expect(subs).toHaveLength(1);
    expect(subs[0].ocultaEn).toBeInstanceOf(Date);
  });

  /// La oculta SIGUE SALIENDO en el catálogo completo, porque si no
  /// no hay forma de volver a ofrecerla; y NO sale en el de los
  /// desplegables, que es lo que significa ocultar.
  it('la oculta se ve al configurar y no se ofrece al anotar', async () => {
    const { servicio } = armar(
      [
        categoria('c1', 'No contactado'),
        categoria('c2', 'Vieja', 20, new Date()),
      ],
      [
        sub('s1', 'c1', 'Sin respuesta'),
        sub('s2', 'c1', 'Antigua', new Date()),
      ],
    );

    const todo = await servicio.listar();
    expect(todo.map((c) => c.nombre)).toEqual(['No contactado', 'Vieja']);
    expect(todo[1].oculta).toBe(true);

    const ofrecido = await servicio.listar(true);
    expect(ofrecido.map((c) => c.nombre)).toEqual(['No contactado']);
    expect(ofrecido[0].subcategorias.map((s) => s.nombre)).toEqual([
      'Sin respuesta',
    ]);
  });

  it('se vuelve a ofrecer poniendo oculta en falso', async () => {
    const { servicio, categorias } = armar([
      categoria('c1', 'No contactado', 10, new Date('2026-09-01')),
    ]);

    await servicio.actualizarCategoria('c1', { oculta: false }, QUIEN);

    expect(categorias[0].ocultaEn).toBeNull();
  });

  /// Reocultar algo ya oculto no puede mover la fecha: la pregunta
  /// que contesta es «desde cuándo», y un segundo clic la perdería.
  it('reocultar no mueve la fecha de cuándo se ocultó', async () => {
    const cuando = new Date('2026-09-01');
    const { servicio, categorias } = armar([
      categoria('c1', 'No contactado', 10, cuando),
    ]);

    await servicio.actualizarCategoria('c1', { oculta: true }, QUIEN);

    expect(categorias[0].ocultaEn).toEqual(cuando);
  });

  /// Nada nuevo cuelga de una categoría oculta: no se ofrecería en
  /// ningún desplegable y quien la creó se quedaría esperando.
  it('no deja colgar una subcategoría de una categoría oculta', async () => {
    const { servicio, subs } = armar([
      categoria('c1', 'No contactado', 10, new Date()),
    ]);

    await expect(
      servicio.crearSubcategoria('c1', { nombre: 'Sin respuesta' }, QUIEN),
    ).rejects.toThrow(/oculta/i);

    expect(subs).toEqual([]);
  });
});

describe('una subcategoría pertenece a su categoría', () => {
  it('la lista la cuelga de la suya y no de la otra', async () => {
    const { servicio } = armar(
      [categoria('c1', 'No contactado', 10), categoria('c2', 'Contactado', 20)],
      [sub('s1', 'c1', 'Sin respuesta'), sub('s2', 'c2', 'Interesado')],
    );

    const todo = await servicio.listar();

    expect(todo[0].subcategorias.map((s) => s.nombre)).toEqual([
      'Sin respuesta',
    ]);
    expect(todo[1].subcategorias.map((s) => s.nombre)).toEqual(['Interesado']);
  });

  it('acepta la pareja que de verdad va junta', async () => {
    const { servicio } = armar(
      [categoria('c1', 'No contactado')],
      [sub('s1', 'c1', 'Sin respuesta')],
    );

    await expect(
      servicio.exigirClasificacion({ categoriaId: 'c1', subcategoriaId: 's1' }),
    ).resolves.toEqual({
      categoriaId: 'c1',
      subcategoriaId: 's1',
      resultado: null,
    });
  });

  it('rechaza una subcategoría sin categoría', async () => {
    const { servicio } = armar(
      [categoria('c1', 'No contactado')],
      [sub('s1', 'c1', 'Sin respuesta')],
    );

    await expect(
      servicio.exigirClasificacion({ subcategoriaId: 's1' }),
    ).rejects.toThrow(/sin categoría/i);
  });
});

describe('una nota con la subcategoría de otra categoría se rechaza', () => {
  /// ES EL DEFECTO QUE NO SE VE: la nota quedaría guardada, nada
  /// fallaría, y el informe contaría «No contactado › Interesado»
  /// hasta que alguien cuadrara cifras. Pasa de verdad --el asesor
  /// cambia el primer desplegable y el segundo se queda con lo de
  /// antes-- y por eso se para en el servidor y no solo en la
  /// pantalla: esta ruta se llama directo.
  it('no cruza las dos categorías', async () => {
    const { servicio } = armar(
      [categoria('c1', 'No contactado'), categoria('c2', 'Contactado')],
      [sub('s1', 'c1', 'Sin respuesta'), sub('s2', 'c2', 'Interesado')],
    );

    await expect(
      servicio.exigirClasificacion({ categoriaId: 'c1', subcategoriaId: 's2' }),
    ).rejects.toThrow(/no es una subcategoría de «No contactado»/i);
  });

  it('rechaza una categoría oculta', async () => {
    const { servicio } = armar([categoria('c1', 'Vieja', 10, new Date())]);

    await expect(
      servicio.exigirClasificacion({ categoriaId: 'c1' }),
    ).rejects.toThrow(/ya no se ofrece/i);
  });

  it('rechaza una subcategoría oculta', async () => {
    const { servicio } = armar(
      [categoria('c1', 'No contactado')],
      [sub('s1', 'c1', 'Antigua', new Date())],
    );

    await expect(
      servicio.exigirClasificacion({ categoriaId: 'c1', subcategoriaId: 's1' }),
    ).rejects.toThrow(/ya no se ofrece/i);
  });

  it('rechaza una que no existe', async () => {
    const { servicio } = armar([categoria('c1', 'No contactado')]);

    await expect(
      servicio.exigirClasificacion({ categoriaId: 'inventada' }),
    ).rejects.toThrow(/no existe/i);
  });

  /// LAS NOTAS VIEJAS NO SE ROMPEN. Sin categoría es válido, y
  /// tiene que serlo: así están las miles que ya hay en la base y
  /// así quedan las que escribe el sistema.
  it('sin clasificar sigue valiendo', async () => {
    const { servicio } = armar([categoria('c1', 'No contactado')]);

    await expect(servicio.exigirClasificacion({})).resolves.toEqual({
      categoriaId: null,
      subcategoriaId: null,
      resultado: null,
    });
  });
});

/**
 * EL RESULTADO LO DECLARA LA CATEGORÍA, Y LO DERIVA EL SERVIDOR.
 *
 * Puesto el 30 sep 2026, cuando el cliente señaló que al anotar una
 * gestión se le preguntaba LO MISMO DOS VECES: arriba «Cómo salió»
 * --[Hablé con la persona] [No contestó] [El dato no sirve]-- y
 * debajo «Clasificación», cuyas cuatro categorías sembradas son esas
 * mismas tres más «Seguimiento». Textual: «Ese "Cómo salió" es la
 * "Clasificación"».
 *
 * Se quitaron los tres botones de la pantalla. El dato NO se podía
 * perder --de `NotaDeGestion.resultado` cuelgan los informes y la
 * cuenta de intentos sin respuesta-- así que la categoría declara
 * qué significa y el servidor lo deriva al escribir.
 *
 * Esto es lo que estos tests fijan, y el motivo de que existan: si
 * alguien volviera a dejar que la pantalla mandara el `resultado`,
 * habría otra vez dos sitios decidiéndolo y un día dirían cosas
 * distintas --«Contactado · SIN_RESPUESTA», coherente para la base y
 * mentira para el informe--.
 */
describe('el resultado se deriva de la categoría', () => {
  it('«No contactado» significa SIN_RESPUESTA', async () => {
    const { servicio } = armar([
      categoria('c1', 'No contactado', 10, null, 'SIN_RESPUESTA'),
    ]);

    await expect(
      servicio.exigirClasificacion({ categoriaId: 'c1' }),
    ).resolves.toEqual({
      categoriaId: 'c1',
      subcategoriaId: null,
      resultado: 'SIN_RESPUESTA',
    });
  });

  /// Con subcategoría sale lo MISMO: el resultado es de la
  /// categoría. «Sin respuesta» y «Buzón de voz» son las dos un
  /// intento sin respuesta, y hacer que cada subcategoría lo
  /// declarara sería repetir dieciséis veces lo que se dice cuatro.
  it('la subcategoría no cambia el resultado', async () => {
    const { servicio } = armar(
      [categoria('c1', 'No contactado', 10, null, 'SIN_RESPUESTA')],
      [sub('s1', 'c1', 'Buzón de voz')],
    );

    await expect(
      servicio.exigirClasificacion({ categoriaId: 'c1', subcategoriaId: 's1' }),
    ).resolves.toEqual({
      categoriaId: 'c1',
      subcategoriaId: 's1',
      resultado: 'SIN_RESPUESTA',
    });
  });

  it('«El dato no sirve» significa DATO_MALO', async () => {
    const { servicio } = armar([
      categoria('c1', 'El dato no sirve', 10, null, 'DATO_MALO'),
    ]);

    await expect(
      servicio.exigirClasificacion({ categoriaId: 'c1' }),
    ).resolves.toMatchObject({ resultado: 'DATO_MALO' });
  });

  /// «Seguimiento» → CONTACTO y no nulo: a un seguimiento solo se
  /// llega después de haber hablado con la persona.
  it('«Seguimiento» significa CONTACTO', async () => {
    const { servicio } = armar([
      categoria('c1', 'Seguimiento', 10, null, 'CONTACTO'),
    ]);

    await expect(
      servicio.exigirClasificacion({ categoriaId: 'c1' }),
    ).resolves.toMatchObject({ resultado: 'CONTACTO' });
  });

  /// UNA CATEGORÍA PUEDE NO SIGNIFICAR NADA, y entonces la nota
  /// queda sin resultado. No es un hueco: es lo que hace falta para
  /// que se pueda añadir una «Nota interna» que no es ni contacto ni
  /// intento sin que cuente en los informes de gestión.
  it('una categoría sin resultado deja la nota sin resultado', async () => {
    const { servicio } = armar([categoria('c1', 'Nota interna')]);

    await expect(
      servicio.exigirClasificacion({ categoriaId: 'c1' }),
    ).resolves.toEqual({
      categoriaId: 'c1',
      subcategoriaId: null,
      resultado: null,
    });
  });

  /// LAS NOTAS VIEJAS SE SIGUEN LEYENDO Y ESCRIBIENDO IGUAL: sin
  /// categoría, sin subcategoría y sin resultado. Es como están las
  /// miles que ya hay en la base --guardaron su `resultado` el día
  /// que se anotaron y nadie se lo toca-- y como quedan las que
  /// escribe el sistema, que no las clasifica ningún asesor.
  it('sin clasificación no hay resultado que derivar', async () => {
    const { servicio } = armar([
      categoria('c1', 'No contactado', 10, null, 'SIN_RESPUESTA'),
    ]);

    await expect(
      servicio.exigirClasificacion({ categoriaId: null }),
    ).resolves.toEqual({
      categoriaId: null,
      subcategoriaId: null,
      resultado: null,
    });
  });
});

describe('qué significa una categoría se configura', () => {
  it('se declara al crearla', async () => {
    const { servicio, categorias } = armar();

    await servicio.crearCategoria(
      { nombre: 'No contactado', resultado: 'SIN_RESPUESTA' },
      QUIEN,
    );

    expect(categorias[0].resultado).toBe('SIN_RESPUESTA');
  });

  it('sin declararlo queda sin significado', async () => {
    const { servicio, categorias } = armar();

    await servicio.crearCategoria({ nombre: 'Nota interna' }, QUIEN);

    expect(categorias[0].resultado).toBeNull();
  });

  it('se puede cambiar después', async () => {
    const { servicio, categorias } = armar([
      categoria('c1', 'Seguimiento', 10, null, 'SIN_RESPUESTA'),
    ]);

    await servicio.actualizarCategoria('c1', { resultado: 'CONTACTO' }, QUIEN);

    expect(categorias[0].resultado).toBe('CONTACTO');
  });

  /// QUITARLE EL SIGNIFICADO TIENE QUE PODERSE, y por eso el nulo
  /// viaja y no se confunde con «no vino»: si solo se pudiera
  /// cambiar de un resultado a otro, una categoría mal configurada
  /// quedaría contando algo para siempre.
  it('se le puede quitar el significado', async () => {
    const { servicio, categorias } = armar([
      categoria('c1', 'Nota interna', 10, null, 'CONTACTO'),
    ]);

    await servicio.actualizarCategoria('c1', { resultado: null }, QUIEN);

    expect(categorias[0].resultado).toBeNull();
  });

  it('lo pinta la pantalla de configuración', async () => {
    const { servicio } = armar([
      categoria('c1', 'No contactado', 10, null, 'SIN_RESPUESTA'),
      categoria('c2', 'Nota interna', 20),
    ]);

    const todo = await servicio.listar();

    expect(todo.map((c) => [c.nombre, c.resultado])).toEqual([
      ['No contactado', 'SIN_RESPUESTA'],
      ['Nota interna', null],
    ]);
  });
});
