/** Lo que la persona marcó no se pierde, aunque lo demás espere. */

/**
 * Cuando un asesor ya tocó la ficha, lo que teclea el interesado
 * NO pisa: queda como propuesta y alguien decide campo a campo.
 * Es correcto, y protege el trabajo del asesor.
 *
 * Pero la caracterización se iba por ese mismo desvío y no
 * llegaba a ninguna parte: `dejarPropuesta` solo lleva campos de
 * `Persona`, así que la respuesta desaparecía sin dejar rastro
 * —ni el dato, ni una propuesta, ni la marca de que se le había
 * preguntado— mientras la pantalla le decía «guardado».
 *
 * Y no es un campo cualquiera: es una declaración de ELLA sobre
 * ella misma. Lo dice el comentario de `guardarCaracterizaciones`
 * — «solo su dueño puede decirlo; un asesor no debe poder
 * proponerle a nadie que alguien es víctima del conflicto»—, así
 * que no tiene sentido que pase por la aprobación de un asesor:
 * o se guarda, o se pierde.
 */

import { PreinscripcionService } from './preinscripcion.service';

type Escritura = { tabla: string; metodo: string; datos?: unknown };

function prismaFalso(tocadaPorAsesor: boolean) {
  const escrituras: Escritura[] = [];
  const anota =
    (tabla: string, metodo: string, valor: unknown = {}) =>
    (datos?: unknown) => {
      escrituras.push({ tabla, metodo, datos });
      return Promise.resolve(valor);
    };

  const prisma = {
    escrituras,
    enlaceCompletado: {
      findUnique: () =>
        Promise.resolve({
          id: 'e1',
          participanteId: 'par1',
          expiraEn: new Date(Date.now() + 86_400_000),
          usadoEn: null,
          anuladoEn: null,
          abiertoEn: null,
        }),
      update: anota('enlaceCompletado', 'update'),
      updateMany: anota('enlaceCompletado', 'updateMany', { count: 0 }),
    },
    participante: {
      findUnique: () =>
        Promise.resolve({
          personaId: 'per1',
          datosTocadosPorAsesorEn: tocadaPorAsesor ? new Date() : null,
          persona: { departamentoSepId: null, municipioSepId: null },
        }),
      update: anota('participante', 'update'),
    },
    persona: {
      findUnique: () =>
        Promise.resolve({
          primerNombre: 'Ana',
          segundoNombre: null,
          primerApellido: 'Ruiz',
          segundoApellido: null,
          celular: null,
          correo: null,
          generoSepId: null,
          fechaNacimiento: null,
          estrato: null,
          departamentoSepId: null,
          municipioSepId: null,
          barrio: null,
          direccion: null,
        }),
      update: anota('persona', 'update'),
    },
    propuestaDeDatos: {
      deleteMany: anota('propuestaDeDatos', 'deleteMany', { count: 0 }),
      create: anota('propuestaDeDatos', 'create'),
    },
    /// Hay autorización viva: lo que se prueba aquí es el
    /// desvío del asesor, no el candado del consentimiento.
    autorizacionDatos: { findFirst: () => Promise.resolve({ id: 'a1' }) },
    politicaDatos: { findFirst: () => Promise.resolve({ id: 'p1' }) },
    caracterizacionPersona: {
      deleteMany: anota('caracterizacionPersona', 'deleteMany', { count: 0 }),
      createMany: anota('caracterizacionPersona', 'createMany', { count: 1 }),
    },
    $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
  };
  return prisma;
}

function servicio(prisma: ReturnType<typeof prismaFalso>) {
  return new PreinscripcionService(
    prisma as never,
    { encolar: () => Promise.resolve() } as never,
    { registrar: () => Promise.resolve() } as never,
    {} as never,
    {} as never,
  );
}

/// 5 = DESPLAZADOS POR LA VIOLENCIA, del catálogo del SEP.
const DESPLAZADA = 5;
const marca = { primerNombre: 'Ana', caracterizaciones: [DESPLAZADA] } as never;

describe('la ficha ya tocada por un asesor', () => {
  it('deja lo demás en espera, como antes', async () => {
    const prisma = prismaFalso(true);
    const r = await servicio(prisma).guardarPersona('t', marca);
    expect(r).toEqual({ guardado: true, enEspera: true });
  });

  it('PERO la caracterización sí se guarda: no es del asesor', async () => {
    const prisma = prismaFalso(true);
    await servicio(prisma).guardarPersona('t', marca);
    const creadas = prisma.escrituras.find(
      (e) => e.tabla === 'caracterizacionPersona' && e.metodo === 'createMany',
    );
    expect(creadas).toBeDefined();
    expect(JSON.stringify(creadas?.datos)).toContain(String(DESPLAZADA));
  });

  it('y queda constancia de que se le preguntó', async () => {
    const prisma = prismaFalso(true);
    await servicio(prisma).guardarPersona('t', marca);
    const sello = prisma.escrituras.find(
      (e) =>
        e.tabla === 'persona' &&
        e.metodo === 'update' &&
        JSON.stringify(e.datos).includes('caracterizacionPreguntada'),
    );
    expect(sello).toBeDefined();
  });
});

describe('la ficha que nadie tocó sigue igual', () => {
  it('guarda todo y no deja propuesta', async () => {
    const prisma = prismaFalso(false);
    const r = await servicio(prisma).guardarPersona('t', marca);
    expect(r).toEqual({ guardado: true, enEspera: false });
    expect(
      prisma.escrituras.some((e) => e.tabla === 'propuestaDeDatos' && e.metodo === 'create'),
    ).toBe(false);
    expect(
      prisma.escrituras.some((e) => e.tabla === 'caracterizacionPersona'),
    ).toBe(true);
  });
});
