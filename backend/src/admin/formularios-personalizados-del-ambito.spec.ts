/** Cada quien ve los formularios de SUS gremios. */

/**
 * La lista de formularios personalizados está escrita en el
 * código y es la misma para todo el mundo. Lo que no puede ser el
 * mismo para todo el mundo es lo que se enseña: quien solo lleva
 * BRITCHAM no tiene por qué ver el enlace del taller-bootcamp de
 * ADECOPRIA, que abre una acción sin publicar.
 *
 * El recorte lo hace el ámbito, igual que en el resto del panel,
 * y este spec lo ata: es la clase de cosa que se rompe el día que
 * alguien añada un formulario y filtre por lo que no es.
 */

import { AdminService } from './admin.service';

const CONVENIOS = [
  { id: 'c-adecopria', slug: 'adecopria', nombre: 'ADECOPRIA', sigla: 'ADECOPRIA' },
  { id: 'c-britcham', slug: 'britcham-adee', nombre: 'BRITCHAM ADEE', sigla: 'BRITCHAM' },
];

/** Un Prisma de mentira, con los dos gremios y una AF6. */
function prismaFalso() {
  return {
    convenio: {
      findMany: ({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(CONVENIOS.filter((c) => where.id.in.includes(c.id))),
    },
    accionFormacion: {
      findFirst: ({
        where,
      }: {
        where: { convenioId: string; codigo: string };
      }) =>
        Promise.resolve(
          where.convenioId === 'c-adecopria' && where.codigo === 'AF6'
            ? {
                codigo: 'AF6',
                nombre: 'FÁBRICA DE SOLUCIONES DIGITALES',
                /// Oculta, que es de lo que se trata.
                visible: false,
                modalidad: 'PRESENCIAL',
                horas: 16,
                ofertas: [
                  {
                    cuposMaximos: 39,
                    cuposOcupados: 14,
                    ubicacion: { nombre: 'POPAYÁN', departamento: 'CAUCA' },
                  },
                ],
              }
            : null,
        ),
    },
  };
}

function servicio() {
  return new AdminService(prismaFalso() as never);
}

describe('los formularios personalizados del ámbito', () => {
  it('quien lleva ADECOPRIA ve el del taller-bootcamp', async () => {
    const lista = await servicio().listarFormulariosPersonalizados([
      'c-adecopria',
    ]);

    /// Sin contar cuántos hay: la lista crece cada vez que se
    /// añade un formulario y un número aquí solo serviría para
    /// romper este spec por algo que no es lo que prueba.
    const bootcamp = lista.find((f) => f.palabra === 'TallerBootcamp');
    expect(bootcamp).toMatchObject({ slug: 'adecopria' });
    /// Con la acción resuelta: el código solo no le dice nada a
    /// nadie, y su `publicada` es lo que hay que poder mirar.
    expect(bootcamp?.accion).toMatchObject({
      codigo: 'AF6',
      publicada: false,
    });
    expect(bootcamp?.accion?.ofertas).toEqual([
      { ubicacion: 'POPAYÁN', departamento: 'CAUCA', libres: 25, cupos: 39 },
    ]);
  });

  it('el de Santillana no fija acción y sí trae aliado', async () => {
    /// Los dos extremos del mismo tipo: uno abre una acción
    /// oculta y no lleva aliado; el otro no toca el catálogo y
    /// solo cambia la banda de arriba.
    const lista = await servicio().listarFormulariosPersonalizados([
      'c-adecopria',
    ]);

    const santillana = lista.find((f) => f.palabra === 'Santillana');
    expect(santillana?.accion).toBeNull();
    expect(santillana?.aliado).toEqual({
      nombre: 'Santillana',
      logo: '/logos/santillana.png',
    });

    /// Y el otro NO lo lleva: si el aliado se colara en todos, el
    /// logo de un tercero saldría en convocatorias que no son
    /// suyas.
    expect(lista.find((f) => f.palabra === 'TallerBootcamp')?.aliado).toBeNull();
  });

  it('quien solo lleva el otro gremio no ve ninguno', async () => {
    const lista = await servicio().listarFormulariosPersonalizados([
      'c-britcham',
    ]);

    expect(lista).toEqual([]);
  });

  it('con ámbito vacío tampoco se cuela nada', async () => {
    /// Un ámbito vacío es «no alcanza a ningún gremio». Si esto
    /// devolviera la lista entera, una cuenta recortada vería el
    /// enlace de un gremio que no lleva.
    expect(await servicio().listarFormulariosPersonalizados([])).toEqual([]);
  });
});
