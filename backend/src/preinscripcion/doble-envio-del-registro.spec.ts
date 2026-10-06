/** El doble clic en el registro público no revienta ni mata el enlace. */

/**
 * Entre el `findFirst` que busca `yaEsta` y el `create` de la
 * ficha hay una ventana, y `Participante` tiene
 * `@@unique([accionFormacionId, personaId])`.
 *
 * Cómo se veía: dos envíos a la vez —el doble clic del botón, o
 * el reintento del móvil que pierde la red con la petición ya
 * hecha— pasaban los dos por el `findFirst` sin ver nada y los
 * dos llegaban al `create`. El segundo reventaba con un P2002
 * sin capturar: un 500 crudo, sin mensaje, en la última pantalla
 * del formulario, con la ficha YA creada. La persona veía un
 * error y creía que no se había inscrito.
 *
 * Y si la base no hubiera parado al segundo habría sido peor:
 * dos acuses encolados que se contradicen y un
 * `emitirAlRegistrarse` que ANULA el token que el primero acababa
 * de entregar —el del botón de la pantalla de gracias—, así que
 * el enlace dejaba de abrir sin que nadie supiera por qué.
 *
 * Lo que lo tapaba: en pruebas nadie hace dos envíos
 * simultáneos, y en producción el segundo 500 se lee como «falló
 * el registro» cuando en realidad había funcionado.
 *
 * MISMA IDEA QUE `leads.service.ts`: se captura el P2002, se
 * relee al ganador y se devuelve lo suyo. Cualquier otro error
 * sube tal cual, porque tragárselos todos convertiría un fallo
 * de base en una inscripción perdida en silencio.
 */

import { Prisma } from '../../generated/prisma';

import { PreinscripcionService } from './preinscripcion.service';
import { dobleDeEnlace } from './doble-enlace';
import { dobleDeEmbudo } from '../embudo/doble';

const CC = 1;
const PAR_DEL_GANADOR = 'par-del-ganador';

/// El error que lanza Prisma cuando la fila ya existe. Se
/// construye el de verdad y no un objeto parecido: la captura
/// comprueba la CLASE, y un doble con `code: 'P2002'` pasaría
/// aunque la clase estuviera mal.
const yaExisteLaFila = () =>
  new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`accionFormacionId`,`personaId`)',
    { code: 'P2002', clientVersion: '6.0.0' },
  );

type Llamada = { que: string; datos?: unknown };

function prismaFalso(opciones: {
  /// Qué hace el `create`: `null` crea sin más, `'P2002'`
  /// revienta como la segunda petición del doble clic, y
  /// `'otro'` es un fallo de base que NO se puede tragar.
  elCreate: null | 'P2002' | 'otro';
  /// Si el ganador aparece al releer. Cuando no aparece, el
  /// P2002 era de otro único y el error tiene que subir.
  ganadorVisible?: boolean;
}) {
  const llamadas: Llamada[] = [];
  const apunta = (que: string, datos?: unknown) =>
    llamadas.push({ que, datos });

  /// El primer `findFirst` es el `yaEsta` de antes del create y
  /// tiene que devolver «no hay nada»: es el estado que provoca
  /// la carrera. El segundo es la relectura del ganador.
  let vecesQueSeBusco = 0;

  return {
    llamadas,
    convenio: {
      findFirst: () =>
        Promise.resolve({ id: 'conv1', nombre: 'ADECOPRIA', sigla: 'ADE' }),
    },
    oferta: {
      findFirst: () =>
        Promise.resolve({
          id: 'of1',
          accionFormacionId: 'af1',
          accionFormacion: { evento: null, codigo: 'AF-001' },
        }),
    },
    /// Sin política vigente no se exige aceptarla, y aquí se está
    /// probando otra cosa.
    politicaDatos: { findFirst: () => Promise.resolve(null) },
    persona: {
      /// Cédula NUEVA: es el caso en que el registro devuelve
      /// token y encola el acuse, o sea el que puede hacer daño.
      findUnique: () => Promise.resolve(null),
      upsert: () => Promise.resolve({ id: 'per1' }),
      update: () => Promise.resolve({}),
    },
    participante: {
      findFirst: () => {
        vecesQueSeBusco += 1;
        apunta('participante.findFirst');
        if (vecesQueSeBusco === 1) return Promise.resolve(null);
        return Promise.resolve(
          opciones.ganadorVisible === false ? null : { id: PAR_DEL_GANADOR },
        );
      },
      findMany: () => Promise.resolve([]),
      create: () => {
        apunta('participante.create');
        if (opciones.elCreate === 'P2002')
          return Promise.reject(yaExisteLaFila());
        if (opciones.elCreate === 'otro') {
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError('se cayó la base', {
              code: 'P1001',
              clientVersion: '6.0.0',
            }),
          );
        }
        return Promise.resolve({ id: 'par-nuevo' });
      },
      update: () => Promise.resolve({}),
      findUnique: () => Promise.resolve(null),
    },
    /// Lo que el perdedor NO debe tocar.
    leadEntrante: {
      findMany: () => Promise.resolve([]),
      updateMany: () => Promise.resolve({ count: 0 }),
    },
    autorizacionDatos: {
      findFirst: () => Promise.resolve(null),
      create: () => {
        apunta('autorizacionDatos.create');
        return Promise.resolve({ id: 'a1' });
      },
    },
    $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
  };
}

function servicio(prisma: ReturnType<typeof prismaFalso>, llamadas: Llamada[]) {
  const enlaces = dobleDeEnlace();
  /// Se envuelven los dos para poder distinguirlos: lo que mata
  /// el enlace del ganador es `emitirAlRegistrarse`, que ANULA el
  /// anterior; `emitirOReusar` reusa el que ya está vivo.
  (enlaces as unknown as Record<string, unknown>).emitirAlRegistrarse = () => {
    llamadas.push({ que: 'emitirAlRegistrarse' });
    return Promise.resolve({ token: 'TOKEN-NUEVO', expiraEn: new Date() });
  };
  (enlaces as unknown as Record<string, unknown>).emitirOReusar = () => {
    llamadas.push({ que: 'emitirOReusar' });
    return Promise.resolve({
      token: 'TOKEN-DEL-GANADOR',
      expiraEn: new Date(),
    });
  };

  return new PreinscripcionService(
    prisma as never,
    /// `colaRui`, que no hace falta aquí.
    { encolarSiHaceFalta: () => Promise.resolve() } as never,
    { registrar: () => Promise.resolve() } as never,
    { enviar: () => Promise.resolve({ estado: 'ENVIADO' }) } as never,
    {} as never,
    dobleDeEmbudo(),
    /// La cola del ACUSE: encolar dos veces es mandarle a la
    /// persona dos correos que se contradicen.
    {
      encolar: () => {
        llamadas.push({ que: 'encolarAcuse' });
        return Promise.resolve();
      },
    } as never,
    enlaces,
    { avisar: () => Promise.resolve() } as never,
  );
}

const loQueManda = {
  tipoDocumentoSepId: CC,
  numeroDocumento: '1026300012',
  primerNombre: 'Ana',
  primerApellido: 'Ruiz',
  ofertaId: 'of1',
} as never;

describe('el segundo envío del doble clic', () => {
  it('ya no devuelve un 500: responde como el primero', async () => {
    const prisma = prismaFalso({ elCreate: 'P2002' });
    const r = await servicio(prisma, prisma.llamadas).registrar(
      'adecopria',
      loQueManda,
    );

    /// El caso exacto del defecto: antes esto lanzaba el P2002
    /// sin capturar.
    expect(r).toEqual({
      registrado: true,
      yaEstaba: false,
      token: 'TOKEN-DEL-GANADOR',
      expiraEn: expect.any(Date),
    });
  });

  it('relee al ganador en vez de inventarse una ficha', async () => {
    const prisma = prismaFalso({ elCreate: 'P2002' });
    await servicio(prisma, prisma.llamadas).registrar('adecopria', loQueManda);

    const busquedas = prisma.llamadas.filter(
      (l) => l.que === 'participante.findFirst',
    );
    /// Dos: la de antes del create y la relectura.
    expect(busquedas).toHaveLength(2);
  });

  it('NO anula el enlace que el primero acaba de entregar', async () => {
    const prisma = prismaFalso({ elCreate: 'P2002' });
    await servicio(prisma, prisma.llamadas).registrar('adecopria', loQueManda);

    const que = prisma.llamadas.map((l) => l.que);
    /// `emitirAlRegistrarse` ANULA el anterior: es lo que dejaba
    /// el enlace de la pantalla de gracias sin abrir.
    expect(que).not.toContain('emitirAlRegistrarse');
    expect(que).toContain('emitirOReusar');
  });

  it('ni encola un segundo acuse que se contradiga con el primero', async () => {
    const prisma = prismaFalso({ elCreate: 'P2002' });
    await servicio(prisma, prisma.llamadas).registrar('adecopria', loQueManda);

    expect(prisma.llamadas.map((l) => l.que)).not.toContain('encolarAcuse');
  });
});

describe('lo que NO se traga', () => {
  it('un fallo de base distinto sigue subiendo', async () => {
    /// Capturar todos los errores convertiría una base caída en
    /// una inscripción perdida en silencio, que es peor que el
    /// 500.
    const prisma = prismaFalso({ elCreate: 'otro' });
    await expect(
      servicio(prisma, prisma.llamadas).registrar('adecopria', loQueManda),
    ).rejects.toThrow('se cayó la base');
  });

  it('un P2002 sin ganador a la vista tampoco se traga', async () => {
    /// Si al releer no aparece nadie, el P2002 era de OTRO único
    /// y no de esta carrera. Devolver «ya estaba» ahí sería
    /// mentir sobre una ficha que no entró.
    const prisma = prismaFalso({ elCreate: 'P2002', ganadorVisible: false });
    await expect(
      servicio(prisma, prisma.llamadas).registrar('adecopria', loQueManda),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });
});

describe('el primero sigue haciendo su trabajo completo', () => {
  it('crea, encola el acuse y emite su enlace', async () => {
    const prisma = prismaFalso({ elCreate: null });
    const r = await servicio(prisma, prisma.llamadas).registrar(
      'adecopria',
      loQueManda,
    );

    const que = prisma.llamadas.map((l) => l.que);
    expect(que).toContain('participante.create');
    expect(que).toContain('encolarAcuse');
    expect(que).toContain('emitirAlRegistrarse');
    expect(r).toMatchObject({ registrado: true, yaEstaba: false });
  });
});
