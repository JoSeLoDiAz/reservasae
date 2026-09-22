/** Quien ya no debe nada pasa a DATOS COMPLETOS, y nadie más. */

import { pasarSiNoLeFaltaNada } from './datos-completos';

/// Una persona a la que no le falta nada de lo que pide el reporte.
const COMPLETA = {
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

function armar(etapa: string, persona: Record<string, unknown> = COMPLETA) {
  const escrito: { etapa?: string; movimiento?: Record<string, unknown> } = {};
  const prisma = {
    participante: {
      findUnique: () => Promise.resolve({ etapa, nivelOcupacionalSepId: 2, persona }),
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
