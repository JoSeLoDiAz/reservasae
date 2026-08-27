/// Que la direccion elija la marca es lo que hace que el
/// panel de un gremio salga con su logo. Y las tres puertas
/// generales tienen que seguir siendo generales: son las
/// restricciones que no se pueden violar.

import { AdminService } from './admin.service';

const ACTIVOS = [
  { id: 'c1', slug: 'adecopria' },
  { id: 'c2', slug: 'britcham-adee' },
];

/// Solo lo que tocan los dos metodos que se prueban.
function conConvenios(marcaDe: Record<string, string | null>) {
  const prisma = {
    convenio: {
      findMany: jest.fn().mockResolvedValue(ACTIVOS),
      findFirst: jest.fn(({ where }: { where: { slug: string } }) => {
        const slug = marcaDe[where.slug];
        if (slug === undefined) return Promise.resolve(null);
        return Promise.resolve({
          formularioMarca: slug === null ? null : { slug },
        });
      }),
    },
  };

  const servicio = new AdminService(prisma as never);
  const general = jest
    .spyOn(servicio, 'obtenerMarca')
    .mockResolvedValue({ ambito: 'GENERAL' } as never);
  const deFormulario = jest
    .spyOn(servicio, 'obtenerMarcaDeFormulario')
    .mockImplementation(
      (slug, incluir) =>
        Promise.resolve({ ambito: 'FORMULARIO', slug, incluir }) as never,
    );

  return { servicio, general, deFormulario };
}

const CON_MARCA = { adecopria: 'adecopria', 'britcham-adee': 'britcham-adee' };

describe('la marca que decide la direccion', () => {
  it('el subdominio del gremio trae la marca de SU formulario', async () => {
    const { servicio, deFormulario } = conConvenios(CON_MARCA);
    const r = (await servicio.obtenerMarcaDelHost(
      'adecopria.reservasae.com',
    )) as unknown as { ambito: string; slug: string };

    expect(r.ambito).toBe('FORMULARIO');
    expect(r.slug).toBe('adecopria');
    expect(deFormulario).toHaveBeenCalledWith('adecopria', true);
  });

  it('el borrador tambien da marca: publicar es otra decision', async () => {
    const { servicio } = conConvenios(CON_MARCA);
    const r = (await servicio.obtenerMarcaDelHost(
      'britcham-adee.reservasae.com',
    )) as unknown as { incluir: boolean };

    // en produccion los formularios nacen en borrador
    expect(r.incluir).toBe(true);
  });

  it('las puertas generales siguen siendo generales', async () => {
    for (const host of [
      'reservasae.com',
      'www.reservasae.com',
      'localhost:3000',
      'prueba.reservasae.com',
      '127.0.0.1:4000',
      undefined,
    ]) {
      const { servicio, general, deFormulario } = conConvenios(CON_MARCA);
      const r = (await servicio.obtenerMarcaDelHost(host)) as unknown as {
        ambito: string;
      };
      expect([host, r.ambito]).toEqual([host, 'GENERAL']);
      expect(general).toHaveBeenCalled();
      expect(deFormulario).not.toHaveBeenCalled();
    }
  });

  it('un subdominio que no es de nadie cae en la general', async () => {
    const { servicio, deFormulario } = conConvenios(CON_MARCA);
    const r = (await servicio.obtenerMarcaDelHost(
      'cualquiera.reservasae.com',
    )) as unknown as { ambito: string };

    expect(r.ambito).toBe('GENERAL');
    expect(deFormulario).not.toHaveBeenCalled();
  });

  it('un gremio sin formulario de marca no rompe: da la general', async () => {
    const { servicio, general } = conConvenios({ adecopria: null });
    const r = (await servicio.obtenerMarcaDeGremio(
      'adecopria',
    )) as unknown as { ambito: string };

    expect(r.ambito).toBe('GENERAL');
    expect(general).toHaveBeenCalled();
  });

  it('un convenio que no existe tampoco rompe', async () => {
    const { servicio } = conConvenios({});
    const r = (await servicio.obtenerMarcaDeGremio(
      'inventado',
    )) as unknown as { ambito: string };

    expect(r.ambito).toBe('GENERAL');
  });
});
