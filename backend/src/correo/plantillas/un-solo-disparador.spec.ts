/** Solo una plantilla activa sale sola en cada gremio. */

/**
 * Con dos, cual de las dos se manda lo decide el orden de la
 * consulta --o sea el azar-- y el sintoma seria que a unos les
 * llega un texto y a otros otro sin que nada falle. Es el
 * mismo criterio del `@@unique` que impide dos filas de toque
 * para el mismo origen.
 */

import { BadRequestException } from '@nestjs/common';

import { dobleDeEnlace } from '../../preinscripcion/doble-enlace';
import { dobleDeMarcaDeCarta } from '../carta/doble';
import { PlantillasCorreoService } from './plantillas-correo.service';

function armar(ocupada: { nombre: string } | null) {
  const buscadas: unknown[] = [];
  const creadas: unknown[] = [];
  const prisma = {
    plantillaCorreo: {
      findFirst: ({ where }: { where: Record<string, unknown> }) => {
        buscadas.push(where);
        return Promise.resolve(ocupada);
      },
      create: ({ data }: { data: unknown }) => {
        creadas.push(data);
        return Promise.resolve({ id: 'nueva' });
      },
    },
  };
  const s = new PlantillasCorreoService(
    prisma as never,
    {} as never,
    dobleDeMarcaDeCarta(),
    dobleDeEnlace(),
  );
  return { s, buscadas, creadas };
}

const BASE = {
  nombre: 'Acuse de preinscripción',
  asunto: 'Recibimos su preinscripción',
  cuerpo: '{{saludo}}, ya quedó registrado.',
  convenioId: 'c1',
};

describe('un solo disparador por gremio', () => {
  it('rechaza la segunda y dice cuál la tiene', async () => {
    const { s, creadas } = armar({ nombre: 'La que ya existía' });

    await expect(
      s.crear({ ...BASE, disparador: 'PREINSCRIPCION' } as never, 'a1', ['c1']),
    ).rejects.toThrow(BadRequestException);

    /// Lo que importa no es el código de error: es que no se
    /// escribió una segunda.
    expect(creadas).toHaveLength(0);
  });

  it('el mensaje nombra a la que estorba, para poder ir a apagarla', async () => {
    const { s } = armar({ nombre: 'La que ya existía' });
    await expect(
      s.crear({ ...BASE, disparador: 'PREINSCRIPCION' } as never, 'a1', ['c1']),
    ).rejects.toThrow(/La que ya existía/);
  });

  it('busca solo entre las ACTIVAS y del mismo gremio', async () => {
    const { s, buscadas } = armar(null);
    await s.crear({ ...BASE, disparador: 'PREINSCRIPCION' } as never, 'a1', [
      'c1',
    ]);

    expect(buscadas[0]).toMatchObject({
      disparador: 'PREINSCRIPCION',
      activa: true,
      convenioId: 'c1',
    });
  });

  it('sin disparador no comprueba nada y guarda', async () => {
    const { s, buscadas, creadas } = armar({ nombre: 'La que ya existía' });
    await s.crear(BASE as never, 'a1', ['c1']);

    expect(buscadas).toHaveLength(0);
    expect(creadas).toHaveLength(1);
    expect((creadas[0] as { disparador: string }).disparador).toBe('NINGUNO');
  });
});
