import { EtapaOportunidad, TipoEmbudo } from '../../generated/prisma';
import {
  GESTIONES_PARA_BANANEO,
  porqueDeSenal,
  rotuloDeSenal,
  senalesDe,
  type NegocioAJuzgar,
} from './senales';

const AHORA = new Date('2026-09-15T10:00:00Z');
const AYER = new Date('2026-09-14T10:00:00Z');
const MANANA = new Date('2026-09-16T10:00:00Z');

function negocio(cambios: Partial<NegocioAJuzgar> = {}): NegocioAJuzgar {
  return {
    embudo: TipoEmbudo.EMPRESA,
    etapa: EtapaOportunidad.EN_NEGOCIACION,
    cierreEsperado: MANANA,
    enLaEtapaDesde: AYER,
    gestionesHechasEnLaEtapa: 0,
    ...cambios,
  };
}

describe('muerto viviente', () => {
  it('lo es cuando su propia fecha de cierre ya pasó', () => {
    expect(senalesDe(negocio({ cierreEsperado: AYER }), AHORA)).toEqual([
      'MUERTO_VIVIENTE',
    ]);
  });

  it('no lo es si la fecha todavía no llega', () => {
    expect(senalesDe(negocio({ cierreEsperado: MANANA }), AHORA)).toEqual([]);
  });

  it('un negocio SIN fecha no queda marcado', () => {
    /// No tener fecha es otro problema --no se puede pronosticar--
    /// y mezclarlo aquí haría que la marca dijera dos cosas.
    expect(senalesDe(negocio({ cierreEsperado: null }), AHORA)).toEqual([]);
  });

  it.each([EtapaOportunidad.GANADO, EtapaOportunidad.PERDIDO])(
    'un negocio ya cerrado (%s) no se pudre',
    (etapa) => {
      expect(senalesDe(negocio({ etapa, cierreEsperado: AYER }), AHORA)).toEqual(
        [],
      );
    },
  );

  it('el borde exacto: vencer es haber pasado, no estar justo ahí', () => {
    /// Con `<=` un negocio que cierra HOY saldría marcado desde
    /// el primer milisegundo del día. Cierra hoy: todavía puede.
    expect(senalesDe(negocio({ cierreEsperado: AHORA }), AHORA)).toEqual([]);
  });
});

describe('bananeo', () => {
  it('se enciende al llegar al conteo de gestiones hechas', () => {
    const n = GESTIONES_PARA_BANANEO[TipoEmbudo.EMPRESA];
    expect(
      senalesDe(negocio({ gestionesHechasEnLaEtapa: n }), AHORA),
    ).toEqual(['BANANEO']);
  });

  it('no se enciende una gestión antes', () => {
    const n = GESTIONES_PARA_BANANEO[TipoEmbudo.EMPRESA];
    expect(
      senalesDe(negocio({ gestionesHechasEnLaEtapa: n - 1 }), AHORA),
    ).toEqual([]);
  });

  it('cuenta por embudo, que tienen su propio umbral', () => {
    const n = GESTIONES_PARA_BANANEO[TipoEmbudo.PERSONA];
    expect(
      senalesDe(
        negocio({
          embudo: TipoEmbudo.PERSONA,
          etapa: EtapaOportunidad.CALIFICADO,
          gestionesHechasEnLaEtapa: n,
        }),
        AHORA,
      ),
    ).toEqual(['BANANEO']);
  });

  it('un negocio cerrado no se banana por más gestiones que tenga', () => {
    expect(
      senalesDe(
        negocio({ etapa: EtapaOportunidad.GANADO, gestionesHechasEnLaEtapa: 99 }),
        AHORA,
      ),
    ).toEqual([]);
  });
});

describe('las dos a la vez', () => {
  it('un negocio puede estar muerto Y bananeado, y se dicen las dos', () => {
    /// Es el peor caso que hay: se le pasó la fecha y encima se le
    /// están dedicando gestiones. Esconder una lo haría parecer
    /// menos grave.
    expect(
      senalesDe(
        negocio({
          cierreEsperado: AYER,
          gestionesHechasEnLaEtapa: GESTIONES_PARA_BANANEO[TipoEmbudo.EMPRESA],
        }),
        AHORA,
      ),
    ).toEqual(['MUERTO_VIVIENTE', 'BANANEO']);
  });
});

describe('cómo se leen', () => {
  it('toda señal tiene rótulo y porqué, y ninguno viene vacío', () => {
    for (const s of ['MUERTO_VIVIENTE', 'BANANEO'] as const) {
      expect(rotuloDeSenal(s).trim()).not.toBe('');
      /// El porqué es lo que hace que la marca no se ignore: una
      /// etiqueta sin motivo no se la cree nadie.
      expect(porqueDeSenal(s).trim().length).toBeGreaterThan(20);
    }
  });
});
