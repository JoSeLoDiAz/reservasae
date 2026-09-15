/** La ficha arma sus datos con el MISMO armador de campañas. */

import { PlantillasCorreoService } from './plantillas-correo.service';

/// Un inscrito NO tiene cobertura: por regla del cliente,
/// nada de lo inscrito cuelga del cronograma. Los 6.600
/// inscritos de pruebas lo confirman -- 6.600 con oferta y
/// cero con cobertura.
const FICHA = {
  persona: {
    primerNombre: 'CAMILA',
    segundoNombre: null,
    primerApellido: 'CARO',
    segundoApellido: null,
    generoSepId: 2,
    numeroDocumento: '1017138135',
    correo: 'camila@ejemplo.test',
    celular: '3000000000',
  },
  empresa: null,
  reserva: null,
  accionFormacion: {
    codigo: 'AF7',
    nombre: 'Foro',
    /// La acción dice HIBRIDA y la celda es virtual.
    modalidad: 'HIBRIDA',
    evento: 'TALLER-BOOTCAMP',
    horas: 16,
  },
  oferta: { modalidad: 'VIRTUAL', ubicacion: { nombre: 'Santander' } },
  cobertura: null,
  asesor: null,
  convenio: { sigla: 'ADECOPRIA', nombre: 'Adecopria' },
};

function servicio(ficha: unknown = FICHA) {
  const visto: { where?: Record<string, unknown> } = {};
  const prisma = {
    participante: {
      findUnique: jest.fn((q: { where: Record<string, unknown> }) => {
        visto.where = q.where;
        return Promise.resolve(ficha);
      }),
    },
    plantillaCorreo: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          id: 'p1',
          asunto: '{{evento}} confirmado',
          cuerpo:
            '{{saludo}}: {{accionFormacion}}, {{modalidad}}, {{horas}}, en {{ubicacion}}.',
        }),
      ),
    },
  };
  const s = new PlantillasCorreoService(
    prisma as never,
    { enviar: jest.fn() } as never,
  );
  return { s, visto };
}

describe('los datos de la ficha', () => {
  it('saca sede y modalidad de la OFERTA cuando no hay cobertura', async () => {
    const { s } = servicio();
    const v = await s.vistaPrevia('x', 'p1', ['c1']);

    expect(v.faltantes).toEqual([]);
    expect(v.cuerpo).toContain('en Santander');
    /// De la acción saldría «Híbrida», que no está vacía: está
    /// mal.
    expect(v.cuerpo).toContain('Virtual');
    expect(v.cuerpo).not.toContain('Hibrida');
    expect(v.sePuede).toBe(true);
  });

  it('llena las dos variables de la acción', async () => {
    const { s } = servicio();
    const v = await s.vistaPrevia('x', 'p1', ['c1']);

    expect(v.asunto).toBe('Taller-Bootcamp confirmado');
    expect(v.cuerpo).toContain('16 horas');
  });

  it('busca la ficha dentro del ámbito y no por id a secas', async () => {
    const { s, visto } = servicio();
    await s.vistaPrevia('x', 'p1', ['c1', 'c2']);

    expect(visto.where).toMatchObject({
      id: 'x',
      convenioId: { in: ['c1', 'c2'] },
    });
  });

  it('una ficha de otro gremio no existe', async () => {
    const { s } = servicio(null);
    await expect(s.vistaPrevia('x', 'p1', ['c1'])).rejects.toThrow(
      'Ese lead ya no existe.',
    );
  });
});
