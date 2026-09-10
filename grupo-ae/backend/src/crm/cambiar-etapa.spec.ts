/** `cambiarEtapa` de verdad, no sus funciones puras. */

/**
 * Este spec existe por una razón concreta: los de la escalera
 * prueban `exigeCupo`, `exigeDatosParaElAula` y
 * `motivoDeTransicionImposible`, que son puras y salen bien —
 * y aun así el flujo real estaba roto DOS veces seguidas,
 * porque el defecto no estaba en los predicados sino en cómo
 * `cambiarEtapa` los usa:
 *
 *  1. La ventana se comprueba en DOS sitios y la exención solo
 *     apagaba el segundo, así que el regreso al aula seguía
 *     muriendo en el primero.
 *  2. `exigirQueQuepa` corría ANTES de juzgar si el paso era
 *     posible, así que `RETIRADO → CERTIFICADO` contestaba con
 *     un error de cupos en vez del mensaje que dice cómo
 *     hacerlo bien.
 *
 * Un spec de funciones puras no puede ver ninguno de los dos.
 * Este llama al método y mira qué contesta.
 *
 * `estadoDeDatos` y `faltantesParaMatricular` sí se sustituyen:
 * son otra cosa y las cubre `completitud.spec`. Lo que NO se
 * sustituye es `exigirQueQuepa`, porque es lo que se prueba.
 */

import { CrmService } from './crm.service';

const OFERTA = 'o1';
const COBERTURA = 'cob1';

/** Una organización completa: no es lo que se prueba aquí. */
const EMPRESA = {
  nit: '900123456',
  razonSocial: 'Textiles del Norte SAS',
  sectorEconomico: 'Manufactura',
  contactoNombre: 'Marta Oquendo',
  contactoCargo: 'Jefa de talento',
  contactoCorreo: 'marta@ejemplo.test',
};

type Opciones = {
  etapa: string;
  /// Que contesta el panel de cupos de esa oferta.
  motivo: string | null;
  inscritos?: number;
  cuposMaximos?: number;
  ventana?: string;
  /// false = la empresa le viene de su reserva, no propia.
  empresaPropia?: boolean;
  /// El disparador se queja (p.ej. a la empresa le faltan los 3 datos).
  disparadorFalla?: boolean;
};

function armar(o: Opciones) {
  const escrituras: string[] = [];

  const prisma = {
    participante: {
      count: () => Promise.resolve(0),
      findFirst: () => Promise.resolve({ id: 'p1' }),
      findUnique: () =>
        Promise.resolve({
          id: 'p1',
          personaId: 'per1',
          convenioId: 'c1',
          etapa: o.etapa,
          accionFormacionId: 'af1',
          ofertaId: OFERTA,
          coberturaId: COBERTURA,
          fechaRetiro: null,
          fechaMatricula: null,
          fechaCertificacion: null,
          persona: { numeroDocumento: '1019456782' },
          /// `propia: false` = solo la tiene por su reserva, que
          /// es el camino principal: una empresa aparta cupos y
          /// despues nomina a su gente.
          empresa: o.empresaPropia === false ? null : EMPRESA,
          reserva: o.empresaPropia === false ? { empresa: EMPRESA } : null,
        }),
      update: () => {
        escrituras.push('participante.update');
        return Promise.resolve({ id: 'p1' });
      },
    },
    /// El aforo del grupo, para el candado que toma `cambiarEtapa`
    /// antes de escribir. Con sitio de sobra: lo que se prueba aqui es
    /// la escalera de etapas, no el lleno.
    grupoCobertura: {
      findUnique: () => Promise.resolve({ cuposMaximos: 30, grupo: { numero: 1 } }),
    },
    movimientoParticipante: {
      create: () => {
        escrituras.push('movimiento.create');
        return Promise.resolve({ id: 'm1' });
      },
    },
    actividad: { count: () => Promise.resolve(10) },
    avanceActividad: { count: () => Promise.resolve(10) },
    /// Admite las dos formas: la lista de siempre y la interactiva,
    /// que es la que usa `cambiarEtapa` desde que toma el candado del
    /// aforo antes de escribir.
    $transaction: (x: unknown) =>
      typeof x === 'function'
        ? (x as (tx: unknown) => Promise<unknown>)(prisma)
        : Promise.all(x as Promise<unknown>[]),
    /// El `SELECT ... FOR UPDATE` del candado.
    ///
    /// Aqui no hay base, asi que no se puede probar que el
    /// bloqueo BLOQUEE. Pero si se puede probar que se TOMA, y
    /// eso es lo que faltaba: el doble devolvia `[]` sin mirar,
    /// asi que borrando esa linea de `crm.service.ts` no fallaba
    /// ningun test. El candado contra la sobreventa podia
    /// desaparecer sin que nada lo notara.
    ///
    /// Lo señalo Mauricio Andres, y es el mismo patron que yo
    /// acababa de cometer en el doble del cruce: no que el spec
    /// mienta, sino que no sujeta lo que dice sujetar.
    $queryRaw: () => {
      escrituras.push('BLOQUEO_DE_LA_OFERTA');
      return Promise.resolve([]);
    },
  };

  const cupos = {
    deLaOferta: () =>
      Promise.resolve({
        ofertaId: OFERTA,
        accion: 'AF1',
        ubicacion: 'Medellín',
        cupos: { total: 30, lleno: o.motivo === 'LLENO' },
        grupos: [
          {
            grupoId: 'g1',
            numero: 2,
            coberturaId: COBERTURA,
            cuposMaximos: o.cuposMaximos ?? 30,
            inscritos: o.inscritos ?? 5,
            ventana: { estado: o.ventana ?? 'CERRADA', cierre: new Date('2026-08-25') },
          },
        ],
        admiteInscripciones: o.motivo === null,
        porQueNo: o.motivo === null ? null : 'motivo: ' + o.motivo,
        motivo: o.motivo,
      }),
  };

  /// A quien se le disparo la validacion de su empresa.
  const inscritos: string[] = [];
  const disparador = {
    alInscribir: (id: string) => {
      inscritos.push(id);
      return o.disparadorFalla
        ? Promise.reject(new Error('faltan persona de contacto, cargo y correo'))
        : Promise.resolve('ENCOLADO');
    },
  };

  const s = new CrmService(
    prisma as never,
    { registrar: () => Promise.resolve() } as never,
    { encolarSiHaceFalta: () => Promise.resolve() } as never,
    cupos as never,
    disparador as never,
  );

  /// Otra cosa, y ya probada en `completitud.spec`.
  jest.spyOn(s, 'estadoDeDatos').mockResolvedValue({ completo: true, falta: [] });
  jest
    .spyOn(s, 'faltantesParaMatricular')
    .mockResolvedValue({ bloquean: [], avisan: [], reporte: [] } as never);
  jest.spyOn(s, 'obtener').mockResolvedValue({ id: 'p1', ok: true } as never);

  return { s, escrituras, inscritos };
}

const ADMIN = { id: 'a1', nombre: 'Ana Jaramillo' };

/** Lo que contesta el método: el resultado o el mensaje del error. */
async function pasarA(opciones: Opciones, etapa: string, cierran: string[] = ['c1']) {
  const { s, escrituras, inscritos } = armar(opciones);
  try {
    await s.cambiarEtapa('p1', { etapa } as never, ADMIN as never, ['c1'], undefined, cierran);
    return { ok: true, mensaje: '', escrituras, inscritos };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message, escrituras, inscritos };
  }
}

describe('el regreso al aula con el grupo ya andando', () => {
  /**
   * ESTOS TESTS SIGUEN VALIENDO, y por un motivo distinto.
   *
   * Antes protegían una EXENCIÓN: la ventana bloqueaba y a quien
   * volvía se le eximía. Desde el 3 sep 2026 el cronograma no
   * bloquea a nadie —orden del cliente—, así que ya no hay nada
   * de lo que eximir.
   *
   * Lo que afirman —que se puede volver al aula con el grupo ya
   * andando— es lo que importa y no ha cambiado. Se quedan como
   * prueba de que la pared no vuelva por otro sitio.
   */
  it('RETIRADO → EN_FORMACION pasa con el grupo ya arrancado', async () => {
    const r = await pasarA({ etapa: 'RETIRADO', motivo: null }, 'EN_FORMACION');

    expect(r.mensaje).not.toMatch(/ventana/i);
    expect(r.ok).toBe(true);
    expect(r.escrituras).toContain('participante.update');
  });

  it('y con los grupos sin fechas, también', async () => {
    const r = await pasarA({ etapa: 'ABANDONO', motivo: null }, 'EN_FORMACION');
    expect(r.ok).toBe(true);
  });

  it('INSCRITO → EN_FORMACION (ingreso tardío) ni siquiera pide cupo', async () => {
    const r = await pasarA({ etapa: 'INSCRITO', motivo: null }, 'EN_FORMACION');
    expect(r.ok).toBe(true);
  });
});

describe('el cupo y la oferta SIGUEN bloqueando: no son cronograma', () => {
  it('con la oferta llena, quien vuelve sigue bloqueado', async () => {
    /// Su silla se liberó al retirarse: volver pide una nueva, y
    /// si no la hay, no la hay. Eximirlo de esto sería
    /// sobrevender sin que nadie lo firme.
    const r = await pasarA({ etapa: 'RETIRADO', motivo: 'LLENO' }, 'EN_FORMACION');

    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/LLENO/);
    expect(r.escrituras).toEqual([]);
  });

  it('con la oferta cerrada, también', async () => {
    const r = await pasarA({ etapa: 'RETIRADO', motivo: 'OFERTA_CERRADA' }, 'EN_FORMACION');
    expect(r.ok).toBe(false);
    expect(r.escrituras).toEqual([]);
  });

  it('y si su grupo concreto ya no tiene sitio, tampoco', async () => {
    const r = await pasarA(
      { etapa: 'RETIRADO', motivo: null, inscritos: 30, cuposMaximos: 30 },
      'EN_FORMACION',
    );
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/lleno/i);
  });
});

describe('quien viene de fuera tampoco topa con el cronograma', () => {
  it('INTERESADO → INSCRITO pasa aunque el grupo ya arrancara', async () => {
    /// EL ASERTO QUE PROTEGE DEL ARREGLO EXCESIVO AL REVES.
    ///
    /// Antes esto se NEGABA: la exención era solo de quien
    /// volvía. Desde que el cronograma no bloquea, tampoco le
    /// aplica a quien entra por primera vez — que es lo que se
    /// ordenó: «nada de lo inscrito debe estar asociado al
    /// cronograma».
    ///
    /// Si alguien devuelve la pared «solo para los nuevos», este
    /// test cae y le obliga a mirar por qué.
    const r = await pasarA({ etapa: 'INTERESADO', motivo: null }, 'INSCRITO');

    expect(r.ok).toBe(true);
  });

  it('y con todo abierto, entra', async () => {
    const r = await pasarA(
      { etapa: 'INTERESADO', motivo: null, ventana: 'ABIERTA' },
      'INSCRITO',
    );
    expect(r.ok).toBe(true);
  });
});

describe('el paso imposible se juzga ANTES que el cupo', () => {
  it('RETIRADO → CERTIFICADO responde cómo hacerlo bien, no un error de cupos', async () => {
    /// `CERTIFICADO` ocupa silla, así que `exigeCupo` es cierto
    /// viniendo de una salida del aula. Con el orden al revés,
    /// `exigirQueQuepa` contestaba con la ventana o con el
    /// sobrecupo y TAPABA el mensaje que dice qué hacer — que
    /// es justo para lo que existe esa regla.
    /// La oferta va LLENA a propósito: es lo que hace visible el
    /// orden. Con la ventana cerrada, `exigirQueQuepa` no lanza
    /// (quien vuelve está exento) y los dos órdenes dan el mismo
    /// resultado — o sea que ese escenario no prueba nada, y la
    /// prueba de mutación lo dijo pasando con el orden invertido.
    const r = await pasarA({ etapa: 'RETIRADO', motivo: 'LLENO' }, 'CERTIFICADO');

    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/En formación/);
    expect(r.mensaje).not.toMatch(/LLENO/);
  });

  it('DESERTO → NO_APROBO da la guía, y NO por el orden', async () => {
    /// Aquí el orden da igual, y conviene decirlo: `NO_APROBO`
    /// NO está en `OCUPA_SILLA`, así que `exigeCupo` es falso y
    /// `exigirQueQuepa` ni se llama. La prueba de mutación lo
    /// dijo — invirtiendo el orden, este test seguía pasando.
    ///
    /// Se queda porque fija otra cosa que sí importa: dar por no
    /// aprobado a quien nunca entró al aula tampoco se puede, y
    /// el mensaje es el mismo que guía.
    const r = await pasarA({ etapa: 'DESERTO', motivo: 'LLENO' }, 'NO_APROBO');

    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/En formación/);
  });
});

describe('la cadena completa del regreso', () => {
  it('vuelve al aula y desde ahí sí se certifica', async () => {
    /// Las dos mitades de la regla, juntas. Si una de las dos
    /// falla, certificar a quien volvió es imposible y no
    /// difícil, que es lo que estuvo pasando.
    const alAula = await pasarA(
      { etapa: 'RETIRADO', motivo: null },
      'EN_FORMACION',
    );
    expect(alAula.ok).toBe(true);

    const certificar = await pasarA(
      { etapa: 'EN_FORMACION', motivo: null },
      'CERTIFICADO',
    );
    expect(certificar.ok).toBe(true);
  });
});

describe('poner la etapa que ya tiene no es un paso', () => {
  it('CERTIFICADO → CERTIFICADO no contesta un error falso', async () => {
    /// Antes daba «alguien que ya salió del aula» a quien está
    /// certificado, que es mentira sobre lo que pasa.
    const r = await pasarA({ etapa: 'CERTIFICADO', motivo: 'LLENO' }, 'CERTIFICADO');

    expect(r.ok).toBe(true);
    expect(r.escrituras).toEqual([]);
  });
});

describe('la organización sale de la suya O de la de su reserva', () => {
  it('quien llegó por la reserva de una empresa SÍ se puede matricular', async () => {
    /// Es el camino principal del sistema: una empresa aparta N
    /// cupos y después nomina a su gente, así que el
    /// participante no tiene empresa propia — la tiene su
    /// reserva. La compuerta miraba solo la propia y contestaba
    /// «no se puede reportar al SENA», que además es falso: el
    /// F7 y el reporte la resuelven por la reserva desde
    /// siempre. Eran tres reglas para la misma pregunta y esta
    /// era la más estrecha.
    const r = await pasarA(
      { etapa: 'INTERESADO', motivo: null, ventana: 'ABIERTA', empresaPropia: false },
      'INSCRITO',
    );

    expect(r.mensaje).not.toMatch(/no tiene organización/i);
    expect(r.ok).toBe(true);
  });

  it('sin ninguna de las dos, sigue bloqueado', async () => {
    const { s } = armar({ etapa: 'INTERESADO', motivo: null, ventana: 'ABIERTA' });
    jest.spyOn(s as never, 'faltaDeLaEmpresa' as never).mockReturnValue([
      'sector económico',
    ] as never);

    await expect(
      s.cambiarEtapa('p1', { etapa: 'INSCRITO' } as never, ADMIN as never, ['c1'], undefined, ['c1']),
    ).rejects.toThrow(/organización/i);
  });
});

describe('entrar a INSCRITO dispara la validacion de su empresa', () => {
  /// El buscador web completa la ficha de la empresa, pero eso es un
  /// complemento del cambio de etapa, no un requisito suyo.
  it('al pasar a INSCRITO se dispara, con el id del participante', async () => {
    const r = await pasarA(
      { etapa: 'INTERESADO', motivo: null, ventana: 'ABIERTA' },
      'INSCRITO',
    );

    expect(r.ok).toBe(true);
    expect(r.inscritos).toEqual(['p1']);
  });

  it('las demas etapas no lo disparan', async () => {
    const r = await pasarA(
      { etapa: 'INTERESADO', motivo: null, ventana: 'ABIERTA' },
      'CONTACTADO',
    );

    expect(r.ok).toBe(true);
    expect(r.inscritos).toEqual([]);
  });

  /// Esto es lo que separa un complemento de un requisito: si a la
  /// empresa le faltan los 3 datos de contacto, el disparador se queja
  /// y la inscripcion tiene que seguir su curso igual.
  it('si el disparador se queja, la etapa cambia de todos modos', async () => {
    const r = await pasarA(
      { etapa: 'INTERESADO', motivo: null, ventana: 'ABIERTA', disparadorFalla: true },
      'INSCRITO',
    );

    expect(r.ok).toBe(true);
    expect(r.inscritos).toEqual(['p1']);
  });
});

describe('el candado contra la sobreventa se TOMA', () => {
  /**
   * No se puede probar sin base que el bloqueo BLOQUEE. Pero sí
   * que se toma, y en el orden bueno — y eso es lo que faltaba:
   * el doble devolvía `[]` sin mirar, así que borrando el
   * `SELECT ... FOR UPDATE` de `crm.service.ts` no fallaba ningún
   * test. El candado podía desaparecer sin que nada lo notara.
   *
   * Lo señaló Mauricio Andrés, y es el mismo patrón que yo
   * acababa de cometer en el doble del cruce: no que el spec
   * mienta, sino que no sujeta lo que dice sujetar.
   */

  it('se toma cuando la transición ocupa una silla nueva', async () => {
    const r = await pasarA(
      { etapa: 'DATOS_COMPLETOS', motivo: null, ventana: 'ABIERTA' },
      'INSCRITO',
    );

    expect(r.ok).toBe(true);
    expect(r.escrituras).toContain('BLOQUEO_DE_LA_OFERTA');
  });

  it('y ANTES de escribir, no después', async () => {
    /// El orden es todo el mecanismo: escribir y después
    /// bloquear deja pasar al segundo asesor entre las dos
    /// cosas, que es exactamente lo que el bloqueo impide.
    const r = await pasarA(
      { etapa: 'DATOS_COMPLETOS', motivo: null, ventana: 'ABIERTA' },
      'INSCRITO',
    );

    const bloqueo = r.escrituras.indexOf('BLOQUEO_DE_LA_OFERTA');
    const escribe = r.escrituras.indexOf('participante.update');
    expect(bloqueo).toBeGreaterThanOrEqual(0);
    expect(bloqueo).toBeLessThan(escribe);
  });

  it('NO se toma cuando la transición no ocupa silla', async () => {
    /// Bloquear la oferta para mover a alguien de INTERESADO a
    /// CONTACTADO serializaría el trabajo de todo el equipo por
    /// nada.
    const r = await pasarA(
      { etapa: 'INTERESADO', motivo: null, ventana: 'ABIERTA' },
      'CONTACTADO',
    );

    expect(r.ok).toBe(true);
    expect(r.escrituras).not.toContain('BLOQUEO_DE_LA_OFERTA');
  });
});
