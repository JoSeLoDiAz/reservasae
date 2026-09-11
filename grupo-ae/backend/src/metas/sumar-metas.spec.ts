import { TipoEmbudo } from '../../generated/prisma';
import { sumarMetas, type MetaQueSuma } from './sumar-metas';

const MILLON = 1_000_000;

const meta = (
  convenioId: string,
  embudo: TipoEmbudo | null,
  valor: number,
): MetaQueSuma => ({ convenioId, embudo, valor });

describe('lo que suman unas metas', () => {
  it('sin metas, cero: no es un vacío, es que no hay nada que alcanzar', () => {
    expect(sumarMetas([])).toBe(0);
  });

  it('las de embudo de un mismo convenio se suman entre sí', () => {
    const total = sumarMetas([
      meta('britcham', TipoEmbudo.EMPRESA, 40 * MILLON),
      meta('britcham', TipoEmbudo.PERSONA, 20 * MILLON),
    ]);
    expect(total).toBe(60 * MILLON);
  });

  /**
   * El caso que justifica el módulo.
   *
   * Con una general de 60 y una de empresa de 40, sumar las dos
   * daría 100: el asesor aparecería debiendo el doble de lo que le
   * pusieron, y el porcentaje del panel sería la mitad del real sin
   * que nadie encontrara de dónde sale.
   */
  it('la general manda sobre las de embudo, no se suma con ellas', () => {
    const total = sumarMetas([
      meta('britcham', null, 60 * MILLON),
      meta('britcham', TipoEmbudo.EMPRESA, 40 * MILLON),
    ]);
    expect(total).toBe(60 * MILLON);
  });

  it('entre convenios sí se suma: quien lleva los dos responde por los dos', () => {
    const total = sumarMetas([
      meta('britcham', null, 60 * MILLON),
      meta('adecopria', null, 25 * MILLON),
    ]);
    expect(total).toBe(85 * MILLON);
  });

  /// La regla se aplica convenio por convenio: que en uno haya
  /// general no puede tapar las de embudo del otro.
  it('la general de un convenio no anula las de embudo del otro', () => {
    const total = sumarMetas([
      meta('britcham', null, 60 * MILLON),
      meta('britcham', TipoEmbudo.EMPRESA, 40 * MILLON),
      meta('adecopria', TipoEmbudo.EMPRESA, 10 * MILLON),
      meta('adecopria', TipoEmbudo.PERSONA, 5 * MILLON),
    ]);
    expect(total).toBe(75 * MILLON);
  });

  it('una meta en cero suma cero y no estorba', () => {
    expect(sumarMetas([meta('britcham', null, 0)])).toBe(0);
  });
});
