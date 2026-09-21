/** Que parametrizar no cambie el comportamiento de quien no parametrizó. */

/**
 * ESTAS PRUEBAS CUIDAN LA PROMESA DEL CAMBIO, no el cambio.
 *
 * Mover el ANS, el bananeo y las probabilidades del código a la base
 * es útil si —y solo si— una instalación que nunca abra Configuración
 * sigue viendo exactamente lo de antes. Si eso se rompe, el tablero de
 * todo el mundo cambia de cifras un martes por la mañana sin que nadie
 * haya tocado nada, y ese es el peor fallo que puede tener una pantalla
 * con la que se juzga al equipo.
 *
 * Por eso cada caso prueba dos cosas: que SIN argumento manda el
 * código, y que CON argumento manda lo que se pasó.
 */

import { EtapaOportunidad, TipoEmbudo } from '../../generated/prisma';
import { COMPROMISO_EN_MINUTOS, compromisoEnPalabras, incumple } from '../oportunidades/ans';
import { PROBABILIDAD, probabilidadDe } from '../oportunidades/embudos';
import { GESTIONES_PARA_BANANEO, senalesDe } from '../oportunidades/senales';

const NEGOCIO = {
  embudo: TipoEmbudo.EMPRESA,
  etapa: EtapaOportunidad.CALIFICADO,
  cierreEsperado: null,
  enLaEtapaDesde: new Date('2026-09-01T08:00:00Z'),
  gestionesHechasEnLaEtapa: 0,
};

describe('el compromiso de respuesta', () => {
  it('sin parámetros usa el del código: cinco minutos en personas', () => {
    expect(COMPROMISO_EN_MINUTOS[TipoEmbudo.PERSONA]).toBe(5);
    expect(incumple(6, TipoEmbudo.PERSONA)).toBe(true);
    expect(incumple(5, TipoEmbudo.PERSONA)).toBe(false);
  });

  it('sin parámetros usa el del código: un día en empresas', () => {
    expect(incumple(60, TipoEmbudo.EMPRESA)).toBe(false);
    expect(incumple(1441, TipoEmbudo.EMPRESA)).toBe(true);
  });

  it('con el de Configuración manda ese', () => {
    const configurado = { [TipoEmbudo.PERSONA]: 15, [TipoEmbudo.EMPRESA]: 60 };
    expect(incumple(6, TipoEmbudo.PERSONA, configurado)).toBe(false);
    expect(incumple(16, TipoEmbudo.PERSONA, configurado)).toBe(true);
    expect(incumple(61, TipoEmbudo.EMPRESA, configurado)).toBe(true);
  });

  it('la frase también sale del parámetro, para que no se contradiga', () => {
    const configurado = { [TipoEmbudo.PERSONA]: 15, [TipoEmbudo.EMPRESA]: 120 };
    expect(compromisoEnPalabras(TipoEmbudo.PERSONA)).toBe('5 minutos');
    expect(compromisoEnPalabras(TipoEmbudo.PERSONA, configurado)).toBe('15 minutos');
    expect(compromisoEnPalabras(TipoEmbudo.EMPRESA, configurado)).toBe('2 horas');
  });
});

describe('el umbral de bananeo', () => {
  const ahora = new Date('2026-09-17T12:00:00Z');

  it('sin parámetros son tres gestiones, como estaba', () => {
    expect(GESTIONES_PARA_BANANEO[TipoEmbudo.EMPRESA]).toBe(3);
    expect(
      senalesDe({ ...NEGOCIO, gestionesHechasEnLaEtapa: 2 }, ahora),
    ).not.toContain('BANANEO');
    expect(senalesDe({ ...NEGOCIO, gestionesHechasEnLaEtapa: 3 }, ahora)).toContain(
      'BANANEO',
    );
  });

  it('con el de Configuración manda ese', () => {
    const configurado = { [TipoEmbudo.PERSONA]: 2, [TipoEmbudo.EMPRESA]: 5 };
    expect(
      senalesDe({ ...NEGOCIO, gestionesHechasEnLaEtapa: 3 }, ahora, configurado),
    ).not.toContain('BANANEO');
    expect(
      senalesDe({ ...NEGOCIO, gestionesHechasEnLaEtapa: 5 }, ahora, configurado),
    ).toContain('BANANEO');
  });

  it('subir el umbral no apaga la otra señal: son independientes', () => {
    const vencido = {
      ...NEGOCIO,
      cierreEsperado: new Date('2026-09-10T00:00:00Z'),
      gestionesHechasEnLaEtapa: 1,
    };
    const configurado = { [TipoEmbudo.PERSONA]: 50, [TipoEmbudo.EMPRESA]: 50 };
    expect(senalesDe(vencido, ahora, configurado)).toEqual(['MUERTO_VIVIENTE']);
  });
});

describe('la probabilidad de cada etapa', () => {
  it('sin tabla usa la estimada del código', () => {
    expect(probabilidadDe(TipoEmbudo.EMPRESA, EtapaOportunidad.PROPUESTA_ENVIADA)).toBe(
      PROBABILIDAD[TipoEmbudo.EMPRESA][EtapaOportunidad.PROPUESTA_ENVIADA],
    );
  });

  it('con la de Configuración manda esa', () => {
    const tabla = {
      [TipoEmbudo.EMPRESA]: {
        ...PROBABILIDAD[TipoEmbudo.EMPRESA],
        [EtapaOportunidad.PROPUESTA_ENVIADA]: 65,
      },
      [TipoEmbudo.PERSONA]: { ...PROBABILIDAD[TipoEmbudo.PERSONA] },
    };
    expect(
      probabilidadDe(TipoEmbudo.EMPRESA, EtapaOportunidad.PROPUESTA_ENVIADA, tabla),
    ).toBe(65);
    /// Y no toca las demás: se cambia una etapa, no el embudo.
    expect(probabilidadDe(TipoEmbudo.EMPRESA, EtapaOportunidad.GANADO, tabla)).toBe(100);
  });
});
