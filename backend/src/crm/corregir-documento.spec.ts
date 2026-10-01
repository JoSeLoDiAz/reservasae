/** El documento de la persona lo corrige SOLO el administrador. */

/**
 * Pedido el 1 oct 2026: «que solo lo pueda cambiar el administrador».
 *
 * El documento es la identidad de la persona —`@@unique([tipoDocumento
 * SepId, numeroDocumento])`— y el número que viaja al SENA y al RUI.
 *
 * LO QUE MÁS IMPORTA DE ESTE SPEC es el primer caso, y no el permiso:
 * la pantalla manda la FICHA ENTERA en cada guardado, así que el
 * documento viaja siempre. Si el candado mirara que el campo VIENE en
 * vez de que el valor CAMBIA, un gestor no podría guardar ni un
 * teléfono: recibiría 403 en cada intento. Por eso se compara el valor
 * ya normalizado, y por eso se prueba.
 */

import { ForbiddenException } from '@nestjs/common';

import { CrmService } from './crm.service';

const PERSONA = {
  tipoDocumentoSepId: 3,
  numeroDocumento: '1019456782',
  primerNombre: 'Marta',
  segundoNombre: null,
  primerApellido: 'Vargas',
  segundoApellido: null,
  sexo: null,
  correo: null,
  celular: null,
  fechaNacimiento: null,
  generoSepId: null,
  estrato: null,
  departamentoSepId: null,
  municipioSepId: null,
  barrio: null,
  direccion: null,
};

/// `otraPersona` es la que ya tiene el documento al que se quiere
/// mover: con ella, cambiarse encima seria fundir dos fichas.
function armar(opciones: { rol: string; otraPersona?: unknown }) {
  const personaUpdates: Array<Record<string, unknown>> = [];
  const auditadas: Array<{ accion: string }> = [];

  const prisma = {
    participante: {
      findUnique: () =>
        Promise.resolve({
          id: 'p-1',
          personaId: 'per-1',
          convenioId: 'c-1',
          etapa: 'INTERESADO',
          asesorId: null,
          cargoEnEmpresa: null,
          nivelEducativo: null,
          nivelOcupacional: null,
          nivelOcupacionalSepId: null,
          beneficiarioPrevio: null,
          coberturaId: null,
          persona: PERSONA,
        }),
      update: (a: unknown) => a,
    },
    persona: {
      /// La del candado contra fundir dos personas.
      findUnique: () => Promise.resolve(opciones.otraPersona ?? null),
      update: (a: { data: Record<string, unknown> }) => {
        personaUpdates.push(a.data);
        return a;
      },
    },
    valorAnterior: { createMany: (a: unknown) => a },
    movimientoParticipante: { create: (a: unknown) => a },
    $transaction: (xs: unknown[]) => Promise.resolve(xs),
  };

  const s = new CrmService(
    prisma as never,
    { registrar: (a: { accion: string }) => {
        auditadas.push(a);
        return Promise.resolve();
      } } as never,
    {} as never,
    {} as never,
    {} as never,
    { avisar: () => Promise.resolve() } as never,
    /// EL SÉPTIMO: el catálogo de notas, que entró el 30 sep 2026 con
    /// «Configuración notas». Este spec nació en `dev` contra un
    /// constructor de seis, así que al fundir las dos ramas quedaba
    /// una llamada corta: git funde el fichero sin conflicto ---nadie
    /// tocó estas líneas--- y el fallo solo sale al compilar.
    ///
    /// Es justo lo que avisa el comentario del constructor: los dobles
    /// que lo construyen a mano se pasan en orden.
    {} as never,
  );

  const cualquiera = s as unknown as Record<string, unknown>;
  cualquiera.exigirParticipante = () => Promise.resolve({ convenioId: 'c-1' });
  cualquiera.obtener = () => Promise.resolve({ ok: true });

  const actualizar = (dto: Record<string, unknown>) =>
    (
      s as unknown as {
        actualizar: (
          id: string,
          dto: unknown,
          admin: unknown,
          ambito: string[],
          ip?: string,
        ) => Promise<unknown>;
      }
    ).actualizar(
      'p-1',
      dto,
      { id: 'a-1', nombre: 'Quien sea', rol: opciones.rol },
      ['c-1'],
      '1.2.3.4',
    );

  return { actualizar, personaUpdates, auditadas };
}

describe('la pantalla manda la ficha entera, y eso no es cambiar el documento', () => {
  it('un gestor guarda otro campo mandando SU MISMO documento', async () => {
    const { actualizar, personaUpdates } = armar({ rol: 'GESTOR' });

    await actualizar({
      tipoDocumentoSepId: 3,
      numeroDocumento: '1019456782',
      celular: '3001234567',
    });

    expect(personaUpdates).toHaveLength(1);
    expect(personaUpdates[0].celular).toBe('3001234567');
    /// no se toca el documento: no cambió
    expect(personaUpdates[0].numeroDocumento).toBeUndefined();
  });

  /// Lo guardado está normalizado y lo tecleado puede venir con
  /// puntos. Si se compararan en crudo, escribir el mismo documento
  /// «bonito» contaría como un cambio y el gestor se llevaría un 403.
  it('tampoco si llega con puntos: se compara ya normalizado', async () => {
    const { actualizar, personaUpdates } = armar({ rol: 'GESTOR' });

    await actualizar({ numeroDocumento: '1.019.456.782', celular: '3009' });

    expect(personaUpdates[0].numeroDocumento).toBeUndefined();
  });
});

describe('cambiarlo de verdad es solo del administrador', () => {
  it('a un gestor se le niega, y no se escribe nada', async () => {
    const { actualizar, personaUpdates } = armar({ rol: 'GESTOR' });

    await expect(
      actualizar({ numeroDocumento: '1122334455' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(personaUpdates).toHaveLength(0);
  });

  it('el superadmin sí lo corrige', async () => {
    const { actualizar, personaUpdates } = armar({ rol: 'SUPERADMIN' });

    await actualizar({ numeroDocumento: '1122334455' });

    expect(personaUpdates[0].numeroDocumento).toBe('1122334455');
  });

  it('y cambiar solo el TIPO también pide ser administrador', async () => {
    const { actualizar } = armar({ rol: 'GESTOR' });

    await expect(
      actualizar({ tipoDocumentoSepId: 4 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('no se funden dos personas por la puerta de atrás', () => {
  it('si ese documento ya es de otra, se rechaza nombrándola', async () => {
    const { actualizar, personaUpdates } = armar({
      rol: 'SUPERADMIN',
      otraPersona: {
        id: 'per-2',
        primerNombre: 'Ana',
        primerApellido: 'Pérez',
      },
    });

    await expect(actualizar({ numeroDocumento: '1122334455' })).rejects.toThrow(
      /Ana Pérez/,
    );

    expect(personaUpdates).toHaveLength(0);
  });

  /// Que la fila encontrada sea ELLA MISMA no es un choque.
  it('encontrarse a sí misma no bloquea', async () => {
    const { actualizar, personaUpdates } = armar({
      rol: 'SUPERADMIN',
      otraPersona: { id: 'per-1', primerNombre: 'M', primerApellido: 'V' },
    });

    await actualizar({ numeroDocumento: '1122334455' });

    expect(personaUpdates[0].numeroDocumento).toBe('1122334455');
  });

  it('un documento con formato imposible se rechaza', async () => {
    const { actualizar, personaUpdates } = armar({ rol: 'SUPERADMIN' });

    await expect(actualizar({ numeroDocumento: 'AB' })).rejects.toThrow(
      /formato/i,
    );

    expect(personaUpdates).toHaveLength(0);
  });
});
