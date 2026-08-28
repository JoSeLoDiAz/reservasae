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
};

function armar(o: Opciones) {
  const escrituras: string[] = [];

  const prisma = {
    participante: {
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
    movimientoParticipante: {
      create: () => {
        escrituras.push('movimiento.create');
        return Promise.resolve({ id: 'm1' });
      },
    },
    actividad: { count: () => Promise.resolve(10) },
    avanceActividad: { count: () => Promise.resolve(10) },
    $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
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

  const s = new CrmService(
    prisma as never,
    { registrar: () => Promise.resolve() } as never,
    { encolarSiHaceFalta: () => Promise.resolve() } as never,
    cupos as never,
  );

  /// Otra cosa, y ya probada en `completitud.spec`.
  jest.spyOn(s, 'estadoDeDatos').mockResolvedValue({ completo: true, falta: [] });
  jest
    .spyOn(s, 'faltantesParaMatricular')
    .mockResolvedValue({ bloquean: [], avisan: [], reporte: [] } as never);
  jest.spyOn(s, 'obtener').mockResolvedValue({ id: 'p1', ok: true } as never);

  return { s, escrituras };
}

const ADMIN = { id: 'a1', nombre: 'Ana Jaramillo' };

/** Lo que contesta el método: el resultado o el mensaje del error. */
async function pasarA(opciones: Opciones, etapa: string, cierran: string[] = ['c1']) {
  const { s, escrituras } = armar(opciones);
  try {
    await s.cambiarEtapa('p1', { etapa } as never, ADMIN as never, ['c1'], undefined, cierran);
    return { ok: true, mensaje: '', escrituras };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message, escrituras };
  }
}

describe('el regreso al aula con el grupo ya andando', () => {
  it('RETIRADO → EN_FORMACION pasa, aunque la ventana esté cerrada', async () => {
    /// Es LA regresión: la ventana se comprueba en dos sitios y
    /// la exención solo apagaba el segundo, así que esto moría
    /// en el primero con «Se cerró la ventana de inscripción de
    /// todos los grupos». Un grupo en curso SIEMPRE la tiene
    /// cerrada, así que fallaba siempre, no a veces.
    const r = await pasarA({ etapa: 'RETIRADO', motivo: 'VENTANA_CERRADA' }, 'EN_FORMACION');

    expect(r.mensaje).not.toMatch(/ventana/i);
    expect(r.ok).toBe(true);
    expect(r.escrituras).toContain('participante.update');
  });

  it('y con los grupos sin fechas, también', async () => {
    const r = await pasarA({ etapa: 'ABANDONO', motivo: 'SIN_FECHAS' }, 'EN_FORMACION');
    expect(r.ok).toBe(true);
  });

  it('INSCRITO → EN_FORMACION (ingreso tardío) ni siquiera pide cupo', async () => {
    const r = await pasarA({ etapa: 'INSCRITO', motivo: 'VENTANA_CERRADA' }, 'EN_FORMACION');
    expect(r.ok).toBe(true);
  });
});

describe('la exención es SOLO de la ventana', () => {
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

describe('quien viene de fuera SÍ tiene que encontrar la ventana abierta', () => {
  it('INTERESADO → INSCRITO con la ventana cerrada se niega', async () => {
    /// La exención es de quien VUELVE. A quien entra por primera
    /// vez la ventana le aplica entera.
    const r = await pasarA({ etapa: 'INTERESADO', motivo: 'VENTANA_CERRADA' }, 'INSCRITO');

    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/VENTANA_CERRADA/);
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
      { etapa: 'RETIRADO', motivo: 'VENTANA_CERRADA' },
      'EN_FORMACION',
    );
    expect(alAula.ok).toBe(true);

    const certificar = await pasarA(
      { etapa: 'EN_FORMACION', motivo: 'VENTANA_CERRADA' },
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
