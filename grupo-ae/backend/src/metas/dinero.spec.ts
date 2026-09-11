import { Prisma } from '../../generated/prisma';
import { aPesos, revisarValor, TOPE_DE_META } from './dinero';

describe('el dinero de las metas', () => {
  it('un Decimal de la base sale en pesos enteros', () => {
    expect(aPesos(new Prisma.Decimal('12000000.00'))).toBe(12_000_000);
    expect(aPesos(new Prisma.Decimal('1234.56'))).toBe(1235);
    expect(aPesos(new Prisma.Decimal('0'))).toBe(0);
  });

  it('un número también, para no tener dos caminos', () => {
    expect(aPesos(1234.4)).toBe(1234);
  });

  /// Redondear fila por fila y sumar enteros es lo que hace que el
  /// total cuadre con la suma de las filas que el panel enseña.
  it('la suma de las filas redondeadas es el total que se enseña', () => {
    const filas = ['100.4', '100.4', '100.4'].map((v) => new Prisma.Decimal(v));
    const total = filas.reduce((s, f) => s + aPesos(f), 0);
    expect(total).toBe(300);
  });

  describe('qué valor se admite como meta', () => {
    it('cero sí: «este mes no tiene que vender» es una decisión', () => {
      expect(revisarValor(0)).toBeNull();
    });

    it('negativo no, y el reparo dice qué hacer en su lugar', () => {
      const reparo = revisarValor(-1);
      expect(reparo).toContain('no puede ser negativa');
      expect(reparo).toContain('póngale cero');
    });

    it('con centavos tampoco: la meta se fija en pesos', () => {
      expect(revisarValor(1_000_000.5)).toContain('pesos enteros');
    });

    it('un cero de más se atrapa antes de que arruine el mes', () => {
      expect(revisarValor(TOPE_DE_META + 1)).toContain('sobra un cero');
      expect(revisarValor(TOPE_DE_META)).toBeNull();
    });

    it('lo que no es número no es meta', () => {
      expect(revisarValor(Number.NaN)).not.toBeNull();
      expect(revisarValor(Number.POSITIVE_INFINITY)).not.toBeNull();
    });

    it('una meta normal no tiene reparos', () => {
      expect(revisarValor(60_000_000)).toBeNull();
    });
  });
});
