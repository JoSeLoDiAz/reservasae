/** La regla de «una sola acción» también guarda la puerta del panel. */

/**
 * «¿Esto no debería pasar, no? ¿Por qué no lo unificó el sistema?»
 * (cliente, 1 oct 2026), con la misma persona saliendo dos veces en
 * Gestión de leads: en AF2 desde el 16 de septiembre y en AF6 desde
 * ese mismo día, con una asesora distinta en cada fila.
 *
 * NO ERA UN FALLO DE UNIFICACIÓN. La persona es una sola ---un
 * documento, un registro--- y lo que estaba dos veces era la
 * PARTICIPACIÓN, que es una por acción a propósito:
 * `@@unique([accionFormacionId, personaId])`.
 *
 * Lo que fallaba es que «solo se puede tomar una acción de formación»
 * guardaba UNA puerta de tres. El formulario público la aplicaba y la
 * conversión automática también; el panel comprobaba únicamente LA
 * MISMA acción, así que crear a la misma persona en otra distinta
 * pasaba sin que nadie dijera nada.
 *
 * Lo que este spec fija es que las tres puertas digan lo mismo.
 */

import { CrmService } from './crm.service';

const CONVENIO = 'convenio-1';
const ADMIN = { id: 'admin-1', nombre: 'Ana Gómez' };

/// En la que ya está desde septiembre.
const AF2 = {
  accionFormacionId: 'af-2',
  accionFormacion: {
    codigo: 'AF2',
    nombre: 'Diseño estratégico de ecosistemas educativos',
    evento: 'CURSO',
  },
};

function armar(yaTiene: (typeof AF2)[], eventoPedido = 'CURSO') {
  const prisma = {
    persona: {
      upsert: () => Promise.resolve({ id: 'persona-1' }),
      findUnique: () => Promise.resolve({ id: 'persona-1' }),
    },
    participante: {
      /// Nadie en LA MISMA acción: lo que se prueba es la otra regla,
      /// la de estar en una distinta.
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve(yaTiene),
      count: () => Promise.resolve(0),
      create: () =>
        Promise.resolve({
          id: 'participante-1',
          personaId: 'persona-1',
          etapa: 'INTERESADO',
        }),
    },
    /// Lo consultan DOS pasos distintos de `crear`: el que comprueba
    /// que la acción es del convenio ---y pide `id` y `convenioId`--- y
    /// el de la regla de una sola acción, que pide el `evento`. El
    /// doble devuelve los tres: con solo el evento, el primero daba
    /// «esa acción no pertenece al convenio» y los cuatro casos se
    /// caían antes de llegar a lo que se quiere probar.
    accionFormacion: {
      findUnique: () =>
        Promise.resolve({
          id: 'af-6',
          convenioId: CONVENIO,
          evento: eventoPedido,
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

  return new CrmService(
    prisma as never,
    { registrar: () => Promise.resolve() } as never,
    { encolarSiHaceFalta: () => Promise.resolve() } as never,
    { deLaOferta: () => Promise.resolve(null) } as never,
    { alInscribir: () => Promise.resolve('ENCOLADO') } as never,
    { avisar: () => Promise.resolve() } as never,
    {
      exigirClasificacion: () =>
        Promise.resolve({ categoriaId: null, subcategoriaId: null }),
    } as never,
  );
}

const crear = (s: CrmService, accionFormacionId: string) =>
  s.crear(
    {
      convenioId: CONVENIO,
      tipoDocumentoSepId: 1,
      numeroDocumento: '1040325021',
      primerNombre: 'Alejandro',
      primerApellido: 'Cardona',
      accionFormacionId,
    } as never,
    ADMIN as never,
    [CONVENIO],
    '10.0.0.1',
    { encolarRui: false },
  );

describe('crear una ficha desde el panel', () => {
  it('no deja meter a alguien en una SEGUNDA acción de formación', async () => {
    const s = armar([AF2]);
    await expect(crear(s, 'af-6')).rejects.toThrow(/solo se puede tomar una/i);
  });

  it('y lo dice con el nombre de la que ya tiene, no con un «no»', async () => {
    /// Un rechazo sin decir cuál obliga a ir a buscarla, y quien lo
    /// lee es una asesora con la persona al teléfono.
    const s = armar([AF2]);
    await expect(crear(s, 'af-6')).rejects.toThrow(/AF2/);
  });

  it('si no está en ninguna, entra', async () => {
    const s = armar([]);
    await expect(crear(s, 'af-6')).resolves.toBeDefined();
  });

  /**
   * LOS FOROS SIGUEN EXENTOS, y no es un caso de borde: es la razón
   * por la que la regla vive en `una-sola-accion.ts` y no escrita a
   * mano aquí. Un foro no consume el cupo de formación.
   */
  it('un foro no cuenta, ni como el que ya tiene ni como el pedido', async () => {
    const s = armar([AF2], 'FORO');
    await expect(crear(s, 'af-6')).resolves.toBeDefined();

    const conForoPrevio = armar([
      {
        accionFormacionId: 'af-foro',
        accionFormacion: { codigo: 'AF9', nombre: 'Foro', evento: 'FORO' },
      },
    ]);
    await expect(crear(conForoPrevio, 'af-6')).resolves.toBeDefined();
  });
});
