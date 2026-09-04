/** El lote de grupo no sobrevende, y no escribe lo que no puede. */

/**
 * Es el candado del que avisaron los cuatro escépticos, cada uno por
 * su lado: un grupo con 3 sillas y 40 marcados, o dos líderes
 * asignando a la vez desde celdas hermanas de la MISMA oferta.
 *
 * Lo que se comprueba aquí no es el número que devuelve —eso puede
 * cambiar— sino **QUÉ SE ESCRIBIÓ**. Es el criterio de
 * `fuera-del-ambito.spec` y de `gestion-no-escribe-si-no-puede`: la
 * aserción que no depende del código de respuesta.
 *
 * El doble de Prisma APLICA LOS FILTROS DE VERDAD sobre una lista en
 * memoria. Uno que devolviera siempre todo probaría el doble, no el
 * candado — el error que este proyecto ya cometió con el que decidía
 * por el prefijo del id.
 */

import { AsignarGrupo } from './asignar-grupo.service';
import { OCUPAN_SILLA, RETIENEN_ASIENTO } from './etapas';

type Ficha = {
  id: string;
  convenioId: string;
  ofertaId: string | null;
  coberturaId: string | null;
  etapa: string;
};

const CELDA = {
  id: 'cel-1',
  ubicacionId: 'u-1',
  modalidad: 'VIRTUAL',
  cuposMaximos: 3,
  ubicacion: { nombre: 'BOGOTÁ D.C' },
  grupo: {
    numero: 1,
    accionFormacionId: 'af-1',
    accionFormacion: { convenioId: 'c-1' },
  },
};

function armar(
  fichas: Ficha[],
  o: { celda?: typeof CELDA | null; ofertaModalidad?: string } = {},
) {
  const escrito: string[] = [];
  let asignados: string[] = [];
  let bloqueo = false;

  const tx = {
    $queryRaw: (...a: unknown[]) => {
      bloqueo = true;
      void a;
      return Promise.resolve([]);
    },
    participante: {
      findMany: (q: { where: Record<string, unknown> }) => {
        const w = q.where;
        const ids = (w.id as { in: string[] } | undefined)?.in;
        /// EL FILTRO DE VERDAD, las cuatro condiciones.
        const hay = fichas.filter(
          (f) =>
            (!ids || ids.includes(f.id)) &&
            f.convenioId === w.convenioId &&
            f.ofertaId === w.ofertaId &&
            f.coberturaId === null &&
            /// SE APLICA EL `where` QUE MANDA EL SERVICIO, no una
            /// copia de la regla.
            ///
            /// Estaba con `OCUPAN_SILLA.includes(...)` a mano, y al
            /// mutar la regla de verdad solo caía 1 de 38: el doble
            /// decidía por su cuenta, así que los tests probaban el
            /// doble. Es la trampa que este repositorio lleva
            /// documentada desde el que decidía por el prefijo del
            /// id.
            cumpleLaEtapa(f.etapa, w.etapa),
        );
        return Promise.resolve(hay.map((f) => ({ id: f.id, etapa: f.etapa })));
      },
      count: (q: { where: { coberturaId: string; etapa: { in: string[] } } }) =>
        Promise.resolve(
          fichas.filter(
            (f) =>
              f.coberturaId === q.where.coberturaId &&
              q.where.etapa.in.includes(f.etapa),
          ).length,
        ),
      updateMany: (q: {
        where: { id: { in: string[] }; coberturaId: null };
        data: { coberturaId: string };
      }) => {
        /// El doble EXIGE el `coberturaId: null` en la escritura: sin
        /// él, este test no distinguiría leer de escribir.
        if (q.where.coberturaId !== null) {
          escrito.push('updateMany.SIN_CANDADO');
          return Promise.resolve({ count: 0 });
        }
        escrito.push('updateMany');
        asignados = q.where.id.in;
        return Promise.resolve({ count: q.where.id.in.length });
      },
    },
    movimientoParticipante: {
      createMany: (q: { data: unknown[] }) => {
        escrito.push(`movimientos:${q.data.length}`);
        return Promise.resolve({ count: q.data.length });
      },
    },
  };

  const celda = o.celda === undefined ? CELDA : o.celda;

  const prisma = {
    grupoCobertura: {
      findFirst: (q: { where: { grupo?: { accionFormacion?: { convenioId?: { in: string[] } } } } }) => {
        /// El ÁMBITO de verdad: fuera de él, la celda no existe.
        const amb = q.where.grupo?.accionFormacion?.convenioId?.in;
        if (celda && amb && !amb.includes(celda.grupo.accionFormacion.convenioId)) {
          return Promise.resolve(null);
        }
        return Promise.resolve(celda);
      },
    },
    oferta: {
      findUnique: () =>
        Promise.resolve({
          id: 'of-1',
          ubicacionId: 'u-1',
          modalidad: o.ofertaModalidad ?? 'VIRTUAL',
        }),
    },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };

  const auditoria = { registrar: () => Promise.resolve() };
  const s = new AsignarGrupo(prisma as never, auditoria as never);

  return { s, escrito, tomo: () => bloqueo, asignados: () => asignados };
}

/// Aplica el filtro de etapa TAL COMO LLEGA en el `where`. Es lo
/// que convierte al doble en un espejo de Prisma y no en una
/// segunda implementación de la regla.
function cumpleLaEtapa(etapa: string, filtro: unknown): boolean {
  const f = filtro as { in?: string[]; notIn?: string[] } | undefined;
  if (!f) return true;
  if (f.in) return f.in.includes(etapa);
  if (f.notIn) return !f.notIn.includes(etapa);
  return true;
}

const ADMIN = { id: 'a-1', nombre: 'Ana Jaramillo' };

/// Cinco esperando, la celda admite 3.
const CINCO: Ficha[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `p${n}`,
  convenioId: 'c-1',
  ofertaId: 'of-1',
  coberturaId: null,
  /// INSCRITOS, que es a quienes ofrece el lote desde el 3 sep 2026.
  etapa: 'INSCRITO',
}));

describe('no sobrevende', () => {
  it('con 3 sillas y 5 marcados, entran 3 y se dice cuántos no', async () => {
    const { s, asignados } = armar(CINCO);

    const r = await s.asignar('cel-1', CINCO.map((f) => f.id), ADMIN, ['c-1']);

    expect(r.asignadas).toBe(3);
    expect(r.sinCupo).toBe(2);
    expect(asignados()).toHaveLength(3);
  });

  it('cuenta a los APUNTADOS, no a los que ocupan silla', async () => {
    /// El defecto que avisaron los cuatro escépticos. Con dos
    /// interesados ya en la celda, solo cabe uno más. Contando con
    /// `OCUPAN_SILLA` la celda se vería vacía y entrarían tres.
    const yaDentro: Ficha[] = [
      /// Interesados A PROPOSITO: por la ficha se les puede poner
      /// grupo de a uno, y entonces RETIENEN el asiento aunque el
      /// lote no los ofrezca. Es justo la distincion que sostiene
      /// las dos listas.
      { id: 'x1', convenioId: 'c-1', ofertaId: 'of-1', coberturaId: 'cel-1', etapa: 'INTERESADO' },
      { id: 'x2', convenioId: 'c-1', ofertaId: 'of-1', coberturaId: 'cel-1', etapa: 'CONTACTADO' },
    ];
    const { s } = armar([...yaDentro, ...CINCO]);

    const r = await s.asignar('cel-1', CINCO.map((f) => f.id), ADMIN, ['c-1']);

    expect(r.asignadas).toBe(1);
    expect(r.sinCupo).toBe(4);
  });

  it('quien se retiró de esa celda libera su asiento', async () => {
    /// Su etapa no está en RETIENEN_ASIENTO, así que no cuenta.
    const salido: Ficha[] = [
      { id: 'x1', convenioId: 'c-1', ofertaId: 'of-1', coberturaId: 'cel-1', etapa: 'RETIRADO' },
    ];
    const { s } = armar([...salido, ...CINCO]);

    const r = await s.asignar('cel-1', CINCO.map((f) => f.id), ADMIN, ['c-1']);
    expect(r.asignadas).toBe(3);
  });
});

describe('el candado de concurrencia', () => {
  it('toma la fila de la OFERTA antes de contar y escribir', async () => {
    /// Sobre la oferta y no sobre la celda: dos celdas hermanas se
    /// reparten el MISMO montón de candidatos, así que bloquear la
    /// celda dejaría correr los dos lotes a la vez.
    const { s, tomo } = armar(CINCO);
    await s.asignar('cel-1', ['p1'], ADMIN, ['c-1']);
    expect(tomo()).toBe(true);
  });
});

describe('lo que NO entra, no se escribe', () => {
  it('un id de otro convenio se cuenta en `fuera` y no se toca', async () => {
    const ajena: Ficha = {
      id: 'ajeno',
      convenioId: 'c-2',
      ofertaId: 'of-1',
      coberturaId: null,
      etapa: 'INSCRITO',
    };
    const { s, asignados } = armar([ajena, ...CINCO]);

    const r = await s.asignar('cel-1', ['ajeno', 'p1'], ADMIN, ['c-1']);

    expect(r.fuera).toBe(1);
    expect(asignados()).toEqual(['p1']);
  });

  it('un id de OTRA oferta tampoco', async () => {
    const otra: Ficha = {
      id: 'otra',
      convenioId: 'c-1',
      ofertaId: 'of-9',
      coberturaId: null,
      etapa: 'INSCRITO',
    };
    const { s, asignados } = armar([otra, ...CINCO]);

    const r = await s.asignar('cel-1', ['otra', 'p1'], ADMIN, ['c-1']);
    expect(r.fuera).toBe(1);
    expect(asignados()).toEqual(['p1']);
  });

  it('quien YA tiene grupo no se mueve de cohorte', async () => {
    /// El lote rellena el hueco; cambiar de grupo es otra decisión.
    const conGrupo: Ficha = {
      id: 'tiene',
      convenioId: 'c-1',
      ofertaId: 'of-1',
      coberturaId: 'cel-9',
      etapa: 'INSCRITO',
    };
    const { s, asignados } = armar([conGrupo, ...CINCO]);

    const r = await s.asignar('cel-1', ['tiene', 'p1'], ADMIN, ['c-1']);
    expect(r.fuera).toBe(1);
    expect(asignados()).toEqual(['p1']);
  });

  it('la escritura lleva el candado `coberturaId: null`', async () => {
    const { s, escrito } = armar(CINCO);
    await s.asignar('cel-1', ['p1'], ADMIN, ['c-1']);
    expect(escrito).toContain('updateMany');
    expect(escrito).not.toContain('updateMany.SIN_CANDADO');
  });
});

describe('fuera del ámbito no existe, y no escribe', () => {
  it('con el gremio ajeno da 404 y no toca nada', async () => {
    const { s, escrito } = armar(CINCO);
    await expect(s.asignar('cel-1', ['p1'], ADMIN, ['c-2'])).rejects.toThrow(
      /no existe/i,
    );
    expect(escrito).toEqual([]);
  });
});

describe('la celda que no cuadra con su oferta', () => {
  it('con otra modalidad se para, y no escribe', async () => {
    const { s, escrito } = armar(CINCO, { ofertaModalidad: 'PRESENCIAL' });
    await expect(s.asignar('cel-1', ['p1'], ADMIN, ['c-1'])).rejects.toThrow(
      /modalidad|VIRTUAL|PRESENCIAL/i,
    );
    expect(escrito).toEqual([]);
  });
});

describe('el aserto que protege del arreglo excesivo', () => {
  it('con sitio de sobra, entran TODOS los marcados', async () => {
    /// Si alguien «endurece» esto y el lote deja de asignar, cae.
    const holgada = { ...CELDA, cuposMaximos: 50 };
    const { s } = armar(CINCO, { celda: holgada });

    const r = await s.asignar('cel-1', CINCO.map((f) => f.id), ADMIN, ['c-1']);
    expect(r.asignadas).toBe(5);
    expect(r.sinCupo).toBe(0);
    expect(RETIENEN_ASIENTO).toContain('INTERESADO');
  });
});

describe('el lote es SOLO para los ya inscritos', () => {
  /**
   * La corrección del cliente del 3 sep 2026: «el grupo es lo último
   * que se asigna, una vez se llame y se completen los datos».
   *
   * Un INTERESADO puede no llegar nunca a inscribirse, y apuntarlo a
   * una cohorte le reserva un asiento del cupo comprometido con el
   * SENA. Por la ficha sí se le puede poner grupo de a uno — ahí hay
   * un asesor mirando una persona. Lo que no puede es pasar de a
   * trescientos.
   */
  const DEL_MONTON = ['INTERESADO', 'CONTACTADO', 'DATOS_COMPLETOS'] as const;

  it.each(DEL_MONTON)('un %s marcado a mano NO se asigna', async (etapa) => {
    const suelto: Ficha = {
      id: 'del-monton',
      convenioId: 'c-1',
      ofertaId: 'of-1',
      coberturaId: null,
      etapa,
    };
    const { s, asignados } = armar([suelto, ...CINCO]);

    const r = await s.asignar('cel-1', ['del-monton', 'p1'], ADMIN, ['c-1']);

    /// Se cuenta en `fuera`, que es lo honesto: no se tocó.
    expect(r.fuera).toBe(1);
    expect(asignados()).toEqual(['p1']);
  });

  it('pero quien ya está EN EL AULA sí, y hace falta', async () => {
    /// El aserto que impide acortar la regla a `['INSCRITO']`: quien
    /// está en formación sin cohorte también la necesita para el
    /// reporte.
    const enAula: Ficha = {
      id: 'en-aula',
      convenioId: 'c-1',
      ofertaId: 'of-1',
      coberturaId: null,
      etapa: 'EN_FORMACION',
    };
    const { s, asignados } = armar([enAula]);

    const r = await s.asignar('cel-1', ['en-aula'], ADMIN, ['c-1']);

    expect(r.asignadas).toBe(1);
    expect(asignados()).toEqual(['en-aula']);
  });
});
