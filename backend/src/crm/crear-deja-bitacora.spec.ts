/** Crear una ficha deja constancia de quién la creó. */

/**
 * `PARTICIPANTE_CREADO` estaba declarado en el catálogo de
 * acciones desde el principio y NO LO EMITÍA NADIE. Crear una
 * ficha —por el panel, por preinscripción, por conversión de un
 * lead o por cargue masivo— no dejaba una sola fila en
 * `registros_auditoria`.
 *
 * Quedaba el `MovimientoParticipante`, que dice la etapa pero no
 * es la bitácora: no lleva el resumen, no lo lee `historial()` y
 * no sirve para responder «¿quién metió a esta persona y desde
 * dónde?», que es lo que hay que poder contestar.
 */

import { CrmService } from './crm.service';

const CONVENIO = 'convenio-1';
const ADMIN = { id: 'admin-1', nombre: 'Ana Gómez' };

function armar() {
  const auditado: Record<string, unknown>[] = [];

  const prisma = {
    /// La persona ya existe: `crear` la resuelve por upsert y
    /// aquí no se prueba eso.
    persona: {
      upsert: () => Promise.resolve({ id: 'persona-1' }),
      findUnique: () => Promise.resolve({ id: 'persona-1' }),
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

  const auditoria = {
    registrar: (e: Record<string, unknown>) => {
      auditado.push(e);
      return Promise.resolve();
    },
  };

  const s = new CrmService(
    prisma as never,
    auditoria as never,
    { encolarSiHaceFalta: () => Promise.resolve() } as never,
    { deLaOferta: () => Promise.resolve(null) } as never,
    { alInscribir: () => Promise.resolve('ENCOLADO') } as never,
  );

  return { s, auditado };
}

describe('crear una ficha', () => {
  it('deja la acción PARTICIPANTE_CREADO en la bitácora', async () => {
    const { s, auditado } = armar();

    await s.crear(
      {
        convenioId: CONVENIO,
        tipoDocumentoSepId: 1,
        numeroDocumento: '1020304050',
        primerNombre: 'Luis',
        primerApellido: 'Pérez',
      } as never,
      ADMIN as never,
      [CONVENIO],
      '10.0.0.1',
      { encolarRui: false },
    );

    const fila = auditado.find((a) => a.accion === 'PARTICIPANTE_CREADO');
    expect(fila).toBeDefined();
    expect(fila?.entidadId).toBe('participante-1');
    expect(fila?.convenioId).toBe(CONVENIO);
    /// El actor y la IP: sin ellos la fila no contesta «quién» ni
    /// «desde dónde», que es para lo que existe.
    expect(fila?.actor).toEqual(ADMIN);
    expect(fila?.ip).toBe('10.0.0.1');
  });
});
