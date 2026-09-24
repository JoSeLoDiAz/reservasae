/** Quien ya no debe nada pasa a DATOS COMPLETOS, y nadie más. */

import { pasarSiNoLeFaltaNada } from './datos-completos';

/// Una persona a la que no le falta nada de lo que pide el reporte.
const COMPLETA = {
  numeroDocumento: '1019456782',
  correo: 'ana@ejemplo.test',
  celular: '3001234567',
  fechaNacimiento: new Date('1990-01-01'),
  generoSepId: 1,
  estrato: 3,
  departamentoSepId: 5,
  municipioSepId: 5001,
  barrio: 'Centro',
  direccion: 'Calle 1 # 2-3',
};

/// Y una organización con lo que el enlace le pide.
const EMPRESA = {
  nit: '890123456',
  sectorEconomico: 'SERVICIOS',
  contactoNombre: 'Luisa Gómez',
  contactoCargo: 'Jefe de talento',
  contactoCorreo: 'luisa@ejemplo.test',
};

function armar(
  etapa: string,
  persona: Record<string, unknown> = COMPLETA,
  empresa: Record<string, unknown> | null = EMPRESA,
  reserva: Record<string, unknown> | null = null,
) {
  const escrito: { etapa?: string; movimiento?: Record<string, unknown> } = {};
  const prisma = {
    participante: {
      findUnique: () =>
        Promise.resolve({
          etapa,
          nivelOcupacionalSepId: 2,
          persona,
          empresa,
          reserva,
        }),
      update: ({ data }: { data: { etapa: string } }) => {
        escrito.etapa = data.etapa;
        return Promise.resolve({});
      },
    },
    movimientoParticipante: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        escrito.movimiento = data;
        return Promise.resolve({});
      },
    },
    $transaction: (ops: Array<Promise<unknown>>) => Promise.all(ops),
  };
  return { prisma: prisma as never, escrito };
}

describe('pasar a «Datos completos»', () => {
  /// EL CASO DE PRODUCCIÓN (18 sep 2026): «Interesado» con «Sin
  /// pendientes» al lado.
  it('Interesado sin nada pendiente pasa, y queda dicho por qué y quién', async () => {
    const { prisma, escrito } = armar('INTERESADO');
    const etapa = await pasarSiNoLeFaltaNada(
      prisma,
      'p1',
      'Un asesor completó sus datos en el lead',
      'adm-1',
    );
    expect(etapa).toBe('DATOS_COMPLETOS');
    expect(escrito.etapa).toBe('DATOS_COMPLETOS');
    expect(escrito.movimiento).toMatchObject({
      etapaAntes: 'INTERESADO',
      etapaDespues: 'DATOS_COMPLETOS',
      motivo: 'Un asesor completó sus datos en el lead',
      adminId: 'adm-1',
    });
  });

  it('Contactado también', async () => {
    const { prisma, escrito } = armar('CONTACTADO');
    expect(await pasarSiNoLeFaltaNada(prisma, 'p1', 'x')).toBe('DATOS_COMPLETOS');
    expect(escrito.etapa).toBe('DATOS_COMPLETOS');
  });

  it('con un dato pendiente no se mueve', async () => {
    const { prisma, escrito } = armar('INTERESADO', { ...COMPLETA, barrio: '' });
    expect(await pasarSiNoLeFaltaNada(prisma, 'p1', 'x')).toBe('INTERESADO');
    expect(escrito.etapa).toBeUndefined();
  });

  /// DESDE EL 24 SEP 2026 LA ORGANIZACIÓN TAMBIÉN CUENTA.
  ///
  /// Lo pidió Josse: «datos completos deben estar los datos de la
  /// persona y los datos de la empresa». Antes la etapa miraba
  /// solo a la persona, así que la lista decía «Sin pendientes»
  /// mientras la ficha decía que faltaban los datos del jefe
  /// directo: dos verdades sobre la misma fila.
  describe('y la organización', () => {
    it('sin ninguna organización no pasa', async () => {
      const { prisma, escrito } = armar('INTERESADO', COMPLETA, null);
      expect(await pasarSiNoLeFaltaNada(prisma, 'p1', 'x')).toBe('INTERESADO');
      expect(escrito.etapa).toBeUndefined();
    });

    it('con la organización a medias tampoco', async () => {
      const { prisma, escrito } = armar('INTERESADO', COMPLETA, {
        ...EMPRESA,
        contactoCorreo: null,
      });
      expect(await pasarSiNoLeFaltaNada(prisma, 'p1', 'x')).toBe('INTERESADO');
      expect(escrito.etapa).toBeUndefined();
    });

    /// Un campo con espacios no es un campo lleno. Esa mitad venía
    /// de la copia de `preinscripcion` y la otra copia no la tenía.
    it('un campo con solo espacios cuenta como vacío', async () => {
      const { prisma } = armar('INTERESADO', COMPLETA, {
        ...EMPRESA,
        contactoNombre: '   ',
      });
      expect(await pasarSiNoLeFaltaNada(prisma, 'p1', 'x')).toBe('INTERESADO');
    });

    /// LA DE LA RESERVA VALE, y es el camino principal del sistema:
    /// quien llegó porque una empresa lo nominó no tiene `empresaId`
    /// propio. Con una regla más estrecha aquí se le diría que no
    /// tiene organización, que es el defecto que ya pasó una vez con
    /// la compuerta de matrícula.
    it('la organización de la reserva que lo nominó también sirve', async () => {
      const { prisma, escrito } = armar('INTERESADO', COMPLETA, null, {
        empresa: EMPRESA,
      });
      expect(await pasarSiNoLeFaltaNada(prisma, 'p1', 'x')).toBe(
        'DATOS_COMPLETOS',
      );
      expect(escrito.etapa).toBe('DATOS_COMPLETOS');
    });

    /// A QUIEN TRABAJA POR SU CUENTA NO SE LE PIDE JEFE.
    ///
    /// Su NIT es su cédula. Pedirle «el nombre de su jefe» es
    /// pedirle que se invente a alguien, y mientras no lo haga la
    /// ficha lo daría por incompleto para siempre.
    it('el independiente solo necesita el sector económico', async () => {
      const { prisma, escrito } = armar('INTERESADO', COMPLETA, {
        nit: COMPLETA.numeroDocumento,
        sectorEconomico: 'SERVICIOS',
        contactoNombre: null,
        contactoCargo: null,
        contactoCorreo: null,
      });
      expect(await pasarSiNoLeFaltaNada(prisma, 'p1', 'x')).toBe(
        'DATOS_COMPLETOS',
      );
      expect(escrito.etapa).toBe('DATOS_COMPLETOS');
    });

    it('y si al independiente le falta el sector, no pasa', async () => {
      const { prisma } = armar('INTERESADO', COMPLETA, {
        nit: COMPLETA.numeroDocumento,
        sectorEconomico: null,
        contactoNombre: null,
        contactoCargo: null,
        contactoCorreo: null,
      });
      expect(await pasarSiNoLeFaltaNada(prisma, 'p1', 'x')).toBe('INTERESADO');
    });
  });

  /// Completar unos datos no puede sacar a nadie del aula ni
  /// deshacer una inscripción.
  it('quien ya está inscrito o en formación no retrocede', async () => {
    for (const etapa of ['INSCRITO', 'EN_FORMACION', 'PERDIDO', 'DATOS_COMPLETOS']) {
      const { prisma, escrito } = armar(etapa);
      expect(await pasarSiNoLeFaltaNada(prisma, 'p1', 'x')).toBe(etapa);
      expect(escrito.etapa).toBeUndefined();
    }
  });
});
