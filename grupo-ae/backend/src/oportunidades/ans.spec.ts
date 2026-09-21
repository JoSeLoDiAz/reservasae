import { TipoEmbudo } from '../../generated/prisma';
import { COMPROMISO_EN_MINUTOS, compromisoEnPalabras, incumple } from './ans';

describe('el compromiso de primera respuesta', () => {
  it('no es el mismo en los dos embudos', () => {
    /// Si alguien los iguala, esta prueba lo cuenta: el fallo que
    /// esto vino a arreglar era exactamente contar los dos con el
    /// mismo número.
    expect(COMPROMISO_EN_MINUTOS[TipoEmbudo.PERSONA]).not.toBe(
      COMPROMISO_EN_MINUTOS[TipoEmbudo.EMPRESA],
    );
  });

  it('a una persona se le contesta antes que a una empresa', () => {
    expect(COMPROMISO_EN_MINUTOS[TipoEmbudo.PERSONA]).toBeLessThan(
      COMPROMISO_EN_MINUTOS[TipoEmbudo.EMPRESA],
    );
  });
});

describe('cuándo se incumple', () => {
  it('justo en el límite NO se incumple: contestar en cinco minutos es cumplir', () => {
    expect(incumple(5, TipoEmbudo.PERSONA)).toBe(false);
    expect(incumple(24 * 60, TipoEmbudo.EMPRESA)).toBe(false);
  });

  it('un minuto después sí', () => {
    expect(incumple(6, TipoEmbudo.PERSONA)).toBe(true);
    expect(incumple(24 * 60 + 1, TipoEmbudo.EMPRESA)).toBe(true);
  });

  it('EL FALLO QUE ARREGLA: seis minutos no incumplen en empresas', () => {
    /// La portada contaba `>= 5` para los dos embudos, así que
    /// esto salía como incumplido. Son veinticuatro horas.
    expect(incumple(6, TipoEmbudo.EMPRESA)).toBe(false);
    /// Y en personas sí, que es lo que hacía parecer que la regla
    /// estaba bien.
    expect(incumple(6, TipoEmbudo.PERSONA)).toBe(true);
  });

  it('una espera de cero minutos nunca incumple', () => {
    for (const embudo of Object.values(TipoEmbudo)) {
      expect(incumple(0, embudo)).toBe(false);
    }
  });
});

describe('cómo se dice', () => {
  it('lo dice en minutos o en días, según cuánto sea', () => {
    expect(compromisoEnPalabras(TipoEmbudo.PERSONA)).toBe('5 minutos');
    expect(compromisoEnPalabras(TipoEmbudo.EMPRESA)).toBe('un día');
  });

  it('cada embudo tiene su frase y ninguna viene vacía', () => {
    for (const embudo of Object.values(TipoEmbudo)) {
      expect(compromisoEnPalabras(embudo).trim()).not.toBe('');
    }
  });
});
