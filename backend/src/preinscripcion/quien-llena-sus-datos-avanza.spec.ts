/** Llenar SUS datos ya mueve la etapa; no hay que llegar a la empresa. */

/**
 * EL DEFECTO (lo vio Mauricio el 20 sep 2026, en producción): en
 * Gestión de leads había fichas del MISMO día en dos estados —unas
 * en «Datos completos» y otras en «Interesado» con «Sin pendientes»
 * al lado—, y no dependía de cuándo entraron sino de hasta dónde
 * llegaron en el formulario: la etapa solo se calculaba al terminar
 * el paso de la ORGANIZACIÓN (`guardarEmpresa`) o al cerrar por
 * desempleo. Quien llenaba lo suyo y ahí lo dejaba se quedaba en
 * «Interesado» para siempre, porque nadie vuelve a tocar esa ficha.
 *
 * Lo que falta de la empresa NO es de la persona y no entra en
 * `faltaDeLaPersona`: por eso la columna decía «Sin pendientes»
 * mientras la etapa decía lo contrario. Dos verdades sobre la misma
 * fila, el patrón de siempre.
 */

import { PreinscripcionService } from './preinscripcion.service';
import { dobleDeEnlace } from './doble-enlace';
import { dobleDeColaDeCorreo } from '../correo/automaticos/doble';
import { dobleDeEmbudo } from '../embudo/doble';

type Escritura = { tabla: string; metodo: string; datos?: unknown };

/// Una persona a la que, DESPUES de guardar, ya no le falta nada.
const COMPLETA = {
  primerNombre: 'Ana',
  segundoNombre: null,
  primerApellido: 'Ruiz',
  segundoApellido: null,
  celular: '3001234567',
  correo: 'ana@ejemplo.test',
  generoSepId: 1,
  fechaNacimiento: new Date('1990-01-01'),
  estrato: 3,
  departamentoSepId: 5,
  municipioSepId: 5001,
  barrio: 'Centro',
  direccion: 'Calle 1 # 2-3',
};

/// Su organización, con lo que el enlace le pide en su paso.
const EMPRESA = {
  nit: '890123456',
  sectorEconomico: 'SERVICIOS',
  contactoNombre: 'Luisa Gómez',
  contactoCargo: 'Jefe de talento',
  contactoCorreo: 'luisa@ejemplo.test',
};

function prismaFalso(
  persona: Record<string, unknown>,
  nivelOcupacionalSepId: number | null,
  empresa: Record<string, unknown> | null = EMPRESA,
) {
  const escrituras: Escritura[] = [];
  const anota =
    (tabla: string, metodo: string, valor: unknown = {}) =>
    (datos?: unknown) => {
      escrituras.push({ tabla, metodo, datos });
      return Promise.resolve(valor);
    };

  return {
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
          datosTocadosPorAsesorEn: null,
          /// Lo que pide `pasarSiNoLeFaltaNada`, y lo que pide
          /// `guardarPersona`: el doble sirve a los dos.
          etapa: 'INTERESADO',
          nivelOcupacionalSepId,
          persona,
          /// Desde el 24 sep 2026 «Datos completos» mira también la
          /// organización, así que `pasarSiNoLeFaltaNada` la pide.
          empresa,
          reserva: null,
        }),
      update: anota('participante', 'update'),
    },
    persona: {
      findUnique: () => Promise.resolve(persona),
      update: anota('persona', 'update'),
    },
    movimientoParticipante: { create: anota('movimientoParticipante', 'create') },
    propuestaDeDatos: {
      deleteMany: anota('propuestaDeDatos', 'deleteMany', { count: 0 }),
      create: anota('propuestaDeDatos', 'create'),
    },
    autorizacionDatos: { findFirst: () => Promise.resolve({ id: 'a1' }) },
    politicaDatos: { findFirst: () => Promise.resolve({ id: 'p1' }) },
    caracterizacionPersona: {
      deleteMany: anota('caracterizacionPersona', 'deleteMany', { count: 0 }),
      createMany: anota('caracterizacionPersona', 'createMany', { count: 1 }),
    },
    $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
  };
}

function servicio(prisma: ReturnType<typeof prismaFalso>) {
  return new PreinscripcionService(
    prisma as never,
    { encolar: () => Promise.resolve() } as never,
    { registrar: () => Promise.resolve() } as never,
    {} as never,
    {} as never,
    dobleDeEmbudo(),
    dobleDeColaDeCorreo(),
    dobleDeEnlace(),
  );
}

/// La etapa que quedó escrita, si se escribió alguna.
function etapaEscrita(prisma: ReturnType<typeof prismaFalso>) {
  const w = prisma.escrituras.find(
    (e) =>
      e.tabla === 'participante' &&
      e.metodo === 'update' &&
      JSON.stringify(e.datos).includes('DATOS_COMPLETOS'),
  );
  return w ? 'DATOS_COMPLETOS' : null;
}

describe('quien llena sus datos desde el enlace', () => {
  it('pasa a «Datos completos» sin llegar al paso de la empresa', async () => {
    const prisma = prismaFalso(COMPLETA, 2);

    const r = await servicio(prisma).guardarPersona('t', { primerNombre: 'Ana' } as never);

    expect(r).toMatchObject({ guardado: true, enEspera: false });
    expect(etapaEscrita(prisma)).toBe('DATOS_COMPLETOS');
  });

  it('si le falta algo suyo, no se mueve', async () => {
    const prisma = prismaFalso({ ...COMPLETA, barrio: null }, 2);

    await servicio(prisma).guardarPersona('t', { primerNombre: 'Ana' } as never);

    expect(etapaEscrita(prisma)).toBeNull();
  });

  /// El nivel ocupacional es de la ficha, no de `Persona`, y
  /// también lo pide el reporte.
  it('tampoco sin nivel ocupacional', async () => {
    const prisma = prismaFalso(COMPLETA, null);

    await servicio(prisma).guardarPersona('t', { primerNombre: 'Ana' } as never);

    expect(etapaEscrita(prisma)).toBeNull();
  });

  /// El que cierra sin llenar lo de la organización.
  it('y cerrar el enlace tampoco la deja en «Interesado»', async () => {
    const prisma = prismaFalso(COMPLETA, 2);

    await servicio(prisma).cerrar('t');

    expect(etapaEscrita(prisma)).toBe('DATOS_COMPLETOS');
  });

  /**
   * ESTO DEROGA, A SABIENDAS, LA DECISIÓN DEL 20 SEP 2026.
   *
   * Aquel día se movió la etapa a `guardarDatos` justo porque
   * quien llenaba lo SUYO y cerraba ahí --sin llegar al paso de
   * la organización-- se quedaba «Interesado» con «Sin
   * pendientes» al lado, y Mauricio lo vio con fichas del mismo
   * día en los dos estados.
   *
   * Desde el 24 sep 2026 vuelve a quedarse, y es lo que Josse
   * pidió: «datos completos deben estar los datos de la persona y
   * los datos de la empresa». LA DIFERENCIA CON AQUEL DEFECTO, y
   * es toda la diferencia: ahora las dos verdades COINCIDEN --la
   * columna dice «Faltan 3» y la etapa dice «Interesado»--, en vez
   * de contradecirse. Lo que queda pendiente es real, no un
   * desajuste entre dos reglas.
   *
   * Y la ficha no se queda sola: vuelve a la cola del asesor, que
   * es de donde sale la campaña que le pide los datos que faltan.
   */
  it('pero si su organización está a medias, se queda en «Interesado»', async () => {
    const prisma = prismaFalso(COMPLETA, 2, {
      ...EMPRESA,
      contactoCorreo: null,
    });

    await servicio(prisma).guardarPersona('t', { primerNombre: 'Ana' } as never);

    expect(etapaEscrita(prisma)).toBeNull();
  });

  it('y sin ninguna organización, tampoco', async () => {
    const prisma = prismaFalso(COMPLETA, 2, null);

    await servicio(prisma).cerrar('t');

    expect(etapaEscrita(prisma)).toBeNull();
  });
});
