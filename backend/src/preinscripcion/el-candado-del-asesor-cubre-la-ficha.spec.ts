/** El candado del asesor también tapa los cuatro campos de la ficha. */

/**
 * `guardarPersona` escribía `nivelEducativo`, `cargoEnEmpresa`,
 * `nivelOcupacionalSepId` y `beneficiarioPrevio` ARRIBA, antes de
 * mirar `datosTocadosPorAsesorEn`. Los once campos de `Persona`
 * sí pasaban por el candado —se quedan como propuesta y decide
 * alguien campo a campo—; estos cuatro se escribían siempre.
 *
 * Cómo se veía: el asesor corregía el nivel ocupacional desde el
 * panel, la persona reabría su enlace y reenviaba el formulario,
 * y el valor volvía atrás. Sin propuesta que decidir, sin
 * `ValorAnterior` que explicara de dónde salía, y con la
 * respuesta diciendo `{enEspera: true}` —o sea «no se pisó
 * nada»—, que para estos cuatro era mentira. El nivel
 * ocupacional es columna del F7.
 *
 * Y eso es justo lo que lo tapaba: la pantalla le decía a la
 * persona «sus datos quedaron en espera» y era verdad para once
 * campos de doce.
 *
 * LA REGLA que se fija aquí: con la ficha ya tocada, lo que
 * choca con un valor guardado NO se escribe y se nombra en el
 * aviso del asesor; lo que cae en un HUECO sí se escribe, porque
 * rellenar un vacío no pisa el trabajo de nadie. Sin candado,
 * todo se guarda como siempre.
 */

import { PreinscripcionService } from './preinscripcion.service';
import { dobleDeEnlace } from './doble-enlace';
import { dobleDeColaDeCorreo } from '../correo/automaticos/doble';
import { dobleDeEmbudo } from '../embudo/doble';
import {
  comoSeCuentanLosChoques,
  repartirDatosDeLaFicha,
} from './datos-de-la-participacion';

/// Del catálogo del SEP: 2 = MEDIO, 3 = OPERATIVO. El asesor lo
/// había corregido a MEDIO y la persona insiste en OPERATIVO.
const LO_QUE_CORRIGIO_EL_ASESOR = 2;
const LO_QUE_DICE_LA_PERSONA = 3;

describe('el reparto en huecos y choques', () => {
  it('lo que choca con un valor guardado no se escribe', () => {
    const r = repartirDatosDeLaFicha(
      { nivelOcupacionalSepId: LO_QUE_DICE_LA_PERSONA },
      { nivelOcupacionalSepId: LO_QUE_CORRIGIO_EL_ASESOR },
    );
    expect(r.huecos).toEqual({});
    expect(r.choques).toHaveLength(1);
    expect(r.choques[0].campo).toBe('nivelOcupacionalSepId');
  });

  it('un hueco sí se rellena: no hay corrección que pisar', () => {
    const r = repartirDatosDeLaFicha(
      {
        nivelOcupacionalSepId: LO_QUE_DICE_LA_PERSONA,
        cargoEnEmpresa: 'Auxiliar',
      },
      { nivelOcupacionalSepId: null, cargoEnEmpresa: undefined },
    );
    expect(r.huecos).toEqual({
      nivelOcupacionalSepId: LO_QUE_DICE_LA_PERSONA,
      cargoEnEmpresa: 'Auxiliar',
    });
    expect(r.choques).toEqual([]);
  });

  it('la cadena en blanco es un hueco, no un valor', () => {
    /// Una ficha que entró por un cargue con `cargoEnEmpresa: ''`
    /// tiene el hueco igual que si fuera nulo. Tratarla como
    /// llena dejaría el dato sin poder completarse nunca.
    const r = repartirDatosDeLaFicha(
      { cargoEnEmpresa: 'Auxiliar' },
      { cargoEnEmpresa: '   ' },
    );
    expect(r.huecos).toEqual({ cargoEnEmpresa: 'Auxiliar' });
  });

  it('lo que llega IGUAL no es un choque ni se escribe', () => {
    /// Si contara, reenviar el formulario sin cambiar nada
    /// --el caso normal-- llenaría la bandeja del asesor.
    const r = repartirDatosDeLaFicha(
      { nivelEducativo: 'Bachiller' },
      { nivelEducativo: 'Bachiller' },
    );
    expect(r.huecos).toEqual({});
    expect(r.choques).toEqual([]);
  });

  it('lo que el formulario no mandó no es ninguna de las dos cosas', () => {
    const r = repartirDatosDeLaFicha(
      { nivelEducativo: undefined },
      { nivelEducativo: 'Bachiller' },
    );
    expect(r.huecos).toEqual({});
    expect(r.choques).toEqual([]);
  });

  it('un «no» declarado choca con un «sí» guardado', () => {
    /// `false` no se puede confundir con «vacío»: es una
    /// respuesta, y es la que viaja al F7.
    const r = repartirDatosDeLaFicha(
      { beneficiarioPrevio: false },
      { beneficiarioPrevio: true },
    );
    expect(r.huecos).toEqual({});
    expect(r.choques).toHaveLength(1);
  });

  it('el aviso nombra el campo en castellano y con los dos valores', () => {
    const linea = comoSeCuentanLosChoques([
      { campo: 'beneficiarioPrevio', dice: false, guardado: true },
    ]);
    expect(linea).toContain('beneficiario previo del SENA');
    expect(linea).toContain('«no»');
    expect(linea).toContain('«sí»');
  });
});

type Escritura = { tabla: string; metodo: string; datos?: unknown };

function prismaFalso(opciones: {
  tocadaPorAsesor: boolean;
  nivelGuardado: number | null;
}) {
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
          datosTocadosPorAsesorEn: opciones.tocadaPorAsesor ? new Date() : null,
          nivelEducativo: null,
          cargoEnEmpresa: null,
          /// Lo que el asesor dejó escrito desde el panel.
          nivelOcupacionalSepId: opciones.nivelGuardado,
          beneficiarioPrevio: null,
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
    /// candado del asesor, no el del consentimiento.
    autorizacionDatos: { findFirst: () => Promise.resolve({ id: 'a1' }) },
    politicaDatos: { findFirst: () => Promise.resolve({ id: 'p1' }) },
    caracterizacionPersona: {
      deleteMany: anota('caracterizacionPersona', 'deleteMany', { count: 0 }),
      createMany: anota('caracterizacionPersona', 'createMany', { count: 1 }),
    },
    $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
  };
}

/// Lo que se le avisa al asesor, para poder leerlo.
const avisos: { detalle?: string }[] = [];

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
    {
      avisar: (a: { detalle?: string }) => {
        avisos.push(a);
        return Promise.resolve();
      },
    } as never,
  );
}

/// Lo que teclea la persona al reenviar su enlace.
const loQueManda = {
  primerNombre: 'Ana',
  nivelOcupacionalSepId: LO_QUE_DICE_LA_PERSONA,
  cargoEnEmpresa: 'Auxiliar',
} as never;

function escrituraDeLaFicha(prisma: ReturnType<typeof prismaFalso>) {
  return prisma.escrituras.filter(
    (e) => e.tabla === 'participante' && e.metodo === 'update',
  );
}

describe('la ficha que el asesor ya corrigió', () => {
  beforeEach(() => {
    avisos.length = 0;
  });

  it('NO devuelve atrás el nivel ocupacional que él puso', async () => {
    const prisma = prismaFalso({
      tocadaPorAsesor: true,
      nivelGuardado: LO_QUE_CORRIGIO_EL_ASESOR,
    });
    await servicio(prisma).guardarPersona('t', loQueManda);

    const escrito = JSON.stringify(escrituraDeLaFicha(prisma));
    /// El defecto: antes aquí aparecía el 7 de la persona.
    expect(escrito).not.toContain(
      `"nivelOcupacionalSepId":${LO_QUE_DICE_LA_PERSONA}`,
    );
  });

  it('pero sí rellena el cargo, que estaba vacío', async () => {
    const prisma = prismaFalso({
      tocadaPorAsesor: true,
      nivelGuardado: LO_QUE_CORRIGIO_EL_ASESOR,
    });
    await servicio(prisma).guardarPersona('t', loQueManda);

    const escrituras = escrituraDeLaFicha(prisma);
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0].datos).toEqual({
      where: { id: 'par1' },
      data: { cargoEnEmpresa: 'Auxiliar' },
    });
  });

  it('y lo que no se escribió se le cuenta al asesor con su valor', async () => {
    const prisma = prismaFalso({
      tocadaPorAsesor: true,
      nivelGuardado: LO_QUE_CORRIGIO_EL_ASESOR,
    });
    await servicio(prisma).guardarPersona('t', loQueManda);

    /// Antes el valor desaparecía sin dejar rastro: ni dato, ni
    /// propuesta, ni una línea que lo mencionara.
    const detalle = avisos.map((a) => a.detalle ?? '').join(' ');
    expect(detalle).toContain('nivel ocupacional');
    expect(detalle).toContain(String(LO_QUE_DICE_LA_PERSONA));
  });

  it('`enEspera: true` ya es verdad para los doce campos', async () => {
    const prisma = prismaFalso({
      tocadaPorAsesor: true,
      nivelGuardado: LO_QUE_CORRIGIO_EL_ASESOR,
    });
    const r = await servicio(prisma).guardarPersona('t', loQueManda);
    expect(r).toEqual({ guardado: true, enEspera: true });
  });

  it('si no quedaba ningún hueco, no se toca la ficha', async () => {
    const prisma = prismaFalso({
      tocadaPorAsesor: true,
      nivelGuardado: LO_QUE_CORRIGIO_EL_ASESOR,
    });
    await servicio(prisma).guardarPersona('t', {
      nivelOcupacionalSepId: LO_QUE_DICE_LA_PERSONA,
    } as never);
    expect(escrituraDeLaFicha(prisma)).toHaveLength(0);
  });
});

describe('la ficha que nadie tocó sigue guardándolo todo', () => {
  it('escribe los cuatro campos como siempre', async () => {
    const prisma = prismaFalso({ tocadaPorAsesor: false, nivelGuardado: null });
    await servicio(prisma).guardarPersona('t', loQueManda);

    const escrituras = escrituraDeLaFicha(prisma);
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0].datos).toEqual({
      where: { id: 'par1' },
      data: {
        nivelEducativo: undefined,
        cargoEnEmpresa: 'Auxiliar',
        nivelOcupacionalSepId: LO_QUE_DICE_LA_PERSONA,
        beneficiarioPrevio: undefined,
      },
    });
  });
});
