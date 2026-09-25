/** Crear una ficha comprueba los ids del SEP, como las otras. */

/**
 * `actualizar` llamaba a `motivoDeIdInvalido`, la
 * preinscripción pública también y la mesa de leads también.
 * `crear` NO — o sea que la ruta del ASESOR era la más
 * permisiva de las cuatro, que es el mismo defecto que este
 * proyecto documenta al revés («la pública era la más
 * permisiva de las dos»).
 *
 * No se notaba porque la pantalla mandaba diez campos y
 * ninguno de estos. Desde que manda los diecisiete, el hueco
 * queda alcanzable desde la propia pantalla: un género que no
 * existe en el catálogo, o Medellín con el departamento de
 * Bogotá, entrarían a la base y saldrían así en el cargue.
 */

import { BadRequestException } from '@nestjs/common';

import { CrmService } from './crm.service';

const CONVENIO = 'convenio-1';
const ADMIN = { id: 'admin-1', nombre: 'Ana Gómez' };

function armar() {
  const creadas: unknown[] = [];

  const prisma = {
    persona: {
      upsert: (x: unknown) => {
        creadas.push(x);
        return Promise.resolve({ id: 'persona-1' });
      },
      findUnique: () => Promise.resolve(null),
    },
    participante: {
      findFirst: () => Promise.resolve(null),
      count: () => Promise.resolve(0),
      create: () =>
        Promise.resolve({
          id: 'participante-1',
          personaId: 'persona-1',
          etapa: 'INTERESADO',
        }),
    },
    movimientoParticipante: { create: () => Promise.resolve({}) },
    convenio: { findFirst: () => Promise.resolve({ id: CONVENIO }) },
    oferta: { findFirst: () => Promise.resolve(null) },
    $transaction: (x: unknown) =>
      typeof x === 'function'
        ? (x as (tx: unknown) => Promise<unknown>)(prisma)
        : Promise.all(x as Promise<unknown>[]),
    $queryRaw: () => Promise.resolve([]),
  };

  const s = new CrmService(
    prisma as never,
    { registrar: () => Promise.resolve() } as never,
    { encolarSiHaceFalta: () => Promise.resolve() } as never,
    { deLaOferta: () => Promise.resolve(null) } as never,
    { alInscribir: () => Promise.resolve('ENCOLADO') } as never,
  
    { avisar: () => Promise.resolve() } as never,
  );

  return { s, creadas };
}

const BASE = {
  tipoDocumentoSepId: 1,
  numeroDocumento: '1017138135',
  primerNombre: 'Camila',
  primerApellido: 'Caro',
  convenioId: CONVENIO,
};

describe('crear una ficha con ids del SEP', () => {
  it('rechaza un género que no está en el catálogo', async () => {
    const { s, creadas } = armar();

    await expect(
      s.crear({ ...BASE, generoSepId: 999 } as never, ADMIN as never, [
        CONVENIO,
      ]),
    ).rejects.toThrow(BadRequestException);

    /// Lo que importa no es el código: es que NO se escribió.
    expect(creadas).toHaveLength(0);
  });

  it('rechaza un municipio que no es de su departamento', async () => {
    const { s, creadas } = armar();

    await expect(
      s.crear(
        /// 11 = Bogotá D.C.; 5001 = Medellín, que es de
        /// Antioquia.
        { ...BASE, departamentoSepId: 11, municipioSepId: 5001 } as never,
        ADMIN as never,
        [CONVENIO],
      ),
    ).rejects.toThrow(BadRequestException);

    expect(creadas).toHaveLength(0);
  });

  it('deja pasar el par que sí cuadra, y lo guarda', async () => {
    const { s, creadas } = armar();

    await s.crear(
      {
        ...BASE,
        generoSepId: 2,
        departamentoSepId: 5,
        municipioSepId: 5001,
        estrato: 3,
        barrio: 'Laureles',
        direccion: 'Calle 1 # 2-3',
      } as never,
      ADMIN as never,
      [CONVENIO],
    );

    expect(creadas).toHaveLength(1);
    const datos = (creadas[0] as { create: Record<string, unknown> }).create;
    /// Los tres que antes no había forma de escribir al crear.
    expect(datos.estrato).toBe(3);
    expect(datos.barrio).toBe('Laureles');
    expect(datos.direccion).toBe('Calle 1 # 2-3');
  });
});
